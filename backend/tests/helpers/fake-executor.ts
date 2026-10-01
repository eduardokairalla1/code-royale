/**
 * A code executor that fakes a sandbox, for fast and deterministic tests.
 */

// --- IMPORTS ---
import {
  ExecutorUnavailableError,
} from '../../src/modules/executor/executor.errors.js';
import type {
  CodeExecutor,
} from '../../src/modules/executor/executor.types.js';
import type {
  ExecutionRequest,
} from '../../src/modules/executor/executor.types.js';
import type {
  ExecutionResult,
} from '../../src/modules/executor/executor.types.js';

// --- GLOBALS ---
// fake "programs": the code is a command, whatever the language
export const PROGRAMS = {
  // prints the sum of every integer in stdin: solves the fixtures
  sum: 'sum',
  // takes a while, then behaves like sum
  slowSum: 'slow-sum',
  compileError: 'compile-error',
  crash: 'crash',
  timeout: 'timeout',
  // the sandbox is down
  unavailable: 'unavailable',
} as const;

// how long slow-sum takes
const SLOW_MS = 300;

// --- CODE ---
/**
 * Runs the fake programs above; `print:<text>` prints the text as is.
 */
export class FakeExecutor implements CodeExecutor {

  // every request received, in order
  readonly requests: ExecutionRequest[] = [];

  // a sandbox that stopped answering, like one whose instance died
  private stalled = false;

  /**
   * Never answer again, whatever the program.
   *
   * @returns {void}
   */
  stall(): void {
    this.stalled = true;
  }

  /**
   * Run a fake program once.
   *
   * @param {ExecutionRequest} request The program and its input.
   *
   * @returns {Promise<ExecutionResult>} What the program produced.
   *
   * @throws {ExecutorUnavailableError} For the "unavailable" program.
   */
  async run(request: ExecutionRequest): Promise<ExecutionResult> {

    this.requests.push(request);

    if (this.stalled) {
      return new Promise(() => {});
    }

    const code = request.code.trim();

    // print:<text> prints the text, whatever the input
    if (code.startsWith('print:')) {
      return ok(code.slice('print:'.length));
    }

    switch (code) {
      case PROGRAMS.sum:
        return ok(String(sumOf(request.stdin)));

      case PROGRAMS.slowSum:
        await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
        return ok(String(sumOf(request.stdin)));

      case PROGRAMS.compileError:
        return { status: 'COMPILE_ERROR', stdout: '', stderr: 'syntax error' };

      case PROGRAMS.crash:
        return { status: 'RUNTIME_ERROR', stdout: '', stderr: 'boom' };

      case PROGRAMS.timeout:
        return { status: 'TIME_LIMIT', stdout: '', stderr: '' };

      case PROGRAMS.unavailable:
        throw new ExecutorUnavailableError({ fake: true });

      default:
        return ok('');
    }
  }
}

/**
 * Build a successful run.
 *
 * @param {string} line What the program printed, without the newline.
 *
 * @returns {ExecutionResult} An OK result ending in a newline.
 */
function ok(line: string): ExecutionResult {
  return { status: 'OK', stdout: `${line}\n`, stderr: '' };
}

/**
 * Add up every integer in a text.
 *
 * @param {string} text The input.
 *
 * @returns {number} The sum.
 */
function sumOf(text: string): number {
  return (text.match(/-?\d+/g) ?? []).map(Number).reduce((a, b) => a + b, 0);
}
