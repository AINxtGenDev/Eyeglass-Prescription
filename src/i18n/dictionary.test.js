import { describe, test, expect } from 'vitest';
import dict from './de-AT.js';
import { t } from './t.js';
import { PARSE_CODES } from '../state/parse.js';
import { RX_CODES } from '../state/transpose.js';

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
