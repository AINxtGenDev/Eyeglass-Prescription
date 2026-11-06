// Loader and tool-index helpers for the Zeiss CR-39 spherical fixture (ENG-08 tier 2).
// The fixture is transcribed and committed; it is never fetched at test time (Pitfall H).

import { readFileSync } from 'node:fs';

const FIXTURE = new URL('./zeiss-fsv-6-23-cr39-spherical.json', import.meta.url);

/** @returns {{ provenance: object, rows: Array<{ d: number, F: number, front: number,
 *   back: number, CT: number, ET: number }> }} */
export function loadZeissFixture() {
  return JSON.parse(readFileSync(FIXTURE, 'utf8'));
}

// Zeiss sheets: "All curves are in 1.530 Index". A published curve D₁.₅₃ defines a radius
// (c = D₁.₅₃/530 per mm) independent of the true material; the true surface power is
// D₁.₅₃·(ne − 1)/0.530.

/** True surface power (dpt) of a curve published in 1.530 tool index. Sign is kept. */
export const toolToTrue = (D153, ne) => (D153 * (ne - 1)) / 0.53;

/** Curvature magnitude (1/mm) of a curve published in 1.530 tool index. */
export const toolCurvature = (D153) => Math.abs(D153) / 530;
