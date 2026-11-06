// ENG-09 informational desktop bench. ENG-09 is defined on a real phone, so CI timing
// never gates: the tests assert correctness only and print the timings.
import { describe, test, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { evaluatePair } from '../../src/engine/evaluate.js';

const FRAME = { shape: 'rund', A: 50, B: 50, DBL: 18 };
const spec = (eye, sph, monoPD, o = {}) => ({
  eye,
  sph,
  cyl: 0,
  axisDeg: 0,
  materialId: 'cr39',
  frame: FRAME,
  monoPD,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
  ...o,
});

// Copy of WORST_CASE_BENCH_SPECS in src/ui/main.js: the Grenzfall from 01-12 group G (slowest
// measured pair among the fuzz top 5 by pair CT iterations). Change both together with
// tech.timingWorst.
const GRENZFALL = {
  cyl: -1,
  axisDeg: 89,
  materialId: 'idx167',
  frame: { shape: 'rechteckig', A: 43, B: 43, DBL: 21 },
  fittingHeight: 0,
};
const PAIRS = {
  'normal pair (−2,00 rund 50/18/32)': { OD: spec('OD', -2, 32), OS: spec('OS', -2, 32) },
  'Grenzfall pair (+10,75 −1,00 × 89, 1.67, rechteckig 43×43/21, PD 36, FH 0)': {
    OD: spec('OD', 10.75, 36, GRENZFALL),
    OS: spec('OS', 10.75, 36, GRENZFALL),
  },
};

function bench(pair) {
  for (let i = 0; i < 10; i++) evaluatePair(pair);
  const times = [];
  let last;
  for (let i = 0; i < 50; i++) {
    const t0 = performance.now();
    last = evaluatePair(pair);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const median = (times[24] + times[25]) / 2;
  const p95 = times[Math.ceil(0.95 * times.length) - 1];
  return { median, p95, last };
}

describe('ENG-09 informational desktop bench', () => {
  test.each(Object.entries(PAIRS))('%s', (name, pair) => {
    const { median, p95, last } = bench(pair);
    console.info(`${name}: median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms (50 runs)`);
    for (const eye of ['OD', 'OS']) {
      const r = last[eye];
      expect(r.ok, eye).toBe(true);
      expect(r.intermediates.baseCurveRule).toBe('thinnest');
      const s = r.intermediates.baseCurveSearch;
      console.info(`  ${eye}: evaluations ${s.evaluations}, iterations ${s.iterations}`);
      expect(s.evaluations).toBeLessThanOrEqual(40);
    }
  });
});
