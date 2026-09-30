/**
 * Minimal language server client over the lsp service's websocket.
 */

// --- IMPORTS ---
import type { Diagnostic } from './lsp.types.ts';
import type { Message } from './lsp.types.ts';
import type { ReadyParams } from './lsp.types.ts';
import type { ServerCapabilities } from './lsp.types.ts';

// --- GLOBALS ---
const READY_METHOD = 'codeRoyale/ready';

// long enough for jdtls and rust-analyzer to wake up
const INITIALIZE_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

// the service's close codes; refused, busy and round over are final
export const CLOSE_REFUSED = 4001;
export const CLOSE_BUSY = 4003;
export const CLOSE_IDLE = 4008;
export const CLOSE_ROUND_OVER = 4009;

// what the editor tells servers it understands
const CLIENT_CAPABILITIES = {
  textDocument: {
    synchronization: { dynamicRegistration: false },
    completion: {
      contextSupport: true,
      completionItem: {
        snippetSupport: true,
        labelDetailsSupport: true,
        documentationFormat: ['markdown', 'plaintext'],
        resolveSupport: { properties: ['documentation', 'detail'] },
      },
    },
    hover: { contentFormat: ['markdown', 'plaintext'] },
    signatureHelp: {
      signatureInformation: {
        documentationFormat: ['markdown', 'plaintext'],
        parameterInformation: { labelOffsetSupport: true },
      },
    },
    publishDiagnostics: {},
  },
  workspace: { configuration: true },
};

// --- CODE ---
/**
 * A request waiting for its answer.
 */
interface Pending {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: number;
}

/**
 * What the client tells whoever uses it.
 */
export interface LspClientEvents {
  diagnostics: (diagnostics: Diagnostic[]) => void;
  // the connection ended, with the websocket close code
  closed: (code: number) => void;
}

/**
 * One connection to one language server, editing one document.
 */
export class LspClient {
  private readonly events: LspClientEvents;
  private socket: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private version = 1;
  private ready: ReadyParams | null = null;
  private closed = false;

  /**
   * Create a client, not connected yet.
   *
   * @param {LspClientEvents} events What to call on diagnostics and close.
   */
  constructor(events: LspClientEvents) {
    this.events = events;
  }

  /**
   * Connect, initialize the server and open the document.
   *
   * @param {string} url The service's websocket url, ticket included.
   * @param {string} text The document's current text.
   *
   * @returns {Promise<ServerCapabilities>} What the server can do.
   *
   * @throws {Error} When the service refuses or the server never starts.
   */
  async connect(url: string, text: string): Promise<ServerCapabilities> {

    const ready = await this.open(url);

    const init = await this.request('initialize', {
      processId: null,
      clientInfo: { name: 'code-royale' },
      rootUri: ready.rootUri,
      capabilities: CLIENT_CAPABILITIES,
      initializationOptions: ready.initializationOptions,
    }, INITIALIZE_TIMEOUT_MS) as { capabilities: ServerCapabilities };

    this.notify('initialized', {});
    this.notify('textDocument/didOpen', {
      textDocument: {
        uri: ready.documentUri,
        languageId: ready.languageId,
        version: this.version,
        text,
      },
    });

    return init.capabilities ?? {};
  }

  /**
   * The document's uri, as the server knows it.
   *
   * @returns {string} The uri, empty until connected.
   */
  get documentUri(): string {
    return this.ready?.documentUri ?? '';
  }

  /**
   * Whether the connection is open.
   *
   * @returns {boolean} True while connected.
   */
  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN && this.ready !== null;
  }

  /**
   * Send the document's new text.
   *
   * @param {string} text The whole text.
   *
   * @returns {void}
   */
  change(text: string): void {

    if (!this.connected) {
      return;
    }

    // a change without a range replaces the whole document
    this.notify('textDocument/didChange', {
      textDocument: { uri: this.documentUri, version: ++this.version },
      contentChanges: [{ text }],
    });
  }

  /**
   * Send a request about the document and wait for its answer.
   *
   * @param {string} method The lsp method.
   * @param {unknown} params Its params.
   * @param {number} timeoutMs How long to wait.
   *
   * @returns {Promise<unknown>} The result.
   *
   * @throws {Error} When the server fails, times out or the socket closes.
   */
  request(
    method: string,
    params: unknown,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<unknown> {

    const id = this.nextId++;

    return new Promise((resolve, reject) => {

      // gave up: tell the server it may drop the work
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        this.notify('$/cancelRequest', { id });
        reject(new Error(`${method} timed out`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  /**
   * Close the connection; the service then stops the server.
   *
   * @returns {void}
   */
  close(): void {

    this.closed = true;
    this.socket?.close();
    this.failPending(new Error('closed'));
  }

  /**
   * Open the websocket and wait for the service's ready message.
   *
   * @param {string} url The websocket url.
   *
   * @returns {Promise<ReadyParams>} Where the program lives.
   */
  private open(url: string): Promise<ReadyParams> {

    return new Promise((resolve, reject) => {

      const socket = new WebSocket(url);
      this.socket = socket;

      socket.onmessage = (event) => {

        const message = JSON.parse(String(event.data)) as Message;

        // the service speaks first
        if (message.method === READY_METHOD) {
          this.ready = message.params as ReadyParams;
          resolve(this.ready);
          return;
        }

        this.handle(message);
      };

      socket.onclose = (event) => {
        this.failPending(new Error(`closed with ${event.code}`));
        reject(new Error(`closed with ${event.code}`));

        if (!this.closed) {
          this.events.closed(event.code);
        }
      };
    });
  }

  /**
   * Route a message from the server.
   *
   * @param {Message} message The message.
   *
   * @returns {void}
   */
  private handle(message: Message): void {

    // an answer to one of ours
    if (typeof message.id === 'number' && !message.method) {
      const pending = this.pending.get(message.id);

      if (!pending) {
        return;
      }

      this.pending.delete(message.id);
      window.clearTimeout(pending.timer);

      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }

      return;
    }

    // a request from the server: answer, or it may wait forever
    if (message.id !== undefined && message.method) {
      this.answer(message);
      return;
    }

    if (message.method === 'textDocument/publishDiagnostics') {
      const params = message.params as {
        uri: string;
        diagnostics: Diagnostic[];
      };

      if (params.uri === this.documentUri) {
        this.events.diagnostics(params.diagnostics);
      }
    }
  }

  /**
   * Answer the requests servers send to clients.
   *
   * @param {Message} message The server's request.
   *
   * @returns {void}
   */
  private answer(message: Message): void {

    switch (message.method) {

      // no settings: every server falls back to its defaults
      case 'workspace/configuration': {
        const items = (message.params as { items?: unknown[] }).items ?? [];
        const result = items.map(() => null);

        this.send({ jsonrpc: '2.0', id: message.id, result });
        return;
      }

      // progress reports and capability registrations: accepted, ignored
      case 'window/workDoneProgress/create':
      case 'client/registerCapability':
      case 'client/unregisterCapability':
        this.send({ jsonrpc: '2.0', id: message.id, result: null });
        return;

      default:
        this.send({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32601, message: 'Method not found' },
        });
    }
  }

  /**
   * Send a notification.
   *
   * @param {string} method The lsp method.
   * @param {unknown} params Its params.
   *
   * @returns {void}
   */
  private notify(method: string, params: unknown): void {
    this.send({ jsonrpc: '2.0', method, params });
  }

  /**
   * Send a message, if the socket is open.
   *
   * @param {Message} message The message.
   *
   * @returns {void}
   */
  private send(message: Message): void {

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Fail every request still waiting.
   *
   * @param {Error} error Why.
   *
   * @returns {void}
   */
  private failPending(error: Error): void {

    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timer);
      pending.reject(error);
    }

    this.pending.clear();
  }
}
