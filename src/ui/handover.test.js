// 04-07 (D-21, T-04-26, T-04-27): the input handover across an update reload, in Node. A Map-backed
// fake storage and a fake document built from plain objects (value/checked, dispatchEvent spies).
import { describe, it, expect, vi } from 'vitest';
import {
  HANDOVER_KEY,
  MAX_CHARS,
  TEXT_IDS,
  probe,
  writeHandover,
  takeHandover,
  snapshotForm,
  applySnapshot,
} from './handover.js';

/** Storage stand-in; `log` records every call in order, `fail` makes a method throw. */
function fakeStorage(initial = {}, fail = {}) {
  const map = new Map(Object.entries(initial));
  const log = [];
  const guard = (name) => {
    if (fail[name]) throw new Error(`${name} blocked`);
  };
  return {
    map,
    log,
    getItem(k) {
      log.push(['getItem', k]);
      guard('getItem');
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      log.push(['setItem', k]);
      guard('setItem');
      map.set(k, String(v));
    },
    removeItem(k) {
      log.push(['removeItem', k]);
      guard('removeItem');
      map.delete(k);
    },
  };
}

/** The form as plain objects: text fields, two checkboxes, three radio groups. */
function fakeDoc() {
  const events = [];
  const el = (id, extra = {}) => {
    const e = { id, value: '', checked: false, ...extra };
    e.dispatchEvent = vi.fn((ev) => events.push([e.id ?? `${e.name}=${e.value}`, ev.type, ev.bubbles]));
    return e;
  };
  const byId = new Map(TEXT_IDS.map((id) => [id, el(id)]));
  byId.set('expert', el('expert'));
  byId.set('rx-same', el('rx-same'));
  byId.set('cmp-start', el('cmp-start'));
  const radio = (name, value, checked = false) => el(undefined, { name, value, checked });
  const radios = [
    radio('frame-shape', 'rechteckig', true),
    radio('frame-shape', 'oval'),
    radio('material', 'cr39', true),
    radio('material', 'mr8'),
    radio('material', 'custom'),
    radio('expert-front', 'sph', true),
    radio('expert-front', 'asph'),
  ];
  // Checking a radio unchecks the others of its group, as in a browser.
  for (const r of radios) {
    let c = r.checked;
    Object.defineProperty(r, 'checked', {
      get: () => c,
      set: (v) => {
        if (v) for (const o of radios) if (o !== r && o.name === r.name) o.checked = false;
        c = v;
      },
    });
  }
  return {
    events,
    byId,
    radios,
    getElementById: (id) => byId.get(id) ?? null,
    querySelectorAll: (sel) => {
      const name = /name="([^"]+)"/.exec(sel)?.[1];
      return radios.filter((r) => r.name === name);
    },
  };
}

const valid = (over = {}) => ({
  v: 1,
  origin: 'self',
  valid: true,
  text: { 'rx-od-sph': '-2,25', 'rx-os-sph': '-1,5', 'frame-a': '50', 'frame-stamp': '50□18 140' },
  checks: { expert: false, 'rx-same': false },
  radios: { 'frame-shape': 'oval', material: 'mr8', 'expert-front': 'sph' },
  compareA: null,
  ...over,
});

describe('probe and writeHandover', () => {
  it('probe writes and removes the one key and reports true', () => {
    const s = fakeStorage();
    expect(probe(s)).toBe(true);
    expect(s.log).toEqual([
      ['setItem', HANDOVER_KEY],
      ['removeItem', HANDOVER_KEY],
    ]);
    expect(s.map.size).toBe(0);
  });
  it('probe reports false when setItem throws, and when no storage exists', () => {
    expect(probe(fakeStorage({}, { setItem: true }))).toBe(false);
    expect(probe(null)).toBe(false);
  });
  it('writeHandover does one setItem under the key and returns true', () => {
    const s = fakeStorage();
    expect(writeHandover(valid(), s)).toBe(true);
    expect(s.log).toEqual([['setItem', HANDOVER_KEY]]);
    expect(JSON.parse(s.map.get(HANDOVER_KEY))).toEqual(valid());
  });
  it('writeHandover never throws: false when setItem throws or storage is missing', () => {
    expect(() => writeHandover(valid(), fakeStorage({}, { setItem: true }))).not.toThrow();
    expect(writeHandover(valid(), fakeStorage({}, { setItem: true }))).toBe(false);
    expect(writeHandover(valid(), null)).toBe(false);
  });
  it('writeHandover writes nothing for a value over the cap', () => {
    const s = fakeStorage();
    expect(writeHandover(valid({ text: { 'rx-od-sph': 'x'.repeat(MAX_CHARS) } }), s)).toBe(false);
    expect(s.map.size).toBe(0);
  });
});

describe('takeHandover (read once, delete before use, T-04-26)', () => {
  it('no key → null, nothing removed', () => {
    const s = fakeStorage();
    expect(takeHandover(s)).toBeNull();
    expect(s.log).toEqual([['getItem', HANDOVER_KEY]]);
  });
  it('a getItem that throws or no storage → null (a normal load)', () => {
    expect(takeHandover(fakeStorage({}, { getItem: true }))).toBeNull();
    expect(takeHandover(null)).toBeNull();
  });
  it('a valid value: removed BEFORE the snapshot is returned', () => {
    const s = fakeStorage({ [HANDOVER_KEY]: JSON.stringify(valid()) });
    let returned = false;
    let removedAfterReturn = null;
    let parsedBeforeRemoval = false;
    const parse = JSON.parse;
    const spy = vi.spyOn(JSON, 'parse').mockImplementation((...a) => {
      if (!s.log.some((c) => c[0] === 'removeItem')) parsedBeforeRemoval = true;
      return parse(...a);
    });
    const orig = s.removeItem.bind(s);
    s.removeItem = (k) => {
      removedAfterReturn = returned;
      orig(k);
    };
    const snap = takeHandover(s);
    returned = true;
    spy.mockRestore();
    expect(removedAfterReturn).toBe(false);
    expect(parsedBeforeRemoval).toBe(false);
    expect(s.map.has(HANDOVER_KEY)).toBe(false);
    expect(snap).toEqual(valid());
    // The removal is the call right after the read, before anything is parsed or returned.
    expect(s.log).toEqual([
      ['getItem', HANDOVER_KEY],
      ['removeItem', HANDOVER_KEY],
    ]);
  });
  it('removal happens before parsing: a throwing JSON is still removed', () => {
    const s = fakeStorage({ [HANDOVER_KEY]: '{not json' });
    expect(takeHandover(s)).toEqual({ lost: true });
    expect(s.map.size).toBe(0);
  });
  it('a value over 8 192 characters → lost, key removed', () => {
    const s = fakeStorage({ [HANDOVER_KEY]: ' '.repeat(MAX_CHARS + 1) });
    expect(MAX_CHARS).toBe(8192);
    expect(takeHandover(s)).toEqual({ lost: true });
    expect(s.map.size).toBe(0);
  });
  it.each([
    ['not an object', '"text"'],
    ['null', 'null'],
    ['an array', '[]'],
    ['wrong version', JSON.stringify(valid({ v: 2 }))],
    ['unknown origin', JSON.stringify(valid({ origin: 'evil' }))],
    ['unknown text id', JSON.stringify(valid({ text: { 'rx-od-sph': '1', 'x-y': '2' } }))],
    ['__proto__ key', '{"v":1,"origin":"self","valid":true,"text":{"__proto__":"x"},"checks":{},"radios":{},"compareA":null}'],
    ['non-string text', JSON.stringify(valid({ text: { 'rx-od-sph': 2 } }))],
    ['over-long text', JSON.stringify(valid({ text: { 'rx-od-sph': 'x'.repeat(201) } }))],
    ['non-boolean check', JSON.stringify(valid({ checks: { expert: 'yes' } }))],
    ['unknown radio group', JSON.stringify(valid({ radios: { 'view-mode': 'heat' } }))],
    ['compareA with a string size', JSON.stringify(valid({ compareA: { frame: { shape: 'oval', A: '50', B: 30, DBL: 18 }, materialId: 'cr39', custom: null } }))],
    ['compareA with NaN-like custom', JSON.stringify(valid({ compareA: { frame: null, materialId: 'custom', custom: { customMaterial: { ne: 'x', density: 1, ve: null }, minCT: 1, minET: 1 } } }))],
    ['unknown top-level key', JSON.stringify(valid({ lost: false }))],
    ['missing valid flag', JSON.stringify({ ...valid(), valid: undefined })],
  ])('wrong shape (%s) → lost, key removed', (_name, raw) => {
    const s = fakeStorage({ [HANDOVER_KEY]: raw });
    expect(takeHandover(s)).toEqual({ lost: true });
    expect(s.map.size).toBe(0);
  });
  it('a valid compareA passes', () => {
    const compareA = {
      frame: { shape: 'oval', A: 52.5, B: 30, DBL: 18 },
      materialId: 'custom',
      custom: { customMaterial: { ne: 1.6, density: 1.3, ve: null }, minCT: 1.8, minET: null },
    };
    const s = fakeStorage({ [HANDOVER_KEY]: JSON.stringify(valid({ compareA })) });
    expect(takeHandover(s)).toEqual(valid({ compareA }));
  });
});

describe('snapshotForm (raw field text, never parsed numbers)', () => {
  it('collects every text field, the checks and the radio groups as typed', () => {
    const doc = fakeDoc();
    doc.byId.get('rx-od-sph').value = '-2,25';
    doc.byId.get('frame-stamp').value = '52□1';
    doc.byId.get('rx-same').checked = true;
    const snap = snapshotForm(doc);
    expect(snap.v).toBe(1);
    expect(Object.keys(snap.text).sort()).toEqual([...TEXT_IDS].sort());
    expect(snap.text['rx-od-sph']).toBe('-2,25');
    expect(snap.text['frame-stamp']).toBe('52□1');
    expect(snap.checks).toEqual({ expert: false, 'rx-same': true });
    expect(snap.radios).toEqual({ 'frame-shape': 'rechteckig', material: 'cr39', 'expert-front': 'sph' });
    expect(snap.compareA).toBeNull();
    expect(snap.valid).toBe(true);
    expect(snap).not.toHaveProperty('origin');
  });
  it('the Rx, frame, material, custom material and the Experten-Ansicht switch are all covered', () => {
    for (const eye of ['od', 'os']) for (const f of ['sph', 'cyl', 'axis', 'pd']) expect(TEXT_IDS).toContain(`rx-${eye}-${f}`);
    for (const id of ['frame-stamp', 'frame-a', 'frame-b', 'frame-dbl', 'frame-rim']) expect(TEXT_IDS).toContain(id);
    for (const id of ['custom-ne', 'custom-density', 'custom-abbe', 'custom-min-ct', 'custom-min-et']) expect(TEXT_IDS).toContain(id);
    // Display state is never stored (UI-SPEC "Input handover").
    expect(snapshotForm(fakeDoc()).radios).not.toHaveProperty('view-mode');
  });
  it('carries a structured copy of the comparison configuration A and the valid flag', () => {
    const compareA = { frame: { shape: 'oval', A: 50, B: 30, DBL: 18 }, materialId: 'cr39', custom: null };
    const snap = snapshotForm(fakeDoc(), { compareA, valid: false });
    expect(snap.compareA).toEqual(compareA);
    expect(snap.compareA).not.toBe(compareA);
    expect(snap.valid).toBe(false);
  });
  it('round-trips through writeHandover and takeHandover', () => {
    const doc = fakeDoc();
    doc.byId.get('rx-os-axis').value = '90';
    const s = fakeStorage();
    expect(writeHandover({ ...snapshotForm(doc), origin: 'other' }, s)).toBe(true);
    expect(takeHandover(s)).toEqual({ ...snapshotForm(doc), origin: 'other' });
  });
});

describe('applySnapshot (through the normal input path, never trusted raw)', () => {
  it('writes field text and dispatches bubbling input/change events, only for changed values', () => {
    const doc = fakeDoc();
    doc.byId.get('rx-os-sph').value = '-1,5'; // unchanged: no event
    const res = applySnapshot(valid(), doc, { startCompare: vi.fn(), isValid: () => true });
    expect(res).toBe('ok');
    expect(doc.byId.get('rx-od-sph').value).toBe('-2,25');
    expect(doc.byId.get('frame-a').value).toBe('50');
    expect(doc.radios.find((r) => r.value === 'oval').checked).toBe(true);
    expect(doc.radios.find((r) => r.value === 'rechteckig').checked).toBe(false);
    expect(doc.radios.find((r) => r.value === 'mr8').checked).toBe(true);
    const ids = doc.events.map((e) => e[0]);
    expect(ids).toContain('rx-od-sph');
    expect(ids).not.toContain('rx-os-sph');
    expect(doc.events.every((e) => e[2] === true)).toBe(true);
    expect(doc.events.find((e) => e[0] === 'rx-od-sph')[1]).toBe('input');
    expect(doc.events.find((e) => e[0] === 'frame-shape=oval')[1]).toBe('change');
  });
  it('order: switch first, the frame sizes before the stamp, the material before its custom fields', () => {
    const doc = fakeDoc();
    const snap = valid({
      checks: { expert: true, 'rx-same': true },
      radios: { 'frame-shape': 'oval', material: 'custom', 'expert-front': 'asph' },
      text: { 'frame-a': '50', 'frame-stamp': '50□1', 'custom-ne': '1,6', 'expert-k': '−0,5' },
    });
    applySnapshot(snap, doc, { startCompare: vi.fn(), isValid: () => true });
    const order = doc.events.map((e) => e[0]);
    const at = (id) => order.indexOf(id);
    expect(at('expert')).toBe(0);
    expect(at('rx-same')).toBeLessThan(at('frame-shape=oval'));
    expect(at('frame-shape=oval')).toBeLessThan(at('frame-a'));
    expect(at('frame-a')).toBeLessThan(at('frame-stamp'));
    expect(at('material=custom')).toBeLessThan(at('custom-ne'));
    expect(at('expert-front=asph')).toBeLessThan(at('expert-k'));
    expect(doc.byId.get('frame-stamp').value).toBe('50□1');
  });
  it('a configuration A is written first (numbers → de-AT text), then #cmp-start, then the B values', () => {
    const doc = fakeDoc();
    const calls = [];
    const startCompare = vi.fn(() => calls.push(['start', doc.byId.get('frame-a').value, doc.byId.get('custom-ne').value]));
    const compareA = {
      frame: { shape: 'rechteckig', A: 52.5, B: 30, DBL: 18 },
      materialId: 'custom',
      custom: { customMaterial: { ne: 1.604, density: 1.3, ve: null }, minCT: 1.8, minET: null },
    };
    const snap = valid({ checks: { expert: true, 'rx-same': false }, compareA });
    const res = applySnapshot(snap, doc, { startCompare, isValid: () => true });
    expect(res).toBe('ok');
    expect(startCompare).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([['start', '52,5', '1,604']]);
    expect(doc.byId.get('custom-abbe').value).toBe('');
    expect(doc.byId.get('custom-min-ct').value).toBe('1,8');
    // B (the form) afterwards.
    expect(doc.byId.get('frame-a').value).toBe('50');
    expect(doc.radios.find((r) => r.value === 'oval').checked).toBe(true);
    expect(doc.radios.find((r) => r.value === 'mr8').checked).toBe(true);
  });
  it('no configuration A → #cmp-start is not triggered', () => {
    const startCompare = vi.fn();
    applySnapshot(valid(), fakeDoc(), { startCompare, isValid: () => true });
    expect(startCompare).not.toHaveBeenCalled();
  });
  it('lost when a written value fails validation', () => {
    expect(applySnapshot(valid(), fakeDoc(), { startCompare: vi.fn(), isValid: () => false })).toBe('lost');
  });
  it('a form that was already invalid at the snapshot is not reported as lost', () => {
    expect(applySnapshot(valid({ valid: false }), fakeDoc(), { startCompare: vi.fn(), isValid: () => false })).toBe('ok');
  });
  it('lost when a radio value or a field no longer exists (a schema change between builds)', () => {
    expect(
      applySnapshot(valid({ radios: { material: 'gone' } }), fakeDoc(), { startCompare: vi.fn(), isValid: () => true }),
    ).toBe('lost');
    const doc = fakeDoc();
    doc.byId.delete('frame-rim');
    expect(applySnapshot(valid({ text: { 'frame-rim': '2' } }), doc, { startCompare: vi.fn(), isValid: () => true })).toBe(
      'lost',
    );
  });
});
