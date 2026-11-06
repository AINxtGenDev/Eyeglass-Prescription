// CDP CPU-throttled phone proxy (01-14 Task 3, user decision D-B). Informational only: ENG-09 is
// defined on a real phone and has no CI gate, so this spec asserts that the numbers parse and
// never fails on time. It runs only through `npm run test:perf` (project 'perf', PERF=1).
//
// Verified APIs:
// - Emulation.setCPUThrottlingRate, parameter `number rate` ("Throttling rate as a slowdown factor
//   (1 is no throttle, 2 is 2x slowdown, etc)"):
//   https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Emulation.pdl
// - browserContext.newCDPSession(page: Page|Frame): Promise<CDPSession>, "CDP sessions are only
//   supported on Chromium-based browsers" (node_modules/playwright-core/types/types.d.ts, 1.65.0).
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/* global document -- page.evaluate bodies run in the browser */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.PERF_OUT ?? path.join(ROOT, 'test-results', 'perf-throttled.json');
// 1× is the harness baseline; 4× and 6× are required by D-B, 2× is context for weaker hosts.
const RATES = [1, 2, 4, 6];
const TAPS = 3;
const EDITS = 10;

/**
 * Lighthouse BenchmarkIndex, copied verbatim (comments shortened) from
 * https://github.com/GoogleChrome/lighthouse/blob/ea58ed1fd36cb8378a4080dbcb41cdc0e5a581b2/core/lib/page-functions.js
 * (computeBenchmarkIndex; Apache License 2.0, Copyright Google LLC). Device-class table:
 * https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md
 */
function computeBenchmarkIndex() {
  function benchmarkIndexGC() {
    const start = Date.now();
    let iterations = 0;

    while (Date.now() - start < 500) {
      let s = '';
      for (let j = 0; j < 10000; j++) s += 'a';
      if (s.length === 1) throw new Error('will never happen, but prevents compiler optimizations');

      iterations++;
    }

    const durationInSeconds = (Date.now() - start) / 1000;
    return Math.round(iterations / 10 / durationInSeconds);
  }

  function benchmarkIndexNoGC() {
    const arrA = [];
    const arrB = [];
    for (let i = 0; i < 100000; i++) arrA[i] = arrB[i] = i;

    const start = Date.now();
    let iterations = 0;

    while (iterations % 10 !== 0 || Date.now() - start < 500) {
      const src = iterations % 2 === 0 ? arrA : arrB;
      const tgt = iterations % 2 === 0 ? arrB : arrA;

      for (let j = 0; j < src.length; j++) tgt[j] = src[j];

      iterations++;
    }

    const durationInSeconds = (Date.now() - start) / 1000;
    return Math.round(iterations / 10 / durationInSeconds);
  }

  return (benchmarkIndexGC() + benchmarkIndexNoGC()) / 2;
}

const num = (s) => Number(s.replace(/\s/g, '').replace(',', '.'));
const READOUT = /Median\s([\d,]+)\sms, p95\s([\d,]+)\sms/;
const INPUT = /Median der letzten (\d+) Eingaben\): Rechenarbeit ([\d,]+)\sms, Wartezeit inklusive ([\d,]+)\sms/;

function parseReadout(text) {
  const m = text.match(READOUT);
  expect(m, text).not.toBeNull();
  return { median: num(m[1]), p95: num(m[2]) };
}

// The engine sources are served to the page unbundled under __src/ (test-only route), so the
// rescan-path pair, which the page cannot enter (no fitting-height field, D-04), is timed in the
// same throttled renderer with the same engine code.
async function routeSources(page) {
  await page.route('**/Eyeglass-Prescription/__src/**', (route) => {
    const rel = new URL(route.request().url()).pathname.split('/__src/')[1];
    const file = path.resolve(ROOT, 'src', rel);
    if (!file.startsWith(path.join(ROOT, 'src') + path.sep)) return route.abort();
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(file, 'utf8') });
  });
}

/** BENCH_RUNS raw evaluatePair runs of a spec in the page, measured like main.js measure(). */
async function timeSourcePair(page, args) {
  return page.evaluate(async ({ rx, pd, materialId, frame, fh }) => {
    const src = (rel) => new URL('__src/' + rel, document.baseURI).href;
    const { evaluatePair } = await import(src('engine/evaluate.js'));
    const { specFor, BENCH_RUNS } = await import(src('state/bench-cases.js'));
    const pair = { OD: specFor('OD', rx, pd, materialId, frame, fh), OS: specFor('OS', rx, pd, materialId, frame, fh) };
    const times = [];
    let last;
    for (let i = 0; i < BENCH_RUNS; i++) {
      const t0 = performance.now();
      last = evaluatePair(pair);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const n = times.length;
    const median = n % 2 ? times[(n - 1) / 2] : (times[n / 2 - 1] + times[n / 2]) / 2;
    const ev = (r) => (r.ok ? r.intermediates.baseCurveSearch.evaluations : null);
    return {
      median,
      p95: times[Math.ceil(0.95 * n) - 1],
      ok: last.OD.ok && last.OS.ok,
      evaluations: [ev(last.OD), ev(last.OS)],
    };
  }, args);
}

// 01-12-SUMMARY finding: slowest timed rescan-path pair inside the fuzz domain.
const RESCAN = {
  rx: { sph: 11.75, cyl: -5.25, axisDeg: 5 },
  pd: 27,
  materialId: 'cr39',
  frame: { shape: 'rund', A: 43, B: 55, DBL: 20 },
  fh: 0,
};
// 01-12 Grenzfall through the same source path (cross-check against the #timing-worst readout).
const GRENZFALL = {
  rx: { sph: 10.75, cyl: -1, axisDeg: 89 },
  pd: 36,
  materialId: 'idx167',
  frame: { shape: 'rechteckig', A: 43, B: 43, DBL: 21 },
  fh: 0,
};

async function typePair(page, { sph, cyl, axis, pd, material, shape, A, B, DBL }) {
  await page.locator('#material').selectOption(material);
  await page.locator('#frame-shape').selectOption(shape);
  await page.locator('#frame-a').fill(A);
  await page.locator('#frame-b').fill(B);
  await page.locator('#frame-dbl').fill(DBL);
  for (const e of ['od', 'os']) {
    await page.locator(`#rx-${e}-sph`).fill(sph);
    await page.locator(`#rx-${e}-cyl`).fill(cyl);
    await page.locator(`#rx-${e}-axis`).fill(axis);
    await page.locator(`#rx-${e}-pd`).fill(pd);
  }
}

/** EDITS single-field edits of OD Sph alternating between two values; work/latency medians. */
async function editMedians(page, values) {
  const echo = page.locator('#rx-od-sph-echo');
  for (let i = 0; i < EDITS; i++) {
    const [raw, shown] = values[i % 2];
    await page.locator('#rx-od-sph').fill(raw);
    await expect(echo).toContainText(shown, { timeout: 30_000 });
  }
  const timing = page.locator('#timing-input');
  await expect(timing).toHaveText(INPUT, { timeout: 30_000 });
  // The setTimeout of the last edit may land after the echo; wait for it explicitly.
  await page.evaluate(() => new Promise((res) => setTimeout(res, 200)));
  const m = (await timing.textContent()).match(INPUT);
  return { n: Number(m[1]), work: num(m[2]), latency: num(m[3]) };
}

test('CPU-throttled phone proxy (ENG-09, D-B)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP sessions are Chromium-only');
  test.setTimeout(15 * 60_000);
  const results = [];
  for (const rate of RATES) {
    await routeSources(page);
    await page.goto('./');
    await expect(page.locator('#result-od-ct')).toHaveText(/mm$/);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const row = { rate, benchmarkIndex: await page.evaluate(computeBenchmarkIndex) };

    // (a) the three page readouts, TAPS re-runs after the initial toggle run
    await page.locator('details#tech > summary').click();
    await expect(page.locator('#timing-worst')).toHaveText(READOUT, { timeout: 120_000 });
    row.readouts = { normal: [], frameMiss: [], grenzfall: [] };
    for (let i = 0; i < TAPS; i++) {
      const texts = await page.evaluate(() => {
        document.getElementById('timing-rerun').click();
        return ['timing', 'timing-frame', 'timing-worst'].map((id) => document.getElementById(id).textContent);
      });
      row.readouts.normal.push(parseReadout(texts[0]));
      row.readouts.frameMiss.push(parseReadout(texts[1]));
      row.readouts.grenzfall.push(parseReadout(texts[2]));
    }
    // rescan-path pair and the Grenzfall through the source path, TAPS times each
    row.rescan = [];
    row.grenzfallSource = [];
    for (let i = 0; i < TAPS; i++) {
      row.rescan.push(await timeSourcePair(page, RESCAN));
      row.grenzfallSource.push(await timeSourcePair(page, GRENZFALL));
    }

    // (b) case A: NORMAL_PAIR typed in, OD Sph −4,00 / −4,25
    await typePair(page, { sph: '-4', cyl: '-2', axis: '30', pd: '32', material: 'cr39', shape: 'rechteckig', A: '52', B: '38', DBL: '18' });
    row.caseA = await editMedians(page, [['-4,25', '−4,25'], ['-4,00', '−4,00']]);
    // (c) case B: the 01-12 Grenzfall typed in. The page has no fitting-height field (D-04), so
    // it computes FH null, not FH 0; the exact FH-0 Grenzfall is the #timing-worst readout.
    await typePair(page, { sph: '+10,75', cyl: '-1', axis: '89', pd: '36', material: 'idx167', shape: 'rechteckig', A: '43', B: '43', DBL: '21' });
    row.caseB = await editMedians(page, [['+11,00', '+11,00'], ['+10,75', '+10,75']]);

    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
    await page.unrouteAll();
    for (const r of [...row.rescan, ...row.grenzfallSource]) expect(r.ok).toBe(true);
    expect(row.caseA.n).toBe(EDITS);
    expect(row.caseB.n).toBe(EDITS);
    results.push(row);
    console.info(JSON.stringify(row));
  }
  const host = { userAgent: await page.evaluate(() => navigator.userAgent) };
  writeFileSync(OUT, JSON.stringify({ host, results }, null, 2));
  console.info(`perf-throttled results written to ${OUT}`);
});
