/**
 * Give the editor a language server while the player types.
 */

// --- IMPORTS ---
import { config } from '../../../config.ts';
import { CLOSE_BUSY } from './lsp-client.ts';
import { CLOSE_REFUSED } from './lsp-client.ts';
import { CLOSE_ROUND_OVER } from './lsp-client.ts';
import { LspClient } from './lsp-client.ts';
import { registerLanguageFeatures } from './lsp-monaco.ts';
import { showDiagnostics } from './lsp-monaco.ts';
import type * as MonacoApi from 'monaco-editor/editor/editor.api';
import { useEffect } from 'react';

// --- GLOBALS ---
// wait at least this long before trying again after a drop
const RETRY_GAP_MS = 5000;

// --- CODE ---
/**
 * What the language server needs from the editor.
 */
export interface LanguageServerOptions {
  // null until the editor mounted
  editor: MonacoApi.editor.IStandaloneCodeEditor | null;
  monaco: typeof MonacoApi | null;
  language: string;
  // off once the code is locked: no server for a finished round
  enabled: boolean;
  // asks the backend for a ticket to the lsp service
  requestTicket: (language: string) => Promise<string>;
}

/**
 * Keep a language server connected; on failure, fall back silently.
 *
 * @param {LanguageServerOptions} options The editor and how to connect.
 *
 * @returns {void}
 */
export function useLanguageServer({
  editor,
  monaco,
  language,
  enabled,
  requestTicket,
}: LanguageServerOptions): void {

  useEffect(() => {

    const model = editor?.getModel();

    // turned off, not ready or not needed
    if (!config.lspUrl || !editor || !monaco || !model || !enabled) {
      return;
    }

    let disposed = false;
    let client: LspClient | null = null;
    let features: MonacoApi.IDisposable | null = null;
    let lastAttempt = 0;
    let gaveUp = false;

    /**
     * Drop the current connection and what it registered.
     *
     * @returns {void}
     */
    const teardown = (): void => {
      features?.dispose();
      features = null;
      client?.close();
      client = null;
      editor.updateOptions({ wordBasedSuggestions: 'currentDocument' });
    };

    /**
     * Connect a new client, unless one is already up.
     *
     * @returns {Promise<void>}
     */
    const start = async (): Promise<void> => {

      if (disposed || gaveUp || client) {
        return;
      }

      lastAttempt = Date.now();

      const current = new LspClient({
        diagnostics: (diagnostics) => {
          showDiagnostics(monaco, model, diagnostics);
        },

        // dropped: try again on the next edit, unless refused for good
        closed: (code) => {
          gaveUp = code === CLOSE_REFUSED || code === CLOSE_BUSY
            || code === CLOSE_ROUND_OVER;

          if (client === current) {
            teardown();
          }
        },
      });

      client = current;

      // connected: the server's words replace the editor's own
      try {
        const ticket = await requestTicket(language);
        const url = `${config.lspUrl}/ws?ticket=${encodeURIComponent(ticket)}`;
        const capabilities = await current.connect(url, model.getValue());

        if (disposed || client !== current) {
          current.close();
          return;
        }

        features = registerLanguageFeatures(
          monaco,
          model,
          current,
          capabilities,
        );

        editor.updateOptions({ wordBasedSuggestions: 'off' });

      // no server this time: the editor works without one
      } catch {
        if (client === current) {
          teardown();
        }
      }
    };

    // every edit reaches the server; after a drop, one edit reconnects
    const onChange = model.onDidChangeContent(() => {

      if (client?.connected) {
        client.change(model.getValue());
      } else if (!client && Date.now() - lastAttempt > RETRY_GAP_MS) {
        void start();
      }
    });

    void start();

    return () => {
      disposed = true;
      onChange.dispose();
      teardown();
    };
  }, [editor, monaco, language, enabled, requestTicket]);
}
