// ENG-08 tier-4 property and invariant suite (01-10 Task 3).
// True invariants: a failure is an engine bug to fix in the owning module, never a tolerance to
// loosen. The restricted x·y pair check is a convention check: a failure first means its stated
// precondition is wrong.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { evaluateLens, evaluatePair } from "./evaluate.js";
import { thicknessAt } from "./metrics.js";
import { frameOutline } from "./frame/outline.js";
import { MATERIALS } from "./materials.js";
import { SHAPES } from "./frame/shapes.js";

const lens = (o = {}) => ({
  eye: "OD",
  sph: -2,
  cyl: 0,
  axisDeg: 0,
  materialId: "cr39",
  frame: { shape: "rechteckig", A: 52, B: 38, DBL: 18 },
  monoPD: 32,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
  ...o,
});
const frame = (shape, A, B, DBL) => ({ shape, A, B, DBL });
const J = (r) => Math.max(r.metrics.ct, r.metrics.etMax.value);
const pair = (s) => evaluatePair({ OD: s, OS: { ...s, eye: "OS" } });
const quarter = (min, max) =>
  fc.integer({ min: min * 4, max: max * 4 }).map((k) => k / 4 + 0);
const SHAPES4 = ["rund", "rechteckig", "panto", "pilot"];

/** Thickness at every outline point of the lens's own eye. */
function outlineThicknesses(r, s) {
  const ol = frameOutline(s.frame.shape, s.frame.A, s.frame.B, s.eye);
  const t = [];
  for (let i = 0; i < ol.length; i += 2)
    t.push(thicknessAt(r.surfaces, ol[i], ol[i + 1]));
  return t;
}

describe("ENG-08 tier-4 properties", () => {
  it("sphere sign: minus lenses are thinnest in the centre, plus lenses thickest (any shape)", () => {
    let checked = 0;
    fc.assert(
      fc.property(
        fc.record({
          sph: quarter(-12, 12).filter((v) => v !== 0),
          shape: fc.constantFrom(...SHAPES4),
          A: fc.integer({ min: 40, max: 62 }),
          B: fc.integer({ min: 28, max: 55 }),
          DBL: fc.integer({ min: 14, max: 24 }),
          monoPD: fc.integer({ min: 25, max: 40 }),
          materialId: fc.constantFrom(...Object.keys(MATERIALS)),
        }),
        ({ sph, shape, A, B, DBL, monoPD, materialId }) => {
          const s = lens({
            sph,
            materialId,
            frame: frame(shape, A, B, DBL),
            monoPD,
          });
          const r = evaluateLens(s);
          if (!r.ok) return;
          checked++;
          const ct = r.metrics.ct;
          for (const t of outlineThicknesses(r, s)) {
            if (sph < 0) expect(t).toBeGreaterThanOrEqual(ct - 1e-9);
            else expect(t).toBeLessThanOrEqual(ct + 1e-9);
          }
          if (sph < 0) expect(r.metrics.etMax.value).toBeGreaterThan(ct);
        },
      ),
      { numRuns: 200, seed: 3 },
    );
    expect(checked).toBeGreaterThan(150);
  });

  it("CYL = 0 on rund A = B, OC at the boxing centre: constant edge thickness", () => {
    for (const sph of [-8, -2, 2, 8]) {
      for (const [A, DBL] of [
        [40, 20],
        [50, 18],
        [60, 14],
      ]) {
        const r = evaluateLens(
          lens({ sph, frame: frame("rund", A, A, DBL), monoPD: (A + DBL) / 2 }),
        );
        expect(r.ok).toBe(true);
        expect(r.metrics.decentration.x).toBe(0);
        expect(r.metrics.etMax.value - r.metrics.etMin.value).toBeLessThan(
          1e-6,
        );
      }
    }
  });

  // Bitwise eye symmetry (01-02 rule, lens-critic iteration-3 MINOR-4): the OS outline is
  // mirrorOutlineX of the exact OD samples, so the searched automatic results are compared directly.
  it("OD/OS mirror for sphere-only lenses on left–right symmetric shapes (bitwise D1 and CT)", () => {
    let checked = 0;
    for (const shape of ["rund", "rechteckig", "panto"]) {
      for (const sph of [-10, -6, -2, 0, 2, 6, 10]) {
        for (const [A, B, DBL, PD] of [
          [52, 38, 18, 32],
          [62, 55, 24, 25],
          [44, 34, 20, 36],
        ]) {
          const { OD, OS } = pair(
            lens({ sph, frame: frame(shape, A, B, DBL), monoPD: PD }),
          );
          expect(OS.ok).toBe(OD.ok);
          if (!OD.ok) continue;
          checked++;
          expect(OS.intermediates.D1).toBe(OD.intermediates.D1);
          expect(OS.metrics.ct).toBe(OD.metrics.ct);
          expect(
            Math.abs(OS.metrics.etAt.nasal - OD.metrics.etAt.nasal),
          ).toBeLessThanOrEqual(1e-9);
          expect(
            Math.abs(OS.metrics.etAt.temporal - OD.metrics.etAt.temporal),
          ).toBeLessThanOrEqual(1e-9);
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  // Precondition: the OS outline is the point reflection of the OD outline, bitwise and index by
  // index (true for rund and rechteckig only, by construction in 01-07), the engine uses the same
  // TABO axis for both eyes, and oc.y = 0 (fittingHeight null).
  it("ENG-05 OD/OS point reflection (fast-check, rund and rechteckig)", () => {
    let checked = 0;
    fc.assert(
      fc.property(
        fc.record({
          sph: quarter(-12, 12),
          cyl: quarter(-6, 0),
          axisDeg: fc.integer({ min: 0, max: 179 }),
          materialId: fc.constantFrom(...Object.keys(MATERIALS)),
          shape: fc.constantFrom("rund", "rechteckig"),
          A: fc.integer({ min: 40, max: 62 }),
          B: fc.integer({ min: 28, max: 55 }),
          DBL: fc.integer({ min: 14, max: 24 }),
          monoPD: fc.integer({ min: 25, max: 40 }),
        }),
        ({ shape, A, B, DBL, ...rx }) => {
          const { OD, OS } = pair(
            lens({ ...rx, frame: frame(shape, A, B, DBL) }),
          );
          if (!OD.ok || !OS.ok) {
            expect(OS.ok).toBe(OD.ok);
            expect(OS.diagnostics[0].code).toBe(OD.diagnostics[0].code);
            return;
          }
          checked++;
          expect(OS.intermediates.D1).toBe(OD.intermediates.D1);
          expect(OS.metrics.ct).toBe(OD.metrics.ct);
          for (let i = 0; i < 11; i++) {
            for (let j = 0; j < 11; j++) {
              const x = -A / 2 + (A * i) / 10;
              const y = -B / 2 + (B * j) / 10;
              const a = thicknessAt(OS.surfaces, x, y);
              const b = thicknessAt(OD.surfaces, -x, -y);
              if (Number.isNaN(a) || Number.isNaN(b)) continue;
              expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-9);
            }
          }
        },
      ),
      { numRuns: 200, seed: 13 },
    );
    expect(checked).toBeGreaterThan(150);
  });

  // Pair difference t(x, y) − t(−x, y) ∝ −C·sin 2θ·sin 2α for D(θ) = S + C·sin²(θ − α), C < 0:
  // for α in [20, 70] the x·y < 0 side is thicker, for α in [110, 160] the x·y > 0 side.
  // Restricted to shapes symmetric about the y axis and no decentration (PD = (A + DBL)/2).
  it("ENG-03 oblique-axis pair check (fast-check, both eyes)", () => {
    let checkedLenses = 0;
    fc.assert(
      fc.property(
        fc.record({
          sph: quarter(-12, 12),
          cyl: quarter(-6, -0.5),
          axisDeg: fc.oneof(
            fc.integer({ min: 20, max: 70 }),
            fc.integer({ min: 110, max: 160 }),
          ),
          shape: fc.constantFrom("rund", "rechteckig"),
          A: fc.integer({ min: 40, max: 62 }),
          B: fc.integer({ min: 28, max: 55 }),
          DBL: fc.integer({ min: 14, max: 24 }),
        }),
        ({ shape, A, B, DBL, ...rx }) => {
          const s = lens({
            ...rx,
            frame: frame(shape, A, B, DBL),
            monoPD: (A + DBL) / 2,
          });
          const p = pair(s);
          for (const eye of ["OD", "OS"]) {
            const r = p[eye];
            if (!r.ok) continue;
            checkedLenses++;
            const ol = frameOutline(shape, A, B, eye);
            for (let i = 0; i < ol.length; i += 2) {
              const x = ol[i];
              const y = ol[i + 1];
              if (Math.abs(x * y) < 1) continue;
              const thickSide = rx.axisDeg <= 70 ? x * y < 0 : x * y > 0;
              if (!thickSide) continue;
              const t = thicknessAt(r.surfaces, x, y);
              const tm = thicknessAt(r.surfaces, -x, y);
              if (!(t > tm)) {
                throw new Error(
                  `counterexample ${eye} ${JSON.stringify(rx)} ${shape} ${A}×${B} at (${x}, ${y}): ${t} vs ${tm}`,
                );
              }
            }
          }
        },
      ),
      { numRuns: 200, seed: 17 },
    );
    expect(checkedLenses).toBeGreaterThan(300);
  });

  it("equal constraints, fixed D1 4,00: higher n gives thinner minus edges and thinner plus centres", () => {
    const ids = Object.keys(MATERIALS).sort(
      (a, b) => MATERIALS[a].ne - MATERIALS[b].ne,
    );
    for (const sph of [-6, -3, 3, 6]) {
      let prev = null;
      for (const materialId of ids) {
        const r = evaluateLens(
          lens({ sph, materialId, baseCurve: 4, minCT: 1.5, minET: 1 }),
        );
        expect(r.ok).toBe(true);
        const v = sph < 0 ? r.metrics.etMax.value : r.metrics.ct;
        if (prev !== null && MATERIALS[materialId].ne > prev.ne)
          expect(v, `${sph} ${materialId}`).toBeLessThan(prev.v);
        prev = { v, ne: MATERIALS[materialId].ne };
      }
    }
  });

  // Sweeps in which both principal meridians move away from zero power. A sweep that crosses a
  // meridian through zero is not monotone by nature: with cyl −2, sph 0 → +0,25 lowers |power| of
  // the cross meridian (−2 → −1,75) and J legitimately drops by about 0.64 mm, so it is excluded.
  it("MAT-02 monotonicity of the thinnest lens along away-from-zero sphere sweeps (≤ 0.005 mm drop)", () => {
    const frames = [
      [frame("rechteckig", 52, 38, 18), 32],
      [frame("rechteckig", 62, 55, 24), 25],
      [frame("rund", 50, 50, 18), 32],
      [frame("rund", 40, 40, 24), 25],
      [frame("panto", 49, 42, 20), 30],
      [frame("pilot", 58, 50, 14), 30],
    ];
    let worst = -Infinity;
    let worstAt = null;
    let samples = 0;
    for (const [f, monoPD] of frames) {
      for (const materialId of ["cr39", "idx174"]) {
        for (const cyl of [0, -2, -4]) {
          const sweeps = [
            [0, -12, -0.25],
            [-cyl, 12, 0.25],
          ];
          for (const [from, to, step] of sweeps) {
            let prev = null;
            for (let k = 0; ; k++) {
              const sph = from + k * step;
              if (step > 0 ? sph > to : sph < to) break;
              const r = evaluateLens(
                lens({ sph, cyl, axisDeg: 30, materialId, frame: f, monoPD }),
              );
              if (!r.ok) continue;
              samples++;
              const j = J(r);
              if (prev !== null) {
                const drop = prev.j - j;
                if (drop > worst)
                  ((worst = drop),
                    (worstAt = `${f.shape} ${f.A}×${f.B} ${materialId} cyl ${cyl}: ${prev.sph} → ${sph}`));
                expect(
                  drop,
                  `${f.shape} ${f.A}×${f.B} ${materialId} cyl ${cyl} sph ${sph}`,
                ).toBeLessThanOrEqual(0.005);
              }
              prev = { j, sph };
            }
          }
        }
      }
    }
    console.log(
      "[01-10] monotonicity: ok samples",
      samples,
      "worst drop (mm)",
      worst,
      worstAt,
    );
    // 01-12: observed 3188 ok samples with the +14 ceiling and the non-convex back (gate = observed)
    expect(samples).toBeGreaterThanOrEqual(3188);
  }, 60_000);

  it("axis sweep 0…179 is continuous (CT and etMax step ≤ 0.05 mm, including 179 → 0)", () => {
    for (const sph of [-4, 4]) {
      const res = [];
      for (let axisDeg = 0; axisDeg < 180; axisDeg++) {
        const r = evaluateLens(lens({ sph, cyl: -2, axisDeg }));
        expect(r.ok).toBe(true);
        res.push(r.metrics);
      }
      let worst = 0;
      for (let a = 0; a < 180; a++) {
        const m0 = res[a];
        const m1 = res[(a + 1) % 180];
        worst = Math.max(
          worst,
          Math.abs(m1.ct - m0.ct),
          Math.abs(m1.etMax.value - m0.etMax.value),
        );
      }
      console.log(
        `[01-10] axis sweep ${sph} −2: worst neighbour step (mm)`,
        worst,
      );
      expect(worst).toBeLessThanOrEqual(0.05);
    }
  });

  for (const shape of SHAPES4) {
    for (const [sph, cyl, axisDeg] of [
      [6, 0, 0],
      [-6, 0, 0],
      [-4, -2, 30],
    ]) {
      it(`ENG-04 outline sampling convergence: ${shape} ${sph}/${cyl}×${axisDeg}, n = 720 vs 5760 ≤ 0.005 mm`, () => {
        const d = SHAPES[shape].defaults;
        const s = lens({
          sph,
          cyl,
          axisDeg,
          frame: frame(shape, d.A, d.B, d.DBL),
          monoPD: 30,
        });
        const a = evaluateLens(s, { outlinePoints: 720 });
        const b = evaluateLens(s, { outlinePoints: 5760 });
        expect(a.ok && b.ok).toBe(true);
        expect(Math.abs(a.metrics.ct - b.metrics.ct)).toBeLessThanOrEqual(
          0.005,
        );
        expect(
          Math.abs(a.metrics.etMax.value - b.metrics.etMax.value),
        ).toBeLessThanOrEqual(0.005);
      });
    }
  }

  it("weight and volume are positive for every ok result (fast-check, seed 11)", () => {
    fc.assert(
      fc.property(
        fc.record({
          sph: quarter(-12, 12),
          cyl: quarter(-6, 0),
          axisDeg: fc.integer({ min: 0, max: 179 }),
          materialId: fc.constantFrom(...Object.keys(MATERIALS)),
          shape: fc.constantFrom(...SHAPES4),
          A: fc.integer({ min: 40, max: 62 }),
          B: fc.integer({ min: 28, max: 55 }),
          DBL: fc.integer({ min: 14, max: 24 }),
          monoPD: fc.integer({ min: 25, max: 40 }),
        }),
        ({ shape, A, B, DBL, ...rx }) => {
          const r = evaluateLens(
            lens({ ...rx, frame: frame(shape, A, B, DBL) }),
          );
          if (!r.ok) return;
          expect(r.metrics.volumeMm3).toBeGreaterThan(0);
          expect(r.metrics.weightG).toBeGreaterThan(0);
        },
      ),
      { numRuns: 200, seed: 11 },
    );
  });
  // 02-01 (lens-critic round 2 MAJOR-1): the etMax/etMin location must not depend on float noise.
  const tieRx = {
    sph: quarter(-8, 6),
    cyl: quarter(-4, 0),
    shape: fc.constantFrom(...SHAPES4),
    monoPD: fc.integer({ min: 58, max: 70 }).map((k) => k / 2),
  };
  const sameMetrics = (a, b) => {
    for (const k of ["ct", "weightG"])
      expect(Math.abs(a.metrics[k] - b.metrics[k])).toBeLessThanOrEqual(1e-9);
    for (const k of ["etMax", "etMin"]) {
      expect(
        Math.abs(a.metrics[k].value - b.metrics[k].value),
      ).toBeLessThanOrEqual(1e-9);
      expect(a.metrics[k].location).toBe(b.metrics[k].location);
    }
  };

  it("Achse 0 and 180 are the same lens (fast-check, seed 21)", () => {
    let checked = 0;
    fc.assert(
      fc.property(
        fc.record({ ...tieRx, eye: fc.constantFrom("OD", "OS") }),
        ({ shape, ...rx }) => {
          const f = frame(shape, 52, 38, 18);
          const a = evaluateLens(lens({ ...rx, axisDeg: 0, frame: f }));
          const b = evaluateLens(lens({ ...rx, axisDeg: 180, frame: f }));
          if (!a.ok || !b.ok) return;
          checked++;
          sameMetrics(a, b);
        },
      ),
      { numRuns: 300, seed: 21 },
    );
    expect(checked).toBeGreaterThan(200);
  });

  it("mirrored Rx gives the same lay label (fast-check, seed 22)", () => {
    let checked = 0;
    fc.assert(
      fc.property(
        fc.record({
          ...tieRx,
          a: fc.oneof(
            fc.constantFrom(0, 30, 90, 180),
            fc.integer({ min: 0, max: 180 }),
          ),
        }),
        ({ shape, a, ...rx }) => {
          const f = frame(shape, 52, 38, 18);
          const od = evaluateLens(
            lens({ ...rx, eye: "OD", axisDeg: a, frame: f }),
          );
          const os = evaluateLens(
            lens({ ...rx, eye: "OS", axisDeg: (180 - a) % 180, frame: f }),
          );
          if (!od.ok || !os.ok) return;
          checked++;
          sameMetrics(od, os);
        },
      ),
      { numRuns: 300, seed: 22 },
    );
    expect(checked).toBeGreaterThan(200);
  });
});
