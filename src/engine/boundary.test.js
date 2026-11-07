// DEPL-03 proof inside the unit suite: the ESLint config in eslint.config.js must reject
// Three.js and DOM access in the engine, and HTML sinks in the UI. Each probe is linted
// with the real config via the ESLint Node API (lintText with a virtual filePath).
// Positive controls prove the probe paths are really linted by the intended config block.
import { describe, test, expect } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function ruleIds(code, probePath) {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, probePath) });
  return result.messages.map((m) => m.ruleId);
}

describe('engine boundary (src/engine)', () => {
  test.each([
    ["import * as T from 'three'; export const x = T;", 'no-restricted-imports'],
    [
      "import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; export { OrbitControls };",
      'no-restricted-imports',
    ],
    ["import '../ui/main.js';", 'no-restricted-imports'],
    ['export const f = () => document.title;', 'no-restricted-globals'],
    ['export const f = () => window.innerWidth;', 'no-restricted-globals'],
    ["export const f = () => fetch('x');", 'no-restricted-globals'],
    ['export const f = () => performance.now();', 'no-restricted-globals'],
    ['export const f = () => [HTMLElement];', 'no-undef'],
  ])('rejects %s (%s)', async (code, rule) => {
    expect(await ruleIds(code, 'src/engine/__probe__.js')).toContain(rule);
  });

  test('positive control: a pure function lints clean', async () => {
    expect(await ruleIds('export const f = (x) => x * 2;\n', 'src/engine/__probe__.js')).toEqual(
      [],
    );
  });
});

describe('UI layer (src/ui)', () => {
  test.each([
    ['export const f = (el, s) => { el.innerHTML = s; };', 'no-restricted-syntax'],
    ['export const f = (el, s) => { el.outerHTML = s; };', 'no-restricted-syntax'],
    ["export const f = (el, s) => el.insertAdjacentHTML('beforeend', s);", 'no-restricted-syntax'],
  ])('rejects %s (%s)', async (code, rule) => {
    expect(await ruleIds(code, 'src/ui/__probe__.js')).toContain(rule);
  });

  test.each([
    ['export const f = (el, s) => { el.textContent = s; };\n'],
    ['export const f = () => document.title;\n'],
  ])('positive control: %s lints clean', async (code) => {
    expect(await ruleIds(code, 'src/ui/__probe__.js')).toEqual([]);
  });
});

describe('state layer (src/state)', () => {
  test('has no browser globals: document is undefined', async () => {
    expect(await ruleIds('export const f = () => document.title;', 'src/state/__probe__.js')).toContain(
      'no-undef',
    );
  });
});

// 02-14 (T-02-39): no browser storage anywhere in the app source. The Rx is health-adjacent data on
// the shared ainxtgendev.github.io origin; persistence is deferred to v2.
describe('no storage API in src/ (T-02-39)', () => {
  const STORAGE = /\b(localStorage|sessionStorage|indexedDB)\b|document\.cookie/;
  const files = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return files(p);
      return e.name.endsWith('.js') && !e.name.endsWith('.test.js') ? [p] : [];
    });
  const src = files(path.join(root, 'src'));

  test('scans the app source (positive control: main.js and the worker are in the list)', () => {
    const rel = src.map((p) => path.relative(root, p).split(path.sep).join('/'));
    expect(rel).toContain('src/ui/main.js');
    expect(rel).toContain('src/worker/engine.worker.js');
    expect(STORAGE.test('x = window.localStorage.getItem(k)')).toBe(true);
    expect(STORAGE.test('document.cookie = s')).toBe(true);
  });

  test('no file uses localStorage, sessionStorage, indexedDB or document.cookie', () => {
    const hits = src.flatMap((p) =>
      readFileSync(p, 'utf8')
        .split('\n')
        .map((line, i) => (STORAGE.test(line) ? `${path.relative(root, p)}:${i + 1}: ${line.trim()}` : null))
        .filter(Boolean),
    );
    expect(hits).toEqual([]);
  });
});
