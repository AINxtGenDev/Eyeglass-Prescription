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
import { settled, settledCompare, etmaxOf } from './helpers.js';
/* global document -- page.evaluate bodies run in the browser */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.PERF_OUT ?? path.join(ROOT, 'test-results', 'perf-throttled.json');
// 02-20 attribution mode: with PERF_TRACE=<file.json> the page opens with ?perfmarks (user timings
// 'u:*' around the update() / requestMain / startCompare segments and 'u:inputFrame' = the
// ring's measured frame window), and the 4× case A / B edit runs and the 1× extreme run are
// wrapped in a Chromium trace. Without PERF_TRACE the spec runs exactly as before.
// Verified API: browser.startTracing(page?, { categories?, path?, screenshots? }) and
// browser.stopTracing(): Promise<Buffer> (node_modules/playwright-core/types/types.d.ts, 1.65.0).
const TRACE_OUT = process.env.PERF_TRACE ?? null;
// Categories checked by a trial trace (2026-11-07, Chromium of Playwright 1.65): RunTask in
// disabled-by-default-devtools.timeline; UpdateLayoutTree, Layout, PrePaint, Paint, Layerize,
// Commit, FireAnimationFrame, TimerFire, HandlePostMessage in devtools.timeline; MinorGC /
// MajorGC in devtools.timeline,v8; measures as nestable async b/e (zero length: 'n') in
// blink.user_timing.
const TRACE_CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'blink.user_timing',
  'toplevel',
  'v8',
];
const TRACED = { 4: ['caseA', 'caseB'], 1: ['extreme'] };
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
const COMPARE_RE = /\(letzte (\d+)\): Median ([\d,]+)\sms, längste ([\d,]+)\sms/;
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

/** 02-07: the compare paint frame incl. paint (#timing-compare), measured on the main thread. */
async function readCompare(page) {
  const text = await textOf(page, 'timing-compare');
  const m = text.match(COMPARE_RE);
  expect(m, text).not.toBeNull();
  return { measured: true, n: Number(m[1]), med: num(m[2]), max: num(m[3]) };
}

/**
 * 02-20: the deferred compare start task (#timing-compare-start) and data-min-gap, the smallest
 * start − input-frame end in ms (amendment MJ-1: must be ≥ 0, the task never runs inside a
 * measured input frame).
 */
async function readCompareStart(page) {
  const el = page.locator('#timing-compare-start');
  const text = await el.textContent();
  const m = text.match(COMPARE_RE);
  expect(m, text).not.toBeNull();
  const minGap = Number(await el.getAttribute('data-min-gap'));
  expect(minGap, 'compare start before the end of its input frame').toBeGreaterThanOrEqual(0);
  return { measured: true, n: Number(m[1]), med: num(m[2]), max: num(m[3]), minGapMs: minGap };
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

// ---- Trace attribution (02-20) ----

// Leaf JS segments of the input frame (src/ui/main.js update, src/ui/pipeline.js requestMain /
// startCompare). u:rm.startCompare is the sum of the u:sc.* leaves.
const JS_LEAVES = [
  'u:readRx',
  'u:readFrame',
  'u:material',
  'u:materialLine',
  'u:specs',
  'u:notes',
  'u:rm.keys',
  'u:rm.request',
  'u:rm.rimFootnote',
  'u:sc.markOutdated',
  'u:sc.buildJobs',
  'u:sc.sendCompare',
  'u:sc.schedulePaint',
];
const RENDER = { style: ['UpdateLayoutTree'], layout: ['Layout'], paint: ['PrePaint', 'Paint', 'Layerize', 'Commit'] };
const GC = ['MinorGC', 'MajorGC'];
const r1 = (v) => Math.round(v * 100) / 100;

/** Pair the user-timing b/e events (n = zero length) into intervals in µs. */
function measures(events, tid) {
  const open = new Map();
  const out = [];
  for (const e of events) {
    if (e.tid !== tid || !e.cat?.includes('blink.user_timing') || !e.name?.startsWith('u:')) continue;
    const id = e.name + '|' + (e.id2?.local ?? e.id);
    if (e.ph === 'n') out.push({ name: e.name, ts: e.ts, end: e.ts });
    else if (e.ph === 'b') open.set(id, e.ts);
    else if (e.ph === 'e' && open.has(id)) {
      out.push({ name: e.name, ts: open.get(id), end: e.ts });
      open.delete(id);
    }
  }
  return out;
}

/** Length of the part of [a, b] covered by the union of intervals (µs). */
function covered(intervals, a, b) {
  const xs = intervals
    .map((x) => [Math.max(a, x.ts), Math.min(b, x.end)])
    .filter(([s, e]) => e > s)
    .sort((p, q) => p[0] - q[0]);
  let sum = 0;
  let cur = null;
  for (const [s, e] of xs) {
    if (!cur || s > cur[1]) {
      if (cur) sum += cur[1] - cur[0];
      cur = [s, e];
    } else cur[1] = Math.max(cur[1], e);
  }
  if (cur) sum += cur[1] - cur[0];
  return sum;
}

/**
 * Per measured input frame (window = the 'u:inputFrame' measure, i.e. exactly the ring's
 * rAF start → after-paint timeout): ms per bucket. JS = the u:* leaves; style / layout / paint
 * and GC are counted outside u:update (inside it they are forced work and listed as
 * forcedInJs); idle = window minus RunTask coverage; other = busy minus every named bucket.
 * Plus every main-thread task > 4 ms that starts within 100 ms after the frame start but
 * outside the frame window.
 */
function attribute(buf) {
  const json = JSON.parse(buf.toString());
  const events = json.traceEvents ?? json;
  const tid = events.find((e) => e.name === 'u:inputFrame')?.tid;
  if (tid === undefined) return { frames: [], note: 'no u:inputFrame measure in the trace' };
  const ms = measures(events, tid);
  const x = events.filter((e) => e.tid === tid && e.ph === 'X' && e.dur > 0).map((e) => ({ ...e, end: e.ts + e.dur }));
  const tasks = x.filter((e) => e.name === 'RunTask');
  const frames = [];
  for (const f of ms.filter((m) => m.name === 'u:inputFrame')) {
    const inside = (e) => e.ts >= f.ts && e.ts < f.end;
    const updates = ms.filter((m) => m.name === 'u:update' && inside(m));
    const b = { frameMs: (f.end - f.ts) / 1000 };
    for (const name of JS_LEAVES) b[name] = ms.filter((m) => m.name === name && inside(m)).reduce((s, m) => s + m.end - m.ts, 0) / 1000;
    b['u:update'] = updates.reduce((s, m) => s + m.end - m.ts, 0) / 1000;
    for (const name of ['u:requestMain', 'u:rm.startCompare']) {
      b[name] = ms.filter((m) => m.name === name && inside(m)).reduce((s, m) => s + m.end - m.ts, 0) / 1000;
    }
    const outsideJs = (e) => covered(updates, e.ts, e.end) === 0;
    let forced = 0;
    for (const [bucket, names] of Object.entries({ ...RENDER, gc: GC })) {
      const evs = x.filter((e) => names.includes(e.name) && inside(e));
      b[bucket] = evs.filter(outsideJs).reduce((s, e) => s + e.dur, 0) / 1000;
      forced += evs.filter((e) => !outsideJs(e)).reduce((s, e) => s + e.dur, 0) / 1000;
    }
    b.forcedInJs = forced;
    const busy = covered(tasks, f.ts, f.end) / 1000;
    b.idle = b.frameMs - busy;
    b.other = busy - b['u:update'] - b.style - b.layout - b.paint - b.gc;
    const frameTasks = tasks.filter((t) => t.end > f.ts && t.ts < f.end);
    // 'other' by trace event name: self time (own duration minus nested events) of the X events
    // in the frame window outside u:update and outside the named buckets.
    const named = new Set([...Object.values(RENDER).flat(), ...GC]);
    const win = x.filter((e) => e.ts >= f.ts && e.end <= f.end).sort((p, q) => p.ts - q.ts || q.dur - p.dur);
    const selfBy = {};
    const stack = [];
    for (const e of win) {
      while (stack.length && stack.at(-1).end <= e.ts) stack.pop();
      const parent = stack.at(-1);
      e.self = e.dur;
      e.skip = (parent?.skip ?? false) || named.has(e.name) || covered(updates, e.ts, e.end) > 0;
      if (parent) parent.self -= e.dur;
      stack.push(e);
    }
    for (const e of win) if (!e.skip) selfBy[e.name] = (selfBy[e.name] ?? 0) + e.self / 1000;
    b.otherTop = Object.entries(selfBy)
      .filter(([, v]) => v >= 0.2)
      .sort((p, q) => q[1] - p[1])
      .slice(0, 8)
      .map(([name, v]) => [name, r1(v)]);
    // DevTools-protocol tasks (the Playwright harness's commands: fill, expect polling, tracing)
    // that run inside the window; a phone without DevTools has none of them.
    const devtools = x.filter(
      (e) => e.name === 'Receive mojo message' && e.args?.chrome_mojo_event_info?.mojo_interface_tag === 'blink.mojom.DevToolsSession',
    );
    b.devtoolsInFrame = covered(devtools, f.ts, f.end) / 1000;
    b.tasksInFrame = frameTasks.length;
    b.longestTaskInFrame = Math.max(0, ...frameTasks.map((t) => t.dur)) / 1000;
    // Work an input causes outside its measured frame (the deferred compare start, paints).
    b.tasksAfter = tasks
      .filter((t) => t.ts >= f.end && t.ts - f.ts <= 100_000 && t.dur > 4000)
      .map((t) => ({
        startAfterFrameStartMs: r1((t.ts - f.ts) / 1000),
        durMs: r1(t.dur / 1000),
        top: [...new Set(x.filter((e) => e !== t && e.ts >= t.ts && e.end <= t.end && e.dur > 1000).map((e) => e.name))].slice(0, 6),
      }));
    for (const k of Object.keys(b)) if (typeof b[k] === 'number') b[k] = r1(b[k]);
    frames.push(b);
  }
  const summary = {};
  for (const k of Object.keys(frames[0] ?? {})) {
    if (typeof frames[0][k] !== 'number') continue;
    const v = frames.map((f) => f[k]).sort((p, q) => p - q);
    summary[k] = { median: r1(v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2), max: v.at(-1) };
  }
  const longest = frames.reduce((m, f) => (f.frameMs > (m?.frameMs ?? -1) ? f : m), null);
  return { n: frames.length, summary, longest, frames };
}

/** Run fn inside a Chromium trace when this rate/run is traced; returns [fn result, attribution]. */
async function traced(browser, page, rate, run, fn) {
  if (!TRACE_OUT || !TRACED[rate]?.includes(run)) return [await fn(), null];
  await browser.startTracing(page, { categories: TRACE_CATEGORIES });
  let out;
  try {
    out = await fn();
  } catch (err) {
    await browser.stopTracing();
    throw err;
  }
  const buf = await browser.stopTracing();
  // The raw trace next to the attribution, for DevTools (Performance panel → Load profile).
  writeFileSync(`${TRACE_OUT.replace(/\.json$/, '')}.${rate}x-${run}.trace.json`, buf);
  return [out, attribute(buf)];
}

const CASE_A = { sph: '-4', cyl: '-2', axis: '30', pd: '32', material: 'cr39', shape: 'rechteckig', A: '52', B: '38', DBL: '18' };
// The 01-12 Grenzfall typed in. The page has no fitting-height field (D-04), so it computes FH
// null, not FH 0; the exact FH-0 Grenzfall is the #timing-worst worker readout.
const CASE_B = { sph: '+10,75', cyl: '-1', axis: '89', pd: '36', material: 'idx167', shape: 'rechteckig', A: '43', B: '43', DBL: '21' };
const OD_CELLS = ['ct', 'thick', 'thin', 'etmin', 'weight', 'dec', 'etmax', 'basecurve', 'status'];
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

test('CPU-throttled phone proxy (ENG-09 restated, 01-15)', async ({ page, browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP sessions are Chromium-only');
  test.setTimeout(30 * 60_000);
  const results = [];
  const traces = [];
  for (const rate of RATES) {
    await page.goto(TRACE_OUT ? './?perfmarks' : './');
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
    const [runA, traceA] = await traced(browser, page, rate, 'caseA', () => editRun(page, ['-4,25', '-4,00']));
    row.caseA = { discriminator: discA, ...runA };
    if (traceA) traces.push({ rate, run: 'caseA', ...traceA });
    // 02-07: the comparison lane ran behind every edit; its paint frames share the main thread.
    await settledCompare(page, { timeout: 60_000 });
    row.caseA.compareFrame = await readCompare(page);
    row.caseA.compareStart = await readCompareStart(page);

    // (iii) case B: the Grenzfall typed (FH null), OD Sph +11,00 / +10,75
    await typePair(page, CASE_B);
    const discB = await discriminator(page, ['+11,00', '+10,75']);
    const [runB, traceB] = await traced(browser, page, rate, 'caseB', () => editRun(page, ['+11,00', '+10,75']));
    row.caseB = { discriminator: discB, ...runB };
    if (traceB) traces.push({ rate, run: 'caseB', ...traceB });
    // 02-20: the compare start after each case B input is a main-thread task an input causes.
    await settledCompare(page, { timeout: 60_000 });
    row.caseB.compareStart = await readCompareStart(page);

    // (iv) extreme run: case A edits typed key by key while the worker runs the rescan bench
    await typePair(page, CASE_A);
    await page.locator('#timing-rerun').click();
    await expect(page.locator('#timing-worst')).toHaveText(READOUT, { timeout: 180_000 });
    const rescanRunningAtStart = (await textOf(page, 'timing-rescan')).includes('wird gemessen');
    const sph = page.locator('#rx-od-sph');
    // The ring keeps 10 frames and one edit here is up to 6 inputs, so the maxima are read after every edit.
    const ext = { reactMax: 0, mainMax: 0, renderMax: 0 };
    const [, traceExt] = await traced(browser, page, rate, 'extreme', async () => {
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
    });
    if (traceExt) traces.push({ rate, run: 'extreme', ...traceExt });
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
    const mains = [row.caseA, row.caseB]
      .flatMap((c) => [c.input.mainMax, c.result.renderMax])
      .concat([ext.mainMax, ext.renderMax, row.caseA.compareFrame.max, row.caseA.compareStart.max, row.caseB.compareStart.max]);
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
  if (TRACE_OUT) {
    writeFileSync(TRACE_OUT, JSON.stringify({ host, categories: TRACE_CATEGORIES, traces }, null, 2));
    for (const tr of traces) {
      expect(tr.n, `${tr.rate}× ${tr.run}: traced input frames`).toBeGreaterThan(0);
      console.info(`trace ${tr.rate}× ${tr.run} (n ${tr.n}) bucket: median / max ms`);
      for (const [k, v] of Object.entries(tr.summary)) console.info(`  ${k.padEnd(20)} ${v.median} / ${v.max}`);
      console.info(`  longest frame: ${JSON.stringify(tr.longest)}`);
    }
    console.info(`perf-throttled trace attribution written to ${TRACE_OUT}`);
  }
});
