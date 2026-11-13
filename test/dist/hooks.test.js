// UI-SPEC E8 / F-04 / AR-03-04: the test hooks exist only in non-production builds.
// dist/ (deployed) must not contain any hook string; dist-e2e/ (`vite build --mode e2e`) must
// contain it (positive control, so a renamed hook cannot make this test pass vacuously).
// Runs in the 'dist' project after `npm run build && npm run build:e2e` (`npm run test:dist`).
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const DIST = path.join(root, 'dist');
const DIST_E2E = path.join(root, 'dist-e2e');
// 04-10: 'refdegraded', the forced-degraded Durchblick hook (src/ui/view/ref-mode.js).
const HOOK_STRINGS = ['__eyeglassView', 'refdegraded'];

function requireBuilds() {
  for (const d of [DIST, DIST_E2E]) {
    if (!existsSync(d)) throw new Error(`${path.basename(d)}/ missing: run \`npm run build && npm run build:e2e\` first`);
  }
}

/** @param {string} dir @returns {string[]} absolute paths of .js and .html files */
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(js|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('test hooks only in the e2e build (E8)', () => {
  test.each(HOOK_STRINGS)('dist/ contains no %s', (hook) => {
    requireBuilds();
    const files = walk(DIST);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes(hook)).map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });

  test.each(HOOK_STRINGS)('positive control: dist-e2e/assets/ contains %s', (hook) => {
    requireBuilds();
    const files = walk(path.join(DIST_E2E, 'assets'));
    expect(files.some((f) => readFileSync(f, 'utf8').includes(hook))).toBe(true);
  });
});
