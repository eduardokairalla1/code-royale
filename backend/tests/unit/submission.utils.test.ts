/**
 * Output comparison and verdicts.
 */

// --- IMPORTS ---
import type {
  ExecutionResult,
} from '../../src/modules/executor/executor.types.js';
import {
  countStatuses,
} from '../../src/modules/submission/submission.utils.js';
import { judgeRun } from '../../src/modules/submission/submission.utils.js';
import {
  normalizeOutput,
} from '../../src/modules/submission/submission.utils.js';
import { toVerdict } from '../../src/modules/submission/submission.utils.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
/**
 * Build a successful run.
 *
 * @param {string} stdout What the program printed.
 *
 * @returns {ExecutionResult} An OK result.
 */
function okRun(stdout: string): ExecutionResult {
  return { status: 'OK', stdout, stderr: '' };
}

describe('normalizeOutput', () => {

  it('ignores trailing newlines and trailing spaces', () => {
    expect(normalizeOutput('7  \n\n')).toBe('7');
  });

  it('ignores windows line endings', () => {
    expect(normalizeOutput('1\r\n2\r\n')).toBe('1\n2');
  });

  it('keeps leading spaces and inner blank lines', () => {
    expect(normalizeOutput('  a\n\nb')).toBe('  a\n\nb');
  });
});

describe('judgeRun', () => {

  it('passes when the output matches after normalizing', () => {
    expect(judgeRun(okRun('7 \n'), '7')).toBe('OK');
  });

  it('fails with WRONG_ANSWER when the output differs', () => {
    expect(judgeRun(okRun('8\n'), '7')).toBe('WRONG_ANSWER');
  });

  it('keeps the execution status when the run failed', () => {
    const crashed: ExecutionResult = {
      status: 'RUNTIME_ERROR',
      stdout: '7\n',
      stderr: 'boom',
    };

    expect(judgeRun(crashed, '7')).toBe('RUNTIME_ERROR');
  });
});

describe('toVerdict', () => {

  it('accepts when every test passed', () => {
    const verdict = toVerdict([okRun('1'), okRun('2')], ['OK', 'OK']);

    expect(verdict).toEqual({
      status: 'ACCEPTED',
      passed: 2,
      total: 2,
      percentage: 100,
      compileError: null,
    });
  });

  it('reports the first failure and the percentage', () => {
    const verdict = toVerdict(
      [okRun('1'), okRun('x'), okRun('y')],
      ['OK', 'WRONG_ANSWER', 'TIME_LIMIT'],
    );

    expect(verdict.status).toBe('WRONG_ANSWER');
    expect(verdict.passed).toBe(1);
    expect(verdict.percentage).toBe(33);
  });

  it('carries the compiler output on a compile error', () => {
    const failed: ExecutionResult = {
      status: 'COMPILE_ERROR',
      stdout: '',
      stderr: 'missing ;',
    };

    const verdict = toVerdict([failed], ['COMPILE_ERROR']);

    expect(verdict.status).toBe('COMPILE_ERROR');
    expect(verdict.compileError).toBe('missing ;');
  });
});

describe('countStatuses', () => {

  it('counts the cases of each status', () => {
    expect(countStatuses(['OK', 'WRONG_ANSWER', 'OK'])).toEqual({
      OK: 2,
      WRONG_ANSWER: 1,
    });
    expect(countStatuses([])).toEqual({});
  });
});
