/**
 * Code editor on a sketched sheet, themed with the logo colors.
 */

// --- IMPORTS ---
import { Scribble } from '../../components/scribble/scribble.tsx';
import { SketchFrame } from '../../components/sketch-frame/sketch-frame.tsx';
import styles from './code-editor.module.css';
import { useLanguageServer } from './lsp/use-language-server.ts';
import './monaco-setup.ts';
import { Editor } from '@monaco-editor/react';
import type { BeforeMount } from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import type * as MonacoApi from 'monaco-editor/editor/editor.api';
import { useState } from 'react';

// --- GLOBALS ---
const THEME = 'code-royale';

// paper, ink and the logo colors
const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8a847c', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c62f32', fontStyle: 'bold' },
      { token: 'string', foreground: '2e8b57' },
      { token: 'number', foreground: 'd4870f' },
      { token: 'type', foreground: '7a4fc9' },
    ],
    colors: {
      'editor.background': '#fffdf6',
      'editor.foreground': '#1a1a1a',
      'editor.lineHighlightBackground': '#fff3c7',
      'editorLineNumber.foreground': '#b8b1a6',
      'editorLineNumber.activeForeground': '#1a1a1a',
      'editorCursor.foreground': '#e5383b',
      'editor.selectionBackground': '#ffd54a80',
    },
  });
};

// --- CODE ---
/**
 * Props of the code editor.
 */
export interface CodeEditorProps {
  // a catalog id, which is also the editor's language id
  language: string;
  value: string;
  readOnly?: boolean;
  // faded, to show it is locked; defaults to readOnly
  dimmed?: boolean;
  onChange: (value: string) => void;
  // a ticket to the lsp service, for completions; none without it
  requestTicket?: (language: string) => Promise<string>;
}

/**
 * The mounted editor and its api.
 */
interface Mounted {
  editor: MonacoApi.editor.IStandaloneCodeEditor;
  monaco: typeof MonacoApi;
}

/**
 * Render the code editor.
 *
 * @param {CodeEditorProps} props The code, its language and the handler.
 *
 * @returns {JSX.Element} The editor.
 */
export function CodeEditor({
  language,
  value,
  readOnly = false,
  dimmed = readOnly,
  onChange,
  requestTicket,
}: CodeEditorProps) {

  const [mounted, setMounted] = useState<Mounted | null>(null);

  useLanguageServer({
    editor: mounted?.editor ?? null,
    monaco: mounted?.monaco ?? null,
    language,
    enabled: !readOnly && requestTicket !== undefined,
    requestTicket: requestTicket ?? noTicket,
  });

  /**
   * Keep the editor once mounted, and fix its letters once the font loads.
   *
   * @param {Parameters<OnMount>[0]} editor The editor.
   * @param {Parameters<OnMount>[1]} monaco Its api.
   *
   * @returns {void}
   */
  const handleMount: OnMount = (editor, monaco) => {

    // the bundled api: see monaco-setup.ts
    setMounted({ editor, monaco: monaco as unknown as typeof MonacoApi });

    // the web font may land after the editor measured its letters
    void document.fonts.ready.then(() => monaco.editor.remeasureFonts());
  };

  return (
    <div className={styles.sheet} data-dimmed={dimmed}>
      <SketchFrame fill="var(--paper-light)" shadow={5} />
      <div className={styles.editor}>
        <Editor
          height="100%"
          language={language}
          value={value}
          theme={THEME}
          beforeMount={defineTheme}
          onMount={handleMount}
          onChange={(next) => onChange(next ?? '')}
          loading={<Scribble label="Opening the editor..." />}
          options={{
            readOnly,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 15,
            lineHeight: 22,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: 4,
            renderLineHighlight: 'line',
            padding: { top: 12, bottom: 12 },
            automaticLayout: true,
            contextmenu: false,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Stand-in when there is no way to get a ticket: never called.
 *
 * @returns {Promise<string>} Never resolves to anything useful.
 */
function noTicket(): Promise<string> {
  return Promise.reject(new Error('no ticket'));
}
