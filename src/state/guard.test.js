// REF-02 (04-05, F-06 m5, D-16, UI-SPEC "Degradation"): the pure step-down guard.
import { describe, test, expect } from 'vitest';
import { initGuard, nextGuard } from './guard.js';

const ORDER = ['fein', 'mittel', 'grob'];
const REF = { budgetMs: 200, need: 2, last: 'grob', down: (t) => ORDER[ORDER.indexOf(t) + 1] };

/** Feed the counted samples in order (excluded samples are simply not passed). */
const run = (tier, samples, opts = REF) => samples.reduce((g, ms) => nextGuard(Object.freeze(g), ms, opts), initGuard(tier));

describe('REF-02 degradation guard (F-06, E5)', () => {
  test('initGuard', () => {
    expect(initGuard('fein')).toEqual({ tier: 'fein', run: 0, stillSlow: false, stepped: false });
  });

  test('E5 slow-fast-slow → no step', () => {
    expect(run('fein', [250, 100, 250])).toEqual({ tier: 'fein', run: 1, stillSlow: false, stepped: false });
  });

  test('E5 slow-slow → one step down', () => {
    expect(run('fein', [250, 250])).toEqual({ tier: 'mittel', run: 0, stillSlow: false, stepped: true });
  });

  test('E5 slow-(excluded)-slow → step (the excluded sample is never passed in)', () => {
    // [250, excluded, 250]: the caller drops the excluded sample, so the guard sees two in a row.
    expect(run('fein', [250, 250]).tier).toBe('mittel');
    expect(run('mittel', [250, 250]).tier).toBe('grob');
  });

  test('E5 last tier slow-slow → no further step, stillSlow true', () => {
    const g = run('grob', [250, 250]);
    expect(g.tier).toBe('grob');
    expect(g.stillSlow).toBe(true);
    expect(g.stepped).toBe(false);
    expect(g.run).toBe(0);
  });

  test('a sample exactly at the budget counts as within budget (resets the run)', () => {
    expect(run('fein', [250, 200, 250])).toMatchObject({ tier: 'fein', run: 1 });
    expect(run('fein', [200, 200])).toMatchObject({ tier: 'fein', run: 0 });
  });

  test('never steps up: fast samples after a step keep the lower tier', () => {
    const g = run('fein', [250, 250, ...Array(20).fill(10)]);
    expect(g).toMatchObject({ tier: 'mittel', run: 0, stepped: true });
  });

  test('steps one tier at a time: fein → mittel → grob → stillSlow', () => {
    expect(run('fein', [250, 250, 250, 250])).toMatchObject({ tier: 'grob', stillSlow: false });
    expect(run('fein', [250, 250, 250, 250, 250, 250])).toMatchObject({ tier: 'grob', stillSlow: true });
  });

  test('thumbnail equivalence (phase-3 view.js THUMB_SLOW_MS 50, THUMB_SLOW_RUN 2)', () => {
    const THUMB = { budgetMs: 50, need: 2, last: 'off', down: () => 'off' };
    expect(run('on', [60, 40, 60], THUMB).tier).toBe('on');
    expect(run('on', [60, 60], THUMB)).toMatchObject({ tier: 'off', stepped: true });
    expect(run('on', [50, 50], THUMB).tier).toBe('on'); // view.js: ms > 50 counts as slow
  });

  test('returns new objects and never mutates its input', () => {
    const g0 = Object.freeze(initGuard('fein'));
    const g1 = nextGuard(g0, 250, REF);
    expect(g1).not.toBe(g0);
    expect(g0).toEqual({ tier: 'fein', run: 0, stillSlow: false, stepped: false });
    const g2 = nextGuard(Object.freeze(g1), 10, REF);
    expect(g2).not.toBe(g1);
  });

  test('default options are the REF-02 Durchblick rule (200 ms, two in a row, fein → mittel → grob)', () => {
    let g = initGuard('fein');
    for (const ms of [201, 201]) g = nextGuard(g, ms);
    expect(g.tier).toBe('mittel');
    for (const ms of [201, 201, 201, 201]) g = nextGuard(g, ms);
    expect(g).toMatchObject({ tier: 'grob', stillSlow: true });
  });
});
