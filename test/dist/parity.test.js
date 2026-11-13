// lens-critic M4, round-2 NEW-8, round-4 NEW-12: tested = deployed except the gated hook, enforced.
// dist/ (deployed, `npm run build`) and dist-e2e/ (`npm run build:e2e`) come from the same commit and
// may differ only by code behind import.meta.env.MODE !== 'production' (test/ci/env-gates.test.js).
//
// Vite names chunks by content hash, so equal names mean byte-identical code (checked below anyway).
// The view chunk carries the gated hook, so its hash differs, and the hash cascades into every chunk
// that imports it by hashed name (index → view; compute-protocol → index; mesh-protocol → index, view;
// measured 2026-11-13). Those cascading chunks must be identical after normalising hashed names.
//
// If a later plan creates another chunk that legitimately differs, it extends PARITY_ALLOW in the same
// commit with a whole-name pattern, the reason and normalisedEqual: true. Never a prefix or catch-all
// pattern, never a non-normalised entry (only view-* may differ for real). 04-05's warp-protocol chunk
// is the known next one and is registered already; it is skipped until a build contains it (04-08).
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ASSETS = path.join(root, 'dist/assets');
const ASSETS_E2E = path.join(root, 'dist-e2e/assets');

// Measured Vite/Rolldown hash form on 2026-11-13: 8 chars, e.g. view-Cv3_G2jJ.js, index-BJ3rYsJ-.js.
const HASH = '[A-Za-z0-9_-]{8}';
const PARITY_ALLOW = Object.freeze([
  { re: new RegExp('^view-' + HASH + '\\.js$'), why: 'view chunk: contains the MODE-gated test handle (and from 04-10 the refdegraded hook)' },
  { re: new RegExp('^index-' + HASH + '\\.js$'), why: 'entry: imports the view chunk by its hashed name', normalisedEqual: true },
  {
    re: new RegExp('^compute-protocol-' + HASH + '\\.js$'),
    why: 'engine sync-fallback chunk: imports the entry chunk by its hashed name (hash cascade, round-4 NEW-12)',
    normalisedEqual: true,
  },
  {
    re: new RegExp('^mesh-protocol-' + HASH + '\\.js$'),
    why: 'mesh sync-fallback chunk: imports the entry and the view chunk by their hashed names (hash cascade, round-4 NEW-12)',
    normalisedEqual: true,
  },
  {
    re: new RegExp('^warp-protocol-' + HASH + '\\.js$'),
    why: 'warp sync-fallback chunk (exists once 04-08 imports warp-client from ref-mode.js): expected to cascade like mesh-protocol (round-4 NEW-12, inferred, not measured)',
    normalisedEqual: true,
  },
]);

const WORKER_RE = /worker[^/]*\.js$/;
const HASHED_NAME_RE = /([A-Za-z0-9._-]+?)-[A-Za-z0-9_-]{8}\.(js|css)/g;

/** Replace every hashed asset name by NAME-HASH.ext. */
const normalise = (text) => text.replace(HASHED_NAME_RE, '$1-HASH.$2');

/** Entry-kind rule: exactly one non-normalised entry, and it is the view chunk. */
function entryKindViolations(allow) {
  const raw = allow.filter((e) => !e.normalisedEqual);
  if (raw.length !== 1) return [`expected exactly one non-normalised entry, got ${raw.length}`];
  if (!raw[0].re.test('view-AAAAAAAA.js')) return [`the non-normalised entry ${raw[0].re} is not the view chunk`];
  return [];
}

/** Names in the symmetric difference that match no whole-name allow-list pattern. */
function unexplainedDiff(namesA, namesB, allow) {
  const a = new Set(namesA);
  const b = new Set(namesB);
  const diff = [...namesA.filter((n) => !b.has(n)), ...namesB.filter((n) => !a.has(n))];
  return { diff, unexplained: diff.filter((n) => !allow.some((e) => e.re.test(n))) };
}

/**
 * Normalised comparison of one allow-list entry.
 * @returns {{ status: 'skipped' | 'equal' | 'fail', message?: string }}
 */
function compareEntry(entry, namesA, namesB, readA, readB) {
  const ma = namesA.filter((n) => entry.re.test(n));
  const mb = namesB.filter((n) => entry.re.test(n));
  if (ma.length === 0 && mb.length === 0) return { status: 'skipped', message: `not built yet: ${entry.re}` };
  if (ma.length !== 1 || mb.length !== 1) {
    return { status: 'fail', message: `${entry.re}: expected one match per build, got [${ma}] vs [${mb}]` };
  }
  const ta = normalise(readA(ma[0]));
  const tb = normalise(readB(mb[0]));
  if (ta === tb) return { status: 'equal' };
  let i = 0;
  while (i < ta.length && ta[i] === tb[i]) i++;
  return {
    status: 'fail',
    message: `${ma[0]} vs ${mb[0]} differ after normalising at ${i}:\n  dist:     ${ta.slice(i, i + 200)}\n  dist-e2e: ${tb.slice(i, i + 200)}`,
  };
}

function listAssets() {
  for (const d of [ASSETS, ASSETS_E2E]) {
    if (!existsSync(d)) throw new Error(`${path.relative(root, d)} missing: run \`npm run build && npm run build:e2e\` first`);
  }
  return { a: readdirSync(ASSETS).sort(), b: readdirSync(ASSETS_E2E).sort() };
}
const readA = (n) => readFileSync(path.join(ASSETS, n), 'utf8');
const readB = (n) => readFileSync(path.join(ASSETS_E2E, n), 'utf8');

describe('dist vs dist-e2e parity (M4, NEW-8, NEW-12)', () => {
  test('worker bundles have identical names and bytes, engine and mesh worker present', () => {
    const { a, b } = listAssets();
    const wa = a.filter((n) => WORKER_RE.test(n));
    const wb = b.filter((n) => WORKER_RE.test(n));
    expect(wa).toEqual(wb);
    expect(wa.some((n) => n.startsWith('engine.worker-'))).toBe(true);
    expect(wa.some((n) => n.startsWith('mesh.worker-'))).toBe(true);
    for (const n of wa) expect(readA(n) === readB(n), n).toBe(true);
  });

  test('PARITY_ALLOW: only the view entry is non-normalised', () => {
    expect(entryKindViolations(PARITY_ALLOW)).toEqual([]);
    expect(PARITY_ALLOW.filter((e) => !e.normalisedEqual).length).toBe(1);
  });

  test('every differing name is allow-listed; every shared name is byte-identical', () => {
    const { a, b } = listAssets();
    const { diff, unexplained } = unexplainedDiff(a, b, PARITY_ALLOW);
    console.log('dist vs dist-e2e differing names:', diff.join(', '));
    expect(unexplained, `not allow-listed: ${unexplained.join(', ')}`).toEqual([]);
    const shared = a.filter((n) => b.includes(n));
    for (const n of shared) expect(readA(n) === readB(n), n).toBe(true);
  });

  test('every normalisedEqual entry is identical after normalising hashed names', () => {
    const { a, b } = listAssets();
    for (const entry of PARITY_ALLOW.filter((e) => e.normalisedEqual)) {
      const r = compareEntry(entry, a, b, readA, readB);
      if (r.status === 'skipped') console.log(r.message);
      expect(r.status, r.message).not.toBe('fail');
    }
  });

  test('positive control: at least one allow-listed chunk really differs between the builds', () => {
    const { a, b } = listAssets();
    const { diff } = unexplainedDiff(a, b, PARITY_ALLOW);
    expect(diff.some((n) => PARITY_ALLOW.some((e) => e.re.test(n)))).toBe(true);
  });
});

describe('parity filter, synthetic cases (nothing written to dist)', () => {
  const base = ['compute-protocol-AAAAAAAA.js', 'engine.worker-WWWWWWWW.js', 'index-AAAAAAAA.js', 'view-AAAAAAAA.js'];
  const other = ['compute-protocol-BBBBBBBB.js', 'engine.worker-WWWWWWWW.js', 'index-BBBBBBBB.js', 'view-BBBBBBBB.js'];
  const cp = PARITY_ALLOW.find((e) => e.re.test('compute-protocol-AAAAAAAA.js'));
  const idx = PARITY_ALLOW.find((e) => e.re.test('index-AAAAAAAA.js'));

  test('an extra compute-protocol chunk on one side fails the one-match-per-build rule', () => {
    const r = compareEntry(cp, base, [...other, 'compute-protocol-XXXXXXXX.js'], () => 'x', () => 'x');
    expect(r.status).toBe('fail');
  });

  test('an extra view-ref chunk is not allow-listed', () => {
    const { unexplained } = unexplainedDiff(base, [...other, 'view-ref-XXXXXXXX.js'], PARITY_ALLOW);
    expect(unexplained).toEqual(['view-ref-XXXXXXXX.js']);
  });

  test('an entry differing outside a hashed name fails; differing only in a hashed name passes', () => {
    const t1 = 'import"./view-AAAAAAAA.js";const a=1;';
    expect(compareEntry(idx, base, other, () => t1, () => 'import"./view-BBBBBBBB.js";const a=1;').status).toBe('equal');
    expect(compareEntry(idx, base, other, () => t1, () => 'import"./view-BBBBBBBB.js";const a=2;').status).toBe('fail');
  });

  test('compute-protocol differing outside a hashed name fails', () => {
    const r = compareEntry(cp, base, other, () => 'import"./index-AAAAAAAA.js";f(1)', () => 'import"./index-BBBBBBBB.js";f(2)');
    expect(r.status).toBe('fail');
  });

  test('a non-normalised compute-protocol entry fails the entry-kind rule', () => {
    const widened = [...PARITY_ALLOW, { re: /^compute-protocol-[A-Za-z0-9_-]{8}\.js$/, why: 'blanket' }];
    expect(entryKindViolations(widened)).not.toEqual([]);
  });

  test('an entry with no match in either build is skipped', () => {
    const warp = PARITY_ALLOW.find((e) => e.re.test('warp-protocol-AAAAAAAA.js'));
    expect(compareEntry(warp, base, other, () => '', () => '').status).toBe('skipped');
  });
});
