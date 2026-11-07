// ENG-09 timing and bench readouts (moved out of main.js in 02-05, no behaviour change): the
// Technische Angaben readouts, the input frame scheduler and the main-thread timing rings.
import { createFrameScheduler } from '../state/frame-scheduler.js';
import { TAIL_PCT } from '../state/compute-client.js';
import { NORMAL_PAIR, GRENZFALL_PAIR, RESCAN_PAIR } from '../state/bench-cases.js';
import { t } from '../i18n/t.js';
import { fmtMm, fmtMs } from '../i18n/format.js';
import { $, setText } from './dom.js';
import { fmtForm } from './rx-input.js';
import { pending, writePending, computeMode, busyCount, client } from './pipeline.js';

// The input frame's update(inputTs), injected by initTiming (main.js owns it; no import cycle).
let update;

/** Wire update(); call once before the first schedule(). */
export function initTiming(deps) {
  ({ update } = deps);
}

const DASH = '–';

// Test-only user timings (?perfmarks, 02-20): the measured input frame as a 'u:inputFrame'
// measure, so the perf spec's trace uses exactly the ring's frame window.
const PERF_MARKS = location.search.includes('perfmarks');

// Ring-buffer length for the input timing medians (ENG-09, lens-critic MAJOR-2).
const TIMING_WINDOW = 10;

const where = () => t(computeMode === 'sync' ? 'tech.where.sync' : 'tech.where.worker');

/** Readout label from the case's OD spec values (the case definition is in bench-cases.js). */
function caseLabel(pair) {
  const s = pair.OD;
  const label = t('tech.case', {
    rx: fmtForm(s),
    material: t('material.' + s.materialId),
    shape: t('frame.shape.' + s.frame.shape),
    A: fmtMm(s.frame.A),
    B: fmtMm(s.frame.B),
    dbl: fmtMm(s.frame.DBL),
    pd: fmtMm(s.monoPD),
  });
  return s.fittingHeight === null ? label : label + t('tech.caseFh', { fh: fmtMm(s.fittingHeight) });
}

// Worker bench readouts in run order (one run per worker job, 01-15).
const READOUTS = {
  normal: { id: 'timing', key: 'tech.timing', pair: NORMAL_PAIR },
  frameMiss: { id: 'timing-frame', key: 'tech.timingFrame', pair: null },
  grenzfall: { id: 'timing-worst', key: 'tech.timingWorst', pair: GRENZFALL_PAIR },
  rescan: { id: 'timing-rescan', key: 'tech.timingRescan', pair: RESCAN_PAIR },
};
const BENCH_CASES = Object.keys(READOUTS);
let benchRuns = 0;

function finishBench() {
  benchRuns++;
  const tech = $('tech');
  tech.dataset.benchRuns = String(benchRuns);
  tech.removeAttribute('aria-busy');
  $('timing-rerun').removeAttribute('aria-disabled');
}

export function onBench(caseId, r) {
  if ('error' in r) {
    for (const id of BENCH_CASES.slice(BENCH_CASES.indexOf(caseId))) setText(READOUTS[id].id, t('tech.benchFailed'));
    finishBench();
    return;
  }
  const ro = READOUTS[caseId];
  const params = { where: where(), median: fmtMs(r.median), tail: fmtMs(r.tail), pct: TAIL_PCT, runs: r.runs };
  if (ro.pair) params.case = caseLabel(ro.pair);
  setText(ro.id, t(ro.key, params));
  if (caseId === BENCH_CASES.at(-1)) finishBench();
}

/** Start the four worker readouts; ignored while a bench is running (re-entry guard, MINOR-5). */
export function runBench() {
  if (client.isBenchRunning()) return;
  for (const id of BENCH_CASES) setText(READOUTS[id].id, t('tech.measuring'));
  $('tech').setAttribute('aria-busy', 'true');
  // aria-disabled, not disabled, so keyboard focus stays on the button.
  $('timing-rerun').setAttribute('aria-disabled', 'true');
  client.bench(BENCH_CASES);
}

/** Timing of a painted result frame (pipeline.js calls it after renderLrCallout). */
export function timeResultFrame(frameStart, openTs, openCount) {
  // 'result' is recorded only when no eye is still open; the start-up result is not an input.
  const complete = openTs !== null && openTs > initInputTs && openCount === 0;
  setTimeout(() => {
    const end = performance.now();
    pushTiming(timings.resultFrame, end - frameStart);
    if (complete) {
      pushTiming(timings.result, end - openTs);
      longestResult = Math.max(longestResult, end - openTs);
    }
    writeResultTiming();
  }, 0);
}

/**
 * Timing of a painted compare frame (02-07, T-02-50): rAF start → after paint, into
 * timings.compareFrame, shown as #timing-compare. So ENG-09 (a) can be read with the comparison
 * active: this frame shares the main thread with the input frames.
 */
export function timeCompareFrame(frameStart) {
  setTimeout(() => {
    pushTiming(timings.compareFrame, performance.now() - frameStart);
    const c = timings.compareFrame;
    setText('timing-compare', t('tech.timingCompare', { n: c.length, med: medOf(c), max: maxOf(c) }));
  }, 0);
}

const median = (sorted) => {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};

// Main-thread timing (ENG-09 (a)–(c), 01-15). Method (Nolan Lawson, "Accurately measuring layout
// on the web", 2018-09-25, https://nolanlawson.com/2018/09/25/accurately-measuring-layout-on-the-web/):
// rAF callbacks run just before the browser's rendering step, so a setTimeout queued from inside
// one runs after style, layout and paint. Rings of the last TIMING_WINDOW values:
// - inputFrame  = input frame (read inputs, echo, send the job) incl. paint: rAF start → after paint;
// - reaction    = input event timeStamp → after paint of that frame (input to next paint);
// - resultFrame = result frame (render the delivered result) incl. paint: rAF start → after paint;
// - result      = earliest open input → result painted, only when no eye is still open;
// - compute     = the worker's computeMs (information only);
// - compareFrame = compare frame (paint the material table) incl. paint (02-07).
// event.timeStamp and performance.now() share the same time origin.
export const timings = { inputFrame: [], reaction: [], resultFrame: [], result: [], compute: [], compareFrame: [] };
let longestResult = 0;
let skipTiming = true; // the init() frame is not an input
let initInputTs = Infinity;

export const pushTiming = (buf, v) => {
  buf.push(v);
  if (buf.length > TIMING_WINDOW) buf.shift();
};
const medOf = (buf) => fmtMs(median([...buf].sort((a, b) => a - b)));
const maxOf = (buf) => fmtMs(Math.max(...buf));
const countNf = new Intl.NumberFormat('de-AT');

function writeResultTiming() {
  const r = timings.result;
  if (r.length > 0) {
    setText(
      'timing-result',
      t('tech.result', {
        n: r.length,
        med: medOf(r),
        max: maxOf(r),
        renderMax: maxOf(timings.resultFrame),
        compute: timings.compute.length > 0 ? medOf(timings.compute) : DASH,
      }),
    );
  }
  writeBusyTiming();
}

export function writeBusyTiming() {
  setText(
    'timing-busy',
    t('tech.busy', { count: countNf.format(busyCount), longest: timings.result.length > 0 ? fmtMs(longestResult) : DASH }),
  );
}

function runFrame({ inputTs, frameStart }) {
  const timed = !skipTiming;
  skipTiming = false;
  try {
    update(inputTs);
  } finally {
    pending.input = false;
    writePending();
  }
  if (!timed) return;
  setTimeout(() => {
    const end = performance.now();
    if (PERF_MARKS) performance.measure('u:inputFrame', { start: frameStart, end });
    pushTiming(timings.inputFrame, end - frameStart);
    pushTiming(timings.reaction, end - inputTs);
    setText(
      'timing-input',
      t('tech.inputRender', {
        n: timings.inputFrame.length,
        reactMed: medOf(timings.reaction),
        reactMax: maxOf(timings.reaction),
        mainMed: medOf(timings.inputFrame),
        mainMax: maxOf(timings.inputFrame),
      }),
    );
    writeBusyTiming();
  }, 0);
}

// Browser cross-check (Event Timing; MDN PerformanceEventTiming: minimum durationThreshold 16 ms,
// durations rounded to 8 ms): the longest interaction of the last TIMING_WINDOW interactions.
export function startEventTiming() {
  if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes('event')) {
    setText('timing-event', t('tech.eventTimingNone'));
    return;
  }
  setText('timing-event', t('tech.eventTimingEmpty', { threshold: fmtMs(16) }));
  /** @type {Map<number, number>} interactionId → longest entry duration */
  const longest = new Map();
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      const id = /** @type {any} */ (e).interactionId;
      if (!(id > 0)) continue;
      longest.set(id, Math.max(longest.get(id) ?? 0, e.duration));
      while (longest.size > TIMING_WINDOW) longest.delete(longest.keys().next().value);
    }
    if (longest.size > 0) {
      setText('timing-event', t('tech.eventTiming', { n: longest.size, max: fmtMs(Math.max(...longest.values())) }));
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
}

const scheduleFrame = createFrameScheduler((cb) => requestAnimationFrame(cb), runFrame, () => performance.now());

/** Schedule one input frame; 'input' is pending from now until that frame has run. */
export function schedule(timeStamp) {
  if (!pending.input) {
    pending.input = true;
    writePending();
  }
  scheduleFrame(timeStamp);
}

/** The first input frame at load; its result is the start-up result, not an input. */
export function scheduleFirst() {
  initInputTs = performance.now();
  schedule(initInputTs);
}
