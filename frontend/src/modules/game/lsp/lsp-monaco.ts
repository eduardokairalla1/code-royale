/**
 * Plug a language server's features into the editor.
 */

// --- IMPORTS ---
import type { LspClient } from './lsp-client.ts';
import type { CompletionItem } from './lsp.types.ts';
import type { CompletionResult } from './lsp.types.ts';
import type { Diagnostic } from './lsp.types.ts';
import type { Hover } from './lsp.types.ts';
import type { MarkedString } from './lsp.types.ts';
import type { MarkupContent } from './lsp.types.ts';
import type { Range } from './lsp.types.ts';
import type { ServerCapabilities } from './lsp.types.ts';
import type { SignatureHelp } from './lsp.types.ts';
import type { TextEdit } from './lsp.types.ts';
import type * as MonacoApi from 'monaco-editor/editor/editor.api';

// --- GLOBALS ---
const MARKER_OWNER = 'lsp';

// lsp completion kinds, 1 based, by the editor's kind names
const KIND_NAMES = [
  'Text', 'Method', 'Function', 'Constructor', 'Field', 'Variable', 'Class',
  'Interface', 'Module', 'Property', 'Unit', 'Value', 'Enum', 'Keyword',
  'Snippet', 'Color', 'File', 'Reference', 'Folder', 'EnumMember',
  'Constant', 'Struct', 'Event', 'Operator', 'TypeParameter',
] as const;

// --- CODE ---
/**
 * The editor api.
 */
type Monaco = typeof MonacoApi;

/**
 * An editor suggestion, still holding the server's item for resolving it.
 */
type Suggestion = MonacoApi.languages.CompletionItem & {
  lspItem: CompletionItem;
};

/**
 * Register the server's features for the editor's model.
 *
 * @param {Monaco} monaco The editor api.
 * @param {MonacoApi.editor.ITextModel} model The document's model.
 * @param {LspClient} client The connected client.
 * @param {ServerCapabilities} capabilities What the server can do.
 *
 * @returns {MonacoApi.IDisposable} Removes every provider again.
 */
export function registerLanguageFeatures(
  monaco: Monaco,
  model: MonacoApi.editor.ITextModel,
  client: LspClient,
  capabilities: ServerCapabilities,
): MonacoApi.IDisposable {

  const language = model.getLanguageId();
  const disposables: MonacoApi.IDisposable[] = [];

  // providers are per language: only answer for our model
  const ours = (candidate: MonacoApi.editor.ITextModel): boolean => {
    return candidate === model && client.connected;
  };

  const textDocument = { uri: client.documentUri };

  if (capabilities.completionProvider) {
    const resolvable = capabilities.completionProvider.resolveProvider;

    disposables.push(monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: capabilities.completionProvider.triggerCharacters,

      provideCompletionItems: async (candidate, position, context) => {

        if (!ours(candidate)) {
          return { suggestions: [] };
        }

        const result = await client.request('textDocument/completion', {
          textDocument,
          position: toPosition(position),
          context: {
            // the editor counts from 0, the protocol from 1
            triggerKind: context.triggerKind + 1,
            triggerCharacter: context.triggerCharacter,
          },
        }).catch(() => null) as CompletionResult;

        const items = Array.isArray(result) ? result : (result?.items ?? []);
        const word = candidate.getWordUntilPosition(position);
        const fallback = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          position.column,
        );

        return {
          incomplete: !Array.isArray(result) && Boolean(result?.isIncomplete),
          suggestions: items.map((item) => {
            return toSuggestion(monaco, item, fallback);
          }),
        };
      },

      resolveCompletionItem: async (suggestion) => {

        const current = suggestion as Suggestion;

        if (!resolvable || !client.connected) {
          return current;
        }

        const resolved = await client
          .request('completionItem/resolve', current.lspItem)
          .catch(() => null) as CompletionItem | null;

        if (!resolved) {
          return current;
        }

        return {
          ...current,
          detail: resolved.detail ?? current.detail,
          documentation: toDocumentation(resolved.documentation)
            ?? current.documentation,
          additionalTextEdits: resolved.additionalTextEdits
            ? resolved.additionalTextEdits.map(toEdit)
            : current.additionalTextEdits,
        };
      },
    }));
  }

  if (capabilities.hoverProvider) {
    disposables.push(monaco.languages.registerHoverProvider(language, {

      provideHover: async (candidate, position) => {

        if (!ours(candidate)) {
          return null;
        }

        const hover = await client.request('textDocument/hover', {
          textDocument,
          position: toPosition(position),
        }).catch(() => null) as Hover | null;

        if (!hover) {
          return null;
        }

        const contents = toMarkdownList(hover.contents);

        return contents.length === 0
          ? null
          : {
            contents,
            range: hover.range ? toRange(hover.range) : undefined,
          };
      },
    }));
  }

  if (capabilities.signatureHelpProvider) {
    const provider = capabilities.signatureHelpProvider;

    disposables.push(monaco.languages.registerSignatureHelpProvider(language, {
      signatureHelpTriggerCharacters: provider.triggerCharacters,
      signatureHelpRetriggerCharacters: provider.retriggerCharacters,

      provideSignatureHelp: async (candidate, position) => {

        if (!ours(candidate)) {
          return null;
        }

        const help = await client.request('textDocument/signatureHelp', {
          textDocument,
          position: toPosition(position),
        }).catch(() => null) as SignatureHelp | null;

        if (!help || help.signatures.length === 0) {
          return null;
        }

        return {
          value: {
            activeSignature: help.activeSignature ?? 0,
            activeParameter: help.activeParameter ?? 0,
            signatures: help.signatures.map((signature) => ({
              label: signature.label,
              documentation: toDocumentation(signature.documentation),
              activeParameter: signature.activeParameter,
              parameters: (signature.parameters ?? []).map((parameter) => ({
                label: parameter.label,
                documentation: toDocumentation(parameter.documentation),
              })),
            })),
          },
          dispose: () => {},
        };
      },
    }));
  }

  return {
    dispose: () => {
      disposables.forEach((disposable) => disposable.dispose());
      monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
    },
  };
}

/**
 * Show a server's diagnostics as squiggles in the model.
 *
 * @param {Monaco} monaco The editor api.
 * @param {MonacoApi.editor.ITextModel} model The document's model.
 * @param {Diagnostic[]} diagnostics What the server found.
 *
 * @returns {void}
 */
export function showDiagnostics(
  monaco: Monaco,
  model: MonacoApi.editor.ITextModel,
  diagnostics: Diagnostic[],
): void {

  // lsp 1 error .. 4 hint, to the editor's severities
  const severities = [
    monaco.MarkerSeverity.Error,
    monaco.MarkerSeverity.Warning,
    monaco.MarkerSeverity.Info,
    monaco.MarkerSeverity.Hint,
  ];

  monaco.editor.setModelMarkers(model, MARKER_OWNER, diagnostics.map((item) => {
    return {
      ...toRange(item.range),
      severity: severities[(item.severity ?? 1) - 1]
        ?? monaco.MarkerSeverity.Error,
      message: item.message,
      source: item.source,
      code: item.code === undefined ? undefined : String(item.code),
    };
  }));
}

/**
 * Turn a server suggestion into an editor one.
 *
 * @param {Monaco} monaco The editor api.
 * @param {CompletionItem} item The server's suggestion.
 * @param {MonacoApi.IRange} fallback The word at the cursor.
 *
 * @returns {Suggestion} The editor's suggestion.
 */
function toSuggestion(
  monaco: Monaco,
  item: CompletionItem,
  fallback: MonacoApi.IRange,
): Suggestion {

  const edit = item.textEdit;

  // the server says where the text goes, or it replaces the word typed
  const range = !edit
    ? fallback
    : 'range' in edit
      ? toRange(edit.range)
      : { insert: toRange(edit.insert), replace: toRange(edit.replace) };

  const kindName = KIND_NAMES[(item.kind ?? 1) - 1] ?? 'Text';

  return {
    label: item.labelDetails
      ? {
        label: item.label,
        detail: item.labelDetails.detail,
        description: item.labelDetails.description,
      }
      : item.label,
    kind: monaco.languages.CompletionItemKind[kindName],
    detail: item.detail,
    documentation: toDocumentation(item.documentation),
    sortText: item.sortText,
    filterText: item.filterText,
    preselect: item.preselect,
    insertText: edit?.newText ?? item.insertText ?? item.label,
    insertTextRules: item.insertTextFormat === 2
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      : undefined,
    range,
    additionalTextEdits: item.additionalTextEdits?.map(toEdit),
    commitCharacters: item.commitCharacters,
    lspItem: item,
  };
}

/**
 * Turn a zero based position into the editor's one based one.
 *
 * @param {MonacoApi.IPosition} position The editor's position.
 *
 * @returns {{ line: number, character: number }} The protocol's position.
 */
function toPosition(
  position: MonacoApi.IPosition,
): { line: number; character: number } {
  return { line: position.lineNumber - 1, character: position.column - 1 };
}

/**
 * Turn a protocol range into an editor range.
 *
 * @param {Range} range The protocol's range.
 *
 * @returns {MonacoApi.IRange} The editor's range.
 */
function toRange(range: Range): MonacoApi.IRange {

  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

/**
 * Turn a protocol edit into an editor edit.
 *
 * @param {TextEdit} edit The protocol's edit.
 *
 * @returns {MonacoApi.editor.ISingleEditOperation} The editor's edit.
 */
function toEdit(edit: TextEdit): MonacoApi.editor.ISingleEditOperation {
  return { range: toRange(edit.range), text: edit.newText };
}

/**
 * Turn documentation into what the editor shows.
 *
 * @param {string | MarkupContent | undefined} value The documentation.
 *
 * @returns {string | MonacoApi.IMarkdownString | undefined} The editor's.
 */
function toDocumentation(
  value: string | MarkupContent | undefined,
): string | MonacoApi.IMarkdownString | undefined {

  if (value === undefined || typeof value === 'string') {
    return value;
  }

  return value.kind === 'markdown' ? { value: value.value } : value.value;
}

/**
 * Turn hover contents, in any of their protocol shapes, into markdown.
 *
 * @param {Hover['contents']} contents The hover's contents.
 *
 * @returns {MonacoApi.IMarkdownString[]} One entry per block, none empty.
 */
function toMarkdownList(
  contents: Hover['contents'],
): MonacoApi.IMarkdownString[] {

  const blocks: (MarkupContent | MarkedString)[] = Array.isArray(contents)
    ? contents
    : [contents];

  return blocks
    .map((block) => {

      // plain string: already markdown
      if (typeof block === 'string') {
        return block;
      }

      // markup content: plain text is escaped by showing it as code
      if ('kind' in block) {
        return block.kind === 'markdown'
          ? block.value
          : `\`\`\`\n${block.value}\n\`\`\``;
      }

      return `\`\`\`${block.language}\n${block.value}\n\`\`\``;
    })
    .filter((value) => value.trim() !== '')
    .map((value) => ({ value }));
}
