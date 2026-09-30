/**
 * Submission types: what players get back when they run or submit code.
 */

// --- IMPORTS ---
import type { ExecutionStatus } from '../executor/executor.types.js';

// --- CODE ---
/**
 * How a program did on one test.
 */
export type TestStatus = ExecutionStatus | 'WRONG_ANSWER';

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
 * Outcome of the submission: how many passed, never which ones.
 */
export interface Verdict {
  status: 'ACCEPTED' | Exclude<TestStatus, 'OK'>;
  passed: number;
  total: number;
  percentage: number;
  compileError: string | null;
}
