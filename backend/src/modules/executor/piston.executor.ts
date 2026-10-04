/**
 * Code executor backed by a self-hosted Piston.
 */

// --- IMPORTS ---
import { ExecutorUnavailableError } from './executor.errors.js';
import { UnsupportedRuntimeError } from './executor.errors.js';
import type { CodeExecutor } from './executor.types.js';
import type { ExecutionRequest } from './executor.types.js';
import type { ExecutionResult } from './executor.types.js';
import type { ExecutionStatus } from './executor.types.js';

// --- GLOBALS ---
// catalog language id -> piston runtime; "*" takes the installed version
const PISTON_RUNTIMES: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  go: 'go',
  java: 'java',
  c: 'c',
  cpp: 'c++',
  rust: 'rust',
};

// --- CODE ---
/**
 * One stage (compile or run) of a piston response.
 */
interface PistonStage {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
  status: string | null;
}

/**
 * The body piston answers to POST /api/v2/execute.
 */
interface PistonResponse {
  compile?: PistonStage;
  run: PistonStage;
}

/**
 * Runs code through the piston http api.
 */
export class PistonExecutor implements CodeExecutor {

  // when piston began failing, to log how long it has been down
  private failingSince: number | null = null;

  /**
   * Create the executor.
   *
   * @param {string} baseUrl Where piston listens, e.g. "http://piston:2000".
   * @param {number} timeoutMs How long to wait for piston's answer; piston
   *                           queues runs and compiles on every request.
   */
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  /**
   * Run a program once.
   *
   * @param {ExecutionRequest} request The program and its input.
   *
   * @returns {Promise<ExecutionResult>} How it ended and what it printed.
   *
   * @throws {ExecutorUnavailableError} When piston cannot be reached.
   */
  async run(request: ExecutionRequest): Promise<ExecutionResult> {

    const runtime = PISTON_RUNTIMES[request.language];

    // the catalog and this map drifted apart: a bug, not a player error
    if (!runtime) {
      throw new UnsupportedRuntimeError({ language: request.language });
    }

    let response: Response;

    // down or too slow: the game cannot judge anything
    try {
      response = await fetch(new URL('/api/v2/execute', this.baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: runtime,
          version: '*',
          files: [{ content: request.code }],
          stdin: request.stdin,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw this.unavailable({
        cause: String(error),
        timed_out: error instanceof Error && error.name === 'TimeoutError',
      });
    }

    // piston refused the request itself, e.g. a runtime that is not installed
    if (!response.ok) {
      throw this.unavailable({
        status: response.status,
        body: await response.text(),
      });
    }

    this.failingSince = null;

    return toExecutionResult((await response.json()) as PistonResponse);
  }

  /**
   * Build the error for a failed call, saying where and for how long.
   *
   * @param {Record<string, unknown>} details What went wrong.
   *
   * @returns {ExecutorUnavailableError} The error to throw.
   */
  private unavailable(
    details: Record<string, unknown>,
  ): ExecutorUnavailableError {

    this.failingSince ??= Date.now();

    return new ExecutorUnavailableError({
      ...details,
      // origin only: no credentials a url may carry
      piston: new URL(this.baseUrl).origin,
      timeout_ms: this.timeoutMs,
      failing_for_ms: Date.now() - this.failingSince,
    });
  }
}

/**
 * Translate a piston response into the game's result.
 *
 * @param {PistonResponse} response What piston answered.
 *
 * @returns {ExecutionResult} The status and outputs.
 */
function toExecutionResult(response: PistonResponse): ExecutionResult {

  const { compile, run } = response;

  // did not compile: the program never ran
  if (compile && compile.code !== 0) {
    return {
      status: 'COMPILE_ERROR',
      stdout: '',
      stderr: compile.stderr || compile.stdout,
    };
  }

  return {
    status: toStatus(run),
    stdout: run.stdout,
    stderr: run.stderr,
  };
}

/**
 * Map a piston run stage to the game's status.
 *
 * @param {PistonStage} run The run stage.
 *
 * @returns {ExecutionStatus} How the run ended.
 */
function toStatus(run: PistonStage): ExecutionStatus {

  // wall clock or cpu time exceeded
  if (run.status === 'TO') {
    return 'TIME_LIMIT';
  }

  // stdout or stderr went past the cap
  if (run.status === 'OL' || run.status === 'EL') {
    return 'OUTPUT_LIMIT';
  }

  // crashed, killed or exited non-zero
  if (run.status !== null || run.code !== 0) {
    return 'RUNTIME_ERROR';
  }

  return 'OK';
}
