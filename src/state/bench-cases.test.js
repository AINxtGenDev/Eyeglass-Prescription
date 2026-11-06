import { describe, test, expect } from 'vitest';
import { NORMAL_PAIR, GRENZFALL_PAIR, frameMissPair, specFor, BENCH_RUNS } from './bench-cases.js';
import { evaluatePair } from '../engine/evaluate.js';

const withoutEye = (spec) => ({ ...spec, eye: undefined });

describe('shared ENG-09 bench cases (01-14)', () => {
  test('BENCH_RUNS is 50', () => expect(BENCH_RUNS).toBe(50));

  test('NORMAL_PAIR = −4,00/−2,00 × 30, Rechteckig 52 × 38, DBL 18, PD 32, CR-39, both eyes', () => {
    expect(NORMAL_PAIR.OD).toEqual({
      eye: 'OD',
      sph: -4,
      cyl: -2,
      axisDeg: 30,
      materialId: 'cr39',
      frame: { shape: 'rechteckig', A: 52, B: 38, DBL: 18 },
      monoPD: 32,
      fittingHeight: null,
      baseCurve: null,
      minCT: null,
      minET: null,
    });
    expect(NORMAL_PAIR.OS.eye).toBe('OS');
    expect(withoutEye(NORMAL_PAIR.OS)).toEqual(withoutEye(NORMAL_PAIR.OD));
  });

  test('GRENZFALL_PAIR = 01-12 Grenzfall (+10,75 −1 × 89, 1,67, rechteckig 43×43/21, PD 36, FH 0)', () => {
    for (const eye of ['OD', 'OS']) {
      expect(GRENZFALL_PAIR[eye]).toEqual(
        specFor(eye, { sph: 10.75, cyl: -1, axisDeg: 89 }, 36, 'idx167', { shape: 'rechteckig', A: 43, B: 43, DBL: 21 }, 0),
      );
    }
    expect(GRENZFALL_PAIR.OD.fittingHeight).toBe(0);
    expect(GRENZFALL_PAIR.OD.frame).toEqual({ shape: 'rechteckig', A: 43, B: 43, DBL: 21 });
  });

  test('frameMissPair(k), k 0…99: unique (A, B) keys, differs from NORMAL_PAIR only in frame.A', () => {
    const keys = new Set();
    for (let k = 0; k < 100; k++) {
      const p = frameMissPair(k);
      for (const eye of ['OD', 'OS']) {
        const { frame, ...rest } = p[eye];
        const { frame: nf, ...nrest } = NORMAL_PAIR[eye];
        expect(rest).toEqual(nrest);
        expect({ ...frame, A: nf.A }).toEqual(nf);
        expect(frame.A).not.toBe(nf.A);
      }
      keys.add(`${p.OD.frame.A}|${p.OD.frame.B}`);
    }
    expect(keys.size).toBe(100);
  });

  test('all three cases evaluate ok for both eyes', () => {
    for (const pair of [NORMAL_PAIR, GRENZFALL_PAIR, frameMissPair(0)]) {
      const r = evaluatePair(pair);
      expect(r.OD.ok).toBe(true);
      expect(r.OS.ok).toBe(true);
    }
  });
});
