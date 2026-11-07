// Preset data (02-09, RES-05, D-26, D-27): field text in paper form, valid through the normal
// parse → validate path, labels only as dictionary keys.
import { describe, test, expect } from 'vitest';
import { RX_PRESETS, FRAME_PRESETS, EXAMPLE } from './presets.js';
import { validateRxEye, TIERS } from './validate.js';
import { parseDiopter } from './parse.js';

const EYES = ['od', 'os'];
const onGrid = (text) => {
  const r = parseDiopter(text);
  return r.ok && Math.abs(r.value * 4 - Math.round(r.value * 4)) < 1e-9;
};

describe('EXAMPLE (02-01 load values)', () => {
  test('equals R −2,75 / −0,50 × 180, PD 32 and L −2,50 / −0,75 × 170, PD 31,5', () => {
    expect(EXAMPLE).toEqual({
      od: { sph: '-2,75', cyl: '-0,50', axis: '180', pd: '32' },
      os: { sph: '-2,50', cyl: '-0,75', axis: '170', pd: '31,5' },
    });
  });

  test('is frozen, also per eye', () => {
    expect(Object.isFrozen(EXAMPLE)).toBe(true);
    for (const e of EYES) expect(Object.isFrozen(EXAMPLE[e])).toBe(true);
  });
});

describe('RX_PRESETS', () => {
  test('ids leicht, stark, weit, hhv in chip order', () => {
    expect(RX_PRESETS.map((p) => p.id)).toEqual(['leicht', 'stark', 'weit', 'hhv']);
  });

  test('UI-SPEC "Preset data" values as paper text', () => {
    const byId = Object.fromEntries(RX_PRESETS.map((p) => [p.id, { od: p.od, os: p.os }]));
    expect(byId).toEqual({
      leicht: { od: { sph: '-1,25', cyl: '', axis: '' }, os: { sph: '-1,00', cyl: '', axis: '' } },
      stark: { od: { sph: '-6,50', cyl: '-0,75', axis: '10' }, os: { sph: '-6,00', cyl: '-0,50', axis: '170' } },
      weit: { od: { sph: '+3,00', cyl: '', axis: '' }, os: { sph: '+2,75', cyl: '', axis: '' } },
      hhv: { od: { sph: '-0,50', cyl: '-2,00', axis: '180' }, os: { sph: '-0,75', cyl: '-1,75', axis: '10' } },
    });
  });

  test.each(RX_PRESETS.map((p) => [p.id, p]))('%s: both eyes validate without error or out-of-model tier', (_id, p) => {
    for (const e of EYES) {
      const v = validateRxEye(p[e]);
      expect(v.rx, e).not.toBeNull();
      expect(v.blocked.rx, e).toBe(false);
      for (const f of ['sph', 'cyl', 'axis']) {
        const m = v.fields[f];
        if (m) expect([TIERS.ERROR, TIERS.OUT], `${e} ${f}`).not.toContain(m.tier);
      }
    }
  });

  test.each(RX_PRESETS.map((p) => [p.id, p]))('%s: Sph and Zyl are on the 0,25 dpt grid', (_id, p) => {
    for (const e of EYES) {
      expect(onGrid(p[e].sph), `${e} sph`).toBe(true);
      if (p[e].cyl !== '') expect(onGrid(p[e].cyl), `${e} cyl`).toBe(true);
    }
  });

  test('presets never carry a PD (PD is kept)', () => {
    for (const p of RX_PRESETS) for (const e of EYES) expect(p[e]).not.toHaveProperty('pd');
  });

  test('frozen, entry and eye level', () => {
    expect(Object.isFrozen(RX_PRESETS)).toBe(true);
    for (const p of RX_PRESETS) {
      expect(Object.isFrozen(p)).toBe(true);
      for (const e of EYES) expect(Object.isFrozen(p[e])).toBe(true);
    }
  });
});

describe('FRAME_PRESETS', () => {
  test('klein 48/18, mittel 52/18, gross 56/18 as field text', () => {
    expect(FRAME_PRESETS.map(({ id, A, DBL }) => ({ id, A, DBL }))).toEqual([
      { id: 'klein', A: '48', DBL: '18' },
      { id: 'mittel', A: '52', DBL: '18' },
      { id: 'gross', A: '56', DBL: '18' },
    ]);
  });

  test('frozen', () => {
    expect(Object.isFrozen(FRAME_PRESETS)).toBe(true);
    for (const p of FRAME_PRESETS) expect(Object.isFrozen(p)).toBe(true);
  });
});

describe('no German in the data module', () => {
  test('ids are dictionary key parts: no umlaut, no ß, no space', () => {
    for (const p of [...RX_PRESETS, ...FRAME_PRESETS]) {
      expect(p.id).not.toMatch(/[äöüßÄÖÜ\s]/);
      expect(p.id).toMatch(/^[a-z]+$/);
    }
  });

  test('no string value outside // comments contains German letters or a word with a space', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./presets.js', import.meta.url), 'utf8')
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, ''))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/[äöüßÄÖÜ]/);
    for (const [, s] of src.matchAll(/'([^']*)'/g)) expect(s, `string '${s}'`).not.toMatch(/\s/);
  });
});
