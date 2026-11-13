// REF-01 Durchblick, slice 7 (04-08; D-01…D-13; UI-SPEC "Durchblick: What the Picture Shows",
// "Where It Lives and How It Behaves", States, Verification items 1–9; lens-critic M3 hard gate).
// The picture is the engine warp grid drawn through the one renderer (refraction.js); every expected
// number is computed here in Node from the same engine (evaluateLens, warp.js classifyDirection) and
// the same chart definition (ref-layout.js), never read back from the picture.
// Reduced motion everywhere (instant camera cuts): SwiftShader renders ≈ 1 s per 3D frame (03-09).
import { test, expect } from '@playwright/test';
import { evaluateLens } from '../src/engine/evaluate.js';
import { prepareWarp, classifyDirection, REF_CLASS, REF_GRID_TIERS } from '../src/engine/warp.js';
import { EYE_POINT_MM } from '../src/engine/magnification.js';
import { specFor } from '../src/state/bench-cases.js';
import { CHART_SQUARE_TAN, CHART_BAND_SQUARES, checkerInk, inLetterBand } from '../src/ui/view/ref-layout.js';
import {
  settled,
  settledView,
  settledRef,
  guardPage,
  noThreeWarnings,
  plain,
  holdWarpWorker,
  changedPixels,
  inscribedLowerWindows,
} from './helpers.js';
/* global window, document */

let threeWarnings;
test.beforeEach(({ page }) => {
  threeWarnings = noThreeWarnings(page);
});
test.use({ reducedMotion: 'reduce' });
guardPage(test, { view: true });
test.afterEach(() => {
  expect(threeWarnings(), 'Three.js / WebGL console warnings').toEqual([]);
});

const S = CHART_SQUARE_TAN;
const N = ' ';
const DEFAULT_FRAME = Object.freeze({ shape: 'rechteckig', A: 52, B: 38, DBL: 18 });
const INK = [26, 26, 26];
const PAPER = [255, 255, 255];
const RIM = [34, 30, 28];
const SURFACE = [243, 244, 246];
const near = (px, want, tol = 2) => want.every((w, i) => Math.abs(px[i] - w) <= tol);
const isChart = (px) => near(px, INK) || near(px, PAPER);
const inkish = (px) => px[0] + px[1] + px[2] < 3 * 128;

const ev = (page, fn, arg) => page.evaluate(fn, arg);
const refState = (page) => ev(page, () => window.__eyeglassView.ref());
const pixels = (page, points) => ev(page, (p) => window.__eyeglassView.pixels(p), points);

/** Canvas drawing-buffer geometry: where the buffer pixel that pixels() reads for a point sits (CSS px). */
async function canvasGeom(page) {
  return ev(page, () => {
    const c = /** @type {HTMLCanvasElement} */ (document.getElementById('view-canvas'));
    const r = c.getBoundingClientRect();
    return { bw: c.width, bh: c.height, cw: c.clientWidth, rw: r.width, rh: r.height };
  });
}
/** CSS position of the centre of the buffer pixel pixels([x, y]) reads (view.js: floor(x·k), k = width / clientWidth). */
function pixelCentre(g, [x, y]) {
  const k = g.bw / g.cw;
  return [((Math.floor(x * k) + 0.5) * g.rw) / g.bw, ((Math.floor(y * k) + 0.5) * g.rh) / g.bh];
}
/** Eye tan (wearer frame, +y up) of a stage CSS position in a panel. */
const eyeTan = (p, [xc, yc]) => [(xc - p.x - p.w / 2) / p.pxPerTan, (p.y + p.h / 2 - yc) / p.pxPerTan];
/** Distance (tan units) from (u, v) to the nearest checker edge. */
const edgeTan = (u, v) => Math.min(Math.abs(u / S - Math.round(u / S)), Math.abs(v / S - Math.round(v / S))) * S;

/** Clear the load example and type one Rx per eye (PD 32 unless given). */
async function setRx(page, od, os = od, pd = '32') {
  const clear = page.locator('#example-clear');
  if (await clear.isVisible()) await clear.click();
  for (const [eye, rx] of [
    ['od', od],
    ['os', os],
  ]) {
    await page.locator(`#rx-${eye}-pd`).fill(pd);
    await page.locator(`#rx-${eye}-sph`).fill(rx.sph);
    await page.locator(`#rx-${eye}-cyl`).fill(rx.cyl ?? '');
    await page.locator(`#rx-${eye}-axis`).fill(rx.axis ?? '');
  }
  await settled(page);
}

async function refOn(page) {
  await page.locator('#view-mode label', { hasText: 'Durchblick' }).click();
  await settledRef(page);
}
async function lens(page, on) {
  await page.locator('#view-ref-lens label', { hasText: on ? 'Mit Glas' : 'Ohne Glas' }).click();
  await expect(page.locator('.view-badge')).toHaveText(on ? 'Durchblick · berechnet' : 'Durchblick · ohne Glas');
}
/** The engine lens of one eye with the app defaults (CR-39 unless given, automatic base curve). */
function lensOf(eye, rx, { frame = DEFAULT_FRAME, pd = 32, material = 'cr39', baseCurve = null } = {}) {
  const r = evaluateLens(specFor(eye, rx, pd, material, frame, null, { baseCurve }));
  expect(r.ok, `engine lens ${eye}`).toBe(true);
  const ctx = prepareWarp({ surfaces: r.surfaces, frame, eye, hMm: EYE_POINT_MM });
  expect(ctx.ok).toBe(true);
  return ctx;
}
/** Colour transitions (CSS x) along a stage row, from x0 to x1, step 1 px: midpoints between changes. */
async function rowEdges(page, y, x0, x1) {
  const pts = [];
  for (let x = Math.ceil(x0) + 0.5; x < x1; x += 1) pts.push([x, y]);
  const px = await pixels(page, pts);
  const out = [];
  for (let i = 1; i < pts.length; i++) if (inkish(px[i]) !== inkish(px[i - 1])) out.push((pts[i][0] + pts[i - 1][0]) / 2);
  return out;
}
const centreOf = (p) => ({ cx: p.x + p.w / 2, cy: p.y + p.h / 2 });
/** The integer pixel row (its centre) nearest to y. */
const rowAt = (y) => Math.round(y - 0.5) + 0.5;

// ---------------------------------------------------------------------------------------------
// Items 1–5, 7–9 and numbers-never-wait run on both projects (two panels on desktop, one on the
// 360 px mobile project, where the stage is below 360 px wide).

test('item 1: Ohne Glas shows the chart, square edges at centre ± n·square, letter band above', async ({ page }) => {
  await settledView(page);
  await refOn(page);
  await lens(page, false);
  const { panels } = await refState(page);
  expect(panels.length).toBeGreaterThan(0);
  for (const p of panels) {
    const { cx, cy } = centreOf(p);
    const y = rowAt(cy + 0.5 * p.squarePx); // half a square below the centre row
    const half = Math.floor(p.w / 2 / p.squarePx) - 1;
    const pts = [];
    for (let n = -half; n < half; n++) pts.push([cx + (n + 0.5) * p.squarePx, y]);
    const px = await pixels(page, pts);
    px.forEach((c, i) => expect(isChart(c), `${p.id} square ${i}: ${c}`).toBe(true));
    for (let i = 1; i < px.length; i++) expect(inkish(px[i]), `${p.id} alternating squares`).not.toBe(inkish(px[i - 1]));
    // Square edges at cx + n·square (± 1 px): a change between 1,5 px left and right of each edge.
    for (let n = -half + 1; n < half; n++) {
      const [a, b] = await pixels(page, [
        [cx + n * p.squarePx - 1.5, y],
        [cx + n * p.squarePx + 1.5, y],
      ]);
      expect(inkish(a), `${p.id} edge n=${n}`).not.toBe(inkish(b));
    }
    // Round-4 MINOR I: the chart is not flipped vertically. P in the letter band (paper) above the
    // centre, where the vertically mirrored tan is an ink square; both facts from the chart definition.
    const u = 0.5 * S;
    const v = 1.25 * S;
    expect(inLetterBand(v)).toBe(true);
    expect(inLetterBand(-v)).toBe(false);
    expect(checkerInk(u, -v), 'mirrored point is ink').toBe(true);
    const P = p.pxPerTan;
    expect((v - CHART_BAND_SQUARES.from * S) * P, 'P ≥ 2 px from the band edge').toBeGreaterThanOrEqual(2);
    expect((1.5 * S - v) * P, 'P ≥ 2 px below the letters (cap 1 square, centred)').toBeGreaterThanOrEqual(2);
    expect(edgeTan(u, -v) * P, 'mirror ≥ 2 px from a checker edge').toBeGreaterThanOrEqual(2);
    const [band] = await pixels(page, [[cx + u * P, cy - v * P]]);
    expect(near(band, PAPER), `${p.id} letter band above the centre: ${band}`).toBe(true);
  }
});

test('item 2: plano both eyes: Mit = Ohne Glas, 0,1 % lines, weak and shape notes; base curve 6 → 0,7 %', async ({ page }) => {
  await settledView(page);
  await setRx(page, { sph: '0,00' });
  await refOn(page);
  const size = page.locator('#view-ref-size');
  await expect(size).toContainText(`Rechtes Glas: Bild etwa 0,1${N}% größer`);
  await expect(size).toContainText(`Linkes Glas: Bild etwa 0,1${N}% größer`);
  await expect(size).toContainText('Bei so schwachen Gläsern ist der Unterschied im Bild kaum zu sehen.');
  await expect(size).toContainText('Die gewölbte Vorderseite und die Dicke des Glases vergrößern das Bild ein wenig.');
  const { panels } = await refState(page);
  for (const p of panels) {
    // 9 × 9 lattice, every point ≥ 2 px from a square edge in eye tan (Ohne Glas).
    const pts = [];
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= 9; b++) {
        let x = p.x + (a * p.w) / 10;
        let y = p.y + (b * p.h) / 10;
        const fix = (c, centre) => {
          const t = (c - centre) / p.squarePx;
          const f = t - Math.floor(t);
          return f < 0.2 || f > 0.8 ? centre + (Math.floor(t) + 0.5) * p.squarePx : c;
        };
        x = fix(x, p.x + p.w / 2);
        y = fix(y, p.y + p.h / 2);
        pts.push([x, y]);
      }
    }
    const mit = await pixels(page, pts);
    await lens(page, false);
    const ohne = await pixels(page, pts);
    await lens(page, true);
    mit.forEach((c, i) => expect(near(c, ohne[i], 8), `${p.id} lattice ${pts[i]}: ${c} vs ${ohne[i]}`).toBe(true));
  }
  await page.locator('#expert').check();
  await page.locator('#expert-basecurve').fill('6');
  await settled(page);
  await expect(size).toContainText(`Rechtes Glas: Bild etwa 0,7${N}% größer`);
});

test('item 3: −4,00 / +4,00 exact size lines, no weak note', async ({ page }) => {
  await settledView(page);
  await setRx(page, { sph: '-4,00' }, { sph: '+4,00' });
  await refOn(page);
  const size = page.locator('#view-ref-size');
  await expect(size.locator('.ref-line').nth(0)).toHaveText(`Rechtes Glas: Bild etwa 6${N}% kleiner`);
  await expect(size.locator('.ref-line').nth(1)).toHaveText(`Linkes Glas: Bild etwa 8${N}% größer`);
  await expect(size).not.toContainText('Bei so schwachen Gläsern');
});

test('item 4: oblique cylinder −2,00 / −2,00 × 30: head, two li, joined aria-label, cyl and axis notes', async ({ page }) => {
  await settledView(page);
  const rx = { sph: '-2,00', cyl: '-2,00', axis: '30' };
  await setRx(page, rx, rx);
  await refOn(page);
  const size = page.locator('#view-ref-size');
  const d1 = `schräg (30°, im Bild von links oben nach rechts unten) etwa 2,9${N}% kleiner`;
  const d2 = `schräg (120°, im Bild von links unten nach rechts oben) etwa 6${N}% kleiner`;
  await expect(size.locator('.ref-line').nth(0)).toHaveText('Rechtes Glas: Bild');
  await expect(size.locator('ul.ref-dirs').nth(0).locator('li')).toHaveText([d1, d2]);
  await expect(size.locator('.ref-line').nth(1)).toHaveText('Linkes Glas: Bild');
  await expect(size.locator('ul.ref-dirs').nth(1).locator('li')).toHaveText([d1, d2]);
  await expect(size).toContainText('Mit Zylinder verändert das Glas die Bildgröße in zwei Richtungen verschieden stark');
  await expect(size).toContainText('Weil Sie von hinten durch die Brille schauen, liegen schräge Richtungen im Bild gespiegelt');
  const joined = plain(`Rechtes Glas: Bild ${d1}, ${d2}.`); // the label is read through plain() (NBSP → space)
  await expect.poll(async () => plain(await page.locator('#view-canvas').getAttribute('aria-label')), { timeout: 5000 }).toContain(joined);
  expect(plain(await page.locator('#view-canvas').getAttribute('aria-label'))).toMatch(/^Durchblick mit Glas: /);
});

test('item 5: −6,00 (1,67) 8 %, −10,00 (CR-39) 13 %, edge note, edge squares smaller than at the centre', async ({ page }) => {
  test.setTimeout(120_000);
  await settledView(page);
  await page.locator('input[name=material][value=idx167]').check();
  await setRx(page, { sph: '-6,00' });
  await refOn(page);
  const size = page.locator('#view-ref-size');
  await expect(size.locator('.ref-line').nth(0)).toHaveText(`Rechtes Glas: Bild etwa 8${N}% kleiner`);
  await expect(size).toContainText('Zum Bildrand hin verändert das Glas die Größe stärker als in der Mitte.');
  await page.locator('input[name=material][value=cr39]').check();
  await page.locator('#rx-od-sph').fill('-10,00');
  await page.locator('#rx-os-sph').fill('-10,00');
  await settledRef(page);
  await expect(size.locator('.ref-line').nth(0)).toHaveText(`Rechtes Glas: Bild etwa 13${N}% kleiner`);
  await expect(size.locator('.ref-line').nth(1)).toHaveText(`Linkes Glas: Bild etwa 13${N}% kleiner`);
  const { panels } = await refState(page);
  for (const p of panels) {
    const { cx, cy } = centreOf(p);
    const edges = await rowEdges(page, rowAt(cy + 0.5 * p.squarePx), cx + 2, p.x + p.w - 2);
    expect(edges.length, `${p.id} edges right of the centre: ${edges}`).toBeGreaterThanOrEqual(3);
    const centreSquare = edges[0] - cx; // the square that starts at the centre corner
    const edgeSquare = edges.at(-1) - edges.at(-2); // the outermost full square
    test.info().annotations.push({ type: 'squares', description: `${p.id}: centre ${centreSquare.toFixed(1)} px, edge ${edgeSquare.toFixed(1)} px` });
    expect(edgeSquare, `${p.id}: edge square smaller than the centre square`).toBeLessThan(centreSquare - 1);
  }
});

test('item 7: entering hides the tools, drops the tab stop, sets the Durchblick labels; leaving restores pose and labels', async ({ page }) => {
  await settledView(page);
  const stage = page.locator('#view-stage');
  const fs = page.locator('#view-fullscreen');
  const before = await ev(page, () => window.__eyeglassView.camera());
  await expect(stage).toHaveAttribute('tabindex', '0');
  // Mode plumbing only: no drawn warp needed (D-10).
  await page.locator('#view-mode label', { hasText: 'Durchblick' }).click();
  await page.waitForFunction(() => window.__eyeglassView.mode() === 'ref');
  await expect(page.locator('#view-tools')).toBeHidden();
  await expect(stage).not.toHaveAttribute('tabindex', /.*/);
  await expect(stage).not.toHaveAttribute('aria-describedby', /.*/);
  await expect(stage).toHaveAttribute('aria-label', 'Durchblick-Bild');
  await expect(page.locator('#view-title')).toHaveText('Durchblick durch Ihre Brille');
  await expect(fs).toHaveAccessibleName('Durchblick im Vollbild');
  await expect(page.locator('#view-ref')).toBeVisible();
  await expect(page.locator('#view-protrusion')).toBeHidden();
  await expect(page.locator('#view-side-note')).toBeHidden();
  await expect(page.locator('#view-caption')).toHaveText(
    'So sehen Sie mit dieser Brille geradeaus in die Ferne – berechnet durch die Vorder- und Rückfläche Ihrer Gläser. Gezeigt ist der mittlere Teil des Blickfelds.',
  );
  await expect(page.locator('#view-hint')).toContainText('Schalten Sie zwischen „Mit Glas“ und „Ohne Glas“ um');
  await expect(page.locator('#view-mode input[value=ref]')).toBeFocused();
  await page.locator('#view-mode label', { hasText: 'Glas' }).first().click();
  await page.waitForFunction(() => window.__eyeglassView.mode() === 'glass');
  const after = await ev(page, () => window.__eyeglassView.camera());
  for (const k of ['position', 'target']) {
    for (const c of ['x', 'y', 'z']) expect(Math.abs(after[k][c] - before[k][c]), `${k}.${c}`).toBeLessThanOrEqual(0.01);
  }
  await expect(page.locator('#view-tools')).toBeVisible();
  await expect(stage).toHaveAttribute('tabindex', '0');
  await expect(stage).toHaveAttribute('aria-describedby', 'view-keys');
  await expect(stage).toHaveAttribute('aria-label', '3D-Ansicht steuern');
  await expect(page.locator('#view-title')).toHaveText('3D-Ansicht Ihrer Brille');
  await expect(fs).toHaveAccessibleName('3D-Ansicht im Vollbild');
  await expect(page.locator('#view-ref')).toBeHidden();
  await expect(page.locator('#view-caption')).toContainText('Visueller Eindruck');
});

test('item 8: never an unwarped Mit Glas: first entry shows the status and no chart pixel until the warp', async ({ page }) => {
  await settledView(page);
  const warp = await holdWarpWorker(page, { startHeld: true });
  await page.locator('#view-mode label', { hasText: 'Durchblick' }).click();
  const status = page.locator('#view-status');
  await expect(status).toHaveText('Durchblick wird berechnet …');
  await expect(page.locator('#view')).toHaveAttribute('data-pending', 'warp');
  await expect(page.locator('#view-ref-lens input').first()).toBeDisabled();
  const g = await canvasGeom(page);
  const pts = [];
  for (let a = 1; a < 10; a++) for (let b = 1; b < 10; b++) pts.push([(a * g.rw) / 10, (b * g.rh) / 10]);
  const px = await pixels(page, pts);
  px.forEach((c, i) => expect(near(c, SURFACE), `stage point ${pts[i]}: ${c}`).toBe(true));
  await warp.release();
  await settledRef(page);
  await expect(status).toHaveText('');
  await expect(page.locator('.view-badge')).toHaveText('Durchblick · berechnet');
  const { panels } = await refState(page);
  const { cx, cy } = centreOf(panels[0]);
  const [c] = await pixels(page, [[cx + 0.5 * panels[0].squarePx, cy + 0.5 * panels[0].squarePx]]);
  expect(isChart(c), `chart after the warp: ${c}`).toBe(true);
});

test('item 9: stale picture stays with the badge "Durchblick wird berechnet …" until the draw', async ({ page }) => {
  await settledView(page);
  const warp = await holdWarpWorker(page);
  await refOn(page);
  const { panels } = await refState(page);
  const p = panels[0];
  const probe = [[p.x + p.w / 2 + 2.5 * p.squarePx, p.y + p.h / 2 + 0.5 * p.squarePx]];
  const before = await pixels(page, probe);
  await warp.hold();
  await page.locator('#rx-od-sph').fill('-8,00');
  await page.locator('#rx-os-sph').fill('-8,00');
  await settled(page);
  await expect(page.locator('.view-badge')).toHaveText('Durchblick wird berechnet …');
  await expect(page.locator('#view')).toHaveAttribute('data-pending', 'warp');
  expect(await pixels(page, probe), 'the old picture stays').toEqual(before);
  await expect(page.locator('#view-status')).toHaveText('');
  await warp.release();
  await settledRef(page);
  await expect(page.locator('.view-badge')).toHaveText('Durchblick · berechnet');
});

test('numbers never wait for the warp (D-13): a Sph edit paints the card with the warp worker held', async ({ page }) => {
  await settledView(page);
  const warp = await holdWarpWorker(page);
  await refOn(page);
  await warp.hold();
  const thick = page.locator('#result-od-thick');
  const was = await thick.textContent();
  await page.locator('#rx-od-sph').fill('-7,25');
  await expect(page.locator('#result')).toHaveAttribute('data-pending', '', { timeout: 5000 });
  await expect(thick).not.toHaveText(was ?? '');
  await expect(page.locator('#view-ref-size .ref-line').first()).toContainText('kleiner');
  await expect(page.locator('#view')).toHaveAttribute('data-pending', 'warp');
  await warp.release();
  await settledRef(page);
});

// ---------------------------------------------------------------------------------------------
// Round-2 NEW-3: the two-panel gate at the stated viewport (two panels; the mobile project shows
// one panel, so these tests are skipped there).

// lens-critic M3 (a) literals (fixed; never changed, round 3 NEW-11 and round 4 NEW-11b).
const M3A_LL_MIN = 20;
const M3A_LR_MAX_FRAC = 0.25;
const M3A_LL_FRAC = 0.6;
const M3A_LR_SLACK = 0.2;
const M3A_WIN = 40;
const M3A_STEP = 2;
const M3A_EDGE_PX = 1.5;
// 04-P0-RESULTS.md section 0: 1280 × 800 in page, two panels 270,00 × 338,75 (293,37 px per tan).
const M3A_PANEL = { w: 270, h: 338.75 };
const M3A_RX = Object.freeze({ sph: 0, cyl: -4, axisDeg: 45 });

/**
 * Round-4 NEW-11b clean lattice: points of a 2 px lattice in the two lower windows that are class 1
 * and at least M3A_EDGE_PX from every checker edge both at the eye direction (Ohne Glas) and at the
 * traced object direction of the CORRECT mapping (Mit Glas). Points are stage CSS px (pixel centres
 * through `geom`); the lower windows never reach the letter band (asserted).
 */
function m3aCleanPoints(panel, windows, ctx, geom) {
  const out = { LL: [], LR: [] };
  const P = panel.pxPerTan;
  for (const k of /** @type {const} */ (['LL', 'LR'])) {
    const w = windows[k];
    for (let x = Math.ceil(w.x) + 0.5; x < w.x + w.w; x += M3A_STEP) {
      for (let y = Math.ceil(w.y) + 0.5; y < w.y + w.h; y += M3A_STEP) {
        const [tx, ty] = eyeTan(panel, pixelCentre(geom, [x, y]));
        const c = classifyDirection(ctx, tx, ty);
        if (c.cls !== REF_CLASS.LENS) continue;
        expect(inLetterBand(ty) || inLetterBand(c.objTan[1]), 'lower windows stay below the letter band').toBe(false);
        if (edgeTan(tx, ty) * P < M3A_EDGE_PX || edgeTan(c.objTan[0], c.objTan[1]) * P < M3A_EDGE_PX) continue;
        out[k].push([x, y]);
      }
    }
  }
  return out;
}
/** The three mappings of the oracle: (i) correct, (ii) y-flipped, (iii) per-eye x-mirror. */
const MAPPINGS = {
  correct: (ctx, tx, ty) => classifyDirection(ctx, tx, ty).objTan,
  yFlipped: (ctx, tx, ty) => {
    const o = classifyDirection(ctx, tx, -ty).objTan;
    return o && [o[0], -o[1]];
  },
  xMirrored: (ctx, tx, ty) => {
    const o = classifyDirection(ctx, -tx, ty).objTan;
    return o && [-o[0], o[1]];
  },
};
/** Oracle counts over the clean points: Mit = chart at the mapping's objTan, Ohne = chart at the eye tan. */
function m3aOracle(panel, clean, mapping, ctx, geom) {
  const count = (pts) =>
    pts.filter((pt) => {
      const [tx, ty] = eyeTan(panel, pixelCentre(geom, pt));
      const o = MAPPINGS[mapping](ctx, tx, ty);
      return o !== null && checkerInk(o[0], o[1]) !== checkerInk(tx, ty);
    }).length;
  return { LL: count(clean.LL), LR: count(clean.LR) };
}
/** Condition (3) of M3 (a): no division, so LR_o = 0 is a valid case (lens-critic round 3). */
const m3aScreenOk = (s, o) => s.LL >= M3A_LL_FRAC * o.LL && s.LR <= o.LR + M3A_LR_SLACK * o.LL;

test.describe('two-panel gate (1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  // The 'mobile' project is the only one with isMobile (playwright.config.js).
  test.skip(({ isMobile }) => isMobile, 'one panel on the mobile project');

  /** Durchblick on, two panels asserted and logged. */
  async function twoPanels(page) {
    await refOn(page);
    const st = await refState(page);
    expect(st.panels.map((p) => p.eye), 'two panels, wearer view').toEqual(['OS', 'OD']);
    test.info().annotations.push({ type: 'panels', description: st.panels.map((p) => `${p.id} ${p.w} × ${p.h} at ${p.pxPerTan.toFixed(2)} px/tan`).join('; ') });
    return st.panels;
  }

  test('item 6: the "Rechtes Glas" pill is in the right half', async ({ page }) => {
    await settledView(page);
    await twoPanels(page);
    const stage = await page.locator('#view-stage').boundingBox();
    const pill = page.locator('#view-labels .ref-pill', { hasText: 'Rechtes Glas' });
    await expect(pill).toBeVisible();
    const b = await pill.boundingBox();
    expect(b.x, 'pill starts right of the stage middle').toBeGreaterThan(stage.x + stage.width / 2);
    const left = await page.locator('#view-labels .ref-pill', { hasText: 'Linkes Glas' }).boundingBox();
    expect(left.x + left.width).toBeLessThan(stage.x + stage.width / 2);
  });

  test('M3 (a) oracle: correct passes, flipped and mirrored fail', async () => {
    // Node only, at M3A_PANEL and M3A_WIN, on the exact 1280 × 800 two-panel layout (the page is
    // loaded only for the guard; the canvas geometry is the in-page one, 1 CSS px per buffer px).
    const W = 2 * M3A_PANEL.w + 2;
    const geom = { bw: W, bh: Math.round(M3A_PANEL.h), cw: W, rw: W, rh: M3A_PANEL.h };
    const P = Math.max(M3A_PANEL.w, M3A_PANEL.h) / (2 * Math.tan(Math.PI / 6));
    const panels = [
      { id: 'L', eye: 'OS', x: 0, y: 0, ...M3A_PANEL, pxPerTan: P },
      { id: 'R', eye: 'OD', x: W - M3A_PANEL.w, y: 0, ...M3A_PANEL, pxPerTan: P },
    ];
    for (const p of panels) {
      const ctx = lensOf(p.eye, M3A_RX);
      const clean = m3aCleanPoints(p, inscribedLowerWindows(p, M3A_WIN), ctx, geom);
      expect(clean.LL.length, `${p.id} clean LL`).toBeGreaterThan(0);
      expect(clean.LR.length, `${p.id} clean LR`).toBeGreaterThan(0);
      const o = m3aOracle(p, clean, 'correct', ctx, geom);
      expect(o.LL, `${p.id} LL_o`).toBeGreaterThanOrEqual(M3A_LL_MIN);
      expect(o.LR, `${p.id} LR_o`).toBeLessThanOrEqual(M3A_LR_MAX_FRAC * o.LL);
      const wrong = { yFlipped: m3aOracle(p, clean, 'yFlipped', ctx, geom), xMirrored: m3aOracle(p, clean, 'xMirrored', ctx, geom) };
      const line = `${p.id}: clean LL ${clean.LL.length} LR ${clean.LR.length}; correct ${o.LL}/${o.LR}; y-flipped ${wrong.yFlipped.LL}/${wrong.yFlipped.LR}; x-mirrored ${wrong.xMirrored.LL}/${wrong.xMirrored.LR}; window ${M3A_WIN}`;
      console.log('M3 (a) oracle', line);
      test.info().annotations.push({ type: 'M3 (a) oracle', description: line });
      for (const [name, w] of Object.entries(wrong)) expect(m3aScreenOk(w, o), `${p.id} ${name} must fail condition (3)`).toBe(false);
    }
  });

  test('M3 (a) cylinder direction on screen, OD and OS', async ({ page }) => {
    test.setTimeout(120_000);
    await settledView(page);
    await setRx(page, { sph: '0,00', cyl: '-4,00', axis: '45' });
    const panels = await twoPanels(page);
    const geom = await canvasGeom(page);
    for (const p of panels) {
      // (1) the oracle and the screen use the same panel size
      expect({ w: p.w, h: p.h }, `${p.id} panel size`).toEqual(M3A_PANEL);
      // (2) the oracle of the CORRECT picture at the panel size the handle reported
      const ctx = lensOf(p.eye, M3A_RX);
      const clean = m3aCleanPoints(p, inscribedLowerWindows(p, M3A_WIN), ctx, geom);
      expect(clean.LL.length, `${p.id} clean LL`).toBeGreaterThan(0);
      expect(clean.LR.length, `${p.id} clean LR`).toBeGreaterThan(0);
      const o = m3aOracle(p, clean, 'correct', ctx, geom);
      expect(o.LL).toBeGreaterThanOrEqual(M3A_LL_MIN);
      expect(o.LR).toBeLessThanOrEqual(M3A_LR_MAX_FRAC * o.LL);
      // (3) on screen over the same clean points
      const s = { LL: await changedPixels(page, clean.LL), LR: await changedPixels(page, clean.LR) };
      const line = `${p.id} (${p.eye}): LL_s ${s.LL} LR_s ${s.LR}; LL_o ${o.LL} LR_o ${o.LR}; clean LL ${clean.LL.length} LR ${clean.LR.length}; bounds LL_s ≥ ${(M3A_LL_FRAC * o.LL).toFixed(1)}, LR_s ≤ ${(o.LR + M3A_LR_SLACK * o.LL).toFixed(1)}`;
      console.log('M3 (a) screen', line);
      test.info().annotations.push({ type: 'M3 (a) screen', description: line });
      expect(s.LL, `${p.id} LL_s`).toBeGreaterThanOrEqual(M3A_LL_FRAC * o.LL);
      expect(s.LR, `${p.id} LR_s`).toBeLessThanOrEqual(o.LR + M3A_LR_SLACK * o.LL);
    }
  });

  test('M3 (b) eyes not swapped: OD −4,00 moves the third edge inward, OS +4,00 outward', async ({ page }) => {
    test.setTimeout(120_000);
    await settledView(page);
    await setRx(page, { sph: '-4,00' }, { sph: '+4,00' });
    const panels = await twoPanels(page);
    const third = async (p) => {
      const { cx, cy } = centreOf(p);
      const e = await rowEdges(page, rowAt(cy + 0.5 * p.squarePx), cx + 0.25 * p.squarePx, cx + 4.5 * p.squarePx);
      expect(e.length, `${p.id} edges ${e}`).toBeGreaterThanOrEqual(3);
      return e[2];
    };
    const mit = {};
    for (const p of panels) mit[p.id] = await third(p);
    await lens(page, false);
    const ohne = {};
    for (const p of panels) ohne[p.id] = await third(p);
    await lens(page, true);
    const line = panels.map((p) => `${p.id} (${p.eye}): Mit ${mit[p.id].toFixed(1)} Ohne ${ohne[p.id].toFixed(1)}`).join('; ');
    console.log('M3 (b)', line);
    test.info().annotations.push({ type: 'M3 (b)', description: line });
    expect(ohne.R - mit.R, 'right panel (OD −4,00): inward by ≥ 2 px').toBeGreaterThanOrEqual(2);
    expect(mit.L - ohne.L, 'left panel (OS +4,00): outward by ≥ 2 px').toBeGreaterThanOrEqual(2);
  });

  // M3 (c) frame (pilot A 40 / B 30 / DBL 14 / PD 40, CR-39, −4,00 both eyes), chosen with
  // classifyDirection in Node: inside the input ranges (FRAME-02: B ≥ 28) the rim never enters the
  // 1280 × 800 two-panel field on the vertical line half a square right of the centre (vertical
  // half-field tan 30° = 8,7 mm at the back surface, outline ≥ 12 mm there), so the sample line runs
  // half a square off the checker edge on the TEMPORAL side, 3,5 squares from the centre (OD right,
  // OS left), where the top rim is in the field and the bottom is not (04-08 SUMMARY, deviation).
  const M3C_FRAME = Object.freeze({ shape: 'pilot', A: 40, B: 30, DBL: 14 });
  const M3C_PD = 40;
  const M3C_COLUMN_SQUARES = 3.5;

  test('M3 (c) y-asymmetric rim on screen', async ({ page }) => {
    test.setTimeout(120_000);
    await settledView(page);
    await page.locator('input[name=frame-shape][value=pilot]').check();
    await page.locator('#frame-a').fill(String(M3C_FRAME.A));
    await page.locator('#frame-b').fill(String(M3C_FRAME.B));
    await page.locator('#frame-dbl').fill(String(M3C_FRAME.DBL));
    await setRx(page, { sph: '-4,00' }, { sph: '-4,00' }, String(M3C_PD));
    const panels = await twoPanels(page);
    const { tier } = await refState(page);
    const R = REF_GRID_TIERS[tier].cellPx + 2;
    const geom = await canvasGeom(page);
    const group = (c) => (c === REF_CLASS.LENS ? 'lens' : c === REF_CLASS.EDGE_BAND || c === REF_CLASS.RIM_FACE ? 'rim' : 'other');
    for (const p of panels) {
      const ctx = lensOf(p.eye, { sph: -4, cyl: 0, axisDeg: 0 }, { frame: M3C_FRAME, pd: M3C_PD });
      const { cx, cy } = centreOf(p);
      const side = p.eye === 'OD' ? 1 : -1; // temporal = screen right for OD, left for OS
      const x = Math.floor(cx + side * M3C_COLUMN_SQUARES * p.squarePx) + 0.5;
      const at = (xx, yy) => {
        const [tx, ty] = eyeTan(p, pixelCentre(geom, [xx, yy]));
        const c = classifyDirection(ctx, tx, ty);
        return { g: group(c.cls), objTan: c.objTan, ty };
      };
      // A point qualifies when its colour group holds for R px along the line and along its row
      // (the panel edge is no class change) and, for a lens point, its object direction is ≥ ¼
      // square from every checker edge and outside the letter band.
      const qualifies = (yy) => {
        const here = at(x, yy);
        if (here.g === 'other') return null;
        for (let d = -R; d <= R; d++) {
          if (yy + d > p.y && yy + d < p.y + p.h && at(x, yy + d).g !== here.g) return null;
          if (at(x + d, yy).g !== here.g) return null;
        }
        if (here.g === 'lens' && (edgeTan(...here.objTan) < 0.25 * S || inLetterBand(here.objTan[1]))) return null;
        return here.g;
      };
      const rows = [];
      for (let yy = Math.ceil(p.y) + 0.5; yy < p.y + p.h; yy += 1) rows.push(yy);
      const half = rows.filter((yy) => yy < cy);
      const rimAbove = half.filter((yy) => at(x, yy).g === 'rim');
      const rimBelow = rows.filter((yy) => yy > cy && at(x, yy).g === 'rim');
      expect(rimAbove.length, `${p.id}: rim above the centre on the line`).toBeGreaterThan(0);
      expect(rimBelow.length, `${p.id}: no rim below the centre on the line (one vertical side only)`).toBe(0);
      const rimPt = half.find((yy) => qualifies(yy) === 'rim');
      expect(rimPt, `${p.id}: a qualifying rim point above the centre`).toBeDefined();
      // The lens point below the centre nearest to the mirror image of the rim point.
      const mirror = 2 * cy - rimPt;
      const lensPt = rows
        .filter((yy) => yy > cy)
        .sort((a, b) => Math.abs(a - mirror) - Math.abs(b - mirror))
        .find((yy) => qualifies(yy) === 'lens');
      expect(lensPt, `${p.id}: a qualifying lens point below the centre`).toBeDefined();
      const [rimPx, lensPx] = await pixels(page, [
        [x, rimPt],
        [x, lensPt],
      ]);
      const line = `${p.id} (${p.eye}): column x ${x}, rim point y ${rimPt} → ${rimPx}, lens point y ${lensPt} → ${lensPx}`;
      console.log('M3 (c)', line);
      test.info().annotations.push({ type: 'M3 (c)', description: line });
      expect(near(rimPx, RIM), `${p.id} rim colour where Node says class 2/4`).toBe(true);
      expect(isChart(lensPx), `${p.id} chart colour where Node says class 1`).toBe(true);
    }
  });
});
