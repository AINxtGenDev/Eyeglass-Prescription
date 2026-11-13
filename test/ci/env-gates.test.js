// Tested artifact = deployed artifact except the gated hook (orchestrator decision 5, lens-critic M4).
// A plan that adds a gate extends ALLOW_ENV in the same commit (04-10 adds src/ui/view/ref-mode.js).
//
// Every line in src/ (non-test .js) that mentions import.meta.env must be in an allowed file and
// contain that file's allowed expression exactly; anything else could make dist and dist-e2e differ
// in ways parity.test.js does not explain.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));

const ALLOW_ENV = Object.freeze({
  'src/i18n/t.js': ['import.meta.env?.PROD'],
  'src/ui/view/view.js': ["import.meta.env.MODE !== 'production'"],
});

/** @param {string} dir absolute @returns {string[]} repo-relative posix paths */
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.js') && !e.name.endsWith('.test.js')) out.push(path.relative(root, p).split(path.sep).join('/'));
  }
  return out;
}

/**
 * @param {{ file: string, text: string }[]} entries
 * @param {Record<string, string[]>} allow
 * @returns {{ hits: { file: string, line: number, text: string }[], violations: string[] }}
 */
function checkEnv(entries, allow) {
  const hits = [];
  const violations = [];
  for (const { file, text } of entries) {
    text.split('\n').forEach((l, i) => {
      if (!l.includes('import.meta.env')) return;
      hits.push({ file, line: i + 1, text: l });
      const ok = allow[file];
      if (!ok) violations.push(`${file}:${i + 1} not allow-listed: ${l.trim()}`);
      else if (!ok.some((expr) => l.includes(expr))) violations.push(`${file}:${i + 1} unexpected expression: ${l.trim()}`);
    });
  }
  return { hits, violations };
}

const entries = walk(path.join(root, 'src')).map((file) => ({ file, text: readFileSync(path.join(root, file), 'utf8') }));

describe('import.meta.env allow-list (M4)', () => {
  test('every import.meta.env use in src/ is allow-listed with its exact expression', () => {
    const { violations } = checkEnv(entries, ALLOW_ENV);
    expect(violations).toEqual([]);
  });

  test('positive control: every allowed file has at least one hit', () => {
    const { hits } = checkEnv(entries, ALLOW_ENV);
    for (const f of Object.keys(ALLOW_ENV)) expect(hits.filter((h) => h.file === f).length, f).toBeGreaterThanOrEqual(1);
  });

  test('synthetic: a use in another file fails', () => {
    const { violations } = checkEnv([{ file: 'src/ui/other.js', text: 'if (import.meta.env.DEV) x();' }], ALLOW_ENV);
    expect(violations).toHaveLength(1);
  });

  test('synthetic: a different expression in an allowed file fails', () => {
    const { violations } = checkEnv([{ file: 'src/ui/view/view.js', text: 'if (import.meta.env.DEV) x();' }], ALLOW_ENV);
    expect(violations).toHaveLength(1);
  });
});
