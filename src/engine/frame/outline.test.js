import { describe, it, expect } from 'vitest';
import { frameOutline, mirrorOutlineX } from './outline.js';
import { SHAPES } from './shapes.js';

const IDS = ['rund', 'rechteckig', 'panto', 'pilot'];

function bbox(o) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < o.length; i += 2) {
    minX = Math.min(minX, o[i]);
    maxX = Math.max(maxX, o[i]);
    minY = Math.min(minY, o[i + 1]);
    maxY = Math.max(maxY, o[i + 1]);
  }
  return { minX, maxX, minY, maxY };
}

function signedArea(o) {
  const n = o.length / 2;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += o[2 * i] * o[2 * j + 1] - o[2 * j] * o[2 * i + 1];
  }
  return a / 2;
}

/** Number of polygon edges a half-line from the origin at angle th crosses (half-open rule). */
function rayCrossings(o, th) {
  const dx = Math.cos(th);
  const dy = Math.sin(th);
  const n = o.length / 2;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const px = o[2 * i];
    const py = o[2 * i + 1];
    const qx = o[2 * j];
    const qy = o[2 * j + 1];
    const cp = dx * py - dy * px;
    const cq = dx * qy - dy * qx;
    if (cp > 0 === cq > 0) continue;
    const ex = qx - px;
    const ey = qy - py;
    const t = (px * ey - py * ex) / (dx * ey - dy * ex);
    if (t > 0) count++;
  }
  return count;
}

describe('FRAME-01 frame outlines', () => {
  for (const shape of IDS) {
    for (const A of [40, 62]) {
      for (const B of [28, 55]) {
        for (const eye of ['OD', 'OS']) {
          it(`${shape} ${A}×${B} ${eye}: exact bbox, CCW, star-shaped, even arc length`, () => {
            const o = frameOutline(shape, A, B, eye);
            expect(o).toBeInstanceOf(Float64Array);
            expect(o.length).toBe(1440);
            const b = bbox(o);
            expect(Math.abs(b.maxX - b.minX - A)).toBeLessThan(1e-9);
            expect(Math.abs(b.maxY - b.minY - B)).toBeLessThan(1e-9);
            expect(Math.abs((b.maxX + b.minX) / 2)).toBeLessThan(1e-9);
            expect(Math.abs((b.maxY + b.minY) / 2)).toBeLessThan(1e-9);
            expect(signedArea(o)).toBeGreaterThan(0);
            for (let k = 0; k < 3600; k++) {
              const c = rayCrossings(o, (2 * Math.PI * (k + 0.5)) / 3600);
              if (c !== 1) expect({ k, c }).toEqual({ k, c: 1 });
            }
            const n = o.length / 2;
            const seg = [];
            for (let i = 0; i < n; i++) {
              const j = (i + 1) % n;
              seg.push(Math.hypot(o[2 * j] - o[2 * i], o[2 * j + 1] - o[2 * i + 1]));
            }
            const mean = seg.reduce((s, v) => s + v, 0) / n;
            for (const s of seg) expect(Math.abs(s - mean) / mean).toBeLessThan(0.01);
          });
        }
      }
    }
  }

  for (const shape of IDS) {
    it(`${shape}: OS is the bitwise mirror of OD`, () => {
      const os = frameOutline(shape, 52, 40, 'OS');
      const m = mirrorOutlineX(frameOutline(shape, 52, 40, 'OD'));
      expect(os.length).toBe(m.length);
      for (let i = 0; i < m.length; i++) expect(os[i]).toBe(m[i]);
    });
  }

  for (const shape of ['rund', 'rechteckig']) {
    it(`${shape}: OD outline is bitwise symmetric about the x axis`, () => {
      const n = 720;
      const o = frameOutline(shape, 52, 40, 'OD', n);
      expect(o[1]).toBe(0);
      expect(o[2 * (n / 2) + 1]).toBe(0);
      for (let k = 1; k < n / 2; k++) {
        expect(o[2 * (n - k)] === o[2 * k]).toBe(true);
        expect(o[2 * (n - k) + 1] === -o[2 * k + 1]).toBe(true);
      }
    });
  }

  it('n not a multiple of 4 throws; unknown shape throws', () => {
    expect(() => frameOutline('rund', 50, 40, 'OD', 722)).toThrow();
    expect(() => frameOutline('oval', 50, 40, 'OD')).toThrow();
    expect(() => frameOutline('toString', 50, 40, 'OD')).toThrow();
  });

  it('pilot is not left-right symmetric (differs from its x-mirror by > 0.5 mm)', () => {
    const o = frameOutline('pilot', 58, 50, 'OD');
    const m = mirrorOutlineX(o);
    let worst = 0;
    for (let i = 0; i < m.length; i += 2) {
      let best = Infinity;
      for (let j = 0; j < o.length; j += 2) {
        best = Math.min(best, Math.hypot(m[i] - o[j], m[i + 1] - o[j + 1]));
      }
      worst = Math.max(worst, best);
    }
    expect(worst).toBeGreaterThan(0.5);
  });

  it('pilot OD is widened on the lower temporal side (−x for OD)', () => {
    const o = frameOutline('pilot', 58, 50, 'OD');
    // at y = −B/4 the temporal (−x) extent exceeds the nasal (+x) extent
    let temporal = 0;
    let nasal = 0;
    for (let i = 0; i < o.length; i += 2) {
      if (Math.abs(o[i + 1] + 12.5) > 0.5) continue;
      temporal = Math.max(temporal, -o[i]);
      nasal = Math.max(nasal, o[i]);
    }
    expect(temporal).toBeGreaterThan(nasal);
  });

  it('memoised outlines are returned as independent copies (also after eviction)', () => {
    const a = frameOutline('panto', 49, 42, 'OD');
    const ref = a.slice();
    a.fill(0);
    const b = frameOutline('panto', 49, 42, 'OD');
    for (let i = 0; i < ref.length; i++) expect(b[i]).toBe(ref[i]);
    for (let A = 30; A < 50; A++) frameOutline('rund', A, 30, 'OD');
    const c = frameOutline('panto', 49, 42, 'OD');
    for (let i = 0; i < ref.length; i++) expect(c[i]).toBe(ref[i]);
  });

  it('rund with A = B is a circle', () => {
    const o = frameOutline('rund', 50, 50, 'OD');
    for (let i = 0; i < o.length; i += 2) {
      expect(Math.abs(Math.hypot(o[i], o[i + 1]) - 25)).toBeLessThan(1e-3);
    }
  });

  it('SHAPES defaults (A × B / DBL)', () => {
    expect(Object.isFrozen(SHAPES)).toBe(true);
    expect(Object.keys(SHAPES)).toEqual(IDS);
    expect(SHAPES.rund.defaults).toEqual({ A: 48, B: 44, DBL: 20 });
    expect(SHAPES.rechteckig.defaults).toEqual({ A: 52, B: 38, DBL: 18 });
    expect(SHAPES.panto.defaults).toEqual({ A: 49, B: 42, DBL: 20 });
    expect(SHAPES.pilot.defaults).toEqual({ A: 58, B: 50, DBL: 14 });
  });
});
