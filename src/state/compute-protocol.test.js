import { describe, test, expect, vi } from 'vitest';
import { createHandler, READY, medianOf, tailOf } from './compute-protocol.js';
import { NORMAL_PAIR, GRENZFALL_PAIR, RESCAN_PAIR, specFor } from './bench-cases.js';
import { evaluateLens } from '../engine/evaluate.js';
import { meridianProfile } from '../engine/profile.js';

const SC4 = specFor('OD', { sph: -12, cyl: -6, axisDeg: 10 }, 32, 'cr39', { shape: 'rechteckig', A: 62, B: 55, DBL: 18 });
const NAN_SPEC = { ...NORMAL_PAIR.OD, sph: Number.NaN };

describe('compute protocol (01-15, ENG-09 worker side)', () => {
  test('READY is the ready message', () => expect(READY).toEqual({ type: 'ready' }));

  test('compute OD+OS: same id, seq echoed, results equal evaluateLens, computeMs ≥ 0', () => {
    const handle = createHandler();
    const res = handle({ type: 'compute', id: 7, eyes: { OD: { seq: 3, spec: NORMAL_PAIR.OD }, OS: { seq: 5, spec: NORMAL_PAIR.OS } } });
    expect(res.type).toBe('result');
    expect(res.id).toBe(7);
    expect(res.eyes.OD.seq).toBe(3);
    expect(res.eyes.OS.seq).toBe(5);
    expect(res.eyes.OD.result).toEqual(evaluateLens(NORMAL_PAIR.OD));
    expect(res.eyes.OS.result).toEqual(evaluateLens(NORMAL_PAIR.OS));
    expect(res.computeMs).toBeGreaterThanOrEqual(0);
  });

  test('an absent eye stays absent', () => {
    const res = createHandler()({ type: 'compute', id: 1, eyes: { OS: { seq: 1, spec: NORMAL_PAIR.OS } } });
    expect(Object.keys(res.eyes)).toEqual(['OS']);
  });

  test.each([
    ['NORMAL_PAIR', NORMAL_PAIR.OD, NORMAL_PAIR.OS],
    ['GRENZFALL_PAIR', GRENZFALL_PAIR.OD, GRENZFALL_PAIR.OS],
    ['RESCAN_PAIR', RESCAN_PAIR.OD, RESCAN_PAIR.OS],
    ['SC-4 lens', SC4, NORMAL_PAIR.OS],
    ['sph NaN', NAN_SPEC, NORMAL_PAIR.OS],
  ])('structuredClone round trip keeps the response (%s; no transferables)', (_, od, os) => {
    const res = createHandler()({ type: 'compute', id: 1, eyes: { OD: { seq: 1, spec: od }, OS: { seq: 1, spec: os } } });
    expect(structuredClone(res)).toEqual(res);
  });

  test('a throwing evaluate gives an error response and does not throw', () => {
    const handle = createHandler({
      evaluate: () => {
        throw new Error('boom');
      },
    });
    const msg = { type: 'compute', id: 4, eyes: { OD: { seq: 1, spec: NORMAL_PAIR.OD }, OS: { seq: 2, spec: NORMAL_PAIR.OS } } };
    let res;
    expect(() => (res = handle(msg))).not.toThrow();
    expect(res).toEqual({ type: 'error', id: 4, eyes: ['OD', 'OS'], message: 'boom' });
  });

  test('an unknown type gives an error with no eyes', () => {
    const res = createHandler()({ type: 'nope', id: 9 });
    expect(res.type).toBe('error');
    expect(res.id).toBe(9);
    expect(res.eyes).toEqual([]);
  });

  test('a malformed message does not throw', () => {
    const handle = createHandler();
    expect(() => handle(null)).not.toThrow();
    expect(handle(null).type).toBe('error');
  });

  test('bench rescan: ok with a finite ms and the evaluation counts', () => {
    const res = createHandler()({ type: 'bench', id: 2, caseId: 'rescan', k: 0 });
    expect(res.type).toBe('bench');
    expect(res.id).toBe(2);
    expect(res.caseId).toBe('rescan');
    expect(res.ok).toBe(true);
    expect(Number.isFinite(res.ms)).toBe(true);
    expect(res.evaluations[0]).toBeGreaterThanOrEqual(163);
  });

  test('bench frameMiss: k 0 and k 1 pass different frame.A to the pair evaluator', () => {
    const evaluatePairFn = vi.fn(() => ({ OD: { ok: true, intermediates: {} }, OS: { ok: true, intermediates: {} } }));
    const handle = createHandler({ evaluatePairFn });
    handle({ type: 'bench', id: 1, caseId: 'frameMiss', k: 0 });
    handle({ type: 'bench', id: 2, caseId: 'frameMiss', k: 1 });
    const a0 = evaluatePairFn.mock.calls[0][0].OD.frame.A;
    const a1 = evaluatePairFn.mock.calls[1][0].OD.frame.A;
    expect(a0).not.toBe(a1);
  });

  test('bench with an unknown case gives an error, not a throw', () => {
    const res = createHandler()({ type: 'bench', id: 3, caseId: 'nope', k: 0 });
    expect(res).toMatchObject({ type: 'error', id: 3, eyes: [] });
  });

  test('medianOf and tailOf on sorted arrays', () => {
    expect(medianOf([1, 2, 3])).toBe(2);
    expect(medianOf([1, 2, 3, 4])).toBe(2.5);
    const fifty = Array.from({ length: 50 }, (_, i) => i + 1);
    expect(tailOf(fifty, 95)).toBe(48);
  });

  describe('compare (02-06)', () => {
    test('compare OD+OS: same id, plain LensResults equal evaluateLens, computeMs ≥ 0', () => {
      const res = createHandler()({ type: 'compare', id: 11, eyes: { OD: NORMAL_PAIR.OD, OS: NORMAL_PAIR.OS } });
      expect(res.type).toBe('compare');
      expect(res.id).toBe(11);
      expect(res.eyes.OD).toEqual(evaluateLens(NORMAL_PAIR.OD));
      expect(res.eyes.OS).toEqual(evaluateLens(NORMAL_PAIR.OS));
      expect(res.computeMs).toBeGreaterThanOrEqual(0);
    });

    test('structuredClone round trip keeps the compare response', () => {
      const res = createHandler()({ type: 'compare', id: 1, eyes: { OD: GRENZFALL_PAIR.OD, OS: NAN_SPEC } });
      expect(structuredClone(res)).toEqual(res);
    });

    test('a throwing evaluate gives an error with no eyes (never a main-eye failure)', () => {
      const handle = createHandler({
        evaluate: () => {
          throw new Error('boom');
        },
      });
      const res = handle({ type: 'compare', id: 5, eyes: { OD: NORMAL_PAIR.OD, OS: NORMAL_PAIR.OS } });
      expect(res).toEqual({ type: 'error', id: 5, eyes: [], message: 'boom' });
    });
  });

  describe('profile (02-13)', () => {
    const r = evaluateLens(NORMAL_PAIR.OD);
    const item = (thetaDeg) => ({ surfaces: r.surfaces, frame: NORMAL_PAIR.OD.frame, eye: 'OD', thetaDeg });

    test('profile items: same id, one meridianProfile per item in order, computeMs ≥ 0', () => {
      const res = createHandler()({ type: 'profile', id: 21, items: [item(0), item(90)] });
      expect(res.type).toBe('profile');
      expect(res.id).toBe(21);
      expect(res.items).toEqual([
        meridianProfile({ surfaces: r.surfaces, frame: NORMAL_PAIR.OD.frame, eye: 'OD' }, 0),
        meridianProfile({ surfaces: r.surfaces, frame: NORMAL_PAIR.OD.frame, eye: 'OD' }, 90),
      ]);
      expect(res.computeMs).toBeGreaterThanOrEqual(0);
    });

    test('structuredClone round trip keeps the profile response (typed arrays included)', () => {
      const res = createHandler()({ type: 'profile', id: 2, items: [item(30)] });
      expect(res.items[0].ok).toBe(true);
      expect(structuredClone(res)).toEqual(res);
    });

    test('injected profileFn; a throwing one gives an error with no eyes', () => {
      const profileFn = vi.fn(() => ({ ok: false, code: 'NO_CHORD' }));
      const res = createHandler({ profileFn })({ type: 'profile', id: 3, items: [item(0)] });
      expect(profileFn).toHaveBeenCalledWith({ surfaces: r.surfaces, frame: NORMAL_PAIR.OD.frame, eye: 'OD' }, 0);
      expect(res.items).toEqual([{ ok: false, code: 'NO_CHORD' }]);
      const boom = createHandler({
        profileFn: () => {
          throw new Error('boom');
        },
      });
      expect(boom({ type: 'profile', id: 4, items: [item(0)] })).toEqual({ type: 'error', id: 4, eyes: [], message: 'boom' });
    });
  });
});
