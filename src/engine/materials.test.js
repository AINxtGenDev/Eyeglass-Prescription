import { describe, it, expect } from 'vitest';
import { MATERIALS } from './materials.js';
import { evaluateLens } from './evaluate.js';

const EXPECTED = {
  cr39: { ne: 1.5, density: 1.32, minCT: 1.8, minET: 1.0 },
  trivex: { ne: 1.53, density: 1.11, minCT: 1.5, minET: 1.0 },
  pc: { ne: 1.59, density: 1.2, minCT: 1.5, minET: 1.3 },
  idx160: { ne: 1.598, density: 1.31, minCT: 1.2, minET: 1.1 },
  idx167: { ne: 1.664, density: 1.35, minCT: 1.2, minET: 1.0 },
  idx174: { ne: 1.738, density: 1.47, minCT: 1.1, minET: 1.0 },
};

const spec = (o = {}) => ({
  eye: 'OD',
  sph: -4,
  cyl: 0,
  axisDeg: 0,
  materialId: 'cr39',
  frame: { shape: 'rund', A: 50, B: 50, DBL: 18 },
  monoPD: 32,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
  ...o,
});

describe('MAT-01 materials', () => {
  it('has exactly the six material ids', () => {
    expect(Object.keys(MATERIALS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.keys(EXPECTED))('%s has the cited ne, density and minimum thicknesses', (id) => {
    const m = MATERIALS[id];
    const e = EXPECTED[id];
    expect(m.id).toBe(id);
    expect(m.ne).toBe(e.ne);
    expect(m.density).toBe(e.density);
    expect(m.minCT).toBe(e.minCT);
    expect(m.minET).toBe(e.minET);
  });

  it.each(Object.keys(MATERIALS))('%s row is complete and cited (https on zeiss.com)', (id) => {
    const m = MATERIALS[id];
    for (const k of ['ne', 'nd', 've', 'vd', 'density', 'minCT', 'minET']) {
      expect(Number.isFinite(m[k]), `${id}.${k}`).toBe(true);
    }
    for (const k of ['doc', 'url', 'page']) {
      expect(typeof m.source[k]).toBe('string');
      expect(m.source[k].length).toBeGreaterThan(0);
    }
    const u = new URL(m.source.url);
    expect(u.protocol).toBe('https:');
    expect(u.hostname === 'zeiss.com' || u.hostname.endsWith('.zeiss.com')).toBe(true);
  });

  it.each(Object.keys(MATERIALS))('MAT-01 %s has a plausible Abbe number νe in [20, 70] with a source doc (01-13)', (id) => {
    const m = MATERIALS[id];
    expect(Number.isFinite(m.ve)).toBe(true);
    expect(m.ve).toBeGreaterThanOrEqual(20);
    expect(m.ve).toBeLessThanOrEqual(70);
    expect(typeof m.source.doc).toBe('string');
  });

  it('rows whose minET is not read from a sheet row are marked assumed', () => {
    expect(MATERIALS.idx167.assumed).toEqual(['minET']);
    expect(MATERIALS.idx174.assumed).toEqual(['minET']);
  });

  it('MATERIALS and its rows are frozen', () => {
    expect(Object.isFrozen(MATERIALS)).toBe(true);
    for (const m of Object.values(MATERIALS)) {
      expect(Object.isFrozen(m)).toBe(true);
      expect(Object.isFrozen(m.source)).toBe(true);
    }
  });

  it('the engine uses ne, not nd (idx167 → n = 1.664)', () => {
    const r = evaluateLens(spec({ materialId: 'idx167' }));
    expect(r.ok).toBe(true);
    expect(r.intermediates.n).toBe(1.664);
  });

  it('higher index gives a thinner minus edge: etMax(idx174) < etMax(idx167) < etMax(cr39)', () => {
    const et = (materialId) => evaluateLens(spec({ materialId })).metrics.etMax.value;
    expect(et('idx174')).toBeLessThan(et('idx167'));
    expect(et('idx167')).toBeLessThan(et('cr39'));
  });

  it('trivex uses n = 1.530 and is lighter than cr39 for the same −4.00 lens', () => {
    const t = evaluateLens(spec({ materialId: 'trivex' }));
    const c = evaluateLens(spec({ materialId: 'cr39' }));
    expect(t.ok).toBe(true);
    expect(t.intermediates.n).toBe(1.53);
    expect(t.metrics.weightG).toBeLessThan(c.metrics.weightG);
  });
});
