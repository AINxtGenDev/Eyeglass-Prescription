// Frame outlines (FRAME-01). Outlines are CCW Float64Array [x0, y0, x1, y1, …], lens-local
// (centred at the boxing centre), first point at angle 0.

/**
 * Circle, bitwise symmetric about the x axis: points 0…n/2 come from cos/sin of 2πk/n with
 * y of points 0 and n/2 set to exactly 0; point n − k = (x_k, −y_k).
 * @param {number} diameter mm
 * @param {number} [n=720] number of points, multiple of 4
 */
export function circleOutline(diameter, n = 720) {
  if (!Number.isInteger(n) || n <= 0 || n % 4 !== 0) {
    throw new Error(`circleOutline: n must be a positive multiple of 4, got ${n}`);
  }
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
