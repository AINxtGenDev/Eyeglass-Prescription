// ENG-09 informational desktop bench. ENG-09 is defined on a real phone, so CI timing
// never gates: the tests assert correctness only and print the timings.
// The cases come from src/state/bench-cases.js, the same definitions the page readouts use.
import { describe, test, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { evaluatePair } from '../../src/engine/evaluate.js';
import { NORMAL_PAIR, GRENZFALL_PAIR, frameMissPair, BENCH_RUNS } from '../../src/state/bench-cases.js';

// Never reused, so every frame-miss run builds a new outline (outline cache key shape|A|B|n).
let frameMissK = 0;

const CASES = {
  'normal pair (−4,00 −2,00 × 30, CR-39, rechteckig 52×38/18, PD 32)': () => NORMAL_PAIR,
  'normal pair, frame width changed every run (outline-cache miss)': () => frameMissPair(frameMissK++),
  'Grenzfall pair (+10,75 −1,00 × 89, 1,67, rechteckig 43×43/21, PD 36, FH 0)': () => GRENZFALL_PAIR,
};

function bench(pairFor) {
  for (let i = 0; i < 10; i++) evaluatePair(pairFor());
  const times = [];
  let last;
  for (let i = 0; i < BENCH_RUNS; i++) {
    const pair = pairFor();
    const t0 = performance.now();
    last = evaluatePair(pair);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const median = (times[BENCH_RUNS / 2 - 1] + times[BENCH_RUNS / 2]) / 2;
  const p95 = times[Math.ceil(0.95 * times.length) - 1];
  return { median, p95, last };
}

describe('ENG-09 informational desktop bench', () => {
  test.each(Object.entries(CASES))('%s', (name, pairFor) => {
    const { median, p95, last } = bench(pairFor);
    console.info(`${name}: median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms (${BENCH_RUNS} runs)`);
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
