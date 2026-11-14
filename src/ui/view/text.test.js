// 03-11 view text (D-19, D-29). The protrusion lines use the engine rule (bevelSplit, frontLeadMm)
// and the paintRim threshold; the aria sentence is the UI-SPEC example built from card strings.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { evaluateLens } from '../../engine/evaluate.js';
import { frameOutline } from '../../engine/frame/outline.js';
import { bevelSplit, frontLeadMm } from '../../engine/rim.js';
import { protrusionLines, protrusionCompareLines, protrusionKind, ariaGlass, PROTRUSION_FLUSH_MM } from './text.js';
import { refDirWords, refSizeBlock, refAria, WEAK_NOTE_MAX_PCT } from './text.js';
import { t } from '../../i18n/t.js';

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

describe('REF-01 size block (D-05, E4)', () => {
  const N = ' ';
  const BIG = { shape: 'rechteckig', A: 62, B: 55, DBL: 24 };
  /** One size-block entry from a real engine result (LensResult.magnification, h = 15 mm). */
  const entry = (who, o = {}) => {
    const s = spec({ eye: who === 'os' ? 'OS' : 'OD', sph: 0, cyl: 0, axisDeg: 0, ...o });
    const r = evaluateLens(s);
    expect(r.ok).toBe(true);
    return { who, mag: r.magnification, cyl: s.cyl };
  };
  const blocked = (who) => ({ who, mag: null, cyl: 0 });
  const PIC = { picture: true };

  test('WEAK_NOTE_MAX_PCT is 1,3 (N6)', () => expect(WEAK_NOTE_MAX_PCT).toBe(1.3));

  test.each([
    [90, 'senkrecht (90°)'],
    [180, 'waagrecht (180°)'],
    [0, 'waagrecht (180°)'],
    [85, 'fast senkrecht (85°)'],
    [95, 'fast senkrecht (95°)'],
    [5, 'fast waagrecht (5°)'],
    [175, 'fast waagrecht (175°)'],
    [15, 'schräg (15°, im Bild von links oben nach rechts unten)'],
    [75, 'schräg (75°, im Bild von links oben nach rechts unten)'],
    [105, 'schräg (105°, im Bild von links unten nach rechts oben)'],
    [165, 'schräg (165°, im Bild von links unten nach rechts oben)'],
    [30, 'schräg (30°, im Bild von links oben nach rechts unten)'],
    [120, 'schräg (120°, im Bild von links unten nach rechts oben)'],
  ])('refDirWords(%d) -> %j (on-screen φ = 180° − θ)', (deg, s) => {
    expect(refDirWords(deg)).toBe(s);
  });

  test('E4: OD −2,00/−2,00×30 head, two li and the joined string', () => {
    const b = refSizeBlock([entry('od', { sph: -2, cyl: -2, axisDeg: 30 })]);
    expect(b.title).toBe('Bildgröße in der Glasmitte, verglichen mit dem Blick ohne Brille');
    const [e] = b.entries;
    expect(e.kind).toBe('cyl');
    expect(e.blocked).toBe(false);
    expect(e.head).toBe('Rechtes Glas: Bild');
    expect(e.dirs).toEqual([
      `schräg (30°, im Bild von links oben nach rechts unten) etwa 2,9${N}% kleiner`,
      `schräg (120°, im Bild von links unten nach rechts oben) etwa 6${N}% kleiner`,
    ]);
    expect(e.joined).toBe(
      'Rechtes Glas: Bild schräg (30°, im Bild von links oben nach rechts unten) etwa 2,9 % kleiner, schräg (120°, im Bild von links unten nach rechts oben) etwa 6 % kleiner',
    );
    expect(b.notes).toEqual([t('view.ref.cylNote'), t('view.ref.axisNote')]);
  });

  test('E4: OS with the same Rx gives the same direction words (never mirrored per eye)', () => {
    const od = refSizeBlock([entry('od', { sph: -2, cyl: -2, axisDeg: 30 })]).entries[0];
    const os = refSizeBlock([entry('os', { sph: -2, cyl: -2, axisDeg: 30 })]).entries[0];
    expect(os.head).toBe('Linkes Glas: Bild');
    expect(os.dirs).toEqual(od.dirs);
    expect(os.joined).toBe(od.joined.replace('Rechtes Glas', 'Linkes Glas'));
  });

  test('E4: −2,00/−1,00×90 → 90° carries Sph, 180° carries Sph + Cyl, no axis note', () => {
    const b = refSizeBlock([entry('od', { sph: -2, cyl: -1, axisDeg: 90 })]);
    expect(b.entries[0].dirs).toEqual([`senkrecht (90°) etwa 2,9${N}% kleiner`, `waagrecht (180°) etwa 4${N}% kleiner`]);
    expect(b.notes).toEqual([t('view.ref.cylNote')]);
  });

  test('UI-SPEC example −1,00/−1,00×5: near words, no path', () => {
    const b = refSizeBlock([entry('od', { sph: -1, cyl: -1, axisDeg: 5 })]);
    expect(b.entries[0].dirs).toEqual([`fast waagrecht (5°) etwa 1,4${N}% kleiner`, `fast senkrecht (95°) etwa 2,9${N}% kleiner`]);
    expect(b.notes).not.toContain(t('view.ref.axisNote'));
  });

  test.each([
    ['OD −4,00', 'od', { sph: -4 }, 'Rechtes Glas: Bild etwa 6 % kleiner'],
    ['OS +4,00', 'os', { sph: 4 }, 'Linkes Glas: Bild etwa 8 % größer'],
    ['OD −6,00 in 1,67', 'od', { sph: -6, materialId: 'idx167' }, 'Rechtes Glas: Bild etwa 8 % kleiner'],
    ['OD −10,00', 'od', { sph: -10 }, 'Rechtes Glas: Bild etwa 13 % kleiner'],
    ['OD manual base curve 6 plano', 'od', { baseCurve: 6 }, 'Rechtes Glas: Bild etwa 0,7 % größer'],
  ])('single line %s', (_, who, o, s) => {
    const [e] = refSizeBlock([entry(who, o)]).entries;
    expect(e.kind).toBe('line');
    expect(e.head).toBe(s);
    expect(e.joined).toBe(s);
    expect(e.dirs).toEqual([]);
  });

  test('plano default CR-39 → "etwa 0,1 % größer" with edge, weakNote and shapeNote', () => {
    const b = refSizeBlock([entry('od')], PIC);
    expect(b.entries[0].head).toBe('Rechtes Glas: Bild etwa 0,1 % größer');
    expect(b.notes).toEqual([t('view.ref.edge'), t('view.ref.weakNote'), t('view.ref.shapeNote')]);
  });

  test('−0,25 on manual base curve 6 → "etwa 0,3 % größer" + shapeNote (word follows SM − 1, not F)', () => {
    const b = refSizeBlock([entry('od', { sph: -0.25, baseCurve: 6 })]);
    expect(b.entries[0].head).toBe('Rechtes Glas: Bild etwa 0,3 % größer');
    expect(b.notes).toContain(t('view.ref.shapeNote'));
  });

  test('CR-39 62×55/24 +5,00/−6,00×90: the −1,00 direction reads "etwa 0,1 % größer", shapeNote on', () => {
    const b = refSizeBlock([entry('od', { sph: 5, cyl: -6, axisDeg: 90, frame: BIG })]);
    expect(b.entries[0].dirs).toEqual([`senkrecht (90°) etwa 10${N}% größer`, `waagrecht (180°) etwa 0,1${N}% größer`]);
    expect(b.notes).toContain(t('view.ref.shapeNote'));
  });

  test('"praktisch gleich groß" only when the formatted value is "0,0 %" (−0,25 on manual base 3: −0,014 %)', () => {
    const b = refSizeBlock([entry('od', { sph: -0.25, baseCurve: 3 })]);
    expect(b.entries[0].head).toBe('Rechtes Glas: Bild praktisch gleich groß');
    expect(b.notes).not.toContain(t('view.ref.shapeNote'));
    // the default plano lens does not reach it
    expect(refSizeBlock([entry('od')]).entries[0].head).not.toContain('gleich groß');
  });

  describe('weak note (N6, ≤ 1,3 %)', () => {
    const weak = (entries) => refSizeBlock(entries, PIC).notes.includes(t('view.ref.weakNote'));
    test('−0,75 / −0,75 on (both "etwa 1,1 % kleiner")', () => {
      const b = refSizeBlock([entry('od', { sph: -0.75 }), entry('os', { sph: -0.75 })], PIC);
      expect(b.entries.map((e) => e.head)).toEqual(['Rechtes Glas: Bild etwa 1,1 % kleiner', 'Linkes Glas: Bild etwa 1,1 % kleiner']);
      expect(weak([entry('od', { sph: -0.75 }), entry('os', { sph: -0.75 })])).toBe(true);
    });
    test('+0,75 / +0,75 on', () => expect(weak([entry('od', { sph: 0.75 }), entry('os', { sph: 0.75 })])).toBe(true));
    test('+0,75 in 62×55 (1,3 %) on', () => {
      const e = entry('od', { sph: 0.75, frame: BIG });
      expect(refSizeBlock([e]).entries[0].head).toBe('Rechtes Glas: Bild etwa 1,3 % größer');
      expect(weak([e])).toBe(true);
    });
    test('−1,00 / −1,00 off', () => expect(weak([entry('od', { sph: -1 }), entry('os', { sph: -1 })])).toBe(false));
    test('+1,00 off', () => expect(weak([entry('od', { sph: 1 })])).toBe(false));
    test('hidden when no eye is computed', () => expect(weak([blocked('od'), blocked('os')])).toBe(false));
    test('blocked eyes are ignored', () => expect(weak([entry('od', { sph: -0.75 }), blocked('os')])).toBe(true));
    test('only with the picture', () => {
      expect(refSizeBlock([entry('od', { sph: -0.75 })]).notes).not.toContain(t('view.ref.weakNote'));
    });
  });

  test('N7: −4,00/−0,50×90 prints "6 %" twice → one line and cylSameNote, not cylNote', () => {
    const b = refSizeBlock([entry('od', { sph: -4, cyl: -0.5, axisDeg: 90 })]);
    expect(b.entries[0].kind).toBe('line');
    expect(b.entries[0].head).toBe('Rechtes Glas: Bild etwa 6 % kleiner');
    expect(b.notes).toContain(t('view.ref.cylSameNote'));
    expect(b.notes).not.toContain(t('view.ref.cylNote'));
  });

  test('note order: edge, rimNote, rimPastNote, cylNote, cylSameNote, axisNote, shapeNote, abNote', () => {
    const b = refSizeBlock(
      [entry('a', { sph: -2, cyl: -2, axisDeg: 30 }), entry('b', { sph: -4, cyl: -0.5, axisDeg: 90 }), entry('od', { sph: 5, cyl: -6, axisDeg: 90, frame: BIG })],
      { picture: true, compare: true, rimInField: true, pastRimInField: true },
    );
    expect(b.entries.map((e) => e.head.split(':')[0])).toEqual(['Vorher (A)', 'Nachher (B)', 'Rechtes Glas']);
    expect(b.notes).toEqual(
      ['edge', 'rimNote', 'rimPastNote', 'cylNote', 'cylSameNote', 'axisNote', 'shapeNote', 'abNote'].map((k) => t(`view.ref.${k}`)),
    );
  });

  test('note gating: picture, rimInField, pastRimInField and compare', () => {
    const e = [entry('od', { sph: -4 })];
    expect(refSizeBlock(e, { picture: false, rimInField: true, pastRimInField: true, compare: false }).notes).toEqual([]);
    expect(refSizeBlock(e, { picture: true, rimInField: false, pastRimInField: true }).notes).toEqual([t('view.ref.edge')]);
    expect(refSizeBlock(e, { picture: true, rimInField: true, pastRimInField: false }).notes).toEqual([t('view.ref.edge'), t('view.ref.rimNote')]);
    expect(refSizeBlock(e, { compare: true }).notes).toEqual([t('view.ref.abNote')]);
    expect(refSizeBlock(e).notes).toEqual([]);
  });

  test('a blocked eye → "Linkes Glas: nicht berechnet"', () => {
    const b = refSizeBlock([entry('od', { sph: -4 }), blocked('os')]);
    expect(b.entries[1]).toEqual({
      who: 'os',
      blocked: true,
      kind: 'line',
      head: 'Linkes Glas: nicht berechnet',
      dirs: [],
      joined: 'Linkes Glas: nicht berechnet',
    });
  });

  test('refAria: UI-SPEC example (OD −4,00, OS +4,00, mit Glas, two panels)', () => {
    const { entries } = refSizeBlock([entry('od', { sph: -4 }), entry('os', { sph: 4 })], PIC);
    expect(refAria({ lens: 'on', layout: 'two', eye: 'od', entries })).toBe(
      'Durchblick mit Glas: so verändert diese Brille Größe und Form dessen, was Sie geradeaus in der Ferne sehen, mittlerer Teil des Blickfelds. Linkes Glas links, rechtes Glas rechts. Rechtes Glas: Bild etwa 6 % kleiner. Linkes Glas: Bild etwa 8 % größer.',
    );
  });

  test('refAria: one panel, comparison, ohne Glas, and the joined cylinder form', () => {
    const cylEntries = refSizeBlock([entry('os', { sph: -2, cyl: -2, axisDeg: 30 })]).entries;
    expect(refAria({ lens: 'off', layout: 'one', eye: 'os', entries: cylEntries })).toBe(
      'Durchblick ohne Glas, zum Vergleich: so verändert diese Brille Größe und Form dessen, was Sie geradeaus in der Ferne sehen, mittlerer Teil des Blickfelds. Nur das linke Glas. ' +
        cylEntries[0].joined +
        '.',
    );
    const ab = refSizeBlock([entry('a', { sph: -4 }), entry('b', { sph: -4, materialId: 'idx167' })], { compare: true }).entries;
    expect(refAria({ lens: 'on', layout: 'compare', eye: 'od', entries: ab })).toBe(
      `Durchblick mit Glas: so verändert diese Brille Größe und Form dessen, was Sie geradeaus in der Ferne sehen, mittlerer Teil des Blickfelds. Rechtes Glas, links Vorher (A), rechts Nachher (B). ${ab[0].joined}. ${ab[1].joined}.`,
    );
  });
});
