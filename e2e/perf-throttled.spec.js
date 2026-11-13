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
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settled, settledCompare, settledView, etmaxOf } from './helpers.js';
/* global document, window, requestAnimationFrame -- page.evaluate bodies run in the browser */

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
// 02-22 (user decision 2026-11-07, "Fix the measurement"): how the case A / B edit runs are
// driven. 'quiet' (default): per edit locator.selectText() (outside the measured frame), then
// page.keyboard.insertText(value) = one CDP command, Input.insertText, which dispatches the input,
// then a Node-side timer of QUIET_MS with NO browser command, then the reads. So no page.evaluate,
// expect polling, locator call or CDP command lands between the input and its frame-end stamp
// (02-20 trace: a blink.mojom.DevToolsSession task of 10–16 ms sat inside every measured 4× frame).
// Same input path as fill(): for a text input Playwright 1.65's fill runs the injected
// selectText(element) (input.select(); input.focus()), returns 'needsinput' and then sends
// Input.insertText (node_modules/playwright-core/lib/coreBundle.js: _fill, injected fill,
// crInput sendText). fill() itself is not used because it releases its element handle
// (Runtime.releaseObject, fire-and-forget in a finally) after Input.insertText, and a first quiet
// trace showed that 248-byte DevToolsSession task inside 3 of 10 measured 4× case A frames.
// selectText() releases its handles the same way, and a second trace showed one such release
// processed by the renderer after the input (4× case B, 1 of 10 frames), so before the input the
// spec flushes the DevTools session: one page.evaluate round trip (commands of one session are
// handled in order, so the release is done when it answers), then 50 ms of Node-side quiet.
// 'legacy': fill then settled() at once, i.e. the 02-14 / 02-20 method, kept so the before/after
// comparison can be reproduced. The extreme run (keystrokes while the bench runs; its keys are
// the input) is the same in both methods.
const METHOD = process.env.PERF_METHOD ?? 'quiet';
if (!['quiet', 'legacy'].includes(METHOD)) throw new Error(`PERF_METHOD must be quiet or legacy, not ${METHOD}`);
// 02-20 untraced runs: input → frame end ≤ 37,4 ms at 4× and ≤ 60,6 ms at 6×; input → result
// painted ≤ 61,2 ms at 4× and ≤ 99,5 ms at 6×. 500 ms is ≥ 5× the 6× worst case.
const QUIET_MS = Number(process.env.PERF_QUIET_MS ?? 500);
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
// 03-15 (Rule 1): a readout of 1 000 ms or more carries a digit-group space ('2 547,50 ms', de-AT
// Intl.NumberFormat); `[\d,]+` did not match it, so the run stopped at readResult. Since the 3D view
// loads in this spec (03-05), a SwiftShader render can hold a result paint that long at 1×.
const READOUT = /Median\s(\d+(?:\s\d{3})*(?:,\d+)?)\sms, p95\s(\d+(?:\s\d{3})*(?:,\d+)?)\sms/;
const INPUT_RE =
  /letzte (\d+) Eingaben\): Median (\d+(?:\s\d{3})*(?:,\d+)?)\sms, längste (\d+(?:\s\d{3})*(?:,\d+)?)\sms; Hauptthread je Eingabe einschließlich Darstellung: Median (\d+(?:\s\d{3})*(?:,\d+)?)\sms, längste (\d+(?:\s\d{3})*(?:,\d+)?)\sms/;
const RESULT_RE =
  /letzte (\d+) Ergebnisse\): Median (\d+(?:\s\d{3})*(?:,\d+)?)\sms, längste (\d+(?:\s\d{3})*(?:,\d+)?)\sms; Darstellung des Ergebnisses längstens (\d+(?:\s\d{3})*(?:,\d+)?)\sms; davon Rechnen: Median (\d+(?:\s\d{3})*(?:,\d+)?)\sms/;
const BUSY_RE = /angezeigt seit dem Laden: ([\d.\s]+)-mal; längste Wartezeit auf ein Ergebnis: (?:(\d+(?:\s\d{3})*(?:,\d+)?)\sms|–)/;
const COMPARE_RE = /\(letzte (\d+)\): Median (\d+(?:\s\d{3})*(?:,\d+)?)\sms, längste (\d+(?:\s\d{3})*(?:,\d+)?)\sms/;
const EVENT_RE = /\(Event Timing, letzte (\d+)\): (\d+(?:\s\d{3})*(?:,\d+)?)\sms/;
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
    b.devtoolsTasksInFrame = devtools.filter((e) => e.end > f.ts && e.ts < f.end).length;
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

/**
 * EDITS fills of OD Sph alternating between two values, each followed by settled. Quiet method
 * (02-22): between fill() and the reads only a Node timer runs, so the measured input frame, its
 * result frame and the compare start contain no harness work; the first read after the window
 * records whether the result was already painted (quietSettled = edits where it was).
 */
async function editRun(page, values) {
  const sph = page.locator('#rx-od-sph');
  let quietSettled = 0;
  for (let i = 0; i < EDITS; i++) {
    if (METHOD === 'quiet') {
      await sph.selectText();
      await page.evaluate(() => 0); // flush the handle releases of selectText (see METHOD)
      await sleep(50);
      await page.keyboard.insertText(values[i % 2]);
      // ---- quiet window: no browser command until the timer fires ----
      await sleep(QUIET_MS);
      const done = await page.evaluate(() => document.getElementById('result').dataset.pending === '');
      if (done) quietSettled++;
    } else {
      await sph.fill(values[i % 2]);
    }
    await settled(page);
  }
  const input = await readInput(page);
  const result = await readResult(page);
  expect(input.n).toBe(EDITS);
  return METHOD === 'quiet' ? { input, result, quietSettled } : { input, result };
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
    // The ENG-09 (a) pass rule of 02-20 / 02-22, unchanged: every case A / B input frame and every
    // deferred compare start < 16,7 ms (the plan-level rule; verdict.a below also counts the extreme
    // run and the result / compare paint frames, as before).
    const ruleA = {
      caseAInputMax: row.caseA.input.mainMax,
      caseBInputMax: row.caseB.input.mainMax,
      compareStartMax: Math.max(row.caseA.compareStart.max, row.caseB.compareStart.max),
    };
    ruleA.pass = Math.max(ruleA.caseAInputMax, ruleA.caseBInputMax, ruleA.compareStartMax) < 16.7;
    row.verdict = {
      ruleA,
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
  const host = { userAgent: await page.evaluate(() => navigator.userAgent), method: METHOD, quietMs: METHOD === 'quiet' ? QUIET_MS : null };
  writeFileSync(OUT, JSON.stringify({ host, results }, null, 2));
  console.info(`perf-throttled results written to ${OUT}`);
  if (TRACE_OUT) {
    writeFileSync(TRACE_OUT, JSON.stringify({ host, categories: TRACE_CATEGORIES, traces }, null, 2));
    for (const tr of traces) {
      expect(tr.n, `${tr.rate}× ${tr.run}: traced input frames`).toBeGreaterThan(0);
      console.info(`trace ${tr.rate}× ${tr.run} (n ${tr.n}) bucket: median / max ms`);
      for (const [k, v] of Object.entries(tr.summary)) console.info(`  ${k.padEnd(20)} ${v.median} / ${v.max}`);
      console.info(`  longest frame: ${JSON.stringify(tr.longest)}`);
      // 02-22 trace proof: with the quiet method no DevTools-session task overlaps a measured
      // case A / B input frame (the extreme run's keys are themselves DevTools commands).
      if (METHOD === 'quiet' && tr.run !== 'extreme') {
        expect(tr.summary.devtoolsTasksInFrame.max, `${tr.rate}× ${tr.run}: DevToolsSession tasks in a measured frame`).toBe(0);
      }
    }
    console.info(`perf-throttled trace attribution written to ${TRACE_OUT}`);
  }
});

// ---- 03-15 (VIZ-06 proxy part, D-28; lens-critic MAJOR 3, MINOR 4, R1-9) ----
// Informational, never fails on time. Same session (this file, after the unchanged ENG-09 test
// above), so the ENG-09 blocks show that they did not regress (RESEARCH Pitfall 12).
// - '3D-Neuaufbau' (remesh): the ?perfmarks user timing u:view-input-paint = the input event of an
//   Rx edit → the render that shows its re-meshed lenses (view.js), 10 Sph edits per layout at 4×,
//   at 1280 × 800 and in the phone layout at 412 × 915 (there each re-mesh frame also carries the
//   bar thumbnail: 2 passes). Target ≤ 200 ms = the INP 'good' threshold
//   (https://web.dev/articles/inp), as for ENG-09 (b); not a RAIL number (lens-critic MINOR 4).
// - Orbit: a 3 s synthetic mouse drag on #view-stage (pointer path); the intervals between
//   consecutive requestAnimationFrame callbacks (each frame renders, render on demand), median and
//   p95. Target ≤ 16,7 ms = one 60 Hz frame.
// - ENG-09 (c) with 3D (MAJOR 3): 3D view loaded and a configuration comparison active (A = CR-39,
//   B = 1,67, so A and the frame A rim exist and compare jobs run behind every edit), 10 case A
//   edits with the quiet method, read exactly like the ENG-09 (c) block above: the measured input →
//   result painted (#timing-result) and the estimate (overhead + COMPUTE14_P95[4].normal). Target
//   ≤ 100 ms (RAIL response, https://web.dev/articles/rail).
// Limits, stated with every number: CDP CPU throttling reaches neither the workers (01-15) nor
// SwiftShader, the software WebGL of headless Chromium, which renders on CPU threads of the GPU
// process (≈ 0,15–0,9 s per frame measured in 03-14). So the 3D numbers are software-rendered and
// say nothing about a phone GPU; the real-phone numbers are measured in 03-17.
const WORKER_NOTE = 'worker unthrottled (CDP CPU throttling does not reach workers, 01-15)';
const SOFTWARE_NOTE = 'software-rendered (SwiftShader, headless Chromium); not a phone GPU number';
/** Quiet window after a 3D edit (Node timer, no browser command): SwiftShader re-mesh + render [BP]. */
const VIEW_QUIET_MS = Number(process.env.PERF_VIEW_QUIET_MS ?? 4000);
const ORBIT_MS = 3000;
const stats = (xs) => {
  const v = [...xs].sort((a, b) => a - b);
  if (v.length === 0) return { n: 0, median: null, p95: null, max: null };
  const q = (p) => v[Math.min(v.length - 1, Math.ceil(p * v.length) - 1)];
  const median = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return { n: v.length, median: r1(median), p95: r1(q(0.95)), max: r1(v.at(-1)) };
};

/** 10 quiet Sph edits; returns the u:view-input-paint durations (ms) they produced. */
async function viewEditRun(page, values) {
  await page.evaluate(() => performance.clearMeasures('u:view-input-paint'));
  const sph = page.locator('#rx-od-sph');
  for (let i = 0; i < EDITS; i++) {
    await sph.selectText();
    await page.evaluate(() => 0);
    await sleep(50);
    await page.keyboard.insertText(values[i % 2]);
    await sleep(VIEW_QUIET_MS);
    await settledView(page, { timeout: 120_000 });
  }
  return page.evaluate(() => performance.getEntriesByName('u:view-input-paint').map((e) => e.duration));
}

/** rAF intervals (ms) during a ORBIT_MS mouse drag across the stage. */
async function orbitRun(page) {
  await page.locator('#view-stage').scrollIntoViewIfNeeded();
  const box = await page.locator('#view-stage').boundingBox();
  const x0 = box.x + box.width / 2;
  const y0 = box.y + box.height / 2;
  await page.evaluate(() => {
    window.__rafTimes = [];
    window.__rafOn = true;
    const tick = (t) => {
      window.__rafTimes.push(t);
      if (window.__rafOn) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const t0 = Date.now();
  let k = 0;
  while (Date.now() - t0 < ORBIT_MS) {
    k++;
    await page.mouse.move(x0 + 60 * Math.sin(k / 8), y0 + 20 * Math.sin(k / 13));
  }
  await page.mouse.up();
  const times = await page.evaluate(() => {
    window.__rafOn = false;
    return window.__rafTimes;
  });
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
  return { moves: k, ...stats(gaps) };
}

test('3D-Neuaufbau, orbit and ENG-09 (c) with 3D on the 4× proxy (03-15, informational)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP sessions are Chromium-only');
  test.setTimeout(30 * 60_000);
  const rate = 4;
  const view3d = {
    rate,
    workerThrottled: false,
    note: WORKER_NOTE,
    rendering: SOFTWARE_NOTE,
    targets: { remeshMs: 200, remeshSource: 'INP good, https://web.dev/articles/inp', orbitFrameMs: 16.7, eng09cMs: 100, eng09cSource: 'RAIL response, https://web.dev/articles/rail' },
    remesh: {},
    orbit: {},
  };
  for (const [name, vp] of [
    ['desktop1280x800', { width: 1280, height: 800 }],
    ['phone412x915', { width: 412, height: 915 }],
  ]) {
    await page.setViewportSize(vp);
    await page.goto('./?perfmarks');
    await settledView(page, { timeout: 120_000 });
    // Phone layout: the edits happen with the Rx fields on screen, so the bar (and its thumbnail) shows.
    await page.evaluate(() => window.scrollTo(0, 0));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const paints = await viewEditRun(page, ['-4,25', '-4,00']);
    const thumb = await page.evaluate(() => window.__eyeglassView.thumbInfo());
    view3d.remesh[name] = {
      workerThrottled: false,
      note: WORKER_NOTE,
      rendering: SOFTWARE_NOTE,
      inputToPaintMs: stats(paints),
      samples: paints.map(r1),
      barShown: await page.evaluate(() => !document.getElementById('summary-bar').hidden),
      thumbCopies: thumb.copies,
      passesPerThumbFrame: thumb.passesPerThumbFrame,
    };
    view3d.orbit[name] = { workerThrottled: false, note: WORKER_NOTE, rendering: SOFTWARE_NOTE, frameMs: await orbitRun(page) };
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
    console.info(`3D-Neuaufbau ${name} 4×: input → 3D paint ${JSON.stringify(view3d.remesh[name].inputToPaintMs)} (target ≤ 200 ms, INP good) — ${WORKER_NOTE}; ${SOFTWARE_NOTE}`);
    console.info(`Orbit ${name} 4×: rAF frame ${JSON.stringify(view3d.orbit[name].frameMs)} (target ≤ 16,7 ms) — ${WORKER_NOTE}; ${SOFTWARE_NOTE}`);
  }

  // ENG-09 (c) with the 3D view loaded and a configuration comparison active (MAJOR 3), 1280 × 800.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  await settledView(page, { timeout: 120_000 });
  await typePair(page, CASE_A);
  await page.locator('#cmp-start').click();
  await settledCompare(page, { timeout: 60_000 });
  await page.locator('input[name=material][value=idx167]').check();
  await settledCompare(page, { timeout: 60_000 });
  await settledView(page, { timeout: 120_000 });
  await page.waitForFunction(() => window.__eyeglassView.compareInfo().active && window.__eyeglassView.compareInfo().aReady, null, { timeout: 120_000 });
  await expect(page.locator('#compute-mode')).toHaveAttribute('data-mode', 'worker');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const run = await editRun(page, ['-4,25', '-4,00']);
  await settledCompare(page, { timeout: 60_000 });
  await settledView(page, { timeout: 120_000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.detach();
  const overhead = run.result.max - run.result.computeMed;
  view3d.eng09cWith3d = {
    workerThrottled: false,
    note: WORKER_NOTE,
    compareActive: await page.evaluate(() => window.__eyeglassView.compareInfo().active),
    ...run,
    measuredInputToResultMs: { median: run.result.med, max: run.result.max },
    c: { estimated: true, overheadMs: overhead, estimateMs: overhead + COMPUTE14_P95[rate].normal, pass: overhead + COMPUTE14_P95[rate].normal <= 100 },
  };
  console.info(
    `ENG-09 (c) with 3D + comparison 4×: input → result painted median ${run.result.med} ms, longest ${run.result.max} ms; ` +
      `estimate ${r1(view3d.eng09cWith3d.c.estimateMs)} ms (target ≤ 100 ms, RAIL) — ${WORKER_NOTE}`,
  );
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  writeFileSync(OUT, JSON.stringify({ ...prev, view3d }, null, 2));
  console.info(`view3d results added to ${OUT}`);
  expect(paintsOk(view3d)).toBe(true);
});

/** The numbers parse (the only assertion of this informational block). */
function paintsOk(v) {
  return Object.values(v.remesh).every((r) => r.inputToPaintMs.n > 0) && Number.isFinite(v.eng09cWith3d.result.med);
}

// 04-10 (D-17, REF-02; UI-SPEC Verification chrome-devtools item 4): input → Durchblick paint at 4×
// with the UI-SPEC clock (ref-mode.js: t0 = the input event timestamp, t1 = the first rAF after the
// render that drew the job), the grid tier reached and the worker compute time (tech.ref.compute),
// which the throttling does not reach. Informational: it asserts only that every edit's picture
// arrives (a sample per edit, the latest input drawn). The quiet method of 02-22: selectText and one
// flush outside the measured span, then Input.insertText, then a Node-side timer, then the reads.
const REF_QUIET_MS = Number(process.env.PERF_REF_QUIET_MS ?? 4000);

test('Durchblick input → picture and the grid tier on the 4× proxy (04-10, informational)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP sessions are Chromium-only');
  test.setTimeout(30 * 60_000);
  const rate = 4;
  const out = { rate, workerThrottled: false, note: WORKER_NOTE, rendering: SOFTWARE_NOTE, budgetMs: 200, budgetSource: 'INP good, https://web.dev/articles/inp', layouts: {} };
  for (const [name, vp, frame] of [
    ['desktop1280x800', { width: 1280, height: 800 }, null],
    ['desktop1280x800-rim', { width: 1280, height: 800 }, { shape: 'rund', A: 40, B: 28, DBL: 14, pd: '40' }],
  ]) {
    await page.setViewportSize(vp);
    await page.goto('./');
    await settledView(page, { timeout: 120_000 });
    if (frame) {
      await page.locator(`input[name=frame-shape][value=${frame.shape}]`).check();
      await page.locator('#frame-a').fill(String(frame.A));
      await page.locator('#frame-b').fill(String(frame.B));
      await page.locator('#frame-dbl').fill(String(frame.DBL));
      for (const eye of ['od', 'os']) await page.locator(`#rx-${eye}-pd`).fill(frame.pd);
      await settledView(page, { timeout: 120_000 });
    }
    await page.locator('#view-mode label', { hasText: 'Durchblick' }).click();
    await page.waitForFunction(() => window.__eyeglassView.ref().drawnGen > 0 && document.getElementById('view').dataset.pending === '', null, { timeout: 120_000 });
    const startTier = (await page.evaluate(() => window.__eyeglassView.ref())).tier;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const sph = page.locator('#rx-od-sph');
    const rows = [];
    for (let i = 0; i < EDITS; i++) {
      const r0 = await page.evaluate(() => window.__eyeglassView.ref());
      await sph.selectText();
      await page.evaluate(() => 0);
      await sleep(50);
      await page.keyboard.insertText(['-4,25', '-4,00'][i % 2]);
      await sleep(REF_QUIET_MS);
      await page.waitForFunction((k) => window.__eyeglassView.ref().sampleN > k && document.getElementById('view').dataset.pending === '', r0.sampleN, { timeout: 120_000 });
      const r = await page.evaluate(() => window.__eyeglassView.ref());
      // The edit's own job: its counted sample and its reply (a step's re-trace comes after it and
      // is not a counted sample). The logs are capped at 20 entries, more than one run adds.
      const counted = r.samples.slice(r0.samples.length);
      const job = r.replyLog.find((j) => j.gen > (r0.replyLog.at(-1)?.gen ?? 0));
      rows.push({
        ms: counted[0] ?? r.lastSampleMs,
        counted: counted.length > 0,
        jobTier: job?.replies[0]?.tier ?? null,
        tierAfter: r.tier,
        computeMs: job?.computeMs ?? r.computeMs,
        rays: job ? job.replies.reduce((a, x) => a + x.rays, 0) : null,
      });
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
    const end = await page.evaluate(() => ({
      ref: window.__eyeglassView.ref(),
      grid: document.getElementById('tech-ref-grid').textContent,
      time: document.getElementById('tech-ref-time').textContent,
      compute: document.getElementById('tech-ref-compute').textContent,
    }));
    out.layouts[name] = {
      startTier,
      tierReached: end.ref.tier,
      degraded: end.ref.degraded,
      stillSlow: end.ref.guard.stillSlow,
      inputToPictureMs: stats(rows.map((x) => x.ms)),
      countedInputToPictureMs: stats(rows.filter((x) => x.counted).map((x) => x.ms)),
      computeMs: stats(rows.map((x) => x.computeMs)),
      samples: rows.map((x) => ({ ...x, ms: r1(x.ms), computeMs: r1(x.computeMs) })),
      panels: end.ref.panels.map(({ eye, w, h, rim }) => ({ eye, w, h, rim })),
      tech: { grid: end.grid, time: end.time, compute: end.compute },
    };
    const L = out.layouts[name];
    console.info(
      `Durchblick ${name} 4×: input → picture ${JSON.stringify(L.inputToPictureMs)}; tier ${startTier} → ${L.tierReached}${L.stillSlow ? ' (stillSlow)' : ''}; ` +
        `worker compute ${JSON.stringify(L.computeMs)} — ${WORKER_NOTE}; ${SOFTWARE_NOTE}`,
    );
    // The latest picture arrives: the last edit is drawn (no warp pending) and every edit gave a sample.
    expect(rows.length).toBe(EDITS);
    expect(rows.every((x) => Number.isFinite(x.ms))).toBe(true);
  }
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  writeFileSync(OUT, JSON.stringify({ ...prev, durchblick: out }, null, 2));
  console.info(`durchblick results added to ${OUT}`);
});
