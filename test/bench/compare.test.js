// Compare-lane informational desktop bench (02-06, RES-02): every material for both eyes, the
// work the compare lane does after one changed main input (the page sends the five other
// materials, one pair per job; this times all six). ENG-09 is defined on a real phone, so CI
// timing never gates: the tests assert correctness only and print the timings.
import { describe, test, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { evaluatePair } from '../../src/engine/evaluate.js';
import { MATERIALS } from '../../src/engine/materials.js';
import { NORMAL_PAIR, GRENZFALL_PAIR, BENCH_RUNS } from '../../src/state/bench-cases.js';

const IDS = Object.keys(MATERIALS);

/** The pair with each material in turn. */
const pairsFor = (pair) => IDS.map((id) => ({ OD: { ...pair.OD, materialId: id }, OS: { ...pair.OS, materialId: id } }));

const CASES = {
  'NORMAL 6 materials × 2 eyes': pairsFor(NORMAL_PAIR),
  'GRENZFALL 6 materials × 2 eyes': pairsFor(GRENZFALL_PAIR),
};

// 02-08: the measured loop stops after BENCH_RUNS runs or once MEASURE_BUDGET_MS of wall time is
// used, whichever comes first (at least MIN_RUNS). Without coverage 50 Grenzfall runs take about
// 4,3 s, so the budget never cuts them. Under `npm run test:coverage` the v8-instrumented engine
// makes one Grenzfall run about 530 ms; 55 fixed runs took 29,2 s against the 30 s testTimeout.
// With the budget the test is bounded by warm-up + budget + one run, independent of load.
const MEASURE_BUDGET_MS = 6000;
const MIN_RUNS = 5;

function bench(pairs) {
  for (let i = 0; i < 5; i++) pairs.forEach((p) => evaluatePair(p));
  const times = [];
  let last;
  const start = performance.now();
  while (times.length < BENCH_RUNS && (times.length < MIN_RUNS || performance.now() - start < MEASURE_BUDGET_MS)) {
    const t0 = performance.now();
    last = pairs.map((p) => evaluatePair(p));
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const n = times.length;
  const median = n % 2 ? times[(n - 1) / 2] : (times[n / 2 - 1] + times[n / 2]) / 2;
  const p95 = times[Math.ceil(0.95 * n) - 1];
  return { median, p95, last, runs: n };
}

describe('compare lane informational desktop bench (02-06)', () => {
  test.each(Object.entries(CASES))('%s', (name, pairs) => {
    const { median, p95, last, runs } = bench(pairs);
    console.info(`${name}: median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms (${runs} of ${BENCH_RUNS} runs)`);
    expect(runs).toBeGreaterThanOrEqual(MIN_RUNS);
    expect(last).toHaveLength(IDS.length);
    last.forEach((r, i) => {
      for (const eye of ['OD', 'OS']) expect(r[eye].ok, `${IDS[i]} ${eye}`).toBe(true);
    });
  });
});
