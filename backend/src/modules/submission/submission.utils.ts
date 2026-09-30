/**
 * Submission helpers: compare outputs and summarize test runs.
 */

// --- IMPORTS ---
import type { ExecutionResult } from '../executor/executor.types.js';
import type { TestStatus } from './submission.types.js';
import type { Verdict } from './submission.types.js';

// --- CODE ---
/**
 * Normalize an output: trailing spaces and CRLF never decide a verdict.
 *
 * @param {string} output The raw output.
 *
 * @returns {string} The normalized output.
 */
export function normalizeOutput(output: string): string {

  return output
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

/**
 * Judge one run against the expected output.
 *
 * @param {ExecutionResult} result What the run produced.
 * @param {string} expectedOutput What it should have printed.
 *
 * @returns {TestStatus} OK when it passed, the reason otherwise.
 */
export function judgeRun(
  result: ExecutionResult,
  expectedOutput: string,
): TestStatus {

  // did not even finish cleanly
  if (result.status !== 'OK') {
    return result.status;
  }

  return normalizeOutput(result.stdout) === normalizeOutput(expectedOutput)
    ? 'OK'
    : 'WRONG_ANSWER';
}

/**
 * Summarize the hidden test runs into the verdict the player sees.
 *
 * @param {ExecutionResult[]} results One run per hidden test, in order.
 * @param {TestStatus[]} statuses The judged status of each run.
 *
 * @returns {Verdict} How many passed, and why the first failure failed.
 */
export function toVerdict(
  results: ExecutionResult[],
  statuses: TestStatus[],
): Verdict {

  const total = statuses.length;
  const passed = statuses.filter((status) => status === 'OK').length;
  const firstFailure = statuses.find((status) => status !== 'OK');

  // compile output is the same for every test: take it from the first
  const compileError = firstFailure === 'COMPILE_ERROR'
    ? (results[0]?.stderr ?? '')
    : null;

  return {
    status: firstFailure ?? 'ACCEPTED',
    passed,
    total,
    percentage: total === 0 ? 0 : Math.round((passed / total) * 100),
    compileError,
  };
}

/**
 * Count how many cases ended in each status.
 *
 * @param {TestStatus[]} statuses The status of each case.
 *
 * @returns {Partial<Record<TestStatus, number>>} The count per status.
 */
export function countStatuses(
  statuses: TestStatus[],
): Partial<Record<TestStatus, number>> {

  const counts: Partial<Record<TestStatus, number>> = {};

  for (const status of statuses) {
    counts[status] = (counts[status] ?? 0) + 1;
  }

  return counts;
}
