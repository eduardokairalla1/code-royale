/**
 * Language server client against a fake websocket.
 */

// --- IMPORTS ---
import { LspClient } from '../../src/modules/game/lsp/lsp-client.ts';
import type { Message } from '../../src/modules/game/lsp/lsp.types.ts';
import { afterEach } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { vi } from 'vitest';

// --- GLOBALS ---
const READY = {
  jsonrpc: '2.0',
  method: 'codeRoyale/ready',
  params: {
    rootUri: 'file:///workspace',
    documentUri: 'file:///workspace/main.py',
    languageId: 'python',
  },
};

// --- CODE ---
/**
 * A websocket that records what is sent and lets tests play the server.
 */
class FakeSocket {
  static readonly OPEN = 1;

  // every socket the client opened, newest last
  static readonly opened: FakeSocket[] = [];

  readonly url: string;
  readonly sent: Message[] = [];
  readyState = FakeSocket.OPEN;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  /**
   * Open the fake socket, as the client does.
   *
   * @param {string} url The url, kept for the assertions.
   */
  constructor(url: string) {
    this.url = url;
    FakeSocket.opened.push(this);
  }

  /**
   * Record a message the client sends.
   *
   * @param {string} data The json.
   *
   * @returns {void}
   */
  send(data: string): void {
    this.sent.push(JSON.parse(data) as Message);
  }

  /**
   * Close, as the service would.
   *
   * @param {number} code The close code.
   *
   * @returns {void}
   */
  close(code = 1000): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }

  /**
   * Deliver a message from the server.
   *
   * @param {object} message The message.
   *
   * @returns {void}
   */
  receive(message: object): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  /**
   * The last message sent with a method.
   *
   * @param {string} method The method.
   *
   * @returns {Message | undefined} The message.
   */
  lastSent(method: string): Message | undefined {
    return this.sent.filter((message) => message.method === method).at(-1);
  }
}

/**
 * The socket the client opened last.
 *
 * @returns {FakeSocket} The lastSocket().
 */
function lastSocket(): FakeSocket {
  return FakeSocket.opened.at(-1) as FakeSocket;
}

/**
 * Wait for queued promise callbacks to run.
 *
 * @returns {Promise<void>}
 */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Connect a client through the whole handshake.
 *
 * @param {object} events The client's callbacks.
 *
 * @returns {Promise<LspClient>} The connected client.
 */
async function connected(events = {
  diagnostics: vi.fn(),
  closed: vi.fn(),
}): Promise<LspClient> {

  const client = new LspClient(events);
  const connecting = client.connect('ws://lsp/ws?ticket=t', 'print(1)');

  lastSocket().receive(READY);
  await flush();

  const initialize = lastSocket().lastSent('initialize');

  lastSocket().receive({
    jsonrpc: '2.0',
    id: initialize?.id,
    result: { capabilities: { hoverProvider: true } },
  });

  await connecting;

  return client;
}

describe('LspClient', () => {

  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('window', globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes the server and opens the document', async () => {
    const client = await connected();

    expect(lastSocket().lastSent('initialize')?.params).toMatchObject({
      rootUri: 'file:///workspace',
    });
    expect(lastSocket().lastSent('initialized')).toBeDefined();
    const open = lastSocket().lastSent('textDocument/didOpen');

    expect(open?.params).toMatchObject({
      textDocument: {
        uri: 'file:///workspace/main.py',
        languageId: 'python',
        text: 'print(1)',
      },
    });
    expect(client.connected).toBe(true);
  });

  it('sends the whole text on every change, with a new version', async () => {
    const client = await connected();

    client.change('print(2)');
    client.change('print(3)');

    const change = lastSocket().lastSent('textDocument/didChange');

    expect(change?.params).toEqual({
      textDocument: { uri: 'file:///workspace/main.py', version: 3 },
      contentChanges: [{ text: 'print(3)' }],
    });
  });

  it('answers what servers ask, so they never wait', async () => {
    await connected();

    lastSocket().receive({
      jsonrpc: '2.0',
      id: 'c1',
      method: 'workspace/configuration',
      params: { items: [{}, {}] },
    });
    lastSocket().receive({
      jsonrpc: '2.0',
      id: 'c2',
      method: 'something/else',
    });

    const answers = lastSocket().sent.filter((message) => {
      return typeof message.id === 'string';
    });

    expect(answers[0]).toMatchObject({ id: 'c1', result: [null, null] });
    expect(answers[1]).toMatchObject({ id: 'c2', error: { code: -32601 } });
  });

  it('passes on the diagnostics of its own document only', async () => {
    const events = { diagnostics: vi.fn(), closed: vi.fn() };

    await connected(events);

    const diagnostic = {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 5 },
      },
      message: 'boom',
    };

    lastSocket().receive({
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params: {
        uri: 'file:///workspace/other.py',
        diagnostics: [diagnostic],
      },
    });
    lastSocket().receive({
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params: {
        uri: 'file:///workspace/main.py',
        diagnostics: [diagnostic],
      },
    });

    expect(events.diagnostics).toHaveBeenCalledTimes(1);
    expect(events.diagnostics).toHaveBeenCalledWith([diagnostic]);
  });

  it('fails pending requests and reports when the service closes', async () => {
    const events = { diagnostics: vi.fn(), closed: vi.fn() };
    const client = await connected(events);

    const hover = client.request('textDocument/hover', {});

    lastSocket().close(4008);

    await expect(hover).rejects.toThrow('closed with 4008');
    expect(events.closed).toHaveBeenCalledWith(4008);
  });

  it('does not report a close it asked for', async () => {
    const events = { diagnostics: vi.fn(), closed: vi.fn() };
    const client = await connected(events);

    client.close();

    expect(events.closed).not.toHaveBeenCalled();
  });
});
