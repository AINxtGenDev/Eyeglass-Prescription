// 03-11 view text (D-19, D-29). The protrusion lines use the engine rule (bevelSplit, frontLeadMm)
// and the paintRim threshold; the aria sentence is the UI-SPEC example built from card strings.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { evaluateLens } from '../../engine/evaluate.js';
import { frameOutline } from '../../engine/frame/outline.js';
import { bevelSplit, frontLeadMm } from '../../engine/rim.js';
import { protrusionLines, protrusionCompareLines, protrusionKind, ariaGlass, PROTRUSION_FLUSH_MM } from './text.js';

const FRAME = { shape: 'rechteckig', A: 52, B: 38, DBL: 18 };
const spec = (o) => ({
  eye: 'OD',
  sph: -2.75,
  cyl: -0.5,
  axisDeg: 180,
  materialId: 'cr39',
  frame: FRAME,
  monoPD: 32,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
  ...o,
});
/** The app example at load (state/presets.js EXAMPLE). */
const EX = { OD: spec({}), OS: spec({ eye: 'OS', sph: -2.5, cyl: -0.75, axisDeg: 170, monoPD: 31.5 }) };
/** What view.js passes per eye: etMax from the metrics, lead from frontLeadMm (same call as paintRim). */
const viewEye = (s, D = 3) => {
  const r = evaluateLens(s);
  expect(r.ok).toBe(true);
  return {
    etMax: r.metrics.etMax.value,
    lead: frontLeadMm(r.surfaces, frameOutline(s.frame.shape, s.frame.A, s.frame.B, s.eye), D).value,
  };
};
const NB = '\u00a0';

describe('D-19/D-29 view text (03-11)', () => {
  test('example: edge lines, lead lines, assumed rim depth and bevel sentence', () => {
    const p = protrusionLines({ OD: { etMax: 4.597, lead: 0.515 }, OS: { etMax: 4.597, lead: 0.528 } }, { rimDepthMm: 3, rimAssumed: true });
    expect(p.title).toBe('Überstand am dicksten Glasrand');
    expect(p.lines).toEqual([
      `Rechts: Glasrand hinten 1,6${NB}mm aus der Fassung, vorne bündig`,
      `Links: Glasrand hinten 1,6${NB}mm aus der Fassung, vorne bündig`,
    ]);
    expect(p.leads).toEqual([`Rechts: Vorderfläche bis zu 0,5${NB}mm vor der Fassung`, `Links: Vorderfläche bis zu 0,5${NB}mm vor der Fassung`]);
    expect(p.assumed).toBe(`Berechnet mit Randtiefe 3,0${NB}mm (angenommener Wert, keine Herstellerangabe; in der Experten-Ansicht änderbar).`);
    expect(p.bevel).toBe('Die Aufteilung nach vorne und hinten ist angenommen.');
  });

  test('the real example through the engine gives the same lines (etMax and frontLeadMm)', () => {
    const p = protrusionLines({ OD: viewEye(EX.OD), OS: viewEye(EX.OS) }, { rimDepthMm: 3, rimAssumed: true });
    expect(p.lines[0]).toBe(`Rechts: Glasrand hinten 1,6${NB}mm aus der Fassung, vorne bündig`);
    expect(p.leads).toEqual([`Rechts: Vorderfläche bis zu 0,5${NB}mm vor der Fassung`, `Links: Vorderfläche bis zu 0,5${NB}mm vor der Fassung`]);
  });

  test('fits, both, front-only, no lead, blocked eye, own rim depth', () => {
    const fits = protrusionLines({ OD: { etMax: 2, lead: 0.01 }, OS: null }, { rimDepthMm: 3, rimAssumed: false });
    expect(fits.lines).toEqual(['Rechts: Glasrand passt ganz in die Fassung']);
    expect(fits.leads).toEqual(['Rechts: Vorderfläche nicht vor der Fassung']);
    expect(fits.assumed).toBeNull();
    // t = 12, D = 3: apex 4, front 4 − 1,5 = 2,5, back 12 − 4 − 1,5 = 6,5
    const both = protrusionLines({ OD: null, OS: { etMax: 12, lead: 3 } }, { rimDepthMm: 3, rimAssumed: true });
    expect(both.lines).toEqual([`Links: Glasrand vorne 2,5${NB}mm, hinten 6,5${NB}mm aus der Fassung`]);
    expect(both.leads).toEqual([`Links: Vorderfläche bis zu 3,0${NB}mm vor der Fassung`]);
    // 'front' cannot occur with the 1:2 rule (back = front + t/3 > front); the key still exists.
    expect(protrusionKind(12, 3).kind).toBe('both');
    expect(protrusionLines({ OD: null, OS: null }, { rimDepthMm: 3, rimAssumed: true }).lines).toEqual([]);
  });

  test('threshold: 0,05 mm counts, just below is bündig; equals the paintRim constant', () => {
    const src = readFileSync(new URL('../frame-input.js', import.meta.url), 'utf8');
    const m = src.match(/const RIM_FLUSH_MM = ([\d.]+);/);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBe(PROTRUSION_FLUSH_MM);
    // paintRim compares with the constant only (no stray literal left)
    expect(src.match(/>= RIM_FLUSH_MM/g)).toHaveLength(3);
    expect(src).not.toMatch(/>= 0\.05/);
    expect(protrusionLines({ OD: { etMax: 2, lead: 0.05 }, OS: null }, { rimDepthMm: 3, rimAssumed: false }).leads[0]).toBe(
      `Rechts: Vorderfläche bis zu 0,1${NB}mm vor der Fassung`,
    );
    expect(protrusionLines({ OD: { etMax: 2, lead: 0.0499 }, OS: null }, { rimDepthMm: 3, rimAssumed: false }).leads[0]).toBe(
      'Rechts: Vorderfläche nicht vor der Fassung',
    );
  });

  test('kind agrees with the paintRim rule for the 03-01 (t, D) pairs', () => {
    const rule = (t, D) => {
      const { front, back } = bevelSplit(t, D);
      const f = front >= 0.05;
      const b = back >= 0.05;
      return f && b ? 'both' : f ? 'front' : b ? 'back' : 'none';
    };
    const pairs = [
      [4.597, 3],
      [3, 3],
      [1, 3],
      [4.6, 3],
      [12, 3],
      [4.6, 10],
      [3.075, 3], // back = 0,05 exactly at the boundary (2t/3 − 1,5)
      [3.07, 3],
    ];
    for (const [t, D] of pairs) expect(protrusionKind(t, D).kind, `${t}/${D}`).toBe(rule(t, D));
    expect(protrusionKind(4.6, 10).kind).toBe('none');
  });

  // lens-critic M2 (03-LC): during a comparison the block shows the compared eye only, one
  // 'Vorher (A):' and one 'Nachher (B):' pair from the same rule; A still computing → B only.
  test('comparison: Vorher (A) and Nachher (B) lines for the compared eye (M2)', () => {
    const d = { rimDepthMm: 3, rimAssumed: true };
    const p = protrusionCompareLines({ A: { etMax: 4.597, lead: 0.515 }, B: { etMax: 3.6, lead: 0.02 } }, d);
    expect(p.lines).toEqual([
      `Vorher (A): Glasrand hinten 1,6${NB}mm aus der Fassung, vorne bündig`,
      // 3,6: apex 1,2, back 3,6 − 1,2 − 1,5 = 0,9
      `Nachher (B): Glasrand hinten 0,9${NB}mm aus der Fassung, vorne bündig`,
    ]);
    expect(p.leads).toEqual([`Vorher (A): Vorderfläche bis zu 0,5${NB}mm vor der Fassung`, 'Nachher (B): Vorderfläche nicht vor der Fassung']);
    expect(p.title).toBe('Überstand am dicksten Glasrand');
    expect(p.assumed).toBe(protrusionLines({ OD: { etMax: 1, lead: 0 }, OS: null }, d).assumed);
    expect(p.bevel).toBe('Die Aufteilung nach vorne und hinten ist angenommen.');
    const onlyB = protrusionCompareLines({ A: null, B: { etMax: 4.597, lead: 0.515 } }, d);
    expect(onlyB.lines).toEqual([`Nachher (B): Glasrand hinten 1,6${NB}mm aus der Fassung, vorne bündig`]);
    expect(onlyB.leads).toEqual([`Nachher (B): Vorderfläche bis zu 0,5${NB}mm vor der Fassung`]);
    expect(protrusionCompareLines({ A: null, B: null }, d).lines).toEqual([]);
  });

  test('aria: the UI-SPEC example sentence exactly', () => {
    const s = ariaGlass({
      viewName: 'schräg von vorne',
      OD: { thick: `4,6${NB}mm`, thickLoc: 'außen oben', ct: `1,8${NB}mm` },
      OS: { thick: `4,4${NB}mm`, thickLoc: 'außen oben', ct: `1,8${NB}mm` },
      frame: { shape: 'Rechteckig', A: 52, DBL: 18 },
      material: '1,50 · Standard',
    });
    expect(s.replaceAll(NB, ' ')).toBe(
      '3D-Ansicht der Brille, schräg von vorne. Rechtes Glas: dickste Stelle 4,6 mm außen oben, Mitte 1,8 mm. Linkes Glas: dickste Stelle 4,4 mm außen oben, Mitte 1,8 mm. Fassung Rechteckig 52□18, Material 1,50 · Standard.',
    );
  });

  test('aria: a blocked eye reads nicht berechnet; decimal sizes', () => {
    const s = ariaGlass({
      viewName: 'von vorne',
      OD: { thick: '4,6 mm', thickLoc: 'außen oben', ct: '1,8 mm' },
      OS: null,
      frame: { shape: 'Rund', A: 49.5, DBL: 18 },
      material: '1,60 · Höherbrechend',
    });
    expect(s).toContain('Linkes Glas: nicht berechnet.');
    expect(s).toContain('Rechtes Glas: dickste Stelle 4,6 mm außen oben');
    expect(s).toContain('Fassung Rund 49,5□18,');
    expect(ariaGlass({ viewName: 'von oben', OD: null, OS: null, frame: null, material: 'x' })).toBe(
      '3D-Ansicht der Brille, von oben. Rechtes Glas: nicht berechnet. Linkes Glas: nicht berechnet. Fassung – –□–, Material x.',
    );
  });
});
