/**
 * Code execution contract: what to run and what came out.
 */

// --- CODE ---
/**
 * How a single run ended.
 */
export type ExecutionStatus =
  | 'OK'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT'
  | 'OUTPUT_LIMIT';

/**
 * A program to run once, with one input.
 */
export interface ExecutionRequest {
  language: string;
  code: string;
  stdin: string;
}

/**
 * What a single run produced.
 */
export interface ExecutionResult {
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
}

/**
 * Anything able to run untrusted code in a sandbox, e.g. Piston.
 */
export interface CodeExecutor {

  /**
   * Run a program once.
   *
   * @param {ExecutionRequest} request The program and its input.
   *
   * @returns {Promise<ExecutionResult>} How it ended and what it printed.
   *
   * @throws {ExecutorUnavailableError} When the sandbox cannot be reached.
   */
  run(request: ExecutionRequest): Promise<ExecutionResult>;
}
