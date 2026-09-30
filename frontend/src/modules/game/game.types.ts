/**
 * What the backend answers when a player runs or submits code.
 */

// --- CODE ---
/**
 * How a program did on one test.
 */
export type TestStatus =
  | 'OK'
  | 'WRONG_ANSWER'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT'
  | 'OUTPUT_LIMIT';

/**
 * Outcome of running the code against one public example.
 */
export interface ExampleResult {
  input: string;
  expectedOutput: string;
  stdout: string;
  stderr: string;
  status: TestStatus;
  passed: boolean;
}

/**
 * Outcome of the one submission against the hidden tests.
 */
export interface Verdict {
  // accepted when every test passed, else the first failure's status
  status: 'ACCEPTED' | Exclude<TestStatus, 'OK'>;
  passed: number;
  total: number;
  percentage: number;
  compileError: string | null;
}

/**
 * The code in the editor, as sent to the backend.
 */
export interface Draft {
  language: string;
  code: string;
}
