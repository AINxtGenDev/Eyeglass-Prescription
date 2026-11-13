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
// T-02-39 amended by 04-UI-SPEC (D-21, M8): one allow-listed module, src/ui/handover.js, may use
// sessionStorage (no other storage API) with exactly one key string, for the input handover
// across an update reload. Every other file still fails on any storage API word.
describe('no storage API in src/ (T-02-39, amended for D-21)', () => {
  const STORAGE = /\b(localStorage|sessionStorage|indexedDB)\b|document\.cookie/;
  /** What the allow-listed module must still never use. */
  const OTHER_STORAGE = /\b(localStorage|indexedDB)\b|document\.cookie/;
  const ALLOW = ['src/ui/handover.js'];
  const files = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return files(p);
      return e.name.endsWith('.js') && !e.name.endsWith('.test.js') ? [p] : [];
    });
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');
  const entries = files(path.join(root, 'src')).map((p) => ({ rel: rel(p), text: readFileSync(p, 'utf8') }));
  /**
   * Lines that use a storage API they may not: any of them outside the allow-list, anything but
   * sessionStorage inside it.
   * @param {{ rel: string, text: string }[]} list @param {string[]} allow
   */
  const storageHits = (list, allow) =>
    list.flatMap(({ rel: r, text }) => {
      const re = allow.includes(r) ? OTHER_STORAGE : STORAGE;
      return text
        .split('\n')
        .map((line, i) => (re.test(line) ? `${r}:${i + 1}: ${line.trim()}` : null))
        .filter(Boolean);
    });
  const handover = entries.find((e) => e.rel === 'src/ui/handover.js');

  test('scans the app source (positive control: main.js, the worker and handover.js are in the list)', () => {
    const list = entries.map((e) => e.rel);
    expect(list).toContain('src/ui/main.js');
    expect(list).toContain('src/worker/engine.worker.js');
    expect(list).toContain('src/ui/handover.js');
    expect(STORAGE.test('x = window.localStorage.getItem(k)')).toBe(true);
    expect(STORAGE.test('document.cookie = s')).toBe(true);
    // handover.js really uses the allowed API, so the allow-list is not an empty exception.
    expect(STORAGE.test(handover.text)).toBe(true);
  });

  test('handover.js holds exactly one storage key string and no other storage API', () => {
    expect(handover.text.match(/eyeglass-rx:v1:/g) ?? []).toHaveLength(1);
    expect(handover.text).toContain("'eyeglass-rx:v1:handover'");
    expect(OTHER_STORAGE.test(handover.text)).toBe(false);
  });

  test('the filter: sessionStorage elsewhere is a hit, other APIs in the allowed file too', () => {
    expect(storageHits([{ rel: 'src/ui/other.js', text: 'const s = sessionStorage;' }], ALLOW)).toHaveLength(1);
    expect(storageHits([{ rel: 'src/ui/handover.js', text: 'const s = localStorage;' }], ALLOW)).toHaveLength(1);
    expect(storageHits([{ rel: 'src/ui/handover.js', text: 'x = document.cookie' }], ALLOW)).toHaveLength(1);
    expect(storageHits([{ rel: 'src/ui/handover.js', text: 'const s = sessionStorage;' }], ALLOW)).toEqual([]);
    expect(storageHits([{ rel: 'src/ui/handover.js', text: 'const s = sessionStorage;' }], [])).toHaveLength(1);
  });

  test('no other file uses localStorage, sessionStorage, indexedDB or document.cookie', () => {
    expect(storageHits(entries, ALLOW)).toEqual([]);
  });
});
