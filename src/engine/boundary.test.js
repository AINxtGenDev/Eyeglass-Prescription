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

// 03-02 (T-03-06): Three.js only in the lazy view chunk src/ui/view/**.
describe('three import boundary (03-02)', () => {
  const THREE_IMPORTS = [
    "import * as T from 'three'; export const x = T;",
    "import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; export { OrbitControls };",
  ];
  const PROBES = [
    'src/engine/mesh/__probe__.js',
    'src/state/__probe__.js',
    'src/worker/__probe__.js',
    'src/ui/__probe__.js',
  ];
  test.each(PROBES.flatMap((p) => THREE_IMPORTS.map((code) => [p, code])))(
    '%s rejects %s (no-restricted-imports)',
    async (probe, code) => {
      expect(await ruleIds(code, probe)).toContain('no-restricted-imports');
    },
  );

  test('src/engine/mesh rejects DOM globals (no-restricted-globals)', async () => {
    expect(
      await ruleIds('export const f = () => document.title;', 'src/engine/mesh/__probe__.js'),
    ).toContain('no-restricted-globals');
  });

  test('positive control: a pure function lints clean in src/engine/mesh', async () => {
    expect(
      await ruleIds('export const f = (x) => x * 2;\n', 'src/engine/mesh/__probe__.js'),
    ).toEqual([]);
  });

  test('positive control: src/ui/view may import three', async () => {
    expect(
      await ruleIds("import * as T from 'three'; export const x = T;\n", 'src/ui/view/__probe__.js'),
    ).toEqual([]);
  });

  test('src/ui/view keeps the HTML-sink ban (no-restricted-syntax)', async () => {
    expect(
      await ruleIds('export const f = (el, s) => { el.innerHTML = s; };', 'src/ui/view/__probe__.js'),
    ).toContain('no-restricted-syntax');
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
