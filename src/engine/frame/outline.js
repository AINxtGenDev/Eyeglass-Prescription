// Frame outlines (FRAME-01). Outlines are CCW Float64Array [x0, y0, x1, y1, …], lens-local
// (centred at the boxing centre), first point at angle 0.

import { SHAPES } from './shapes.js';

function assertN(name, n) {
  if (!Number.isInteger(n) || n <= 0 || n % 4 !== 0) {
    throw new Error(`${name}: n must be a positive multiple of 4, got ${n}`);
  }
}

/** Scale x and y separately and translate in place so the bbox is exactly A × B at the origin. */
function normaliseBox(o, A, B) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < o.length; i += 2) {
    if (o[i] < minX) minX = o[i];
    if (o[i] > maxX) maxX = o[i];
    if (o[i + 1] < minY) minY = o[i + 1];
    if (o[i + 1] > maxY) maxY = o[i + 1];
  }
  const cx = (maxX + minX) / 2;
  const cy = (maxY + minY) / 2;
  const sx = A / (maxX - minX);
  const sy = B / (maxY - minY);
  for (let i = 0; i < o.length; i += 2) {
    o[i] = (o[i] - cx) * sx;
    o[i + 1] = (o[i + 1] - cy) * sy;
  }
}

/**
 * Resample a polyline (closed or open) to `count` points equally spaced by arc length,
 * starting at its first point (an open polyline also ends exactly at its last point).
 */
function resample(d, count, closed) {
  const m = d.length / 2;
  const edges = closed ? m : m - 1;
  const cum = new Float64Array(edges + 1);
  for (let i = 0; i < edges; i++) {
    const j = (i + 1) % m;
    cum[i + 1] = cum[i] + Math.hypot(d[2 * j] - d[2 * i], d[2 * j + 1] - d[2 * i + 1]);
  }
  const L = cum[edges];
  const steps = closed ? count : count - 1;
  const o = new Float64Array(2 * count);
  let e = 0;
  for (let k = 0; k < count; k++) {
    if (!closed && k === count - 1) {
      o[2 * k] = d[2 * (m - 1)];
      o[2 * k + 1] = d[2 * (m - 1) + 1];
      break;
    }
    const s = (k * L) / steps;
    while (e < edges - 1 && cum[e + 1] < s) e++;
    const j = (e + 1) % m;
    const u = (s - cum[e]) / (cum[e + 1] - cum[e]);
    o[2 * k] = d[2 * e] + u * (d[2 * j] - d[2 * e]);
    o[2 * k + 1] = d[2 * e + 1] + u * (d[2 * j + 1] - d[2 * e + 1]);
  }
  return o;
}

/**
 * Frame outline for one eye: OD shape sampled densely (8·n), scaled to A × B, arc-length
 * resampled to n points, then scaled exactly to A × B about the boxing centre (bbox centre).
 * x-symmetric shapes (rund, rechteckig) are resampled over the upper half only and mirrored,
 * so they are bitwise symmetric about the x axis. OS = mirrorOutlineX(OD), never resampled.
 * @param {string} shape key of SHAPES
 * @param {number} A box width mm  @param {number} B box height mm
 * @param {'OD'|'OS'} eye
 * @param {number} [n=720] multiple of 4
 */
export function frameOutline(shape, A, B, eye, n = 720) {
  assertN('frameOutline', n);
  if (!Object.hasOwn(SHAPES, shape)) throw new Error(`frameOutline: unknown shape ${shape}`);
  const key = `${shape}|${A}|${B}|${n}`;
  let od = CACHE.get(key);
  if (od === undefined) {
    od = buildOD(shape, A, B, n);
    if (CACHE.size >= CACHE_SIZE) CACHE.delete(CACHE.keys().next().value);
    CACHE.set(key, od);
  }
  // copies, so a caller can never alter the cached samples
  return eye === 'OS' ? mirrorOutlineX(od) : od.slice();
}

// Small memo of OD outlines: re-evaluating on every keystroke mostly keeps the frame unchanged,
// and building an outline costs more than the lens solve (desktop ≈ 1.6 ms vs ≈ 0.2 ms).
const CACHE_SIZE = 16;
const CACHE = new Map();

function buildOD(shape, A, B, n) {
  const { radius, xSymmetric } = SHAPES[shape];
  const M = 8 * n;
  let od;
  if (xSymmetric) {
    const m = M / 2 + 1;
    const d = new Float64Array(2 * m);
    for (let i = 0; i < m; i++) {
      const phi = (Math.PI * i) / (m - 1);
      const r = radius(phi, 1);
      d[2 * i] = r * Math.cos(phi);
      d[2 * i + 1] = i === 0 || i === m - 1 ? 0 : r * Math.sin(phi);
    }
    // bbox of the full (mirrored) curve: y spans [−maxY, maxY]
    let maxY = 0;
    for (let i = 1; i < 2 * m; i += 2) maxY = Math.max(maxY, d[i]);
    const minX = d[2 * (m - 1)];
    const maxX = d[0];
    const sx = A / (maxX - minX);
    const sy = B / (2 * maxY);
    const cx = (maxX + minX) / 2;
    for (let i = 0; i < 2 * m; i += 2) {
      d[i] = (d[i] - cx) * sx;
      d[i + 1] *= sy;
    }
    const upper = resample(d, n / 2 + 1, false);
    od = new Float64Array(2 * n);
    od.set(upper);
    od[1] = 0;
    od[n + 1] = 0;
    for (let k = 1; k < n / 2; k++) {
      od[2 * (n - k)] = od[2 * k];
      od[2 * (n - k) + 1] = -od[2 * k + 1];
    }
    normaliseBox(od, A, B);
    // cy is exactly 0, so the lower half already equals the mirrored upper half; re-copy anyway
    for (let k = 1; k < n / 2; k++) {
      od[2 * (n - k)] = od[2 * k];
      od[2 * (n - k) + 1] = -od[2 * k + 1];
    }
  } else {
    const d = new Float64Array(2 * M);
    for (let i = 0; i < M; i++) {
      const phi = (2 * Math.PI * i) / M;
      const r = radius(phi, 1);
      d[2 * i] = r * Math.cos(phi);
      d[2 * i + 1] = r * Math.sin(phi);
    }
    normaliseBox(d, A, B);
    od = resample(d, n, true);
    normaliseBox(od, A, B);
  }
  return od;
}

/**
 * Circle, bitwise symmetric about the x axis: points 0…n/2 come from cos/sin of 2πk/n with
 * y of points 0 and n/2 set to exactly 0; point n − k = (x_k, −y_k).
 * @param {number} diameter mm
 * @param {number} [n=720] number of points, multiple of 4
 */
export function circleOutline(diameter, n = 720) {
  assertN('circleOutline', n);
  const r = diameter / 2;
  const o = new Float64Array(2 * n);
  for (let k = 0; k <= n / 2; k++) {
    const a = (2 * Math.PI * k) / n;
    o[2 * k] = r * Math.cos(a);
    o[2 * k + 1] = k === 0 || k === n / 2 ? 0 : r * Math.sin(a);
  }
  for (let k = 1; k < n / 2; k++) {
    o[2 * (n - k)] = o[2 * k];
    o[2 * (n - k) + 1] = -o[2 * k + 1];
  }
  return o;
}

/**
 * OS outline from the OD samples: point i = (−x_j, y_j), j = (n − i) mod n.
 * Bitwise x-negation; the index map keeps CCW and maps every 4th point to every 4th point.
 * @param {Float64Array} outline
 */
export function mirrorOutlineX(outline) {
  const n = outline.length / 2;
  const m = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    const j = (n - i) % n;
    m[2 * i] = -outline[2 * j];
    m[2 * i + 1] = outline[2 * j + 1];
  }
  return m;
}
