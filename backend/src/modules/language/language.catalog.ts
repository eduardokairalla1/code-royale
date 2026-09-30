/**
 * Languages players can write in, with the code the editor starts from.
 */

// --- GLOBALS ---
// NOTE: each id needs a runtime in piston.executor.ts and a package.
export const LANGUAGES: Language[] = [
  {
    id: 'python',
    name: 'Python 3.12',
    template: [
      'data = input()',
      '',
    ].join('\n'),
  },
  {
    id: 'javascript',
    name: 'JavaScript (Node 20)',
    template: [
      'const data = require(\'fs\')',
      '  .readFileSync(0, \'utf8\').trim().split(/\\s+/);',
      '',
    ].join('\n'),
  },
  {
    id: 'typescript',
    name: 'TypeScript 5.0',
    template: [
      '// no node types are installed: declare what you use',
      'declare const require: any;',
      '',
      'const data: string[] = require(\'fs\')',
      '  .readFileSync(0, \'utf8\').trim().split(/\\s+/);',
      '',
    ].join('\n'),
  },
  {
    id: 'go',
    name: 'Go 1.16',
    template: [
      'package main',
      '',
      'import "fmt"',
      '',
      'func main() {',
      '\tvar n int',
      '\tfmt.Scan(&n)',
      '}',
      '',
    ].join('\n'),
  },
  {
    id: 'java',
    name: 'Java 15',
    template: [
      'import java.util.*;',
      '',
      'public class Main {',
      '    public static void main(String[] args) {',
      '        Scanner in = new Scanner(System.in);',
      '    }',
      '}',
      '',
    ].join('\n'),
  },
  {
    id: 'c',
    name: 'C (GCC 10)',
    template: [
      '#include <stdio.h>',
      '',
      'int main(void) {',
      '    return 0;',
      '}',
      '',
    ].join('\n'),
  },
  {
    id: 'cpp',
    name: 'C++ (GCC 10)',
    template: [
      '#include <bits/stdc++.h>',
      'using namespace std;',
      '',
      'int main() {',
      '    return 0;',
      '}',
      '',
    ].join('\n'),
  },
  {
    id: 'rust',
    name: 'Rust 1.68',
    template: [
      'use std::io::{self, Read};',
      '',
      'fn main() {',
      '    let mut input = String::new();',
      '    io::stdin().read_to_string(&mut input).unwrap();',
      '}',
      '',
    ].join('\n'),
  },
];

// --- CODE ---
/**
 * A language offered to players.
 */
export interface Language {
  id: string;
  name: string;
  // starting code: reads stdin, so players only write the logic
  template: string;
}

/**
 * Keep only the languages enabled in this deployment, in catalog order.
 *
 * @param {string[]} ids The enabled language ids.
 *
 * @returns {Language[]} The enabled languages.
 */
export function pickLanguages(ids: string[]): Language[] {
  return LANGUAGES.filter((language) => ids.includes(language.id));
}
