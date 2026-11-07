// ANA-01 (02-13): meridian profile (cross-section) of a computed lens. Pure: plain numbers in,
// plain data out, no throw. Lens-local coordinates relative to the boxing centre
// (conventions.js); the chord is the line through the optical centre at TABO angle θ (CCW from
// +x, the same for both eyes). Thickness uses metrics.js thicknessAt, the formula of the result
// metrics, so every number in the drawing is a number of the result.

import { thicknessAt } from './metrics.js';
import { frontSagAt, backSagAt } from './design.js';
import { locationLabel, nasalSign } from './conventions.js';
import { frameOutline } from './frame/outline.js';

/**
 * End labels name a direction part only when it is at least this far from the meridian's other
 * axis: within 15° of horizontal only Nase/Schläfe, within 15° of vertical only oben/unten,
 * otherwise both (e.g. 'nasal-superior'). Labelling choice (UI-SPEC "End labels"), no optical
 * meaning.
 */
export const END_LABEL_TOL_DEG = 15;
const END_TOL = Math.sin((END_LABEL_TOL_DEG * Math.PI) / 180);

// Distance d > 0 from (ox, oy) along (c, s) to edge i of the outline, or −1 if the ray misses it.
// Same maths as metrics.js hitEdge (lines 61-74), translated to the ray origin (the OC, not the
// boxing centre); outlineRadii is not used, it assumes rays from the boxing centre.
function hitEdge(outline, n, i, ox, oy, c, s) {
  const k = i + 1 === n ? 0 : i + 1;
  const px = outline[2 * i] - ox;
  const py = outline[2 * i + 1] - oy;
  const ex = outline[2 * k] - outline[2 * i];
  const ey = outline[2 * k + 1] - outline[2 * i + 1];
  const den = c * ey - s * ex;
  if (den === 0) return -1;
  const d = (px * ey - py * ex) / den;
  const u = (px * s - py * c) / den;
  return d > 0 && u >= -1e-9 && u <= 1 + 1e-9 ? d : -1;
}

/** Nearest positive hit of the ray on any outline edge (panto/pilot are not convex everywhere). */
function nearestHit(outline, ox, oy, c, s) {
  const n = outline.length / 2;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const d = hitEdge(outline, n, i, ox, oy, c, s);
    if (d > 0 && d < best) best = d;
  }
  return best;
}

// Even-odd point-in-polygon test, as evaluate.js insideOutline (OC_OUTSIDE_OUTLINE).
function inside(outline, px, py) {
  let ins = false;
  const n = outline.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = outline[2 * i];
    const yi = outline[2 * i + 1];
    const xj = outline[2 * j];
    const yj = outline[2 * j + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

const NO_CHORD = Object.freeze({ ok: false, code: 'NO_CHORD' });
const noChord = () => ({ ...NO_CHORD });

const finiteArray = (a) => a.every(Number.isFinite);

/**
 * Profile of the lens along the meridian θ through the optical centre.
 * s: signed distance from the OC along (cos θ, sin θ), ascending; `samples` uniform points from
 * the end in direction θ + 180° to the end in direction θ, plus s = 0 inserted exactly.
 * zFront = −sF, zBack = −CT − sB (conventions.js), t = thicknessAt = zFront − zBack.
 * ends[0] is the end in direction θ (s > 0), ends[1] the end in direction θ + 180° (s < 0).
 * NO_CHORD when the OC lies outside the outline, a side has no hit, or a value is not finite.
 * @param {{ surfaces: { n: number, ct: number, c1: number, k1: number, ca: number, cb: number,
 *   axisRad: number, oc: { x: number, y: number } }, frame: { shape: string, A: number, B: number },
 *   eye: 'OD'|'OS' }} lens
 * @param {number} thetaDeg
 * @param {number} [samples]
 */
export function meridianProfile({ surfaces, frame, eye }, thetaDeg, samples = 96) {
  const sf = surfaces;
  const outline = frameOutline(frame.shape, frame.A, frame.B, eye);
  const { x: ox, y: oy } = sf.oc;
  if (!(Number.isFinite(ox) && Number.isFinite(oy)) || !inside(outline, ox, oy)) return noChord();
  const rad = (thetaDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const sn = Math.sin(rad);
  const dF = nearestHit(outline, ox, oy, c, sn);
  const dB = nearestHit(outline, ox, oy, -c, -sn);
  if (!Number.isFinite(dF) || !Number.isFinite(dB)) return noChord();

  const pts = [];
  for (let i = 0; i < samples; i++) pts.push(i === samples - 1 ? dF : -dB + (i * (dF + dB)) / (samples - 1));
  if (!pts.includes(0)) {
    pts.push(0);
    pts.sort((a, b) => a - b);
  }
  const m = pts.length;
  const s = Float64Array.from(pts);
  const zFront = new Float64Array(m);
  const zBack = new Float64Array(m);
  const t = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const x = ox + s[i] * c;
    const y = oy + s[i] * sn;
    zFront[i] = -frontSagAt(sf, x, y);
    zBack[i] = -sf.ct - backSagAt(sf, x, y);
    t[i] = thicknessAt(sf, x, y);
  }
  const end = (d) => {
    const x = ox + d * c;
    const y = oy + d * sn;
    return { s: d, t: thicknessAt(sf, x, y), x, y, location: locationLabel(x, y, eye) };
  };
  const ends = [end(dF), end(-dB)];
  if (![s, zFront, zBack, t].every(finiteArray) || !ends.every((e) => Number.isFinite(e.t)) || !Number.isFinite(sf.ct)) {
    return noChord();
  }
  return { ok: true, thetaDeg, s, zFront, zBack, t, ends, ct: sf.ct };
}

/**
 * Meridians offered for the section: horizontal (0°) plus, when Zyl ≠ 0, the principal meridians
 * of the minus-cylinder form: the axis α (power Sph) and α + 90° (power Sph + Zyl). Duplicates
 * dropped, ascending, each in [0, 180).
 * @param {{ cyl: number, axisDeg: number }} rx
 * @returns {number[]}
 */
export function principalMeridians({ cyl, axisDeg }) {
  if (cyl === 0) return [0];
  const a = ((axisDeg % 180) + 180) % 180;
  return [...new Set([0, a, (a + 90) % 180])].sort((x, y) => x - y);
}

function directionLabel(eye, c, s) {
  const parts = [];
  if (Math.abs(c) >= END_TOL) parts.push(Math.sign(c) === nasalSign(eye) ? 'nasal' : 'temporal');
  if (Math.abs(s) >= END_TOL) parts.push(s > 0 ? 'superior' : 'inferior');
  return parts.join('-');
}

/**
 * Location codes of the two chord ends from the meridian direction (never from the hit point):
 * [end in direction θ, end in direction θ + 180°]. Codes as conventions.js locationLabel.
 * @param {'OD'|'OS'} eye @param {number} thetaDeg
 * @returns {[string, string]}
 */
export function meridianEndLabels(eye, thetaDeg) {
  const rad = (thetaDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [directionLabel(eye, c, s), directionLabel(eye, -c, -s)];
}
