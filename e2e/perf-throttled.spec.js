// CDP CPU-throttled phone proxy (01-14 Task 3, user decision D-B; reworked in 01-15 for the
// restated ENG-09). Informational only: ENG-09 is decided on a real phone and has no CI gate, so
// this spec asserts that the numbers parse and never fails on time. It runs only through
// `npm run test:perf` (project 'perf', PERF=1).
//
// What the proxy can slow (lens-critic measurement, 2026-11-06): Emulation.setCPUThrottlingRate
// on the page throttles the main thread only. With the page at 1× → 4× the worker took
// 45,4 → 50,2 ms while the main thread took 46,5 → 193,4 ms, and the same command sent to the
// worker target returned -32000 "Operation is only supported for pages, not workers". So the
// proxy MEASURES ENG-09 (a) and (b) (main thread) and only ESTIMATES (c) and (d) (worker time):
// the worker readouts below are labelled "worker, unthrottled".
//
// Verified APIs:
// - Emulation.setCPUThrottlingRate, parameter `number rate` ("Throttling rate as a slowdown factor
//   (1 is no throttle, 2 is 2x slowdown, etc)"):
//   https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Emulation.pdl
// - browserContext.newCDPSession(page: Page|Frame): Promise<CDPSession>, "CDP sessions are only
//   supported on Chromium-based browsers" (node_modules/playwright-core/types/types.d.ts, 1.65.0).
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settled, etmaxOf } from './helpers.js';
/* global document -- page.evaluate bodies run in the browser */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.PERF_OUT ?? path.join(ROOT, 'test-results', 'perf-throttled.json');
// 1× is the harness baseline; 4× and 6× are required by D-B, 2× is context for weaker hosts.
const RATES = [1, 2, 4, 6];
const EDITS = 10;
const BENCH_RUNS_PER_RATE = 3; // the auto-started bench plus two re-runs

// 01-14-SUMMARY "ENG-09 phone proxy" table: main-thread evaluatePair p95 per rate (ms), measured
// before the worker existed. Used only for the (c)/(d) estimates (MINOR-10).
const COMPUTE14_P95 = {
  1: { normal: 2.6, rescan: 42.5 },
  2: { normal: 6.5, rescan: 90.4 },
  4: { normal: 13.6, rescan: 182.0 },
  6: { normal: 19.4, rescan: 282.5 },
};

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
const INPUT_RE =
  /letzte (\d+) Eingaben\): Median ([\d,]+)\sms, längste ([\d,]+)\sms; Hauptthread je Eingabe einschließlich Darstellung: Median ([\d,]+)\sms, längste ([\d,]+)\sms/;
const RESULT_RE =
  /letzte (\d+) Ergebnisse\): Median ([\d,]+)\sms, längste ([\d,]+)\sms; Darstellung des Ergebnisses längstens ([\d,]+)\sms; davon Rechnen: Median ([\d,]+)\sms/;
const BUSY_RE = /angezeigt seit dem Laden: ([\d.\s]+)-mal; längste Wartezeit auf ein Ergebnis: (?:([\d,]+)\sms|–)/;
const EVENT_RE = /\(Event Timing, letzte (\d+)\): ([\d,]+)\sms/;
const READOUT_IDS = { normal: 'timing', frameMiss: 'timing-frame', grenzfall: 'timing-worst', rescan: 'timing-rescan' };

function parseReadout(text) {
  const m = text.match(READOUT);
  expect(m, text).not.toBeNull();
  return { median: num(m[1]), p95: num(m[2]) };
}

const textOf = (page, id) => page.locator(`#${id}`).textContent();

async function readInput(page) {
  const m = (await textOf(page, 'timing-input')).match(INPUT_RE);
  expect(m).not.toBeNull();
  return { n: Number(m[1]), reactMed: num(m[2]), reactMax: num(m[3]), mainMed: num(m[4]), mainMax: num(m[5]) };
}

async function readResult(page) {
  const m = (await textOf(page, 'timing-result')).match(RESULT_RE);
  expect(m).not.toBeNull();
  return { n: Number(m[1]), med: num(m[2]), max: num(m[3]), renderMax: num(m[4]), computeMed: num(m[5]) };
}

async function readBusy(page) {
  const text = await textOf(page, 'timing-busy');
  const m = text.match(BUSY_RE);
  expect(m, text).not.toBeNull();
  return { count: num(m[1]), longest: m[2] ? num(m[2]) : null };
}

async function readEvent(page) {
  const text = await textOf(page, 'timing-event');
  const m = text.match(EVENT_RE);
  return { text, n: m ? Number(m[1]) : 0, max: m ? num(m[2]) : null };
}

/** One bench: wait for data-bench-runs = runs, then parse the four worker readouts. */
async function benchReadouts(page, runs) {
  await expect(page.locator('#tech')).toHaveAttribute('data-bench-runs', String(runs), { timeout: 180_000 });
  const out = {};
  for (const [caseId, id] of Object.entries(READOUT_IDS)) out[caseId] = parseReadout(await textOf(page, id));
  return out;
}

async function typePair(page, { sph, cyl, axis, pd, material, shape, A, B, DBL }) {
  await page.locator(`input[name=material][value=${material}]`).check();
  await page.locator(`input[name=frame-shape][value=${shape}]`).check();
  await page.locator('#frame-a').fill(A);
  await page.locator('#frame-b').fill(B);
  await page.locator('#frame-dbl').fill(DBL);
  for (const e of ['od', 'os']) {
    await page.locator(`#rx-${e}-sph`).fill(sph);
    await page.locator(`#rx-${e}-cyl`).fill(cyl);
    await page.locator(`#rx-${e}-axis`).fill(axis);
    await page.locator(`#rx-${e}-pd`).fill(pd);
  }
  await settled(page);
}

const CASE_A = { sph: '-4', cyl: '-2', axis: '30', pd: '32', material: 'cr39', shape: 'rechteckig', A: '52', B: '38', DBL: '18' };
// The 01-12 Grenzfall typed in. The page has no fitting-height field (D-04), so it computes FH
// null, not FH 0; the exact FH-0 Grenzfall is the #timing-worst worker readout.
const CASE_B = { sph: '+10,75', cyl: '-1', axis: '89', pd: '36', material: 'idx167', shape: 'rechteckig', A: '43', B: '43', DBL: '21' };
const OD_CELLS = ['ct', 'thick', 'etmin', 'weight', 'dec', 'etmax', 'basecurve', 'status'];
const odColumn = (page) => page.evaluate((cells) => cells.map((c) => document.getElementById(`result-od-${c}`).textContent).join(' | '), OD_CELLS);

/**
 * Discriminating pair (lens-critic MAJOR-1): etmax if the two values give different etmax,
 * otherwise the whole OD column text. Asserts the pair differs.
 */
async function discriminator(page, [a, b]) {
  const sph = page.locator('#rx-od-sph');
  await sph.fill(a);
  await settled(page);
  const ea = await etmaxOf(page, 'od');
  const ca = await odColumn(page);
  await sph.fill(b);
  await settled(page);
  const eb = await etmaxOf(page, 'od');
  const cb = await odColumn(page);
  if (ea !== eb) return { by: 'etmax', values: [ea, eb] };
  expect(ca).not.toBe(cb);
  return { by: 'OD column text', values: [ca, cb] };
}

/** EDITS fills of OD Sph alternating between two values, each followed by settled. */
async function editRun(page, values) {
  const sph = page.locator('#rx-od-sph');
  for (let i = 0; i < EDITS; i++) {
    await sph.fill(values[i % 2]);
    await settled(page);
  }
  const input = await readInput(page);
  const result = await readResult(page);
  expect(input.n).toBe(EDITS);
  return { input, result };
}

test('CPU-throttled phone proxy (ENG-09 restated, 01-15)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP sessions are Chromium-only');
  test.setTimeout(30 * 60_000);
  const results = [];
  for (const rate of RATES) {
    await page.goto('./');
    await settled(page);
    await expect(page.locator('#compute-mode')).toHaveAttribute('data-mode', 'worker');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const row = { rate, benchmarkIndex: await page.evaluate(computeBenchmarkIndex) };

    // (i) worker readouts (information only; the worker is NOT throttled)
    row.workerUnthrottled = [];
    await page.locator('details#tech > summary').click();
    row.workerUnthrottled.push(await benchReadouts(page, 1));
    for (let run = 2; run <= BENCH_RUNS_PER_RATE; run++) {
      await page.locator('#timing-rerun').click();
      row.workerUnthrottled.push(await benchReadouts(page, run));
    }
    await expect(page.locator('#tech')).not.toHaveAttribute('aria-busy', /.*/);

    // (ii) case A: the canonical normal pair, OD Sph −4,25 / −4,00
    await typePair(page, CASE_A);
    const discA = await discriminator(page, ['-4,25', '-4,00']);
    row.caseA = { discriminator: discA, ...(await editRun(page, ['-4,25', '-4,00'])) };

    // (iii) case B: the Grenzfall typed (FH null), OD Sph +11,00 / +10,75
    await typePair(page, CASE_B);
    const discB = await discriminator(page, ['+11,00', '+10,75']);
    row.caseB = { discriminator: discB, ...(await editRun(page, ['+11,00', '+10,75'])) };

    // (iv) extreme run: case A edits typed key by key while the worker runs the rescan bench
    await typePair(page, CASE_A);
    await page.locator('#timing-rerun').click();
    await expect(page.locator('#timing-worst')).toHaveText(READOUT, { timeout: 180_000 });
    const rescanRunningAtStart = (await textOf(page, 'timing-rescan')).includes('wird gemessen');
    const sph = page.locator('#rx-od-sph');
    // The ring keeps 10 frames and one edit here is up to 6 inputs, so the maxima are read after every edit.
    const ext = { reactMax: 0, mainMax: 0, renderMax: 0 };
    for (let i = 0; i < EDITS; i++) {
      await sph.fill('');
      await sph.pressSequentially(i % 2 ? '-4,00' : '-4,25');
      await settled(page);
      const inp = await readInput(page);
      const res = await readResult(page);
      ext.reactMax = Math.max(ext.reactMax, inp.reactMax);
      ext.mainMax = Math.max(ext.mainMax, inp.mainMax);
      ext.renderMax = Math.max(ext.renderMax, res.renderMax);
    }
    row.extreme = {
      rescanRunningAtStart,
      ...ext,
      input: await readInput(page),
      result: await readResult(page),
      event: await readEvent(page),
      busy: await readBusy(page),
      finalEtmax: await etmaxOf(page, 'od'),
      expectedEtmax: discA.by === 'etmax' ? discA.values[1] : null,
    };
    await benchReadouts(page, BENCH_RUNS_PER_RATE + 1);
    row.extreme.busyAfterBench = await readBusy(page);
    row.extreme.eventAfterBench = await readEvent(page);

    // Verdict (MINOR-10): (a)/(b) measured on the main thread; (c)/(d) estimated.
    const mains = [row.caseA, row.caseB].flatMap((c) => [c.input.mainMax, c.result.renderMax]).concat([ext.mainMax, ext.renderMax]);
    const reacts = [row.caseA.input.reactMax, row.caseB.input.reactMax, ext.reactMax];
    const overhead = row.caseA.result.max - row.caseA.result.computeMed;
    const estimateC = overhead + COMPUTE14_P95[rate].normal;
    const predictedRescanWait = overhead + COMPUTE14_P95[rate].rescan;
    row.verdict = {
      a: { measured: true, worstMs: Math.max(...mains), pass: Math.max(...mains) < 16.7 },
      b: { measured: true, worstMs: Math.max(...reacts), pass: Math.max(...reacts) <= 200 },
      c: { estimated: true, overheadMs: overhead, estimateMs: estimateC, pass: estimateC <= 100 },
      d: {
        estimated: true,
        predictedRescanWaitMs: predictedRescanWait,
        rechnetExpected: predictedRescanWait > 50,
        pass: row.extreme.finalEtmax === row.extreme.expectedEtmax && row.extreme.result.n > 0,
      },
    };

    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
    expect(row.extreme.finalEtmax).toBe(7.3);
    results.push(row);
    console.info(JSON.stringify(row));
  }
  const host = { userAgent: await page.evaluate(() => navigator.userAgent) };
  writeFileSync(OUT, JSON.stringify({ host, results }, null, 2));
  console.info(`perf-throttled results written to ${OUT}`);
});
