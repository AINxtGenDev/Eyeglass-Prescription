import { describe, test, expect } from 'vitest';
import dict from './de-AT.js';
import { t } from './t.js';
import { PARSE_CODES, PD_CODES, STAMP_CODES } from '../state/parse.js';
import { RX_CODES } from '../state/transpose.js';
import { VAL_CODES } from '../state/validate.js';
import { DIAGNOSTICS } from '../engine/diagnostics.js';
import { MATERIALS } from '../engine/materials.js';
import { RX_PRESETS, FRAME_PRESETS } from '../state/presets.js';
import { readFileSync } from 'node:fs';

describe('t() (L10N-02)', () => {
  test('returns the German title', () => {
    expect(t('app.title')).toBe('Brillenglas-Rechner – Dicke und Gewicht');
  });

  test('unknown key throws an Error naming the key', () => {
    expect(() => t('no.such.key')).toThrow(/no\.such\.key/);
  });
});

describe('de-AT dictionary', () => {
  test('is frozen', () => expect(Object.isFrozen(dict)).toBe(true));

  test('every value is a non-empty string', () => {
    for (const [k, v] of Object.entries(dict)) {
      expect(typeof v, k).toBe('string');
      expect(v.trim().length, k).toBeGreaterThan(0);
    }
  });

  test.each(Object.keys(PARSE_CODES))('has parse.%s', (code) => {
    expect(dict).toHaveProperty([`parse.${code}`]);
  });

  test.each(Object.keys(RX_CODES))('has rx.%s', (code) => {
    expect(dict).toHaveProperty([`rx.${code}`]);
  });

  test.each(Object.keys(VAL_CODES))('has val.%s', (code) => {
    expect(dict).toHaveProperty([`val.${code}`]);
  });

  test.each(Object.keys(PD_CODES))('has pd.%s', (code) => {
    expect(dict).toHaveProperty([`pd.${code}`]);
  });

  test.each(Object.keys(STAMP_CODES))('has stamp.%s', (code) => {
    expect(dict).toHaveProperty([`stamp.${code}`]);
  });

  test('never uses "Stärke" (thickness is Mittendicke/Randdicke)', () => {
    for (const [k, v] of Object.entries(dict)) expect(v, k).not.toMatch(/Stärke/);
  });
});

describe('disclaimer (RES-06, lens-critic iteration-3 MAJOR-1)', () => {
  const body = () => dict['disclaimer.body'];
  test('has a title', () => expect(dict['disclaimer.title']).toBe('Wichtiger Hinweis'));
  test('does not mention Vogel-Regel', () => expect(body()).not.toContain('Vogel-Regel'));
  // 01-12 D-C: no longer literally "möglichst dünn"; τ = 0,1 mm and the flattest front are named
  test('says nahezu so dünn wie möglich, at most 0,1 mm thicker, flattest front', () => {
    expect(body()).toContain('nahezu so dünn wie möglich');
    expect(body()).toContain('0,1 mm');
    expect(body()).toContain('flachsten Vorderfläche');
    expect(body()).not.toContain('möglichst dünn wird');
  });
  test('says the back surface is never curved outwards (01-12)', () => expect(body()).toContain('nach außen gewölbt'));
  // measured max Zeiss − automatic CT over the 51 plus rows = 0,449 mm (tier 2 (d)), rounded to 0,1 mm
  test('names the measured plus-lens CT difference (tier 2 (d))', () => expect(body()).toContain('0,4 mm'));
  test('names the +0,50 floor', () => expect(body()).toContain('+0,50'));
  test('says real lenses can be dicker', () => expect(body()).toContain('dicker'));
  test('is a Lernhilfe', () => expect(body()).toContain('Lernhilfe'));
  test('states the CT tolerance as ±0,3 mm', () => expect(body()).toContain('±0,3 mm'));
  // 02-11 (MAT-05, UI-SPEC disclaimer note): the sphere is the default, the asphere is generic.
  test('says the spherical front applies without the Expert setting and is not a manufacturer design', () => {
    expect(body()).toContain('ohne Experten-Einstellung mit einer sphärischen Vorderfläche');
    expect(body()).toContain('nicht mit asphärischen Herstellerdesigns');
  });
});

// Documented data fields per code (src/engine/diagnostics.js, solve.js, evaluate.js).
const DIAG_DATA = {
  FRONT_SAG_UNDEFINED: ['R1', 'rhoMax'],
  BACK_SAG_UNDEFINED: ['meridian', 'axisDeg', 'searched'],
  BACK_SURFACE_CONVEX: ['D2max', 'searched'],
  VERTEX_TERM_INVALID: ['ct', 'D1'],
  THICK_LENS_NOT_CONVERGED: ['iterations'],
  NON_FINITE_RESULT: [],
  INVALID_SPEC: ['reason'],
  OC_OUTSIDE_OUTLINE: ['x', 'y'],
  BLANK_EXCEEDS_STOCK: ['mbsMm', 'stockMm'],
  CT_SET_BY_MIN_CT: [],
  CT_SET_BY_MIN_ET: [],
  MANUAL_BACK_CONVEX: ['D2max'],
};
const placeholders = (v) => [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

describe('L10N-02 completeness (codes ↔ dictionary, both ways)', () => {
  test('DIAG_DATA documents exactly the catalogue', () => {
    expect(Object.keys(DIAG_DATA).sort()).toEqual(Object.keys(DIAGNOSTICS).sort());
  });

  test.each(Object.keys(DIAGNOSTICS))('has diag.%s.title|explain|suggest', (code) => {
    for (const part of ['title', 'explain', 'suggest']) {
      expect(dict, `${code}.${part}`).toHaveProperty([`diag.${code}.${part}`]);
    }
  });

  test('no orphan diag.*, parse.*, rx.<CODE>, val.<CODE>, pd.<CODE> or stamp.<CODE> keys', () => {
    for (const key of Object.keys(dict)) {
      let m;
      if ((m = key.match(/^diag\.([A-Z_]+)\.(title|explain|suggest)$/))) {
        expect(Object.keys(DIAGNOSTICS), key).toContain(m[1]);
      } else if (key.startsWith('diag.')) {
        expect.fail(`malformed diag key ${key}`);
      } else if ((m = key.match(/^parse\.(.+)$/))) {
        expect(Object.keys(PARSE_CODES), key).toContain(m[1]);
      } else if ((m = key.match(/^rx\.([A-Z][A-Z_]*)$/))) {
        expect(Object.keys(RX_CODES), key).toContain(m[1]);
      } else if ((m = key.match(/^val\.([A-Z][A-Z_]*)$/))) {
        expect(Object.keys(VAL_CODES), key).toContain(m[1]);
      } else if ((m = key.match(/^pd\.([A-Z][A-Z_]*)$/))) {
        expect(Object.keys(PD_CODES), key).toContain(m[1]);
      } else if ((m = key.match(/^stamp\.([A-Z][A-Z_]*)$/))) {
        expect(Object.keys(STAMP_CODES), key).toContain(m[1]);
      }
    }
  });

  test('every {param} in val.* is suggestion, value, typed, min, max or field', () => {
    for (const [key, v] of Object.entries(dict)) {
      if (!key.startsWith('val.')) continue;
      // field: the literal frame term A, B or DBL (VAL_FRAME_OUT_OF_MODEL, 02-04)
      const allowed = ['suggestion', 'value', 'typed', 'min', 'max', 'field'];
      for (const p of placeholders(v)) expect(allowed, `${key} {${p}}`).toContain(p);
    }
  });

  test('every {param} in diag.* texts is a documented data field of that code', () => {
    for (const [key, v] of Object.entries(dict)) {
      const m = key.match(/^diag\.([A-Z_]+)\./);
      if (!m) continue;
      for (const p of placeholders(v)) expect(DIAG_DATA[m[1]], `${key} {${p}}`).toContain(p);
    }
  });

  test('every {param} in basecurve.* is vogel, thickness, clamped or rounded', () => {
    for (const [key, v] of Object.entries(dict)) {
      if (!key.startsWith('basecurve.')) continue;
      // clamped: basecurve.vogelClamped only (01-13, MINOR-1), passed by main.js baseCurveText
      // rounded: basecurve.vogelRounded only (02-10, MINOR-5), the 0,25 dpt step in 0,00…+10,00
      for (const p of placeholders(v)) expect(['vogel', 'thickness', 'clamped', 'rounded'], `${key} {${p}}`).toContain(p);
    }
  });

  test('no value contains Stärke, Linse or undefined', () => {
    for (const [k, v] of Object.entries(dict)) {
      expect(v, k).not.toMatch(/Stärke|Linse|undefined/);
    }
  });

  test('t() still throws on a missing diag key', () => {
    expect(() => t('diag.NOPE.title')).toThrow(/diag\.NOPE\.title/);
  });

  test('the generic result.notComputable key is gone', () => {
    expect(dict).not.toHaveProperty(['result.notComputable']);
  });
});

describe('diagnostic texts are geometrically true (lens-critic M1/m6, iteration-2 m1/m2)', () => {
  test('BACK_SAG_UNDEFINED never suggests a rounder frame', () => {
    expect(dict['diag.BACK_SAG_UNDEFINED.suggest']).not.toContain('runder');
  });
  test('BACK_SAG_UNDEFINED explains the model range and has no {meridian}', () => {
    const v = dict['diag.BACK_SAG_UNDEFINED.explain'];
    expect(v).toContain('Modell');
    expect(v).toContain('0,50');
    expect(v).toContain('+14,00');
    expect(v).not.toContain('{meridian}');
  });
  test('MANUAL_BACK_CONVEX advises a steeper (higher) base curve, never a flatter one (D2 = Sph − D1v)', () => {
    expect(dict['diag.MANUAL_BACK_CONVEX.title']).toBe('Rückfläche zum Auge hin gewölbt (konvex)');
    expect(dict['diag.MANUAL_BACK_CONVEX.suggest']).toContain('stärker gewölbte (höhere) Basiskurve');
    expect(dict['diag.MANUAL_BACK_CONVEX.suggest']).toContain('leer lassen');
    expect(dict['diag.MANUAL_BACK_CONVEX.suggest']).not.toContain('flacher');
  });
  test('BASE_CURVE_CLAMPED keys are removed (D-01 final)', () => {
    expect(Object.keys(dict).filter((k) => k.startsWith('diag.BASE_CURVE_CLAMPED'))).toEqual([]);
  });
  test('the thinnest rule names τ = 0,1 mm and the flattest front, and never dicker', () => {
    expect(dict['basecurve.rule.thinnest']).toContain('nahezu so dünn wie möglich');
    expect(dict['basecurve.rule.thinnest']).toContain('0,1 mm');
    expect(dict['basecurve.rule.thinnest']).toContain('flachsten Vorderfläche');
    expect(dict['basecurve.rule.thinnest']).not.toContain('dicker');
  });
  test.each(['basecurve.vogelRef', 'basecurve.vogelRefThicker', 'basecurve.vogelRefImpossible'])(
    '%s names the Faustregel nach Vogel',
    (key) => expect(dict[key]).toContain('Faustregel nach Vogel'),
  );
});

describe('result cards (02-01)', () => {
  const placeholders = (key) => [...dict[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  test('result.headline placeholders', () => {
    expect(placeholders('result.headline')).toEqual(['ct', 'glass', 'thick', 'thickLoc', 'thin', 'thinLoc', 'weight']);
  });
  test('thinnest point and thinnest edge keys (02-16, lens-critic B1)', () => {
    expect(dict['result.label.thin']).toBe('Dünnste Stelle');
    expect(dict['expert.zw.etmin']).toBe('Dünnster Rand');
    expect(placeholders('result.thinEdge')).toEqual(['etmin']);
    expect(dict['loc.even']).toBe('überall gleich');
    expect(dict['loc.tech.even']?.length).toBeGreaterThan(0);
  });
  test('result.headline.uniformEdge placeholders', () => {
    expect(placeholders('result.headline.uniformEdge')).toEqual(['ct', 'etmin', 'glass', 'weight']);
  });
  test.each(['rx', 'pd', 'rx-pd'])('has result.lr.cause.%s', (cause) => {
    expect(dict).toHaveProperty([`result.lr.cause.${cause}`]);
  });
  test('has loc.uniform and loc.centre', () => {
    expect(dict['loc.uniform']).toBe('am ganzen Rand');
    expect(dict['loc.centre']).toBe('in der Mitte');
  });
});

describe('Experten-Ansicht (02-02)', () => {
  test('has the binding-constraint sentences', () => {
    expect(dict['expert.binding.minCT']).toBe('Die Mittendicke ist durch den Mindestwert festgelegt.');
    expect(dict['expert.binding.minET']).toBe('Die Mittendicke ergibt sich aus der Mindest-Randdicke.');
  });
  test('every loc.<x> key has a loc.tech.<x> key and vice versa', () => {
    const keys = Object.keys(dict);
    const lay = keys.filter((k) => k.startsWith('loc.') && !k.startsWith('loc.tech.')).map((k) => k.slice(4));
    const tech = keys.filter((k) => k.startsWith('loc.tech.')).map((k) => k.slice(9));
    expect(lay.length).toBeGreaterThan(0);
    expect(tech.sort()).toEqual(lay.sort());
  });
});

describe('toggletips (02-03, UX-01)', () => {
  test('every tip.<term>.name has a tip.<term>.text and vice versa', () => {
    const keys = Object.keys(dict).filter((k) => k.startsWith('tip.'));
    const terms = (part) => keys.filter((k) => k.endsWith('.' + part)).map((k) => k.slice(4, -part.length - 1)).sort();
    expect(terms('name').length).toBeGreaterThanOrEqual(4);
    expect(terms('text')).toEqual(terms('name'));
    for (const k of keys) expect(k, k).toMatch(/^tip\.[a-z]+\.(name|text)$/);
  });
  test('accessible names start with "Erklärung: "', () => {
    for (const [k, v] of Object.entries(dict)) if (/^tip\..+\.name$/.test(k)) expect(v, k).toMatch(/^Erklärung: \S/);
  });
});

describe('soft hyphens (02-02, UI-SPEC Typography)', () => {
  // Written as the \u00AD escape only, so every break point is visible in review (PATTERNS de-AT).
  test('de-AT.js source contains no raw U+00AD', () => {
    const src = readFileSync(new URL('./de-AT.js', import.meta.url), 'utf8');
    expect(src.includes('\u00AD')).toBe(false);
  });
  test('the escapes are in place for Pupillen·distanz and Dezen·tration', () => {
    expect(dict['result.lr.cause.pd']).toContain('Pupillen\u00ADdistanz');
    expect(dict['expert.zw.dec']).toContain('Dezen\u00ADtration');
  });
});

describe('frame section and smart PD (02-04)', () => {
  const ph = (key) => [...dict[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  test('the assumed PD and the estimated B are stated in the result (D-06, lens-critic MINOR-6)', () => {
    expect(dict['pd.assumed']).toBe('PD angenommen: {pd} je Auge ({eyes}) – fragen Sie Ihren Optiker nach Ihrem Wert.');
    expect(dict['frame.bAssumed']).toBe(
      'Glashöhe B geschätzt: {B} aus der Form – für genauere Werte B messen oder beim Optiker erfragen.',
    );
  });
  test('placeholders of the PD and stamp notes', () => {
    expect(ph('pd.binocularNote')).toEqual(['half', 'total']);
    expect(ph('pd.pairNote')).toEqual(['od', 'os']);
    expect(ph('pd.PD_AMBIGUOUS')).toEqual(['value']);
    expect(ph('stamp.echo')).toEqual(['A', 'DBL']);
    expect(ph('stamp.echoTemple')).toEqual(['A', 'DBL', 'temple']);
    expect(ph('stamp.STAMP_SWAPPED')).toEqual(['A', 'DBL']);
    expect(ph('frame.defaults')).toEqual(['A', 'B', 'DBL']);
    expect(ph('frame.bEstimated')).toEqual(['B']);
  });
  test('the SVG labels name the three stamp numbers', () => {
    expect([dict['stamp.svg.a'], dict['stamp.svg.dbl'], dict['stamp.svg.temple']]).toEqual(['Glasbreite', 'Stegbreite', 'Bügellänge']);
  });
  test.each(['a', 'b', 'dbl', 'stamp'])('has tip.%s', (term) => {
    expect(dict).toHaveProperty([`tip.${term}.name`]);
    expect(dict).toHaveProperty([`tip.${term}.text`]);
  });
});

describe('material cards (02-07)', () => {
  const ph = (key) => [...dict[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  test.each(Object.keys(MATERIALS))('%s has a title and a sub line with {abbe}', (id) => {
    expect(dict).toHaveProperty([`material.${id}.title`]);
    expect(ph(`material.${id}.sub`)).toEqual(['abbe']);
    // Index first (UI-SPEC "Material"): "1,50 · Standard".
    expect(dict[`material.${id}.title`]).toMatch(/^1,\d\d · /);
  });
  test.each(['index', 'abbe'])('has tip.%s', (term) => {
    expect(dict).toHaveProperty([`tip.${term}.name`]);
    expect(dict).toHaveProperty([`tip.${term}.text`]);
  });
  test('the Brechungs·index escape is in place', () => {
    expect(dict['tip.index.text']).toContain('Brechungs­index');
  });
});

describe('material comparison (02-07)', () => {
  const ph = (key) => [...dict[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const diffKeys = Object.keys(dict).filter((k) => k.startsWith('cmp.diff.'));
  test('the four mixed difference sentences have exactly {mm} and {g}', () => {
    for (const k of ['thinnerLighter', 'thickerHeavier', 'thinnerHeavier', 'thickerLighter']) {
      expect(ph(`cmp.diff.${k}`), k).toEqual(['g', 'mm']);
    }
  });
  test('every cmp.diff.* uses only {mm} and {g}', () => {
    expect(diffKeys.length).toBe(9);
    for (const k of diffKeys) for (const p of ph(k)) expect(['g', 'mm'], k).toContain(p);
  });
  test('placeholders of the intro, the percentages and the assumed note', () => {
    expect(ph('cmp.material.intro')).toEqual(['eye']);
    // 02-19 (m3): the intro's {eye} is one of these two wrappers
    expect(ph('cmp.eye.thicker')).toEqual(['eye']);
    expect(ph('cmp.eye.tie')).toEqual(['eye']);
    expect(ph('cmp.pct')).toEqual(['pct']);
    expect(ph('cmp.pctThicker')).toEqual(['pct']);
    expect(ph('cmp.assumedNote')).toEqual(['materials']);
    expect(ph('tech.timingCompare')).toEqual(['max', 'med', 'n']);
  });
  test.each(['ct', 'et'])('has tip.%s', (term) => {
    expect(dict).toHaveProperty([`tip.${term}.name`]);
    expect(dict).toHaveProperty([`tip.${term}.text`]);
  });
});

describe('configuration comparison (02-08)', () => {
  const ph = (key) => [...dict[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const ALLOWED = {
    'cmp.config.status': ['A', 'DBL', 'material', 'shape'],
    'cmp.config.diff': ['g', 'lighterHeavier', 'mm', 'thinnerThicker'],
    'cmp.config.diffEqualThick': ['g', 'lighterHeavier'],
    'cmp.config.diffEqualWeight': ['mm', 'thinnerThicker'],
    'cmp.config.partial': ['eye'],
  };
  test('placeholder whitelist for cmp.config.*: exactly the listed params, none elsewhere', () => {
    const keys = Object.keys(dict).filter((k) => k.startsWith('cmp.config.'));
    expect(keys.length).toBeGreaterThanOrEqual(14);
    for (const k of keys) expect(ph(k), k).toEqual(ALLOWED[k] ?? []);
  });
  test('cmp.cfg.diff.* use only {mm} or {g}; rows and columns have no params', () => {
    for (const k of Object.keys(dict).filter((x) => x.startsWith('cmp.cfg.') || x.startsWith('cmp.show.'))) {
      const allowed = k.startsWith('cmp.cfg.diff.') ? ['g', 'mm'] : [];
      for (const p of ph(k)) expect(allowed, `${k} {${p}}`).toContain(p);
    }
    expect(ph('cmp.cfg.diff.thinner')).toEqual(['mm']);
    expect(ph('cmp.cfg.diff.lighter')).toEqual(['g']);
  });
  test('the UI-SPEC sentences', () => {
    expect(dict['cmp.config.cta']).toBe('Variante vergleichen');
    expect(dict['cmp.config.end']).toBe('Vergleich beenden');
    expect(dict['cmp.show.legend']).toBe('Ergebniskarten zeigen:');
    expect(t('cmp.config.diff', { mm: '1,6 mm', thinnerThicker: 'dünner', g: '4 g', lighterHeavier: 'leichter' })).toBe(
      'Nachher (B) ist an der dicksten Stelle 1,6 mm dünner und insgesamt 4 g leichter als Vorher (A).',
    );
  });
});

describe('presets (02-09)', () => {
  test.each(RX_PRESETS.map((p) => p.id))('has preset.rx.%s', (id) => {
    expect(dict).toHaveProperty([`preset.rx.${id}`]);
  });

  test.each(FRAME_PRESETS.map((p) => p.id))('has preset.frame.%s with exactly {A} and {DBL}', (id) => {
    expect(dict).toHaveProperty([`preset.frame.${id}`]);
    expect(dict[`preset.frame.${id}`].match(/\{(\w+)\}/g)).toEqual(['{A}', '{DBL}']);
  });

  test('the UI-SPEC sentences', () => {
    expect(dict['preset.rx.label']).toBe('Beispiele zum Ausprobieren:');
    expect(dict['preset.frame.label']).toBe('Typische Größen:');
    expect(dict['preset.confirm.q']).toBe('Ihre Eingaben ersetzen?');
    expect(dict['preset.confirm.body']).toBe('Ihre eingetippten Werte werden durch das Beispiel „{preset}“ ersetzt.');
    expect(dict['preset.confirm.replace']).toBe('Ersetzen');
    expect(dict['preset.confirm.keep']).toBe('Eingaben behalten');
  });

  test('the Hornhaut·verkrümmung escape is in place', () => {
    expect(dict['preset.rx.hhv']).toBe('Hornhaut\u00ADverkrümmung');
  });
});

describe('02-11 aspheric front and rim depth copy (MAT-05, FRAME-02)', () => {
  test('generic-model label, k range, plus-lens note, spherical-basis label', () => {
    expect(dict['expert.front.asph']).toContain('allgemeines Modell, kein bestimmtes Herstellerdesign');
    expect(dict['expert.k.label']).toBe('Konische Konstante k (Standard −1, erlaubt −5,0 bis −1,0)');
    expect(dict['expert.asph.note']).toContain('vor allem Plusgläser');
    expect(dict['basecurve.sphericalBasis']).toBe('(für sphärische Vorderfläche bestimmt)');
  });
  test('rim depth: assumed default, no effect on thickness or weight, split and lead placeholders', () => {
    expect(dict['frame.rim.note']).toContain('angenommener Wert, keine Herstellerangabe');
    expect(dict['frame.rim.note']).toContain('ändert Dicke und Gewicht nicht');
    const ph = (k) => [...dict[k].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    // 03-01 (D-05): frame.rim.over replaced by the front/back split and the front-surface lead
    expect(dict).not.toHaveProperty(['frame.rim.over']);
    expect(ph('frame.rim.both')).toEqual(['back', 'front', 'glass']);
    expect(ph('frame.rim.front')).toEqual(['front', 'glass']);
    expect(ph('frame.rim.back')).toEqual(['back', 'glass']);
    expect(ph('frame.rim.lead')).toEqual(['glass', 'lead']);
    expect(ph('frame.rim.leadNone')).toEqual(['glass']);
    expect(dict['frame.rim.bevel']).toContain('angenommen');
    expect(ph('frame.rim.fits')).toEqual(['glass']);
    expect(ph('frame.rim.note')).toEqual(['value']);
  });
  test('k and Randtiefe have toggletips', () => {
    for (const k of ['k', 'rim']) {
      expect(dict).toHaveProperty([`tip.${k}.name`]);
      expect(dict).toHaveProperty([`tip.${k}.text`]);
    }
  });
});

describe('02-12 custom material copy (MAT-06, D-17)', () => {
  test('card, label, only-Expert Hinweis, comparison note and ne tip (UI-SPEC copywriting)', () => {
    expect(dict['material.custom.title']).toBe('Eigenes Material');
    expect(dict['material.custom.sub']).toBe('Werte selbst eingeben');
    expect(dict['material.custom.label']).toBe('beruht auf Ihren Angaben, kein geprüftes Material');
    expect(dict['material.custom.onlyExpert']).toBe('Eigenes Material gilt nur in der Experten-Ansicht. Es wird wieder {material} verwendet.');
    expect(dict['cmp.customExcluded']).toBe('Ihr eigenes Material ist hier nicht aufgeführt; verglichen werden nur geprüfte Materialien.');
    expect(dict['tip.ne.text']).toContain('0,001 bis 0,007');
    expect(dict).toHaveProperty(['tip.ne.name']);
  });
  test('field labels and {field} names for the two custom codes', () => {
    for (const f of ['ne', 'density', 'abbe']) expect(dict).toHaveProperty([`material.custom.field.${f}`]);
    expect(dict['material.custom.ne.label']).toContain('Brechungsindex');
    expect(dict['material.custom.density.label']).toContain('g/cm³');
    expect(dict['material.custom.abbe.label']).toContain('freiwillig');
    const ph = (k) => [...dict[k].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    expect(ph('val.VAL_CUSTOM_OUT_OF_RANGE')).toEqual(['field', 'max', 'min', 'value']);
    expect(ph('val.VAL_CUSTOM_IMPLAUSIBLE')).toEqual(['field', 'max', 'min', 'value']);
  });
});

describe('02-13 Querschnitt copy (ANA-01, D-30, D-37)', () => {
  const ph = (k) => [...dict[k].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const ALLOWED = {
    'xs.svgTitle': ['angle', 'eye'],
    'xs.desc': ['ct', 'endA', 'endB', 'locA', 'locB'],
    'xs.descA': ['ct', 'endA', 'endB', 'locA', 'locB'],
    'xs.descB': ['ct', 'endA', 'endB', 'locA', 'locB'],
    'xs.row.end': ['loc'],
    'xs.meridian.hPrincipal': ['power'],
    'xs.meridian.hOblique': ['power'],
    'xs.meridian.hSphere': ['power'],
    'xs.meridian.principal': ['axis', 'power'],
  };
  test('placeholder whitelist for xs.*: exactly the listed params, none elsewhere', () => {
    const keys = Object.keys(dict).filter((k) => k.startsWith('xs.'));
    expect(keys.length).toBeGreaterThanOrEqual(25);
    for (const k of keys) expect(ph(k), k).toEqual(ALLOWED[k] ?? []);
  });
  test('the UI-SPEC sentences and an end label for every location code', () => {
    expect(dict['xs.title']).toBe('Querschnitt');
    expect(dict['xs.svgTitle']).toBe('Querschnitt {eye}, Schnitt {angle}°');
    expect(dict['xs.desc']).toBe('Mittendicke {ct}; Rand {endA} ({locA}) und {endB} ({locB}).');
    expect(dict['xs.legend']).toBe('A (Vorher) — durchgezogen · B (Nachher) — gestrichelt');
    expect(dict['xs.table.caption']).toBe('Werte im Querschnitt');
    expect(dict['xs.meridian.label']).toBe('Schnitt');
    expect(dict['xs.meridian.h']).toBe('waagrecht (0°)');
    expect(dict['xs.meridian.principal']).toBe('Hauptschnitt {axis}° ({power})');
    expect(dict['xs.eye.od']).toBe('Rechtes Glas');
    expect(dict['xs.eye.os']).toBe('Linkes Glas');
    expect(dict['xs.noChord']).toBe(
      'Für diesen Schnitt lässt sich kein Querschnitt zeichnen: der optische Mittelpunkt liegt außerhalb der Fassung.',
    );
    const words = { nasal: 'Nase', temporal: 'Schläfe', superior: 'oben', inferior: 'unten' };
    for (const h of ['nasal', 'temporal']) {
      expect(dict[`xs.end.${h}`]).toBe(words[h]);
      for (const v of ['superior', 'inferior']) expect(dict[`xs.end.${h}-${v}`]).toBe(`${words[h]} ${words[v]}`);
    }
    for (const v of ['superior', 'inferior']) expect(dict[`xs.end.${v}`]).toBe(words[v]);
  });
});

describe('02-14 UX-01 term list (UI-SPEC Toggletips)', () => {
  // Sph, Zyl, Achse, PD, Brechungsindex, Basiskurve, Mittendicke, Randdicke, A, B, DBL, Dezentration.
  const UX01 = ['sph', 'cyl', 'axis', 'pd', 'index', 'basecurve', 'ct', 'et', 'a', 'b', 'dbl', 'dec'];

  test('lists the 12 UX-01 terms', () => expect(UX01).toHaveLength(12));

  test.each(UX01)('tip.%s has a name "Erklärung: …" and a text', (id) => {
    expect(dict[`tip.${id}.name`]).toMatch(/^Erklärung: \S/);
    expect(dict[`tip.${id}.text`]?.trim().length).toBeGreaterThan(0);
  });

  test.each(UX01)('index.html has a tip button and panel for tip-%s', (id) => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).toMatch(new RegExp(`class="tip-btn"[^>]*\\s+aria-controls="tip-${id}"`));
    expect(html).toContain(`id="tip-${id}"`);
  });
});
