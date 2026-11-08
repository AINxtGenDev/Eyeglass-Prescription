// VIZ-05 (03-13): the pure label layout behind the Dickenkarte callouts, eye labels and iso labels.
import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { layoutLabels, LABEL_GAP_PX } from './label-layout.js';

const W = 50;
const H = 28;
const DOT = 8;

/** A callout item (priority 0) with the outward offset from the OC at `oc`, as labels.js builds it. */
function callout(id, order, anchor, oc, { w = W, h = H } = {}) {
  let dx = anchor.x - oc.x;
  let dy = anchor.y - oc.y;
  const len = Math.hypot(dx, dy);
  let offset;
  if (len < 1e-9) offset = { dx: LABEL_GAP_PX + w / 2, dy: LABEL_GAP_PX + h / 2 }; // Mitte: below-right
  else {
    dx /= len;
    dy /= len;
    const d = LABEL_GAP_PX + (Math.abs(dx) * w) / 2 + (Math.abs(dy) * h) / 2;
    offset = { dx: dx * d, dy: dy * d };
  }
  return { id, priority: 0, order, anchor, size: { w, h }, offset, dot: DOT };
}

/** Six callouts (Mitte, four edge points, one 45° thickest point) of a lens of w × h px centred in the stage. */
function sixAround(lw, lh, bounds) {
  const oc = { x: bounds.w / 2, y: bounds.h / 2 };
  const pts = [
    ['centre', oc],
    ['nasal', { x: oc.x + lw / 2, y: oc.y }],
    ['temporal', { x: oc.x - lw / 2, y: oc.y }],
    ['superior', { x: oc.x, y: oc.y - lh / 2 }],
    ['inferior', { x: oc.x, y: oc.y + lh / 2 }],
    ['thickest', { x: oc.x + (lw / 2) * Math.SQRT1_2, y: oc.y - (lh / 2) * Math.SQRT1_2 }],
  ];
  return pts.map(([id, p], i) => callout(id, i, p, oc));
}

const box = (p, size) => ({ x: p.x, y: p.y, w: size.w, h: size.h });
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a, bounds) => a.x >= 0 && a.y >= 0 && a.x + a.w <= bounds.w && a.y + a.h <= bounds.h;

/** Every visible box: placed labels plus the dots of placed callouts. */
function visibleBoxes(items, out) {
  const boxes = [];
  for (const it of items) {
    const p = out.placed.get(it.id);
    if (!p) continue;
    boxes.push({ id: it.id, ...box(p, it.size) });
    if (it.priority === 0) boxes.push({ id: `${it.id}:dot`, x: it.anchor.x - DOT / 2, y: it.anchor.y - DOT / 2, w: DOT, h: DOT });
  }
  return boxes;
}

describe('VIZ-05 label layout (03-13)', () => {
  test('six callouts around the 320 px heat-eye framing fit without overlap', () => {
    const bounds = { w: 288, h: 216 };
    const items = sixAround(226, 165, bounds);
    const out = layoutLabels(items, bounds);
    expect(out.calloutsFit).toBe(true);
    expect(out.placed.size).toBe(6);
    const boxes = visibleBoxes(items, out);
    for (const b of boxes) expect(inside(b, bounds), b.id).toBe(true);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(hit(boxes[i], boxes[j]), `${boxes[i].id} × ${boxes[j].id}`).toBe(false);
  });

  test('the same six around the old both-rims lens size do not fit: no callout at all (MAJOR 4)', () => {
    const bounds = { w: 288, h: 216 };
    const items = sixAround(73, 53, bounds);
    const out = layoutLabels(items, bounds);
    expect(out.calloutsFit).toBe(false);
    expect(out.placed.size).toBe(0);
  });

  test('candidate order: outward, below, above, left, right (8 px gap)', () => {
    const bounds = { w: 400, h: 300 };
    const a = { x: 200, y: 150 };
    // Outward to the right is free: taken.
    const outward = { id: 'c', priority: 0, order: 0, anchor: a, size: { w: W, h: H }, offset: { dx: 8 + W / 2, dy: 0 }, dot: DOT };
    expect(layoutLabels([outward], bounds).placed.get('c')).toEqual({ x: 208, y: 136 });
    // Outward leaves the stage → below.
    const off = { ...outward, offset: { dx: 1000, dy: 0 } };
    expect(layoutLabels([off], bounds).placed.get('c')).toEqual({ x: 175, y: 158 });
    // Outward and below blocked by an avoid box → above.
    const below = { x: 0, y: 155, w: 400, h: 145 };
    expect(layoutLabels([off], { ...bounds, avoid: [below] }).placed.get('c')).toEqual({ x: 175, y: 114 });
    // Below and above blocked → left.
    const band = [below, { x: 0, y: 0, w: 400, h: 145 }];
    const left = layoutLabels([{ ...off, anchor: { x: 200, y: 150 } }], { ...bounds, avoid: [{ x: 0, y: 0, w: 400, h: 135 }, { x: 0, y: 165, w: 400, h: 135 }] });
    expect(left.placed.get('c')).toEqual({ x: 142, y: 136 });
    // Left also blocked → right.
    const right = layoutLabels([off], { ...bounds, avoid: [{ x: 0, y: 0, w: 400, h: 135 }, { x: 0, y: 165, w: 400, h: 135 }, { x: 0, y: 135, w: 195, h: 30 }] });
    expect(right.placed.get('c')).toEqual({ x: 208, y: 136 });
    // Everything blocked → no fit.
    const none = layoutLabels([off], { ...bounds, avoid: band.concat([{ x: 0, y: 140, w: 195, h: 20 }, { x: 205, y: 140, w: 195, h: 20 }]) });
    expect(none.calloutsFit).toBe(false);
  });

  test('later callouts avoid the earlier ones and every callout dot', () => {
    const bounds = { w: 400, h: 300 };
    const oc = { x: 200, y: 150 };
    const items = [callout('centre', 0, oc, oc), callout('nasal', 1, { x: 220, y: 150 }, oc)];
    const out = layoutLabels(items, bounds);
    expect(out.calloutsFit).toBe(true);
    const boxes = visibleBoxes(items, out);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(hit(boxes[i], boxes[j]), `${boxes[i].id} × ${boxes[j].id}`).toBe(false);
  });

  test('drop by priority: callouts > eye labels > iso labels', () => {
    const bounds = { w: 400, h: 300 };
    const oc = { x: 100, y: 100 };
    const c = callout('centre', 0, oc, oc); // box 108…158 × 108…136
    const eyeOnCallout = { id: 'eye', priority: 1, order: 0, anchor: { x: 130, y: 110 }, size: { w: 30, h: 28 }, offset: { dx: 0, dy: 14 } };
    const isoOnCallout = { id: 'iso', priority: 2, order: 0, anchor: { x: 130, y: 120 }, size: { w: 40, h: 28 }, offset: { dx: 0, dy: 0 } };
    let out = layoutLabels([isoOnCallout, eyeOnCallout, c], bounds);
    expect(out.placed.has('centre')).toBe(true);
    expect(out.placed.has('eye')).toBe(false);
    expect(out.placed.has('iso')).toBe(false);
    // Iso over an eye label → the iso label goes.
    const eye = { ...eyeOnCallout, anchor: { x: 300, y: 200 } };
    const iso = { ...isoOnCallout, anchor: { x: 300, y: 214 } };
    out = layoutLabels([iso, eye], bounds);
    expect(out.placed.has('eye')).toBe(true);
    expect(out.placed.has('iso')).toBe(false);
    // Not overlapping → both stay.
    out = layoutLabels([{ ...iso, anchor: { x: 300, y: 100 } }, eye], bounds);
    expect(out.placed.has('eye') && out.placed.has('iso')).toBe(true);
  });

  test('eye and iso labels are clamped inside the bounds', () => {
    const bounds = { w: 200, h: 100 };
    const items = [
      { id: 'eye', priority: 1, order: 0, anchor: { x: 195, y: 95 }, size: { w: 60, h: 28 }, offset: { dx: 0, dy: 14 } },
      { id: 'iso', priority: 2, order: 0, anchor: { x: -20, y: -20 }, size: { w: 40, h: 28 }, offset: { dx: 0, dy: 0 } },
    ];
    const out = layoutLabels(items, bounds);
    expect(out.placed.get('eye')).toEqual({ x: 140, y: 72 });
    expect(out.placed.get('iso')).toEqual({ x: 0, y: 0 });
  });

  test('non-finite anchors: labels are dropped, a callout makes calloutsFit false', () => {
    const bounds = { w: 400, h: 300 };
    const oc = { x: 200, y: 150 };
    const eye = { id: 'eye', priority: 1, order: 0, anchor: { x: NaN, y: 10 }, size: { w: 30, h: 28 }, offset: { dx: 0, dy: 14 } };
    const iso = { id: 'iso', priority: 2, order: 0, anchor: { x: 10, y: Infinity }, size: { w: 30, h: 28 }, offset: { dx: 0, dy: 0 } };
    let out = layoutLabels([eye, iso, callout('centre', 0, oc, oc)], bounds);
    expect(out.calloutsFit).toBe(true);
    expect([...out.placed.keys()]).toEqual(['centre']);
    out = layoutLabels([callout('centre', 0, oc, oc), { ...callout('nasal', 1, oc, oc), anchor: { x: NaN, y: NaN } }], bounds);
    expect(out.calloutsFit).toBe(false);
    expect(out.placed.size).toBe(0);
    // A callout whose dot leaves the stage does not fit either.
    out = layoutLabels([callout('nasal', 0, { x: 399, y: 150 }, oc)], bounds);
    expect(out.calloutsFit).toBe(false);
  });

  test('no callouts at all: calloutsFit true, eye and iso labels still placed', () => {
    const out = layoutLabels([{ id: 'eye', priority: 1, order: 0, anchor: { x: 50, y: 50 }, size: { w: 30, h: 28 }, offset: { dx: 0, dy: 14 } }], { w: 100, h: 100 });
    expect(out.calloutsFit).toBe(true);
    expect(out.placed.has('eye')).toBe(true);
  });

  const itemArb = fc.record({
    priority: fc.constantFrom(0, 1, 2),
    ax: fc.double({ min: -50, max: 450, noNaN: true }),
    ay: fc.double({ min: -50, max: 350, noNaN: true }),
    w: fc.integer({ min: 20, max: 120 }),
    h: fc.integer({ min: 20, max: 40 }),
    dx: fc.double({ min: -60, max: 60, noNaN: true }),
    dy: fc.double({ min: -60, max: 60, noNaN: true }),
  });

  test('property: deterministic, no two visible boxes overlap, all inside, avoid boxes kept free', () => {
    const bounds = { w: 400, h: 300, avoid: [{ x: 8, y: 8, w: 100, h: 30 }] };
    fc.assert(
      fc.property(fc.array(itemArb, { maxLength: 16 }), (arr) => {
        const items = arr.map((r, i) => ({
          id: `i${i}`,
          priority: r.priority,
          order: i,
          anchor: { x: r.ax, y: r.ay },
          size: { w: r.w, h: r.h },
          offset: { dx: r.dx, dy: r.dy },
          ...(r.priority === 0 ? { dot: DOT } : {}),
        }));
        const a = layoutLabels(items, bounds);
        const b = layoutLabels(items, bounds);
        expect([...a.placed.entries()]).toEqual([...b.placed.entries()]);
        expect(a.calloutsFit).toBe(b.calloutsFit);
        const callouts = items.filter((it) => it.priority === 0);
        if (!a.calloutsFit) for (const c of callouts) expect(a.placed.has(c.id)).toBe(false);
        else for (const c of callouts) expect(a.placed.has(c.id)).toBe(true);
        const boxes = visibleBoxes(items, a);
        for (const q of boxes) {
          expect(inside(q, bounds)).toBe(true);
          expect(hit(q, bounds.avoid[0])).toBe(false);
        }
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(hit(boxes[i], boxes[j])).toBe(false);
      }),
      { numRuns: 300, seed: 1303 },
    );
  });
});
