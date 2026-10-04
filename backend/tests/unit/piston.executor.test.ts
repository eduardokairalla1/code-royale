/**
 * Piston executor: piston answers mapped to statuses, fetch stubbed.
 */

// --- IMPORTS ---
import {
  ExecutorUnavailableError,
} from '../../src/modules/executor/executor.errors.js';
import {
  UnsupportedRuntimeError,
} from '../../src/modules/executor/executor.errors.js';
import { PistonExecutor } from '../../src/modules/executor/piston.executor.js';
import { afterEach } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { vi } from 'vitest';

// --- GLOBALS ---
const executor = new PistonExecutor('http://piston.test', 5000);

const REQUEST = { language: 'cpp', code: 'int main() {}', stdin: '1' };

// a run stage that went fine
const CLEAN = { stdout: '', stderr: '', code: 0, signal: null, status: null };

// --- CODE ---
/**
 * Make fetch answer with the given piston body.
 *
 * @param {unknown} body What piston answers.
 * @param {number} status The http status.
 *
 * @returns {ReturnType<typeof vi.fn>} The fetch mock.
 */
function pistonAnswers(body: unknown, status = 200): ReturnType<typeof vi.fn> {

  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PistonExecutor', () => {

  it('sends the piston runtime name, any version and the stdin', async () => {
    const fetchMock = pistonAnswers({ run: CLEAN });

    await executor.run(REQUEST);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const body = JSON.parse(String(init.body));

    expect(String(url)).toBe('http://piston.test/api/v2/execute');
    expect(body).toMatchObject({ language: 'c++', version: '*', stdin: '1' });
  });

  it('maps a clean run to OK with its output', async () => {
    pistonAnswers({ run: { ...CLEAN, stdout: '7\n' } });

    expect(await executor.run(REQUEST)).toEqual({
      status: 'OK',
      stdout: '7\n',
      stderr: '',
    });
  });

  it('maps a failed compile to COMPILE_ERROR', async () => {
    pistonAnswers({
      compile: { ...CLEAN, code: 1, stderr: 'error: expected ;' },
      run: CLEAN,
    });

    expect(await executor.run(REQUEST)).toMatchObject({
      status: 'COMPILE_ERROR',
      stderr: 'error: expected ;',
    });
  });

  it.each([
    ['TO', null, 'TIME_LIMIT'],
    ['OL', null, 'OUTPUT_LIMIT'],
    ['EL', null, 'OUTPUT_LIMIT'],
    ['RE', 1, 'RUNTIME_ERROR'],
    ['SG', null, 'RUNTIME_ERROR'],
    [null, 137, 'RUNTIME_ERROR'],
  ])('maps status %s / exit %s to %s', async (status, code, expected) => {
    pistonAnswers({ run: { ...CLEAN, status, code } });

    expect((await executor.run(REQUEST)).status).toBe(expected);
  });

  it('is unavailable when piston cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')));

    await expect(executor.run(REQUEST))
      .rejects.toBeInstanceOf(ExecutorUnavailableError);
  });

  it('is unavailable when piston refuses the request', async () => {
    pistonAnswers({ message: 'runtime is unknown' }, 400);

    await expect(executor.run(REQUEST))
      .rejects.toBeInstanceOf(ExecutorUnavailableError);
  });

  it('says where piston is and how long it has been failing', async () => {
    const flaky = new PistonExecutor('http://user:pass@piston.test', 5000);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')));
    await flaky.run(REQUEST).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 20));

    const error = await flaky.run(REQUEST).catch((caught) => caught);

    // no credentials: the error ends up in the logs
    expect(error.details).toMatchObject({
      piston: 'http://piston.test',
      timeout_ms: 5000,
      timed_out: false,
    });
    expect(error.details.failing_for_ms).toBeGreaterThanOrEqual(15);

    // back up: the next failure starts counting again
    pistonAnswers({ run: CLEAN });
    await flaky.run(REQUEST);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')));
    const next = await flaky.run(REQUEST).catch((caught) => caught);

    expect(next.details.failing_for_ms).toBeLessThan(15);
  });

  it('refuses a language it has no runtime for', async () => {
    await expect(executor.run({ ...REQUEST, language: 'cobol' }))
      .rejects.toBeInstanceOf(UnsupportedRuntimeError);
  });
});
