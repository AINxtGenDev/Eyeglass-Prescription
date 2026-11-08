// VIZ-05 label layout (03-13; UI-SPEC "Heatmap": callouts, iso labels, collision priority;
// Typography: labels are never shrunk). Pure: plain numbers in, plain numbers out, no imports.
//
// lens-critic MAJOR 4, the one rule: callouts are all-or-nothing. Each callout tries up to five
// boxes in a fixed order (outward along optical centre → anchor; below, above, left, right of its
// anchor, 8 px gap) and takes the first that lies inside the stage and overlaps no box placed so
// far. If any callout finds no free box, NO callout is shown (the table holds every number); a
// partial set of callouts is never shown.
//
// After the callouts, eye labels (priority 1) and then iso labels (priority 2) are placed, each in
// `order`, clamped inside the stage. A label that overlaps anything already placed (callouts and
// their dots, eye labels, iso labels, the avoid boxes) is dropped, never moved or shrunk.

/** Gap between a callout anchor and its pill (UI-SPEC: 8 px outward) [BP]. */
export const LABEL_GAP_PX = 8;

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const fits = (r, w, h) => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);
const byOrder = (a, b) => a.order - b.order;

/**
 * @typedef {{ id: string, priority: 0 | 1 | 2, order: number, anchor: { x: number, y: number },
 *   size: { w: number, h: number }, offset: { dx: number, dy: number }, dot?: number }} LabelItem
 *   priority 0 = callout, 1 = eye label, 2 = iso label. offset = the box centre minus the anchor
 *   (for a callout: its first, outward candidate). dot = the callout marker diameter (px).
 * @param {LabelItem[]} items
 * @param {{ w: number, h: number, avoid?: Array<{ x: number, y: number, w: number, h: number }> }} bounds
 *   avoid = boxes no label may cover (the badge, the keyboard hint)
 * @returns {{ placed: Map<string, { x: number, y: number }>, calloutsFit: boolean }}
 *   placed = top-left of every shown label box
 */
export function layoutLabels(items, bounds) {
  const { w, h } = bounds;
  const avoid = bounds.avoid ?? [];
  const callouts = items.filter((it) => it.priority === 0).sort(byOrder);

  // Callouts: dots first (a pill may cover no marker), then the pills in order.
  /** @type {Array<{ x: number, y: number, w: number, h: number }>} */
  let taken = [...avoid];
  const placed = new Map();
  let calloutsFit = true;
  const dots = [];
  for (const c of callouts) {
    const d = c.dot ?? 0;
    const r = { x: c.anchor.x - d / 2, y: c.anchor.y - d / 2, w: d, h: d };
    if (!finite(c.anchor) || !fits(r, w, h) || taken.some((q) => hit(r, q))) {
      calloutsFit = false;
      break;
    }
    dots.push(r);
  }
  if (calloutsFit) {
    taken.push(...dots);
    for (const c of callouts) {
      const { x: ax, y: ay } = c.anchor;
      const { w: bw, h: bh } = c.size;
      const centres = [
        [ax + c.offset.dx, ay + c.offset.dy],
        [ax, ay + LABEL_GAP_PX + bh / 2],
        [ax, ay - LABEL_GAP_PX - bh / 2],
        [ax - LABEL_GAP_PX - bw / 2, ay],
        [ax + LABEL_GAP_PX + bw / 2, ay],
      ];
      let box = null;
      for (const [cx, cy] of centres) {
        const r = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
        if (fits(r, w, h) && !taken.some((q) => hit(r, q))) {
          box = r;
          break;
        }
      }
      if (box === null) {
        calloutsFit = false;
        break;
      }
      taken.push(box);
      placed.set(c.id, { x: box.x, y: box.y });
    }
  }
  if (!calloutsFit) {
    // All-or-nothing: the other labels are placed against an empty callout set.
    placed.clear();
    taken = [...avoid];
  }

  for (const p of [1, 2]) {
    for (const it of items.filter((q) => q.priority === p).sort(byOrder)) {
      if (!finite(it.anchor)) continue;
      const { w: bw, h: bh } = it.size;
      const x = Math.min(Math.max(it.anchor.x + it.offset.dx - bw / 2, 0), Math.max(0, w - bw));
      const y = Math.min(Math.max(it.anchor.y + it.offset.dy - bh / 2, 0), Math.max(0, h - bh));
      const r = { x, y, w: bw, h: bh };
      if (taken.some((q) => hit(r, q))) continue;
      taken.push(r);
      placed.set(it.id, { x, y });
    }
  }
  return { placed, calloutsFit };
}
