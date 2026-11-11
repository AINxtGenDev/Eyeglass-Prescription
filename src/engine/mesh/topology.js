// VIZ-01 (03-02, D-03): fixed lens-mesh topology, identical for every shape, size, eye and tier,
// so the renderer never sees a buffer resize (03-RESEARCH Pitfall 1). Pure, imports nothing.
//
// Polar grid about the boxing centre: vertex (k, i) = RING_FRAC[k] · outline[i], k = 0…RINGS,
// i = 0…SPOKES − 1. Ring 0 is one centre vertex; ring RINGS is the engine outline itself.
// Vertex numbering: p = 0 is the centre; ring k ≥ 1, spoke i → p = 1 + (k − 1)·SPOKES + i.

export const RINGS = 64;
export const SPOKES = 720; // = frameOutline default point count; never changed per lens
// Rim grading exponent, measured, 03-RESEARCH Pattern 1 table: max sag error 0,0074–0,0078 mm
// for nₑ ≥ 1,49 at 64 rings × 720 spokes on the research lenses. Not a bound for every input
// (03-LC M1, full grid scan in tessellation.test.js): ≤ 0,01 mm holds up to etMax 31 mm; large
// frames with a strong minus reach 0,0174 mm below etMax 35 mm and ≥ 0,117 mm above (at the far
// corner, angular: a higher GRADING does not help). The vertices themselves are exact.
export const GRADING = 2.5;

/** RING_FRAC[k] = 1 − (1 − k/RINGS)^GRADING: dense rings near the rim, where sag error peaks. */
export const RING_FRAC = new Float64Array(RINGS + 1);
for (let k = 0; k <= RINGS; k++) RING_FRAC[k] = 1 - (1 - k / RINGS) ** GRADING;

/** Vertices per surface: 46 081 (fits a Uint16 index). */
export const VERTS = 1 + RINGS * SPOKES;

const vid = (k, i) => 1 + (k - 1) * SPOKES + (i % SPOKES);

// Front: CCW seen from +z for a CCW outline. Centre fan (ring 1), then two triangles per quad
// between rings k and k + 1: (a, c, d) and (a, d, b) with a = (k, i), b = (k, i+1),
// c = (k+1, i), d = (k+1, i+1). 720 + 2·63·720 = 91 440 triangles.
function buildFront() {
  const idx = new Uint16Array(3 * (SPOKES + 2 * (RINGS - 1) * SPOKES));
  let t = 0;
  for (let i = 0; i < SPOKES; i++) {
    idx[t++] = 0;
    idx[t++] = vid(1, i);
    idx[t++] = vid(1, i + 1);
  }
  for (let k = 1; k < RINGS; k++) {
    for (let i = 0; i < SPOKES; i++) {
      const a = vid(k, i);
      const b = vid(k, i + 1);
      const c = vid(k + 1, i);
      const d = vid(k + 1, i + 1);
      idx[t++] = a;
      idx[t++] = c;
      idx[t++] = d;
      idx[t++] = a;
      idx[t++] = d;
      idx[t++] = b;
    }
  }
  return idx;
}

export const FRONT_INDEX = buildFront();

/** Back: the same triangles with reversed winding (the back faces −z, toward the eye). */
export const BACK_INDEX = new Uint16Array(FRONT_INDEX.length);
for (let t = 0; t < FRONT_INDEX.length; t += 3) {
  BACK_INDEX[t] = FRONT_INDEX[t];
  BACK_INDEX[t + 1] = FRONT_INDEX[t + 2];
  BACK_INDEX[t + 2] = FRONT_INDEX[t + 1];
}

// Edge band: own vertices, i = front rim copy, SPOKES + i = back rim copy. Triangles
// (f_i, b_i, b_{i+1}) and (f_i, b_{i+1}, f_{i+1}) face outward for a CCW outline with the front
// above the back (z_front > z_back). 2·720 = 1440 triangles.
export const BAND_INDEX = new Uint16Array(3 * 2 * SPOKES);
for (let i = 0, t = 0; i < SPOKES; i++) {
  const f0 = i;
  const f1 = (i + 1) % SPOKES;
  const b0 = SPOKES + f0;
  const b1 = SPOKES + f1;
  BAND_INDEX[t++] = f0;
  BAND_INDEX[t++] = b0;
  BAND_INDEX[t++] = b1;
  BAND_INDEX[t++] = f0;
  BAND_INDEX[t++] = b1;
  BAND_INDEX[t++] = f1;
}
