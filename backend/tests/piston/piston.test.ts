/**
 * Against a real Piston; runs only with PISTON_URL set.
 */

// --- IMPORTS ---
import { PistonExecutor } from '../../src/modules/executor/piston.executor.js';
import { LANGUAGES } from '../../src/modules/language/language.catalog.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- GLOBALS ---
const PISTON_URL = process.env.PISTON_URL;

// solutions to "print the sum of two numbers", one per language
const SUM_SOLUTIONS: Record<string, string> = {
  python: 'a, b = map(int, input().split())\nprint(a + b)',
  javascript: [
    'const [a, b] = require(\'fs\').readFileSync(0, \'utf8\')',
    '  .trim().split(/\\s+/).map(Number);',
    'console.log(a + b);',
  ].join('\n'),
  cpp: [
    '#include <iostream>',
    'int main() { long a, b; std::cin >> a >> b; std::cout << a + b; }',
  ].join('\n'),
};

// --- CODE ---
describe.skipIf(!PISTON_URL)('piston', () => {

  const executor = new PistonExecutor(PISTON_URL ?? '', 60_000);

  it.each(LANGUAGES.map((language) => [language.id, language]))(
    'runs the %s template',
    async (_, language) => {
      const result = await executor.run({
        language: language.id,
        code: language.template,
        stdin: '3\n1 2 3\n',
      });

      expect(result.status).toBe('OK');
    },
  );

  it.each(Object.entries(SUM_SOLUTIONS))(
    'solves the sum in %s',
    async (language, code) => {
      const result = await executor.run({ language, code, stdin: '2 5' });

      expect(result.status).toBe('OK');
      expect(result.stdout.trim()).toBe('7');
    },
  );

  it('gives player code no network', async () => {
    const result = await executor.run({
      language: 'python',
      code: [
        'import socket',
        'try:',
        '    socket.create_connection(("1.1.1.1", 80), timeout=3)',
        '    print("connected")',
        'except OSError:',
        '    print("blocked")',
      ].join('\n'),
      stdin: '',
    });

    expect(result.stdout.trim()).toBe('blocked');
  });

  it('kills an infinite loop', async () => {
    const result = await executor.run({
      language: 'python',
      code: 'while True: pass',
      stdin: '',
    });

    expect(result.status).toBe('TIME_LIMIT');
  });
});
