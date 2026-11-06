import { describe, test, expect } from 'vitest';
import dict from './de-AT.js';
import { t } from './t.js';
import { PARSE_CODES } from '../state/parse.js';
import { RX_CODES } from '../state/transpose.js';
import { DIAGNOSTICS } from '../engine/diagnostics.js';

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

  test('never uses "Stärke" (thickness is Mittendicke/Randdicke)', () => {
    for (const [k, v] of Object.entries(dict)) expect(v, k).not.toMatch(/Stärke/);
  });
});

describe('disclaimer (RES-06, lens-critic iteration-3 MAJOR-1)', () => {
  const body = () => dict['disclaimer.body'];
  test('has a title', () => expect(dict['disclaimer.title']).toBe('Wichtiger Hinweis'));
  test('does not mention Vogel-Regel', () => expect(body()).not.toContain('Vogel-Regel'));
  test('says möglichst dünn', () => expect(body()).toContain('möglichst dünn'));
  test('names the +0,50 floor', () => expect(body()).toContain('+0,50'));
  test('says real lenses can be dicker', () => expect(body()).toContain('dicker'));
  test('is a Lernhilfe', () => expect(body()).toContain('Lernhilfe'));
  test('states the CT tolerance as ±0,3 mm', () => expect(body()).toContain('±0,3 mm'));
});

// Documented data fields per code (src/engine/diagnostics.js, solve.js, evaluate.js).
const DIAG_DATA = {
  FRONT_SAG_UNDEFINED: ['R1', 'rhoMax'],
  BACK_SAG_UNDEFINED: ['meridian', 'axisDeg', 'searched'],
  VERTEX_TERM_INVALID: ['ct', 'D1'],
  THICK_LENS_NOT_CONVERGED: ['iterations'],
  NON_FINITE_RESULT: [],
  INVALID_SPEC: ['reason'],
  OC_OUTSIDE_OUTLINE: ['x', 'y'],
  BLANK_EXCEEDS_STOCK: ['mbsMm', 'stockMm'],
  CT_SET_BY_MIN_CT: [],
  CT_SET_BY_MIN_ET: [],
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

  test('no orphan diag.*, parse.* or rx.<CODE> keys', () => {
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
      }
    }
  });

  test('every {param} in diag.* texts is a documented data field of that code', () => {
    for (const [key, v] of Object.entries(dict)) {
      const m = key.match(/^diag\.([A-Z_]+)\./);
      if (!m) continue;
      for (const p of placeholders(v)) expect(DIAG_DATA[m[1]], `${key} {${p}}`).toContain(p);
    }
  });

  test('every {param} in basecurve.* is vogel or thickness', () => {
    for (const [key, v] of Object.entries(dict)) {
      if (!key.startsWith('basecurve.')) continue;
      for (const p of placeholders(v)) expect(['vogel', 'thickness'], `${key} {${p}}`).toContain(p);
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
    expect(v).not.toContain('{meridian}');
  });
  test('BASE_CURVE_CLAMPED keys are removed (D-01 final)', () => {
    expect(Object.keys(dict).filter((k) => k.startsWith('diag.BASE_CURVE_CLAMPED'))).toEqual([]);
  });
  test('the thinnest rule says möglichst dünn and never dicker', () => {
    expect(dict['basecurve.rule.thinnest']).toContain('möglichst dünn');
    expect(dict['basecurve.rule.thinnest']).not.toContain('dicker');
  });
  test.each(['basecurve.vogelRef', 'basecurve.vogelRefThicker', 'basecurve.vogelRefImpossible'])(
    '%s names the Faustregel nach Vogel',
    (key) => expect(dict[key]).toContain('Faustregel nach Vogel'),
  );
});
