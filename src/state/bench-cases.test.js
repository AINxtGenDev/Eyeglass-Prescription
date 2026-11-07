import { describe, test, expect } from 'vitest';
import { NORMAL_PAIR, GRENZFALL_PAIR, RESCAN_PAIR, frameMissPair, benchPair, specFor, BENCH_RUNS } from './bench-cases.js';
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

  test('RESCAN_PAIR = 01-12 rescan-path pair (+11,75 −5,25 × 5, CR-39, rund 43×55/20, PD 27, FH 0)', () => {
    for (const eye of ['OD', 'OS']) {
      expect(RESCAN_PAIR[eye]).toEqual(
        specFor(eye, { sph: 11.75, cyl: -5.25, axisDeg: 5 }, 27, 'cr39', { shape: 'rund', A: 43, B: 55, DBL: 20 }, 0),
      );
    }
  });

  test('RESCAN_PAIR computes on both eyes through the rescan path (≥ 163 evaluations per eye)', () => {
    const r = evaluatePair(RESCAN_PAIR);
    for (const eye of ['OD', 'OS']) {
      expect(r[eye].ok).toBe(true);
      expect(r[eye].intermediates.baseCurveSearch.evaluations).toBeGreaterThanOrEqual(163);
    }
  });

  test('benchPair maps the four case ids and throws on an unknown id', () => {
    expect(benchPair('normal', 0)).toBe(NORMAL_PAIR);
    expect(benchPair('grenzfall', 0)).toBe(GRENZFALL_PAIR);
    expect(benchPair('rescan', 0)).toBe(RESCAN_PAIR);
    expect(benchPair('frameMiss', 3)).toEqual(frameMissPair(3));
    expect(() => benchPair('nope', 0)).toThrow(/nope/);
  });

  test('specFor overrides (02-10): same key order, missing overrides are null', () => {
    const rx = { sph: -4, cyl: -2, axisDeg: 30 };
    const frame = { shape: 'rechteckig', A: 52, B: 38, DBL: 18 };
    const s = specFor('OD', rx, 32, 'cr39', frame, null, { baseCurve: 6, minCT: 2 });
    expect(Object.keys(s)).toEqual(Object.keys(NORMAL_PAIR.OD));
    expect(s).toEqual({ ...NORMAL_PAIR.OD, baseCurve: 6, minCT: 2, minET: null });
    expect(specFor('OD', rx, 32, 'cr39', frame, null, { baseCurve: 0 }).baseCurve).toBe(0);
  });

  test('specFor without overrides is unchanged (identical JSON, the cache key)', () => {
    const rx = { sph: -4, cyl: -2, axisDeg: 30 };
    const frame = { shape: 'rechteckig', A: 52, B: 38, DBL: 18 };
    const s = specFor('OD', rx, 32, 'cr39', frame);
    expect(s).toEqual(NORMAL_PAIR.OD);
    // Recorded before the 02-10 change.
    expect(JSON.stringify(NORMAL_PAIR.OD)).toBe(
      '{"eye":"OD","sph":-4,"cyl":-2,"axisDeg":30,"materialId":"cr39","frame":{"shape":"rechteckig","A":52,"B":38,"DBL":18},"monoPD":32,"fittingHeight":null,"baseCurve":null,"minCT":null,"minET":null}',
    );
    expect(JSON.stringify(specFor('OD', rx, 32, 'cr39', frame, null, {}))).toBe(JSON.stringify(NORMAL_PAIR.OD));
  });
});
