/**
 * The slice of the language server protocol the editor uses.
 */

// --- CODE ---
/**
 * A position in a document, both zero based.
 */
export interface Position {
  line: number;
  character: number;
}

/**
 * A span of a document, end exclusive.
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * Formatted text: markdown or plain.
 */
export interface MarkupContent {
  kind: 'markdown' | 'plaintext';
  value: string;
}

/**
 * Older hover content: a string or a code block.
 */
export type MarkedString = string | { language: string; value: string };

/**
 * A replacement of a span of the document.
 */
export interface TextEdit {
  range: Range;
  newText: string;
}

/**
 * A replacement that may insert or overwrite the word at the cursor.
 */
export interface InsertReplaceEdit {
  newText: string;
  insert: Range;
  replace: Range;
}

/**
 * One suggestion.
 */
export interface CompletionItem {
  label: string;
  labelDetails?: { detail?: string; description?: string };
  kind?: number;
  detail?: string;
  documentation?: string | MarkupContent;
  sortText?: string;
  filterText?: string;
  preselect?: boolean;
  insertText?: string;
  // 2 means insertText is a snippet
  insertTextFormat?: number;
  textEdit?: TextEdit | InsertReplaceEdit;
  additionalTextEdits?: TextEdit[];
  commitCharacters?: string[];
}

/**
 * What a completion request answers.
 */
export type CompletionResult =
  | CompletionItem[]
  | { isIncomplete: boolean; items: CompletionItem[] }
  | null;

/**
 * What a hover request answers.
 */
export interface Hover {
  contents: MarkupContent | MarkedString | MarkedString[];
  range?: Range;
}

/**
 * One parameter of a signature.
 */
export interface ParameterInformation {
  // the text, or its offsets inside the signature label
  label: string | [number, number];
  documentation?: string | MarkupContent;
}

/**
 * One way to call a function.
 */
export interface SignatureInformation {
  label: string;
  documentation?: string | MarkupContent;
  parameters?: ParameterInformation[];
  activeParameter?: number;
}

/**
 * What a signature help request answers.
 */
export interface SignatureHelp {
  signatures: SignatureInformation[];
  activeSignature?: number;
  activeParameter?: number;
}

/**
 * A problem the server found in the document.
 */
export interface Diagnostic {
  range: Range;
  // 1 error, 2 warning, 3 information, 4 hint
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
}

/**
 * What the server can do, as far as the editor cares.
 */
export interface ServerCapabilities {
  completionProvider?: {
    triggerCharacters?: string[];
    resolveProvider?: boolean;
  };
  hoverProvider?: boolean | object;
  signatureHelpProvider?: {
    triggerCharacters?: string[];
    retriggerCharacters?: string[];
  };
}

/**
 * The service's first message: where the program lives.
 */
export interface ReadyParams {
  rootUri: string;
  documentUri: string;
  languageId: string;
  initializationOptions?: unknown;
}

/**
 * Any json-rpc message.
 */
export interface Message {
  jsonrpc: '2.0';
  id?: number | string | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}
