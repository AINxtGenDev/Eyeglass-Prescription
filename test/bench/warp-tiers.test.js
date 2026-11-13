// REF-02 (04-05, D-15, UI-SPEC "Degradation" E6, lens-critic M2): per-tier cost of the Durchblick
// warp job with the production engine, timed through createWarpHandler (validation + prepareWarp
// + warpGrid, as the worker runs it). Timing never gates CI (test/bench/recompute.test.js
// precedent): the tests always assert correctness and the host-independent ray rule, and assert
// the time budgets only with BENCH_GATE=1 on a local run.
import { describe, test, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { cpus, loadavg } from 'node:os';
import { evaluateLens } from '../../src/engine/evaluate.js';
import { REF_GRID_TIERS, FIELD_HALF_ANGLE_DEG } from '../../src/engine/warp.js';
import { createWarpHandler } from '../../src/state/warp-protocol.js';
import { NORMAL_PAIR, GRENZFALL_PAIR, specFor, medianOf, tailOf } from '../../src/state/bench-cases.js';

const GATE = process.env.BENCH_GATE === '1';
const TIERS = Object.keys(REF_GRID_TIERS); // fein, mittel, grob
const WARMUP = 10;
const RUNS = 30;
const TIMEOUT_MS = 600_000;

// UI-SPEC "Degradation", Node benchmark budget per tier (median of the default and the Grenzfall
// Rx). Derivation [BP]: 4× the mid-tier-phone proxy (ROADMAP 01-14) leaves ≥ 80 ms of the 200 ms
// for transfer and draw.
const BUDGET_MS = { fein: 30, mittel: 15, grob: 8 };

const TAN_FIELD = Math.tan((FIELD_HALF_ANGLE_DEG * Math.PI) / 180);
/** pxPerTan = long side / (2 · tan field) (04-P0-RESULTS.md section 0). */
const panelOf = (wPx, hPx) => ({ wPx, hPx, pxPerTan: Math.max(wPx, hPx) / (2 * TAN_FIELD) });
// Measured panels (04-P0-RESULTS.md section 0).
const PANEL_412 = panelOf(189, 285); // 412 × 915 in page, two panels
const PANEL_320 = panelOf(288, 216); // 320 × 640 in page, one panel
const PANEL_LARGEST = panelOf(639, 800); // 1280 × 800 fullscreen, the largest measured panel

const handle = createWarpHandler();

function itemFor(panel, spec, layout, tier) {
  const lens = evaluateLens(spec);
  expect(lens.ok, `${spec.eye} accepted`).toBe(true);
  const { shape, A, B } = spec.frame;
  return { panel, eye: spec.eye, surfaces: lens.surfaces, frame: { shape, A, B }, layout, tier };
}

/** Every item ok, every array finite. */
function checkReply(r, n) {
  expect(r.type).toBe('warp');
  expect(r.items).toHaveLength(n);
  for (const it of r.items) {
    expect(it.ok, it.code).toBe(true);
    expect(it.uv.every(Number.isFinite)).toBe(true);
    expect(it.leaves.subarray(0, 6 * it.leafCount).every(Number.isFinite)).toBe(true);
    expect(it.cls.every((c) => c >= 1 && c <= 5)).toBe(true);
  }
}

/** Time one job: WARMUP + RUNS calls, median and p95 (nearest rank) in ms. */
function bench(msg) {
  let last;
  for (let i = 0; i < WARMUP; i++) last = handle(msg);
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    last = handle(msg);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return { median: medianOf(times), p95: tailOf(times, 95), last };
}

const ms = (v) => v.toFixed(2);
const load = () =>
  loadavg()
    .map((v) => v.toFixed(2))
    .join(' / ');
console.info(`warp bench host: ${cpus()[0]?.model}, ${cpus().length} logical CPUs, BENCH_GATE=${GATE ? 1 : 0}`);

describe('REF-02 tier bench, normal cases (D-15, E6): one two-panel job of the 412 px layout', () => {
  const PAIRS = {
    'NORMAL_PAIR (−4,00 −2,00 × 30, CR-39, 52×38)': NORMAL_PAIR,
    'GRENZFALL_PAIR (+10,75 −1,00 × 89, 1,67, 43×43)': GRENZFALL_PAIR,
  };

  test.each(TIERS)(
    'tier %s: median and p95 per Rx, combined median',
    (tier) => {
      const medians = [];
      for (const [name, pair] of Object.entries(PAIRS)) {
        const msg = { type: 'warp', id: 1, items: [itemFor('R', pair.OD, PANEL_412, tier), itemFor('L', pair.OS, PANEL_412, tier)] };
        const { median, p95, last } = bench(msg);
        checkReply(last, 2);
        medians.push(median);
        const rays = last.items.map((i) => i.rays).join(' + ');
        console.info(`warp bench ${tier} ${name}: rays ${rays}, median ${ms(median)} ms, p95 ${ms(p95)} ms (${RUNS} runs, load ${load()})`);
      }
      const combined = (medians[0] + medians[1]) / 2;
      const within = combined <= BUDGET_MS[tier];
      console.info(
        `warp bench ${tier}: median of the two Rx medians ${ms(combined)} ms, budget ${BUDGET_MS[tier]} ms, ` +
          `within budget: ${within ? 'yes' : 'no'}${GATE ? '' : ' (informational, BENCH_GATE unset)'}`,
      );
      if (GATE) expect.soft(combined, `${tier} combined median ≤ ${BUDGET_MS[tier]} ms`).toBeLessThanOrEqual(BUDGET_MS[tier]);
    },
    TIMEOUT_MS,
  );
});

// Item 12 (UI-SPEC "Correctness"): the rim enters the field for this accepted frame.
const ITEM12_FRAME = Object.freeze({ shape: 'rechteckig', A: 40, B: 28, DBL: 14 });
const item12 = (sph) => specFor('OD', { sph, cyl: 0, axisDeg: 0 }, 40, 'cr39', ITEM12_FRAME);

describe('rim case (item-12 frame, M2)', () => {
  const CASES = [
    ['−4,00 at 320 one-panel 288 × 216', -4, PANEL_320],
    ['+4,00 at 320 one-panel 288 × 216', 4, PANEL_320],
    ['−4,00 at largest 639 × 800', -4, PANEL_LARGEST],
    ['+4,00 at largest 639 × 800', 4, PANEL_LARGEST],
  ];

  test.each(CASES)(
    'item-12 %s: rays(grob) ≤ rays(mittel) ≤ rays(fein); timing per tier',
    (name, sph, layout) => {
      const res = {};
      for (const tier of TIERS) {
        const msg = { type: 'warp', id: 1, items: [itemFor('P', item12(sph), layout, tier)] };
        const { median, p95, last } = bench(msg);
        checkReply(last, 1);
        expect(last.items[0].rimInField).toBe(true);
        res[tier] = { rays: last.items[0].rays, median, p95 };
        const above = median > BUDGET_MS[tier];
        console.info(
          `rim ${name} ${tier}: rays ${res[tier].rays}, median ${ms(median)} ms, p95 ${ms(p95)} ms, ` +
            `above normal-case budget (${BUDGET_MS[tier]} ms): ${above ? 'yes' : 'no'} (load ${load()})`,
        );
      }
      // Host-independent (round-2 NEW-2): a step down must never cost more rays.
      expect(res.grob.rays).toBeLessThanOrEqual(res.mittel.rays);
      expect(res.mittel.rays).toBeLessThanOrEqual(res.fein.rays);
      const ratio = res.grob.median / res.fein.median;
      console.info(`rim ${name}: grob/fein median ${ratio.toFixed(3)} (gate ≤ 0,6)`);
      if (GATE) {
        expect.soft(res.grob.median, 'grob median ≤ mittel median').toBeLessThanOrEqual(res.mittel.median);
        expect.soft(res.mittel.median, 'mittel median ≤ fein median').toBeLessThanOrEqual(res.fein.median);
        expect.soft(res.grob.median, 'grob median ≤ 0,6 × fein median').toBeLessThanOrEqual(0.6 * res.fein.median);
      }
    },
    TIMEOUT_MS,
  );
});
