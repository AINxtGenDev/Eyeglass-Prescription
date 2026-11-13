import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { HSA_ASSUMED_MM, ENTRANCE_PUPIL_MM, EYE_POINT_MM, spectacleMagnification } from './magnification.js';
import { evaluateLens } from './evaluate.js';
import { traceFromEye } from './trace.js';

const spec = (o = {}) => ({
  eye: 'OD',
  sph: 0,
  cyl: 0,
  axisDeg: 0,
  materialId: 'cr39',
  frame: { shape: 'rechteckig', A: 52, B: 38, DBL: 18 },
  monoPD: 32,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
  ...o,
});
const q4 = (lo, hi) => fc.integer({ min: Math.round(lo * 4), max: Math.round(hi * 4) }).map((k) => k / 4);
const MATERIAL_IDS = ['cr39', 'trivex', 'pc', 'idx160', 'idx167', 'idx174'];
const BIG = { shape: 'rechteckig', A: 62, B: 55, DBL: 24 };

/** SM − 1 per meridian of an evaluated lens, in meridian order. */
const smMinus1 = (o) => {
  const r = evaluateLens(spec(o));
  expect(r.ok).toBe(true);
  return r.magnification.meridians.map((m) => m.sm - 1);
};

/** Paraxial M = J⁻¹ of the reverse trace at the lens centre: eigenvalues and eigenvector angles. */
function traceMagnification(lens, e = 1e-4) {
  const obj = (ex, ey) => {
    const r = traceFromEye(lens.surfaces, EYE_POINT_MM, ex, ey);
    expect(r.status).toBe('ok');
    return r.objTan;
  };
  const px = obj(e, 0);
  const mx = obj(-e, 0);
  const py = obj(0, e);
  const my = obj(0, -e);
  const j11 = (px[0] - mx[0]) / (2 * e);
  const j21 = (px[1] - mx[1]) / (2 * e);
  const j12 = (py[0] - my[0]) / (2 * e);
  const j22 = (py[1] - my[1]) / (2 * e);
  const det = j11 * j22 - j12 * j21;
  const a = j22 / det;
  const b = -j12 / det;
  const c = -j21 / det;
  const d = j11 / det;
  const half = (a + d) / 2;
  const disc = Math.sqrt(Math.max(0, half * half - (a * d - b * c)));
  const eig = [half - disc, half + disc];
  const angleOf = (l) => {
    const v1 = [b, l - a];
    const v2 = [l - d, c];
    const v = Math.hypot(...v1) >= Math.hypot(...v2) ? v1 : v2;
    const deg = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
    return ((deg % 180) + 180) % 180;
  };
  return { eig, angles: eig.map(angleOf) };
}

describe('REF-01 spectacle magnification (D-04, D-05, D-12)', () => {
  it('eye point constants: HSA 12 mm (assumed) + entrance pupil 3,0 mm = 15 mm', () => {
    expect(HSA_ASSUMED_MM).toBe(12);
    expect(ENTRANCE_PUPIL_MM).toBe(3.0);
    expect(EYE_POINT_MM).toBe(15);
  });

  it('entrance pupil 3,04 mm from the Le Grand table', () => {
    // Greivenkamp, OPTI-502 "The Eye" (Univ. of Arizona 2019), PDF page 4, slide 22-9 "More
    // Complete Eye Model" (Le Grand & El Hage, Physiological Optics, 1980), fetched 2026-11-13:
    const R1 = 7.8; // anterior cornea radius, mm
    const R2 = 6.5; // posterior cornea radius, mm
    const tCornea = 0.55; // corneal thickness, mm (t column, anterior cornea row)
    const nCornea = 1.3771; // cornea index
    const nAqueous = 1.3374; // aqueous index
    const stop = 0.55 + 3.05; // aperture stop (iris at the anterior lens) from the corneal vertex, mm
    // Paraxial image of the stop through the cornea, light travelling outward (z flipped, radii
    // change sign): vergences L = n / l, surface power P = (n2 − n1) / R.
    let L = nAqueous / -(stop - tCornea);
    L += (nCornea - nAqueous) / -R2;
    const lPost = nCornea / L;
    const L2 = nCornea / (lPost - tCornea) + (1 - nCornea) / -R1;
    const depth = -1 / L2; // entrance pupil behind the corneal vertex, mm
    console.log(`[04-01] Le Grand entrance pupil ${depth.toFixed(4)} mm behind the corneal vertex`);
    expect(Math.abs(depth - 3.04)).toBeLessThan(0.005);
    expect(Math.abs(ENTRANCE_PUPIL_MM - depth)).toBeLessThan(0.05);
  });

  it('closed form: shape factor and power factor, default h = 15 mm, custom h', () => {
    const m = spectacleMagnification({ n: 1.5, ctMm: 1.8, D1: 0.5, sph: -4, cyl: 0, axisDeg: 0 });
    expect(m.hMm).toBe(15);
    expect(m.shape).toBeCloseTo(1 / (1 - (0.0018 / 1.5) * 0.5), 15);
    expect(m.meridians).toEqual([{ deg: null, wearerDeg: null, F: -4, sm: m.shape / (1 + 0.015 * 4) }]);
    const m12 = spectacleMagnification({ n: 1.5, ctMm: 1.8, D1: 0.5, sph: -4, cyl: 0, axisDeg: 0 }, 12);
    expect(m12.hMm).toBe(12);
    expect(m12.meridians[0].sm).toBeCloseTo(m12.shape / (1 + 0.012 * 4), 15);
  });

  it('meridians: TABO 1…180 ascending (180 last), axis carries Sph, perpendicular Sph + Cyl, wearerDeg = 180 − deg', () => {
    const base = { n: 1.5, ctMm: 2, D1: 4, sph: -2, cyl: -1 };
    const pick = (axisDeg) => spectacleMagnification({ ...base, axisDeg }).meridians.map(({ deg, wearerDeg, F }) => ({ deg, wearerDeg, F }));
    expect(pick(0)).toEqual([
      { deg: 90, wearerDeg: 90, F: -3 },
      { deg: 180, wearerDeg: 0, F: -2 },
    ]);
    expect(pick(180)).toEqual(pick(0));
    expect(pick(90)).toEqual([
      { deg: 90, wearerDeg: 90, F: -2 },
      { deg: 180, wearerDeg: 0, F: -3 },
    ]);
    expect(pick(30)).toEqual([
      { deg: 30, wearerDeg: 150, F: -2 },
      { deg: 120, wearerDeg: 60, F: -3 },
    ]);
    expect(pick(120)).toEqual([
      { deg: 30, wearerDeg: 150, F: -3 },
      { deg: 120, wearerDeg: 60, F: -2 },
    ]);
  });

  // Measured 2026-11-13 at h = 15 mm, rechteckig 52×38/18, PD 32, CR-39, automatic base curve
  // unless noted; pinned to 1e-9 (each within 1e-5 of the 04-01-PLAN / UI-SPEC reference value).
  const REFERENCES = [
    ['plano', {}, [0.0006003602]],
    ['plano, manual base curve 6', { baseCurve: 6 }, [0.007252216]],
    ['−0,25 on manual base curve 6', { sph: -0.25, baseCurve: 6 }, [0.0034891317]],
    ['−1,00', { sph: -1 }, [-0.0141868372]],
    ['−4,00', { sph: -4 }, [-0.056037396]],
    ['+4,00', { sph: 4 }, [0.0776692836]],
    ['−2,00/−2,00×30 (30°, 120°)', { sph: -2, cyl: -2, axisDeg: 30 }, [-0.0285433396, -0.056037396]],
    ['0,00/−1,00×90 (90°, 180°)', { cyl: -1, axisDeg: 90 }, [0.0006003602, -0.0141868372]],
    ['−6,00 in 1,67', { sph: -6, materialId: 'idx167' }, [-0.0822378835]],
    ['−10,00', { sph: -10 }, [-0.1299127302]],
    ['62×55/24 +5,00/−6,00×90 (90°, 180° = the −1,00 meridian)', { sph: 5, cyl: -6, axisDeg: 90, frame: BIG }, [0.0983591697, 0.0009677162]],
  ];
  for (const [name, o, want] of REFERENCES) {
    it(`reference value ${name}: SM − 1 = ${want.join(' / ')}`, () => {
      const got = smMinus1(o);
      expect(got).toHaveLength(want.length);
      got.forEach((g, i) => expect(Math.abs(g - want[i])).toBeLessThan(1e-9));
    });
  }
  it('reference values agree with the plan table (−0.056037, 0.077669, −0.028543) within 1e-5', () => {
    expect(Math.abs(smMinus1({ sph: -4 })[0] - -0.056037)).toBeLessThan(1e-5);
    expect(Math.abs(smMinus1({ sph: 4 })[0] - 0.077669)).toBeLessThan(1e-5);
    expect(Math.abs(smMinus1({ sph: -2, cyl: -2, axisDeg: 30 })[0] - -0.028543)).toBeLessThan(1e-5);
  });

  const ORACLE = [
    ['−4,00', { sph: -4 }],
    ['+4,00', { sph: 4 }],
    ['−2,00/−2,00×30 OD', { sph: -2, cyl: -2, axisDeg: 30 }],
    ['−2,00/−2,00×30 OS', { eye: 'OS', sph: -2, cyl: -2, axisDeg: 30 }],
    ['0,00/−1,00×90', { cyl: -1, axisDeg: 90 }],
    ['−6,00 in 1,67', { sph: -6, materialId: 'idx167' }],
    ['+4,00 conic front k = −2', { sph: 4, frontConic: -2 }],
  ];
  for (const [name, o] of ORACLE) {
    it(`trace oracle ${name}: eigenvalues of J⁻¹ equal the meridian SM within 0,05 pp`, () => {
      const lens = evaluateLens(spec(o));
      expect(lens.ok).toBe(true);
      if (o.frontConic) expect(lens.surfaces.k1).toBe(o.frontConic);
      const { eig } = traceMagnification(lens);
      const sms = lens.magnification.meridians.map((m) => m.sm).sort((a, b) => a - b);
      const want = sms.length === 1 ? [sms[0], sms[0]] : sms;
      const err = Math.max(Math.abs(eig[0] - want[0]), Math.abs(eig[1] - want[1]));
      console.log(`[04-01] trace oracle ${name}: max |trace − formula| = ${(err * 100).toExponential(2)} pp`);
      expect(err).toBeLessThan(0.0005);
    });
  }

  it('the less-minified eigenvector of −2,00/−2,00×30 lies at engine 30,00° ± 0,05° for OD and OS', () => {
    for (const eye of ['OD', 'OS']) {
      const lens = evaluateLens(spec({ eye, sph: -2, cyl: -2, axisDeg: 30 }));
      const { angles } = traceMagnification(lens);
      // eig ascending: [more minified, less minified]
      expect(Math.abs(angles[1] - 30)).toBeLessThan(0.05);
      expect(Math.abs(angles[0] - 120)).toBeLessThan(0.05);
    }
  });

  const signProperty = (side, arb, seed) => {
    let checked = 0;
    let skipped = 0;
    fc.assert(
      fc.property(arb, fc.integer({ min: 0, max: 179 }), fc.constantFrom(...MATERIAL_IDS), ([sph, cyl], axisDeg, materialId) => {
        const r = evaluateLens(spec({ sph, cyl, axisDeg, materialId }));
        if (!r.ok) {
          skipped++;
          return;
        }
        checked++;
        for (const m of r.magnification.meridians) {
          if (side === 'minus') expect(m.sm).toBeLessThan(1);
          else expect(m.sm).toBeGreaterThan(1);
        }
      }),
      { numRuns: 300, seed },
    );
    console.log(`[04-01] E3 ${side}: ${checked} lenses checked, ${skipped} engine-rejected skipped`);
    expect(checked).toBeGreaterThan(200);
  };

  it('E3: both meridians ≤ −1,00 → both minify (six materials, 300 runs, seed 45)', () => {
    signProperty('minus', fc.tuple(q4(-12, -1), q4(-6, 0)), 45);
  });

  it('E3: both meridians ≥ +1,00 → both magnify (six materials, 300 runs, seed 46)', () => {
    // sph + cyl ≥ +1,00 and sph ≤ +12,00: draw the weaker meridian, then the sphere.
    const arb = q4(-6, 0).chain((cyl) => q4(1, 12 + cyl).map((weak) => [weak - cyl, cyl]));
    signProperty('plus', arb, 46);
  });
});
