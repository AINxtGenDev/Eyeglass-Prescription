// REF-01 Durchblick, slice 7 (04-08; D-01…D-13; UI-SPEC "Durchblick: What the Picture Shows",
// "Where It Lives and How It Behaves", States, Verification items 1–9; lens-critic M3 hard gate).
// The picture is the engine warp grid drawn through the one renderer (refraction.js); every expected
// number is computed here in Node from the same engine (evaluateLens, warp.js classifyDirection) and
// the same chart definition (ref-layout.js), never read back from the picture.
// Reduced motion everywhere (instant camera cuts): SwiftShader renders ≈ 1 s per 3D frame (03-09).
import { test, expect } from '@playwright/test';
import { evaluateLens } from '../src/engine/evaluate.js';
import { prepareWarp, warpGrid, classifyDirection, REF_CLASS, REF_GRID_TIERS } from '../src/engine/warp.js';
import { SHAPES } from '../src/engine/frame/shapes.js';
import { validateFrame, RX_RANGES } from '../src/state/validate.js';
import { REF_TIER_ORDER, refStepDown } from '../src/ui/view/tiers.js';
import { EYE_POINT_MM } from '../src/engine/magnification.js';
import { specFor } from '../src/state/bench-cases.js';
import { CHART_SQUARE_TAN, CHART_BAND_SQUARES, checkerInk, inLetterBand } from '../src/ui/view/ref-layout.js';
import {
  settled,
  settledView,
  settledRef,
  settledCompare,
  guardPage,
  noThreeWarnings,
  plain,
  holdWarpWorker,
  changedPixels,
  inscribedLowerWindows,
  holdMeshWorker,
  WARP_WORKER_URL,
} from './helpers.js';
/* global window, document, self, requestAnimationFrame, MutationObserver */

let threeWarnings;
test.beforeEach(({ page }) => {
  threeWarnings = noThreeWarnings(page);
});
test.use({ reducedMotion: 'reduce' });
// 04-11: every test loads the page with ?refguardoff (the Durchblick guard measures but never
// trips), so a slow CI runner cannot step an ordinary test down to "vereinfacht"; the 04-10
// degradation tests keep the real guard.
const REAL_GUARD = 'REF-02 degradation (04-10)';
const guard = guardPage(test, { view: true, search: (info) => (info.titlePath.includes(REAL_GUARD) ? '' : '?refguardoff') });
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

/**
 * 04-09 (M4): type a value without scrolling the field into view. On the phone layout fill() scrolls
 * to the Rx field and takes the stage off screen, where no warp job is posted by design; the tests
 * of the warp lane keep the stage on screen this way (the app listens to 'input').
 */
async function fillInPlace(page, selector, value) {
  await page.locator(selector).evaluate((el, v) => {
    /** @type {HTMLInputElement} */ (el).value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

/**
 * 04-09 (M4): bring the stage on screen and wait for a warp drawn after generation `gen` (a job is
 * posted only while the stage is on screen; settledRef alone would accept the older picture).
 */
async function refRedrawn(page, gen) {
  await page.locator('#view-stage').scrollIntoViewIfNeeded();
  await page.waitForFunction((g) => window.__eyeglassView.ref().drawnGen > g, gen, { timeout: 60_000 });
  await settledRef(page);
}

/**
 * 04-09 (item 5, item 12): no #f3f4f6 pixel inside any drawn panel (a 6 px lattice) and no
 * "hier kein Durchblick" pill. Tolerance 1: an anti-aliased chart grey (r = g = b) can never be
 * within 1 of (243, 244, 246), so only the real fill matches.
 */
async function noSurfaceInPanels(page) {
  const { panels } = await refState(page);
  for (const p of panels) {
    expect(p.noView, `${p.id}: the warp reports no class-3 direction`).toBe(false);
    const pts = [];
    for (let x = p.x + 3.5; x < p.x + p.w - 1; x += 6) for (let y = p.y + 3.5; y < p.y + p.h - 1; y += 6) pts.push([x, y]);
    const px = await pixels(page, pts);
    const bad = pts.filter((_, i) => near(px[i], SURFACE, 1));
    expect(bad, `${p.id}: #f3f4f6 pixels`).toEqual([]);
  }
  await expect(page.locator('#view-labels .ref-pill--noview:visible')).toHaveCount(0);
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
  // 04-09 (B2 (f)): no "kein Durchblick" zone anywhere in the field.
  await noSurfaceInPanels(page);
  const gen = (await refState(page)).drawnGen;
  await page.locator('input[name=material][value=cr39]').check();
  await fillInPlace(page, '#rx-od-sph', '-10,00');
  await fillInPlace(page, '#rx-os-sph', '-10,00');
  await refRedrawn(page, gen);
  await expect(size.locator('.ref-line').nth(0)).toHaveText(`Rechtes Glas: Bild etwa 13${N}% kleiner`);
  await expect(size.locator('.ref-line').nth(1)).toHaveText(`Linkes Glas: Bild etwa 13${N}% kleiner`);
  await noSurfaceInPanels(page);
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

test('04-11: ordinary Durchblick tests load with ?refguardoff (guard measures, never trips)', async ({ page }) => {
  await settledView(page);
  await refOn(page);
  const st = await refState(page);
  expect(st.guardOff).toBe(true);
  expect(st.tier).toBe(st.startTier);
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
  await fillInPlace(page, '#rx-od-sph', '-8,00');
  await fillInPlace(page, '#rx-os-sph', '-8,00');
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
  await fillInPlace(page, '#rx-od-sph', '-7,25');
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

// ---------------------------------------------------------------------------------------------
// 04-09 Task 1: one-panel mode, blocked / empty / failed / no-WebGL states, stage visibility (M4).

const VIEW_CHUNK = '**/assets/view-*.js';
const VIEW_CHUNK_RE = /\/assets\/view-[^/]*\.js$/;
const BLOCKED_OS = 'Linkes Glas – nicht berechnet';

/** Zyl set and Achse empty: the left eye has a field error (Fehler), so it is not computed (view.spec VIZ-01). */
async function blockOs(page) {
  await page.locator('#rx-os-cyl').fill('-1,00');
  await page.locator('#rx-os-axis').fill('');
  await page.locator('#rx-os-axis').blur();
  await settled(page);
}
/** The "Durchblick für" picker (one-panel mode). */
async function pickEye(page, eye) {
  await page.locator('#view-ref-eye label', { hasText: eye === 'OS' ? 'Linkes Glas' : 'Rechtes Glas' }).click();
}
/** Visible tick marks of one panel (svg#view-ref-ticks; none while it does not exist). */
const panelTicks = (page, id) => page.locator(`#view-ref-ticks g[data-panel="${id}"]:not([display="none"]) g.ref-tick:not([display="none"])`);

/**
 * Serve the real warp worker; while self.__fail is true every 'warp' reply carries ok: false items
 * (the worker's own item-failure shape, warp-protocol.js), so the page takes its failure path.
 */
async function failWarpWorker(page) {
  const patch =
    '{const post = self.postMessage.bind(self); self.__fail = true;' +
    "self.postMessage = (m, ...rest) => { if (self.__fail && m && m.type === 'warp') post({ ...m, items: m.items.map((it) => ({ panel: it.panel, ok: false, code: 'WARP_FAILED' })) }); else post(m, ...rest); };}\n";
  await page.route(WARP_WORKER_URL, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: patch + body });
  });
  const find = () => page.workers().find((x) => WARP_WORKER_URL.test(new URL(x.url()).pathname));
  return {
    heal: async () => {
      await expect.poll(() => Boolean(find())).toBe(true);
      await find().evaluate(() => {
        self.__fail = false;
      });
    },
  };
}

test('item 10: one eye blocked: its panel is the fill with the pill, no ticks, size line "nicht berechnet"; the other renders', async ({ page }) => {
  test.setTimeout(120_000);
  await settledView(page);
  await blockOs(page);
  await refOn(page);
  const size = page.locator('#view-ref-size');
  await expect(size).toContainText('Linkes Glas: nicht berechnet');
  await expect(size).toContainText('Rechtes Glas: Bild');
  let st = await refState(page);
  if (st.panels.length === 1) {
    // One panel: the default eye is the computable one (OS has no SM); the picker still offers OS.
    expect(st.panels[0].eye).toBe('OD');
    await expect(page.locator('#view-ref-eye')).toBeVisible();
    await expect(page.locator('#view-ref-eye input[value=OD]')).toBeChecked();
    const p = st.panels[0];
    const [c] = await pixels(page, [[p.x + p.w / 2 + 0.5 * p.squarePx, p.y + p.h / 2 + 0.5 * p.squarePx]]);
    expect(isChart(c), `OD renders: ${c}`).toBe(true);
    await pickEye(page, 'OS');
    await expect.poll(async () => (await refState(page)).panels[0]?.eye).toBe('OS');
    await settledRef(page);
    st = await refState(page);
  }
  const L = st.panels.find((p) => p.eye === 'OS');
  const pill = page.locator('#view-labels .ref-pill--blocked:visible');
  await expect(pill).toHaveText(BLOCKED_OS);
  await expect(pill).toBeVisible();
  const pb = await pill.boundingBox();
  const cv = await page.locator('#view-canvas').boundingBox();
  // centred in its panel (± 2 px)
  expect(Math.abs(pb.x + pb.width / 2 - (cv.x + L.x + L.w / 2))).toBeLessThanOrEqual(2);
  expect(Math.abs(pb.y + pb.height / 2 - (cv.y + L.y + L.h / 2))).toBeLessThanOrEqual(2);
  const pts = [];
  for (let a = 1; a < 10; a++) for (let b = 1; b < 10; b++) if (a !== 5 && b !== 5) pts.push([L.x + (a * L.w) / 10, L.y + (b * L.h) / 10]);
  (await pixels(page, pts)).forEach((c, i) => expect(near(c, SURFACE), `blocked panel point ${pts[i]}: ${c}`).toBe(true));
  await expect(panelTicks(page, L.id)).toHaveCount(0);
  const R = st.panels.find((p) => p.eye === 'OD');
  if (R) {
    const [c] = await pixels(page, [[R.x + R.w / 2 + 0.5 * R.squarePx, R.y + R.h / 2 + 0.5 * R.squarePx]]);
    expect(isChart(c), `right panel renders: ${c}`).toBe(true);
    await expect(page.locator('#view-labels .ref-pill', { hasText: /^Rechtes Glas$/ })).toBeVisible();
  }
});

test('no eye computable: empty panels, no pills, caption view.empty, size block hidden', async ({ page }) => {
  await settledView(page);
  await refOn(page);
  await page.locator('#example-clear').click();
  for (const eye of ['od', 'os']) await page.locator(`#rx-${eye}-sph`).fill('');
  await settled(page);
  await expect(page.locator('#view-caption')).toHaveText('Noch keine Gläser – tragen Sie den Sph-Wert ein.');
  await expect(page.locator('#view-ref-size')).toBeHidden();
  await expect(page.locator('#view-labels .ref-pill:visible')).toHaveCount(0);
  await expect(page.locator('#view-status')).toHaveText('');
  const g = await canvasGeom(page);
  const pts = [];
  for (let a = 1; a < 10; a++) for (let b = 1; b < 10; b++) pts.push([(a * g.rw) / 10, (b * g.rh) / 10]);
  (await pixels(page, pts)).forEach((c, i) => expect(near(c, SURFACE), `stage point ${pts[i]}: ${c}`).toBe(true));
});

test('item 11: the stage crossing 360 px shows / hides the picker; OD −2,00 / OS −5,00 → default "Linkes Glas"', async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  test.skip(isMobile, 'resizes a desktop window');
  await settledView(page);
  await setRx(page, { sph: '-2,00' }, { sph: '-5,00' });
  await refOn(page);
  const picker = page.locator('#view-ref-eye');
  await expect(picker).toBeHidden();
  expect((await refState(page)).panels.length).toBe(2);
  await page.setViewportSize({ width: 320, height: 640 });
  await expect.poll(async () => (await refState(page)).panels.length).toBe(1);
  // Below 900 px the view sits after the result cards (view-place.js): bring the stage on screen (M4).
  await page.locator('#view-stage').scrollIntoViewIfNeeded();
  await settledRef(page);
  await expect(picker).toBeVisible();
  await expect(picker.locator('input[value=OS]')).toBeChecked();
  const one = await refState(page);
  expect(one.panels[0].eye).toBe('OS');
  await expect(page.locator('#view-ref-side')).toHaveText('Sie schauen selbst durch Ihr linkes Glas.');
  await expect(page.locator('#view-labels .ref-pill:visible')).toHaveText(['Linkes Glas']);
  // Switching the eye changes the picture, not the scale; the size block lists both eyes.
  await pickEye(page, 'OD');
  await expect.poll(async () => (await refState(page)).panels[0].eye).toBe('OD');
  await settledRef(page);
  expect((await refState(page)).panels[0].pxPerTan).toBe(one.panels[0].pxPerTan);
  await expect(page.locator('#view-ref-size .ref-line')).toHaveCount(2);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(async () => (await refState(page)).panels.length).toBe(2);
  await expect(picker).toBeHidden();
});

test('warp failure: the Fehler box with "Erneut versuchen"; the retry re-posts the job; the size block stays', async ({ page }) => {
  test.setTimeout(120_000);
  await settledView(page);
  const warp = await failWarpWorker(page);
  await page.locator('#view-mode label', { hasText: 'Durchblick' }).click();
  const status = page.locator('#view-status');
  await expect(status).toHaveClass(/view-failed/, { timeout: 30_000 });
  await expect(status).toContainText('Der Durchblick konnte nicht berechnet werden. Die übrigen Ergebnisse gelten unverändert.');
  const retry = status.getByRole('button', { name: 'Erneut versuchen' });
  await expect(retry).toBeVisible();
  await expect(page.locator('#view-ref-size .ref-line').first()).toContainText('Rechtes Glas: Bild');
  await expect(page.locator('#view-ref-ticks g:not([display="none"]) g.ref-tick:not([display="none"])')).toHaveCount(0);
  const jobs = (await refState(page)).jobs;
  await warp.heal();
  await retry.click();
  await settledRef(page);
  expect((await refState(page)).jobs).toBe(jobs + 1);
  await expect(status).not.toHaveClass(/view-failed/);
  await expect(status).toHaveText('');
  await expect(page.locator('.view-badge')).toHaveText('Durchblick · berechnet');
});

test('no WebGL 2: Durchblick is not offered, the size block is shown with the no-picture scope', async ({ page }) => {
  await settledView(page);
  const all = threeWarnings;
  threeWarnings = () => all().filter((w) => !w.includes('3D view: no WebGL2'));
  await page.goto('./?nowebgl');
  await settledView(page);
  await expect(page.locator('#view-mode')).toHaveCount(0);
  await expect(page.locator('#view-stage')).toContainText('WebGL 2 fehlt');
  const size = page.locator('#view-ref-size');
  await expect(size).toBeVisible();
  await expect(size.locator('.ref-title')).toHaveText('Bildgröße in der Glasmitte, verglichen mit dem Blick ohne Brille');
  await expect(size).toContainText('Rechtes Glas: Bild');
  await expect(size).not.toContainText('Zum Bildrand hin');
  await expect(size).not.toContainText('Bei so schwachen Gläsern');
  await expect(page.locator('#view-ref-scope')).toHaveText(
    `Berechnet für ein ruhendes Auge, das geradeaus durch die Glasmitte schaut, mit der Pupille 15,0${N}mm hinter dem Glas (angenommener Wert).`,
  );
  await expect(page.locator('#view-ref-lens')).toBeHidden();
  await expect(page.locator('#view-ref-side')).toBeHidden();
  await page.locator('#rx-od-sph').fill('-4,00');
  await settledView(page);
  await expect(size.locator('.ref-line').first()).toHaveText(`Rechtes Glas: Bild etwa 6${N}% kleiner`);
});

test('3D chunk failed: the size block is still shown with the no-picture scope', async ({ page }) => {
  await settledView(page);
  guard.allowFailed(VIEW_CHUNK_RE);
  await page.route(VIEW_CHUNK, (route) => route.abort());
  await page.goto('./');
  await settled(page);
  await expect(page.locator('#view-stage')).toContainText('Die 3D-Ansicht konnte nicht geladen werden.');
  const size = page.locator('#view-ref-size');
  await expect(size).toBeVisible();
  await expect(size).toContainText('Rechtes Glas: Bild');
  await expect(size).not.toContainText('Zum Bildrand hin');
  await expect(page.locator('#view-ref-scope')).toContainText('Berechnet für ein ruhendes Auge');
  await expect(page.locator('#view-ref-lens')).toBeHidden();
  await page.locator('#rx-od-sph').fill('-4,00');
  await settled(page);
  await expect(size.locator('.ref-line').first()).toHaveText(`Rechtes Glas: Bild etwa 6${N}% kleiner`);
});

test('webglcontextlost in Durchblick: redrawn from the last warp on restore', async ({ page }) => {
  await settledView(page);
  await refOn(page);
  const { panels, drawnGen } = await refState(page);
  const p = panels[0];
  const probe = [[p.x + p.w / 2 + 0.5 * p.squarePx, p.y + p.h / 2 + 0.5 * p.squarePx]];
  const before = await pixels(page, probe);
  const lost = await page.evaluate(
    () =>
      new Promise((res) => {
        const c = /** @type {HTMLCanvasElement} */ (document.getElementById('view-canvas'));
        const ext = c.getContext('webgl2')?.getExtension('WEBGL_lose_context');
        if (!ext) return res(false);
        window.__loseExt = ext;
        c.addEventListener('webglcontextlost', () => res(true), { once: true });
        ext.loseContext();
      }),
  );
  expect(lost).toBe(true);
  await page.evaluate(
    () =>
      new Promise((res) => {
        const c = document.getElementById('view-canvas');
        c.addEventListener('webglcontextrestored', () => requestAnimationFrame(() => setTimeout(res, 0)), { once: true });
        window.__loseExt.restoreContext();
      }),
  );
  await expect(page.locator('#view-status')).toHaveText('');
  expect((await refState(page)).drawnGen, 'no new trace').toBe(drawnGen);
  await expect.poll(() => pixels(page, probe)).toEqual(before);
});

test.describe('stage visibility (M4) at 412×915', () => {
  test.use({ viewport: { width: 412, height: 915 } });
  test.skip(({ isMobile }) => !isMobile, 'phone layout: mobile project only');

  test('item 13: off-screen: no warp job, the re-mesh and bar thumbnail run; back on screen: exactly one job', async ({ page }) => {
    test.setTimeout(120_000);
    await settledView(page);
    await page.goto('./?thumbguardoff&refguardoff');
    await settledView(page);
    await page.locator('#view-stage').scrollIntoViewIfNeeded();
    await refOn(page);
    await expect.poll(async () => (await refState(page)).onScreen).toBe(true);
    const jobs0 = (await refState(page)).jobs;
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('#summary-bar')).toBeVisible();
    await expect.poll(async () => (await refState(page)).onScreen).toBe(false);
    const thumb0 = (await ev(page, () => window.__eyeglassView.thumbInfo())).copies;
    const mesh0 = (await refState(page)).meshSent;
    await page.locator('#rx-od-sph').fill('-3,25');
    await settledView(page);
    await expect.poll(async () => (await refState(page)).meshSent, 'the re-mesh ran').toBeGreaterThan(mesh0);
    await expect
      .poll(async () => (await ev(page, () => window.__eyeglassView.thumbInfo())).copies, { message: 'the bar thumbnail updated', timeout: 30_000 })
      .toBeGreaterThan(thumb0);
    await expect(page.locator('#bar-view-slot')).toBeVisible();
    expect((await refState(page)).jobs, 'no warp job off-screen').toBe(jobs0);
    await page.locator('#view-stage').scrollIntoViewIfNeeded();
    await expect.poll(async () => (await refState(page)).onScreen).toBe(true);
    await settledRef(page);
    expect((await refState(page)).jobs, 'exactly one job on return').toBe(jobs0 + 1);
    await page.waitForTimeout(300);
    expect((await refState(page)).jobs).toBe(jobs0 + 1);
  });
});

test('item 14: leaving Durchblick with a deferred re-mesh shows "3D wird aktualisiert …" until the mesh attaches', async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  // On a phone the edited field and the stage are never both on screen (typing scrolls the stage off).
  test.skip(isMobile, 'needs the stage on screen while typing: desktop layout');
  await settledView(page);
  const gate = await holdMeshWorker(page);
  await page.goto('./?refguardoff');
  await settledView(page);
  await page.locator('#view-stage').scrollIntoViewIfNeeded();
  await refOn(page);
  await expect.poll(async () => (await refState(page)).onScreen).toBe(true);
  const mesh0 = (await refState(page)).meshSent;
  await page.locator('#rx-od-sph').fill('-3,75');
  await settledRef(page);
  const st = await refState(page);
  expect(st.meshSent, 'on screen: the re-mesh is deferred').toBe(mesh0);
  expect(st.meshDeferred).toBe(true);
  await gate.hold();
  await page.locator('#view-mode label', { hasText: 'Glas' }).first().click();
  await expect(page.locator('.view-badge')).toHaveText('3D wird aktualisiert …');
  await expect(page.locator('#view')).toHaveAttribute('data-pending', 'mesh');
  await gate.release();
  await settledView(page);
  await expect(page.locator('.view-badge')).toHaveText('Visueller Eindruck');
});

// ---------------------------------------------------------------------------------------------
// 04-09 Task 2: rim and edge band from the leaves, reference ticks (items 12, 25).

const SCRATCH = process.env.REF_SHOTS ?? null; // optional screenshot directory (D-30 pass)
const RIM_NOTE = 'Der dunkle Streifen im Bild ist der Rand Ihrer Fassung.';
const RIM_PAST_NOTE = 'Außerhalb des Rands sehen Sie am Glas vorbei.';
const ITEM12_FRAME = Object.freeze({ shape: 'rechteckig', A: 40, B: 28, DBL: 14 });
const ITEM12_PD = 40;
// UI-SPEC item 12 in tan units (N9): [chart, edge band, rim face] eye tan from the panel centre, temporal.
const ITEM12_TAN = Object.freeze({ '-4,00': [0.401, 0.453, 0.521], '+4,00': [0.361, 0.421, 0.521] });

/** The ticks of a panel as drawn: edge, n, the edge point (stage px) and whether it is displayed. */
const drawnTicks = (page, id) =>
  ev(
    page,
    (pid) =>
      [...document.querySelectorAll(`#view-ref-ticks g[data-panel="${pid}"] g.ref-tick`)].map((g) => {
        const l = /** @type {SVGLineElement} */ (g.querySelector('line'));
        return {
          edge: g.getAttribute('data-edge'),
          n: Number(g.getAttribute('data-n')),
          x: Number(l.getAttribute('x1')),
          y: Number(l.getAttribute('y1')),
          shown: g.getAttribute('display') !== 'none' && g.parentElement?.getAttribute('display') !== 'none',
        };
      }),
    id,
  );

/**
 * Offset (CSS px) from a tick to the nearest chart colour change on the line 14 px inside the panel
 * edge, searched ± `span` px along the edge; null when none (UI-SPEC "How visible", item 25).
 */
async function tickOffset(page, p, tk, span = 8) {
  const along = tk.edge === 'top' || tk.edge === 'bottom';
  const pts = [];
  if (along) {
    const y = rowAt(tk.edge === 'top' ? p.y + 14 : p.y + p.h - 14);
    for (let x = Math.floor(tk.x - span) + 0.5; x <= tk.x + span; x += 1) pts.push([x, y]);
  } else {
    const x = rowAt(tk.edge === 'left' ? p.x + 14 : p.x + p.w - 14);
    for (let y = Math.floor(tk.y - span) + 0.5; y <= tk.y + span; y += 1) pts.push([x, y]);
  }
  const px = await pixels(page, pts);
  let best = null;
  for (let i = 1; i < pts.length; i++) {
    if (inkish(px[i]) === inkish(px[i - 1])) continue;
    const mid = along ? (pts[i][0] + pts[i - 1][0]) / 2 : (pts[i][1] + pts[i - 1][1]) / 2;
    const d = mid - (along ? tk.x : tk.y);
    if (best === null || Math.abs(d) < Math.abs(best)) best = d;
  }
  return best;
}
/** The bottom outermost ticks (N5: the badge and the fullscreen button cover the top edge). */
function outermost(ticks) {
  const lr = (edge) => ticks.filter((t) => t.edge === edge && t.shown).sort((a, b) => a.n - b.n)[0];
  const bottom = ticks.filter((t) => t.edge === 'bottom' && t.shown).sort((a, b) => a.n - b.n);
  return { left: lr('left'), right: lr('right'), bottomL: bottom[0], bottomR: bottom.at(-1) };
}

async function setFrame(page, f) {
  await page.locator(`input[name=frame-shape][value=${f.shape}]`).check();
  await page.locator('#frame-a').fill(String(f.A));
  await page.locator('#frame-b').fill(String(f.B));
  await page.locator('#frame-dbl').fill(String(f.DBL));
}

test.describe('item 12 rim in the field (320×640, one panel)', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test.skip(({ isMobile }) => isMobile, 'the desktop project at 320 × 640 is the stated case');

  test('item 12: lens → edge band → rim face exactly where the engine classes put them; Ohne Glas keeps the mask; Linkes Glas mirrors', async ({ page }) => {
    test.setTimeout(240_000);
    await settledView(page);
    await setFrame(page, ITEM12_FRAME);
    await setRx(page, { sph: '-4,00' }, { sph: '-4,00' }, String(ITEM12_PD));
    await refOn(page);
    const geom = await canvasGeom(page);
    const size = page.locator('#view-ref-size');
    for (const rxText of /** @type {const} */ (['-4,00', '+4,00'])) {
      const sph = Number(rxText.replace(',', '.'));
      let gen = (await refState(page)).drawnGen;
      if ((await page.locator('#rx-od-sph').inputValue()) !== rxText) {
        await fillInPlace(page, '#rx-od-sph', rxText);
        await fillInPlace(page, '#rx-os-sph', rxText);
        await refRedrawn(page, gen);
      }
      for (const eye of /** @type {const} */ (['OD', 'OS'])) {
        if ((await refState(page)).panels[0].eye !== eye) {
          gen = (await refState(page)).drawnGen;
          await pickEye(page, eye);
          await refRedrawn(page, gen);
        }
        const st = await refState(page);
        expect(st.panels.length).toBe(1);
        const p = st.panels[0];
        expect(p.eye).toBe(eye);
        const ctx = lensOf(eye, { sph, cyl: 0, axisDeg: 0 }, { frame: ITEM12_FRAME, pd: ITEM12_PD });
        const side = eye === 'OD' ? 1 : -1; // temporal = screen right for OD, left for OS
        const { cx, cy } = centreOf(p);
        const [tChart, tBand, tFace] = ITEM12_TAN[rxText];
        const xAt = (tan) => cx + side * tan * p.pxPerTan; // N9: tan × the measured pxPerTan
        const y0 = rowAt(cy);
        const cls = (pt) => classifyDirection(ctx, ...eyeTan(p, pixelCentre(geom, pt)));
        // The rim samples on the centre row; the engine classes there are the premise.
        const band = [xAt(tBand), y0];
        const face = [xAt(tFace), y0];
        expect(cls(band).cls, `${eye} ${rxText} Node: edge band at tan ${tBand}`).toBe(REF_CLASS.EDGE_BAND);
        expect(cls(face).cls, `${eye} ${rxText} Node: rim face at tan ${tFace}`).toBe(REF_CLASS.RIM_FACE);
        // The chart sample: the row nearest the centre line where the point is class 1 and ≥ 2 px
        // from every checker edge both at the eye tan (Ohne) and the traced object tan (Mit).
        let chart = null;
        for (const d of [2.5, -2.5, 3.5, -3.5, 4.5, -4.5, 5.5, -5.5, 6.5, -6.5]) {
          const pt = [xAt(tChart), y0 + d];
          const [tx, ty] = eyeTan(p, pixelCentre(geom, pt));
          const c = classifyDirection(ctx, tx, ty);
          if (c.cls !== REF_CLASS.LENS) continue;
          if (edgeTan(tx, ty) * p.pxPerTan < 2 || edgeTan(...c.objTan) * p.pxPerTan < 2) continue;
          chart = pt;
          break;
        }
        expect(chart, `${eye} ${rxText}: a clean chart point near the centre line`).not.toBeNull();
        // D-12 (f): inside a MIXED grid cell (corners of different classes) the leaves decide: a
        // class-1 point there is chart, a class-2 point rim (the 04-08 rule drew the whole cell as rim).
        const cellPx = REF_GRID_TIERS[st.tier].cellPx;
        const nx = Math.ceil(p.w / cellPx);
        const ny = Math.ceil(p.h / cellPx);
        const cX = p.w / nx;
        const cY = p.h / ny;
        const gridCls = (i, j) => classifyDirection(ctx, (i * cX - p.w / 2) / p.pxPerTan, (j * cY - p.h / 2) / p.pxPerTan).cls;
        const mixedAt = (pt) => {
          const [sx, sy] = pixelCentre(geom, pt);
          const i = Math.floor((sx - p.x) / cX);
          const j = Math.floor((p.y + p.h - sy) / cY);
          const c = [gridCls(i, j), gridCls(i + 1, j), gridCls(i, j + 1), gridCls(i + 1, j + 1)];
          return c.some((v) => v !== c[0]);
        };
        const leafPts = { lens: null, band: null };
        // The lens end can sit on a grid column on the centre row, so the search covers the panel height.
        const rows = [];
        for (let dy = 0; dy < p.h / 2 - 2; dy += 2) rows.push(dy, -dy - 1);
        for (const dy of rows) {
          for (let dx = 0; dx < 60 && !(leafPts.lens && leafPts.band); dx += 1) {
            const pt = [Math.floor(xAt(tChart) + side * dx) + 0.5, Math.floor(cy + dy) + 0.5];
            if (!mixedAt(pt)) continue;
            const [tx, ty] = eyeTan(p, pixelCentre(geom, pt));
            const c = classifyDirection(ctx, tx, ty);
            // ≥ 1 px from the class change and (lens) from every checker edge
            const stable = [-1, 1].every((d) => classifyDirection(ctx, ...eyeTan(p, pixelCentre(geom, [pt[0] + d, pt[1]]))).cls === c.cls);
            if (!stable) continue;
            const clean = (u, v) => edgeTan(u, v) * p.pxPerTan >= 1.5 && !inLetterBand(v);
            if (c.cls === REF_CLASS.LENS && !leafPts.lens && clean(...c.objTan) && clean(tx, ty)) leafPts.lens = pt;
            if (c.cls === REF_CLASS.EDGE_BAND && !leafPts.band) leafPts.band = pt;
          }
        }
        expect(leafPts.lens, `${eye} ${rxText}: a class-1 point in a mixed cell`).not.toBeNull();
        expect(leafPts.band, `${eye} ${rxText}: a class-2 point in a mixed cell`).not.toBeNull();
        for (const lensOn of [true, false]) {
          await lens(page, lensOn);
          const [l, b] = await pixels(page, [leafPts.lens, leafPts.band]);
          const line = `${eye} ${rxText} ${lensOn ? 'Mit' : 'Ohne'} mixed cells: lens ${leafPts.lens.map((v) => v.toFixed(1))} → ${l}; band ${leafPts.band.map((v) => v.toFixed(1))} → ${b}`;
          console.log('item 12', line);
          test.info().annotations.push({ type: 'item 12 leaves', description: line });
          expect(isChart(l), `leaf class 1 in a mixed cell is chart: ${l}`).toBe(true);
          expect(near(b, RIM), `leaf class 2 in a mixed cell is rim: ${b}`).toBe(true);
        }
        for (const lensOn of [true, false]) {
          await lens(page, lensOn);
          const [c, b, f] = await pixels(page, [chart, band, face]);
          const line = `${eye} ${rxText} ${lensOn ? 'Mit' : 'Ohne'}: chart ${chart.map((v) => v.toFixed(1))} → ${c}; band x ${band[0].toFixed(1)} → ${b}; face x ${face[0].toFixed(1)} → ${f}; ${p.pxPerTan.toFixed(2)} px/tan`;
          console.log('item 12', line);
          test.info().annotations.push({ type: 'item 12', description: line });
          expect(isChart(c), `chart colour at tan ${tChart}: ${c}`).toBe(true);
          expect(near(b, RIM), `edge band #221e1c at tan ${tBand}: ${b}`).toBe(true);
          expect(near(f, RIM), `rim face #221e1c at tan ${tFace}: ${f}`).toBe(true);
          await noSurfaceInPanels(page);
          if (SCRATCH) await page.locator('#view-stage').screenshot({ path: `${SCRATCH}/04-09-320-item12-${rxText}-${eye}-${lensOn ? 'mit' : 'ohne'}.png` });
        }
        // N11: a tick is hidden exactly where its 14 px sample point is on the rim face or edge band.
        const ticks = await drawnTicks(page, p.id);
        expect(ticks.length).toBeGreaterThan(0);
        for (const tk of ticks) {
          const inX = tk.edge === 'left' ? p.x + 14 : tk.edge === 'right' ? p.x + p.w - 14 : tk.x;
          const inY = tk.edge === 'top' ? p.y + 14 : tk.edge === 'bottom' ? p.y + p.h - 14 : tk.y;
          const [tx, ty] = eyeTan(p, [inX, inY]);
          const c = classifyDirection(ctx, tx, ty).cls;
          // skip a sample point within 1,5 px of a class change (the grid resolves the boundary to ≤ 1 px)
          const near1 = [-1.5, 1.5].some((dd) => {
            const alongX = tk.edge === 'top' || tk.edge === 'bottom';
            const [ux, uy] = eyeTan(p, alongX ? [inX + dd, inY] : [inX, inY + dd]);
            return classifyDirection(ctx, ux, uy).cls !== c;
          });
          if (near1) continue;
          const onRim = c === REF_CLASS.EDGE_BAND || c === REF_CLASS.RIM_FACE;
          expect(tk.shown, `${eye} tick ${tk.edge} ${tk.n}: shown iff its sample point is not on the rim`).toBe(!onRim);
        }
        // N3 / MINOR 8: the rim note with a rim in the shown panel; the past-rim note iff class 5 is on screen.
        expect(p.rim).toBe(true);
        await expect(size).toContainText(RIM_NOTE);
        if (p.pastRim) await expect(size).toContainText(RIM_PAST_NOTE);
        else await expect(size).not.toContainText(RIM_PAST_NOTE);
        test.info().annotations.push({ type: 'item 12 notes', description: `${eye} ${rxText}: rim ${p.rim}, pastRim ${p.pastRim}` });
      }
      await pickEye(page, 'OD');
    }
  });
});

test.describe('item 25 reference ticks (412×915, two panels)', () => {
  test.use({ viewport: { width: 412, height: 915 } });
  test.skip(({ isMobile }) => isMobile, 'one run of the 412 layout (desktop project)');

  test('item 25 (a)–(d): ticks on the Ohne-Glas square edges; −1,00 and −1,00 × 180 move them; weak note at −0,75', async ({ page }) => {
    test.setTimeout(240_000);
    await settledView(page);
    await refOn(page);
    let st = await refState(page);
    expect(st.panels.length).toBe(2);
    // (a) Ohne Glas, the load Rx: every drawn tick sits on a chart colour change within ± 1 px.
    await lens(page, false);
    for (const p of st.panels) {
      const ticks = (await drawnTicks(page, p.id)).filter((t) => t.shown);
      expect(ticks.filter((t) => (t.edge === 'left' || t.edge === 'right') && t.n >= 1 && t.n <= 3), 'N1: no tick in the letter band').toEqual([]);
      for (const tk of ticks) {
        // skip a sample line within 1,5 px of a perpendicular square edge (mixed colours there)
        const along = tk.edge === 'top' || tk.edge === 'bottom';
        const lineAt = along ? (tk.edge === 'top' ? p.y + 14 : p.y + p.h - 14) : tk.edge === 'left' ? p.x + 14 : p.x + p.w - 14;
        const t = along ? (p.y + p.h / 2 - rowAt(lineAt)) / p.pxPerTan : (rowAt(lineAt) - p.x - p.w / 2) / p.pxPerTan;
        if (Math.abs(t / S - Math.round(t / S)) * p.squarePx < 1.5) continue;
        const d = await tickOffset(page, p, tk);
        expect(d, `${p.id} ${tk.edge} ${tk.n}: a colour change near the tick`).not.toBeNull();
        expect(Math.abs(d), `${p.id} ${tk.edge} ${tk.n}: Ohne Glas offset ${d}`).toBeLessThanOrEqual(1);
      }
    }
    await lens(page, true);
    const offsets = async (label) => {
      st = await refState(page);
      const out = {};
      for (const p of st.panels) {
        const o = outermost(await drawnTicks(page, p.id));
        out[p.id] = {};
        for (const [k, tk] of Object.entries(o)) out[p.id][k] = tk ? await tickOffset(page, p, tk) : null;
      }
      const line = `${label}: ${JSON.stringify(out, (_, v) => (typeof v === 'number' ? Number(v.toFixed(2)) : v))}`;
      console.log('item 25', line);
      test.info().annotations.push({ type: 'item 25', description: line });
      return out;
    };
    const redraw = async (od, os = od) => {
      const gen = (await refState(page)).drawnGen;
      for (const [eye, rx] of [
        ['od', od],
        ['os', os],
      ]) {
        await fillInPlace(page, `#rx-${eye}-sph`, rx.sph);
        await fillInPlace(page, `#rx-${eye}-cyl`, rx.cyl ?? '');
        await fillInPlace(page, `#rx-${eye}-axis`, rx.axis ?? '');
      }
      await refRedrawn(page, gen);
    };
    // (b) OD and OS −1,00, Mit Glas: the outermost left/right ticks ≥ 2 px off; Ohne Glas ± 1 px.
    await redraw({ sph: '-1,00' });
    const mit = await offsets('−1,00 Mit');
    await lens(page, false);
    const ohne = await offsets('−1,00 Ohne');
    await lens(page, true);
    for (const id of ['L', 'R']) {
      for (const k of ['left', 'right']) {
        expect(Math.abs(mit[id][k] ?? 0), `${id} ${k} −1,00 Mit ≥ 2 px`).toBeGreaterThanOrEqual(2);
        expect(Math.abs(ohne[id][k] ?? 99), `${id} ${k} −1,00 Ohne ≤ 1 px`).toBeLessThanOrEqual(1);
      }
    }
    if (SCRATCH) await page.locator('#view-stage').screenshot({ path: `${SCRATCH}/04-09-412-ticks-m100.png` });
    // (d) −1,00: the weak note is hidden.
    await expect(page.locator('#view-ref-size')).not.toContainText('Bei so schwachen Gläsern');
    // (c) 0,00 / −1,00 × 180: left/right ≥ 2 px, the bottom ticks (top/bottom edges) within ± 1 px.
    await redraw({ sph: '0,00', cyl: '-1,00', axis: '180' });
    const cyl = await offsets('0,00 / −1,00 × 180 Mit');
    for (const id of ['L', 'R']) {
      for (const k of ['left', 'right']) expect(Math.abs(cyl[id][k] ?? 0), `${id} ${k} × 180 ≥ 2 px`).toBeGreaterThanOrEqual(2);
      for (const k of ['bottomL', 'bottomR']) expect(Math.abs(cyl[id][k] ?? 99), `${id} ${k} × 180 ≤ 1 px`).toBeLessThanOrEqual(1);
    }
    if (SCRATCH) await page.locator('#view-stage').screenshot({ path: `${SCRATCH}/04-09-412-ticks-cyl180.png` });
    // (d) −0,75 both eyes: the weak note is shown.
    await redraw({ sph: '-0,75' });
    await expect(page.locator('#view-ref-size')).toContainText('Bei so schwachen Gläsern ist der Unterschied im Bild kaum zu sehen.');
  });
});

test.describe('item 25 one panel (320×640)', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test.skip(({ isMobile }) => isMobile, 'the desktop project at 320 × 640');

  test('item 25 320 px: 0,00 / −1,00 × 90 moves the bottom ticks ≥ 2 px, the left/right ticks stay within ± 1 px', async ({ page }) => {
    test.setTimeout(180_000);
    await settledView(page);
    await setRx(page, { sph: '0,00', cyl: '-1,00', axis: '90' });
    await refOn(page);
    const { panels } = await refState(page);
    expect(panels.length).toBe(1);
    const p = panels[0];
    const o = outermost(await drawnTicks(page, p.id));
    const d = {};
    for (const [k, tk] of Object.entries(o)) d[k] = tk ? await tickOffset(page, p, tk) : null;
    const line = `${p.id} ${p.w} × ${p.h} at ${p.pxPerTan.toFixed(2)}: ${JSON.stringify(d)}`;
    console.log('item 25 320', line);
    test.info().annotations.push({ type: 'item 25 320', description: line });
    for (const k of ['bottomL', 'bottomR']) expect(Math.abs(d[k] ?? 0), `${k} ≥ 2 px`).toBeGreaterThanOrEqual(2);
    for (const k of ['left', 'right']) expect(Math.abs(d[k] ?? 99), `${k} ≤ 1 px`).toBeLessThanOrEqual(1);
    if (SCRATCH) await page.locator('#view-stage').screenshot({ path: `${SCRATCH}/04-09-320-ticks-cyl90.png` });
  });
});

// ---------------------------------------------------------------------------------------------
// 04-10 (REF-02, D-15, D-16; UI-SPEC "Degradation", E5, E8): the grid tiers, the measured guard,
// the degraded note and the Technische Angaben lines. The slow samples are made by holding the
// warp worker's reply (holdWarpWorker) for HOLD_MS, so each sample is > the 200 ms budget whatever
// the host; the percentages are engine values and are compared before and after the step.

/** Hold per slow sample: over the 200 ms budget with margin (plan: release after 250 ms). */
const HOLD_MS = 250;
const DEGRADED_TEXT =
  'Vereinfachte Darstellung: Ihr Gerät braucht für das Bild zu lange, deshalb wird es mit weniger Rechenpunkten gezeichnet und wirkt etwas kantiger. Die Prozentwerte sind davon nicht betroffen.';

/** Wait for a sample taken after `n` (the clock's t1 has run). */
async function sampleAfter(page, n) {
  await page.waitForFunction((k) => window.__eyeglassView.ref().sampleN > k, n, { timeout: 120_000 });
}

/** One edit whose job is held HOLD_MS in the worker; resolves after its sample. */
async function slowEdit(page, warp, selector, value) {
  const { sampleN } = await refState(page);
  await warp.hold();
  await fillInPlace(page, selector, value);
  await page.waitForTimeout(HOLD_MS);
  await warp.release();
  await sampleAfter(page, sampleN);
  return refState(page);
}

/** One edit without a hold; resolves after its sample. */
async function plainEdit(page, selector, value) {
  const { sampleN } = await refState(page);
  await fillInPlace(page, selector, value);
  await sampleAfter(page, sampleN);
  return refState(page);
}

const raysOf = (job) => job.replies.reduce((a, r) => a + r.rays, 0);

/**
 * The guard-integration body (desktop and the rim variant): two held edits → one step down, the
 * note, the live text once, the badge; the job after the step carries the lower tier and its reply
 * has fewer rays than the job before it for the same input (M2); the percentages are unchanged;
 * two more edits never step back up.
 * @returns {Promise<{ before: any, after: any, start: string, stepped: string }>}
 */
async function guardRun(page, warp, { values = ['-4,25', '-4,50'], afterValues = ['-4,75', '-5,00'], selector = '#rx-od-sph', eqRays = false } = {}) {
  const st0 = await refState(page);
  const start = st0.tier;
  expect(st0.degraded).toBe(false);
  await expect(page.locator('#view-ref-degraded')).toBeHidden();
  const s1 = await slowEdit(page, warp, selector, values[0]);
  expect(s1.lastSampleCounted, 'the first held edit is a counted sample').toBe(true);
  expect(s1.lastSampleMs).toBeGreaterThan(200);
  expect(s1.tier, 'one slow sample does not step').toBe(start);
  expect(s1.guard.run).toBe(1);
  const s2 = await slowEdit(page, warp, selector, values[1]);
  expect(s2.lastSampleCounted).toBe(true);
  expect(s2.lastSampleMs).toBeGreaterThan(200);
  const stepped = refStepDown(start);
  expect(s2.tier, 'two slow samples in a row: one tier down').toBe(stepped);
  // The step job (same input, lower tier) is drawn: the stale badge goes, the degraded one shows.
  await page.waitForFunction((tier) => window.__eyeglassView.ref().replies[0]?.tier === tier, stepped, { timeout: 120_000 });
  await settledRef(page);
  const st = await refState(page);
  const after = st.replyLog.at(-1);
  const before = st.replyLog.at(-2);
  expect(after.replies.every((r) => r.tier === stepped), 'the posted job carries the lower tier').toBe(true);
  expect(before.replies.every((r) => r.tier === start), 'the job before the step is at the start tier').toBe(true);
  if (eqRays) expect(raysOf(after)).toBeLessThanOrEqual(raysOf(before));
  else expect(raysOf(after), 'M2: a step cuts rays, not only the label').toBeLessThan(raysOf(before));
  await expect(page.locator('#view-ref-degraded')).toBeVisible();
  await expect(page.locator('#view-ref-degraded')).toHaveText(DEGRADED_TEXT);
  await expect(page.locator('#view-ref-degraded svg.icon')).toHaveCount(1);
  await expect(page.locator('#view-ref-live')).toHaveText(DEGRADED_TEXT);
  await expect(page.locator('.view-badge')).toHaveText('Durchblick · vereinfacht');
  const sizeBefore = plain(await page.locator('#view-ref-size').textContent());
  // Two more edits (no hold): never back up; the live text is not rewritten.
  await ev(page, () => {
    window.__liveWrites = 0;
    new MutationObserver((m) => (window.__liveWrites += m.length)).observe(document.getElementById('view-ref-live'), { childList: true, characterData: true, subtree: true });
  });
  for (const v of afterValues) {
    const s = await plainEdit(page, selector, v);
    expect(REF_TIER_ORDER.indexOf(s.tier), `never back up (${s.tier})`).toBeGreaterThanOrEqual(REF_TIER_ORDER.indexOf(stepped));
  }
  expect(await ev(page, () => window.__liveWrites), 'the live text is written once').toBe(0);
  await expect(page.locator('#view-ref-degraded')).toBeVisible();
  // Technische Angaben: the grid line names the path and the step; time and compute lines are set.
  const grid = await page.locator('#tech-ref-grid').textContent();
  expect(grid).toContain(`Stufe ${start} → ${stepped}`);
  expect(grid).toContain('(automatisch vereinfacht, weil die Berechnung zu lange dauerte)');
  await expect(page.locator('#tech-ref-time')).toHaveText(/^Durchblick bis zum Bild zuletzt: \d+,\d\d\u00a0ms$/);
  await expect(page.locator('#tech-ref-compute')).toHaveText(/^davon Rechenzeit im Hintergrund: \d+,\d\d\u00a0ms$/);
  return { before, after, start, stepped, sizeBefore };
}

test.describe(REAL_GUARD, () => {
  test('forced degraded (?refdegraded): note, live text once, badge "Durchblick · vereinfacht", tech grid at the lower tier', async ({ page }) => {
    test.setTimeout(180_000);
    await settledView(page);
    await page.goto('./?refdegraded');
    await settledView(page);
    await refOn(page);
    const st = await refState(page);
    expect(st.tier).toBe(refStepDown(st.startTier));
    expect(st.degraded).toBe(true);
    await expect(page.locator('#view-ref-degraded')).toBeVisible();
    await expect(page.locator('#view-ref-degraded')).toHaveText(DEGRADED_TEXT);
    await expect(page.locator('#view-ref-live')).toHaveText(DEGRADED_TEXT);
    await expect(page.locator('.view-badge')).toHaveText('Durchblick · vereinfacht');
    const r = st.replies[0];
    await expect(page.locator('#tech-ref-grid')).toHaveText(
      `Durchblick-Raster: Stufe ${st.startTier} → ${st.tier}, ${r.nx + 1} × ${r.ny + 1} Punkte je Glas (automatisch vereinfacht, weil die Berechnung zu lange dauerte)`,
    );
    // Ohne Glas keeps its own badge; the note stays.
    await page.locator('#view-ref-lens label', { hasText: 'Ohne Glas' }).click();
    await expect(page.locator('.view-badge')).toHaveText('Durchblick · ohne Glas');
    await expect(page.locator('#view-ref-degraded')).toBeVisible();
    await page.locator('#view-ref-lens label', { hasText: 'Mit Glas' }).click();
    await expect(page.locator('.view-badge')).toHaveText('Durchblick · vereinfacht');
    // Leaving and re-entering does not announce again.
    await page.locator('#view-mode label', { hasText: 'Glas' }).first().click();
    await ev(page, () => {
      window.__liveWrites = 0;
      new MutationObserver((m) => (window.__liveWrites += m.length)).observe(document.getElementById('view-ref-live'), { childList: true, characterData: true, subtree: true });
    });
    await refOn(page);
    await expect(page.locator('#view-ref-degraded')).toBeVisible();
    expect(await ev(page, () => window.__liveWrites)).toBe(0);
  });

  test('a normal session shows no note, the start tier from the device class and the tech lines', async ({ page, isMobile }) => {
    test.setTimeout(120_000);
    await settledView(page);
    await refOn(page);
    const st = await refState(page);
    expect(st.startTier).toBe(isMobile ? 'mittel' : 'fein');
    expect(st.tier).toBe(st.startTier);
    expect(st.degraded).toBe(false);
    expect(st.guardOff, '04-10 tests keep the real guard (no ?refguardoff)').toBe(false);
    expect(st.lastJobExcluded, 'the entry job is a warm-up sample').toBe(true);
    await expect(page.locator('#view-ref-degraded')).toBeHidden();
    await expect(page.locator('#view-ref-live')).toHaveText('');
    await expect(page.locator('.view-badge')).toHaveText('Durchblick · berechnet');
    const r = st.replies[0];
    await expect(page.locator('#tech-ref-grid')).toHaveText(`Durchblick-Raster: Stufe ${st.tier}, ${r.nx + 1} × ${r.ny + 1} Punkte je Glas`);
    await expect(page.locator('#tech-ref-compute')).toHaveText(/^davon Rechenzeit im Hintergrund: \d+,\d\d\u00a0ms$/);
    // The grid matches the tier's cell (REF_GRID_TIERS): nx = ceil(w / cellPx).
    const p = st.panels[0];
    expect(r.nx).toBe(Math.ceil(p.w / REF_GRID_TIERS[st.tier].cellPx));
  });

  test('guard integration: two held samples step one tier down with the note; fast samples never step back up', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the desktop project (fein → mittel); the phone start tier runs in "rim case from mittel"');
    test.setTimeout(300_000);
    await settledView(page);
    const warp = await holdWarpWorker(page);
    await refOn(page);
    const run = await guardRun(page, warp, { values: ['-4,25', '-4,50'], afterValues: ['-4,75', '-4,50'] });
    expect(run.start).toBe('fein');
    // Back at −4,50 OD after two more edits: the size block (engine percentages) is the block shown
    // right after the step for the same Rx.
    expect(plain(await page.locator('#view-ref-size').textContent()), 'the percentages never degrade').toBe(run.sizeBefore);
    const st = await refState(page);
    const line =
      `fein → mittel: rays ${raysOf(run.before)} → ${raysOf(run.after)}; grid ${JSON.stringify(run.after.replies.map(({ nx, ny }) => [nx, ny]))}; ` +
      `counted samples ${JSON.stringify(st.samples.map((x) => Math.round(x)))} ms; tier at the end ${st.tier}`;
    console.log('04-10 guard', line);
    test.info().annotations.push({ type: '04-10 guard', description: line });
  });

  // Round-2 NEW-2 / round-3 MINOR D / round-4 MINOR NEW-14: the mittel → grob step in a rim case.
  // The item-12 box A 40 / B 28 / DBL 14 / PD 40 at −4,00 CR-39 is kept (each value sits at a model
  // limit, never below); the shape is the lever, tried in the order rechteckig, rund, panto.
  // RIM_FRAME = the item-12 frame itself: the mobile project (360 × 780) shows ONE panel of
  // 328 × 246 at 284,06 px/tan (the stage is below 360 px wide), not the two 179 × 270 panels the
  // plan assumed, and there Node gives rimInField true for rechteckig at mittel (2336 rays) and grob
  // (1684 rays), so no shape change is needed. The Node check below fails loudly if the panel drifts.
  const RIM_FRAME = Object.freeze({ shape: 'rechteckig', A: 40, B: 28, DBL: 14, PD: 40 });

  test('guard integration: rim case from mittel (phone start tier, item-12 box) steps to grob and cuts rays', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'needs the phone start tier');
    test.setTimeout(300_000);
    // The app accepts RIM_FRAME: no Außerhalb-des-Modells message, PD in range, a known shape.
    expect(validateFrame({ A: RIM_FRAME.A, B: RIM_FRAME.B, DBL: RIM_FRAME.DBL })).toEqual({ A: null, B: null, DBL: null });
    expect(RIM_FRAME.PD).toBeGreaterThanOrEqual(RX_RANGES.pd[0]);
    expect(RIM_FRAME.PD).toBeLessThanOrEqual(RX_RANGES.pd[1]);
    expect(Object.hasOwn(SHAPES, RIM_FRAME.shape)).toBe(true);
    await settledView(page);
    const warp = await holdWarpWorker(page);
    const frame = { shape: RIM_FRAME.shape, A: RIM_FRAME.A, B: RIM_FRAME.B, DBL: RIM_FRAME.DBL };
    await setFrame(page, frame);
    await setRx(page, { sph: '-4,00' }, { sph: '-4,00' }, String(RIM_FRAME.PD));
    await refOn(page);
    await page.locator('#view-stage').scrollIntoViewIfNeeded();
    await settledRef(page);
    const st = await refState(page);
    expect(st.startTier, 'pickTier mittel → refStartTier mittel').toBe('mittel');
    expect(st.tier).toBe('mittel');
    // Node, at the panel the page reports: the rim is in the field at mittel and at grob.
    const node = {};
    for (const p of st.panels) {
      const ctx = lensOf(p.eye, { sph: -4, cyl: 0, axisDeg: 0 }, { frame, pd: RIM_FRAME.PD });
      for (const tier of ['mittel', 'grob']) {
        const g = warpGrid(ctx, { wPx: p.w, hPx: p.h, pxPerTan: p.pxPerTan }, REF_GRID_TIERS[tier].cellPx, { leafPx: REF_GRID_TIERS[tier].leafPx });
        expect(g.ok).toBe(true);
        expect(g.rimInField, `Node: ${p.eye} ${tier} rim in the field at ${p.w} × ${p.h}`).toBe(true);
        node[`${p.eye} ${tier}`] = { rays: g.rays, rimInField: g.rimInField };
      }
    }
    // Browser, before the first slow sample: every panel's last reply has the rim in the field.
    for (const r of st.replies) expect(r.rimInField, `reply ${r.eye}: rimInField`).toBe(true);
    const eqRays = Object.keys(node).some((k) => k.endsWith('mittel') && node[k].rays === node[k.replace('mittel', 'grob')].rays);
    const run = await guardRun(page, warp, { values: ['-4,25', '-4,00'], afterValues: ['-4,25', '-4,00'], eqRays });
    expect(run.start).toBe('mittel');
    expect(run.stepped).toBe('grob');
    for (const r of run.after.replies) expect(r.rimInField).toBe(true);
    const line =
      `panel ${st.panels.map((p) => `${p.eye} ${p.w} × ${p.h} at ${p.pxPerTan.toFixed(2)}`).join(', ')}; RIM_FRAME ${JSON.stringify(RIM_FRAME)}; ` +
      `Node ${JSON.stringify(node)}; browser mittel ${JSON.stringify(run.before.replies.map(({ eye, rays, rimInField }) => ({ eye, rays, rimInField })))} → grob ${JSON.stringify(run.after.replies.map(({ eye, rays, rimInField }) => ({ eye, rays, rimInField })))}`;
    console.log('04-10 rim', line);
    test.info().annotations.push({ type: '04-10 rim', description: line });
  });
});

// ---------------------------------------------------------------------------------------------
// 04-11 (D-11a, items 26 and NEW-7): the A/B comparison in the Durchblick.

const AB_NOTE = 'Material und Fassung ändern den Durchblick meist nur wenig; der größere Unterschied liegt bei Dicke und Gewicht.';
const AB_SIDE = 'Sie schauen selbst durch Ihr rechtes Glas: links Vorher (A), rechts Nachher (B), gleicher Maßstab.';
const cmpShow = (page, v) => page.locator(`#cmp-show input[name=cmp-show][value=${v}]`);

/**
 * The comparison is drawn in the Durchblick: configuration A computed and every shown panel drawn
 * by the current job (the stage on screen first: no warp job is posted off screen, M4).
 */
async function abReady(page, ids) {
  await settledCompare(page);
  await page.locator('#view-stage').scrollIntoViewIfNeeded();
  await page.waitForFunction(
    (want) => {
      const r = window.__eyeglassView.ref();
      if (!r.compare || r.compare.pending) return false;
      const panels = r.panels.map((p) => p.id).join();
      const drawn = r.replies.map((x) => x.panel).join();
      return panels === want && drawn === want;
    },
    ids.join(),
    { timeout: 60_000 },
  );
  await settledRef(page);
}

test('item 26: comparison in Durchblick: compared eye only, A | B, A then B lines, abNote; "Vergleich beenden" restores the two-eye form', async ({ page }) => {
  test.setTimeout(240_000);
  await settledView(page);
  await setRx(page, { sph: '-4,00' }, { sph: '-4,00' });
  await refOn(page);
  const size = page.locator('#view-ref-size');
  await expect(size).not.toContainText(AB_NOTE);
  const twoEye = (await refState(page)).panels.map((p) => p.id);
  await page.locator('#cmp-start').click();
  await settledCompare(page);
  await page.locator('input[name=material][value=idx174]').check();
  const split = twoEye.length === 2;
  await abReady(page, split ? ['A', 'B'] : ['B']);
  let st = await refState(page);
  // −4,00 both eyes: the thickest points tie, so the right eye (phase-3 rule).
  expect(st.compare.eye).toBe('OD');
  expect(st.panels.every((p) => p.eye === 'OD'), 'the compared eye only').toBe(true);
  await expect(size.locator('.ref-line')).toHaveText([`Vorher (A): Bild etwa 6${N}% kleiner`, `Nachher (B): Bild etwa 6${N}% kleiner`]);
  await expect(size.locator('.ref-note').last()).toHaveText(AB_NOTE);
  await expect(page.locator('#view-ref-eye')).toBeHidden();
  if (split) {
    const [a, b] = st.panels;
    expect(a.x, 'A left').toBeLessThan(b.x);
    expect(a.pxPerTan, 'same scale').toBe(b.pxPerTan);
    expect([a.w, a.h]).toEqual([b.w, b.h]);
    const stage = await page.locator('#view-stage').boundingBox();
    const pillA = await page.locator('#view-labels .ref-pill', { hasText: /^Vorher \(A\)$/ }).boundingBox();
    const pillB = await page.locator('#view-labels .ref-pill', { hasText: /^Nachher \(B\)$/ }).boundingBox();
    expect(pillA.x + pillA.width, 'Vorher (A) pill in the left half').toBeLessThan(stage.x + stage.width / 2);
    expect(pillB.x, 'Nachher (B) pill in the right half').toBeGreaterThan(stage.x + stage.width / 2);
    await expect(page.locator('#view-labels .ref-pill:not(.ref-pill--blocked):visible')).toHaveCount(2);
    await expect(page.locator('#view-ref-side')).toHaveText(AB_SIDE);
    await expect.poll(async () => plain(await page.locator('#view-canvas').getAttribute('aria-label')), { timeout: 5000 }).toContain(
      'Rechtes Glas, links Vorher (A), rechts Nachher (B). Vorher (A): Bild etwa 6 % kleiner. Nachher (B): Bild etwa 6 % kleiner.',
    );
  } else {
    // One panel (stage below 360 px): it follows #cmp-show, Nachher (B) first.
    await expect(page.locator('#view-labels .ref-pill:visible')).toHaveText(['Nachher (B)']);
    await cmpShow(page, 'a').check();
    await abReady(page, ['A']);
    await expect(page.locator('#view-labels .ref-pill:visible')).toHaveText(['Vorher (A)']);
    await expect(page.locator('#view-ref-eye')).toBeHidden();
    await cmpShow(page, 'b').check();
    await abReady(page, ['B']);
    await expect(page.locator('#view-labels .ref-pill:visible')).toHaveText(['Nachher (B)']);
  }
  await page.locator('#cmp-end').click();
  await page.locator('#view-stage').scrollIntoViewIfNeeded();
  await page.waitForFunction(
    (want) => {
      const r = window.__eyeglassView.ref();
      return r.compare === null && r.panels.map((p) => p.id).join() === want && r.replies.map((x) => x.panel).join() === want;
    },
    twoEye.join(),
    { timeout: 60_000 },
  );
  await settledRef(page);
  st = await refState(page);
  expect(st.panels.map((p) => p.id)).toEqual(twoEye);
  await expect(size).not.toContainText(AB_NOTE);
  await expect(size).not.toContainText('Vorher (A)');
  await expect(size.locator('.ref-line').first()).toHaveText(`Rechtes Glas: Bild etwa 6${N}% kleiner`);
  if (split) await expect(page.locator('#view-ref-side')).not.toHaveText(AB_SIDE);
});

test.describe('item 26 at 320×640 (one panel following #cmp-show)', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test.skip(({ isMobile }) => isMobile, 'the mobile project runs the one-panel branch of item 26');

  test('item 26 320 px: one panel, Nachher (B) ↔ Vorher (A) with #cmp-show, no picker, abNote', async ({ page }) => {
    test.setTimeout(240_000);
    await settledView(page);
    await setRx(page, { sph: '-4,00' }, { sph: '-4,00' });
    await refOn(page);
    await page.locator('#cmp-start').click();
    await settledCompare(page);
    await page.locator('input[name=material][value=idx174]').check();
    await abReady(page, ['B']);
    const one = (await refState(page)).panels;
    expect(one).toHaveLength(1);
    await expect(page.locator('#view-ref-eye')).toBeHidden();
    await expect(page.locator('#view-labels .ref-pill:visible')).toHaveText(['Nachher (B)']);
    await expect(page.locator('#view-ref-size .ref-note').last()).toHaveText(AB_NOTE);
    await cmpShow(page, 'a').check();
    await abReady(page, ['A']);
    const a = (await refState(page)).panels;
    expect(a.map((p) => [p.id, p.eye, p.w, p.h, p.pxPerTan])).toEqual([['A', 'OD', one[0].w, one[0].h, one[0].pxPerTan]]);
    await expect(page.locator('#view-labels .ref-pill:visible')).toHaveText(['Vorher (A)']);
    await page.locator('#cmp-end').click();
    await page.locator('#view-stage').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__eyeglassView.ref().compare === null);
    await settledRef(page);
    await expect(page.locator('#view-ref-eye')).toBeVisible();
    await expect(page.locator('#view-ref-size')).not.toContainText(AB_NOTE);
  });
});

// Round-2 NEW-7 / round-3 MINOR E / round-4 MINOR NEW-14: A and B are separate traces, A left.
// AB_FRAME_A = the item-12 box itself (rechteckig A 40 / B 28 / DBL 14, CR-39) with PD 40. Chosen
// in Node (scratch 04-11-abframe.mjs) at the 1280 × 800 panel the handle reports (270 × 338,75 at
// 293,37 px/tan, fein): 10 lattice points (4 px) are class 2/4 for A and class 1 for B, each
// ≥ cellPx + 2 px from a class boundary, so no shape lever (rund 571, panto 331) was needed. PD is
// part of the shared Rx (pipeline.js buildCompareJobs: A = the current spec with A's frame and
// material), so B = the default frame 52 × 38 / 18 also runs at PD 40; Node gives it no class-2/4
// lattice point. At PD 32 (the default) no shape gives a single point, so PD 32 is not usable.
const AB_FRAME_A = Object.freeze({ shape: 'rechteckig', A: 40, B: 28, DBL: 14, PD: 40 });
const AB_MIN_POINTS = 8;
const AB_LATTICE_PX = 4;

test.describe('A/B separate traces (1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.skip(({ isMobile }) => isMobile, 'one panel on the mobile project');

  test('A/B panels are separate traces, A left (NEW-7)', async ({ page }) => {
    test.setTimeout(300_000);
    // The app accepts AB_FRAME_A: no Außerhalb-des-Modells message, PD in range, a known shape.
    expect(validateFrame({ A: AB_FRAME_A.A, B: AB_FRAME_A.B, DBL: AB_FRAME_A.DBL })).toEqual({ A: null, B: null, DBL: null });
    expect(AB_FRAME_A.PD).toBeGreaterThanOrEqual(RX_RANGES.pd[0]);
    expect(AB_FRAME_A.PD).toBeLessThanOrEqual(RX_RANGES.pd[1]);
    expect(Object.hasOwn(SHAPES, AB_FRAME_A.shape)).toBe(true);
    const frameA = { shape: AB_FRAME_A.shape, A: AB_FRAME_A.A, B: AB_FRAME_A.B, DBL: AB_FRAME_A.DBL };
    await settledView(page);
    await setFrame(page, frameA);
    await setRx(page, { sph: '-4,00' }, { sph: '-4,00' }, String(AB_FRAME_A.PD));
    await page.locator('#cmp-start').click();
    await settledCompare(page);
    await setFrame(page, DEFAULT_FRAME);
    await settled(page);
    await refOn(page);
    await abReady(page, ['A', 'B']);
    const st = await refState(page);
    const [pA, pB] = st.panels;
    expect([pA.id, pB.id]).toEqual(['A', 'B']);
    expect(pA.eye).toBe(st.compare.eye);
    expect(pA.pxPerTan).toBe(pB.pxPerTan);
    const geom = await canvasGeom(page);
    const R = REF_GRID_TIERS[st.tier].cellPx + 2;
    const rx = { sph: -4, cyl: 0, axisDeg: 0 };
    const ctxA = lensOf(pA.eye, rx, { frame: frameA, pd: AB_FRAME_A.PD });
    const ctxB = lensOf(pB.eye, rx, { frame: DEFAULT_FRAME, pd: AB_FRAME_A.PD });
    const group = (c) => (c === REF_CLASS.LENS ? 'lens' : c === REF_CLASS.EDGE_BAND || c === REF_CLASS.RIM_FACE ? 'rim' : 'other');
    const at = (ctx, p, x, y) => group(classifyDirection(ctx, ...eyeTan(p, pixelCentre(geom, [x, y]))).cls);
    const stable = (ctx, p, x, y, g) => {
      for (let d = -R; d <= R; d++) {
        if (y + d > p.y && y + d < p.y + p.h && at(ctx, p, x, y + d) !== g) return false;
        if (x + d > p.x && x + d < p.x + p.w && at(ctx, p, x + d, y) !== g) return false;
      }
      return true;
    };
    // Node, at the panel the page reports: the qualifying points (panel offsets) and B's rim-free lattice.
    const offsets = [];
    for (let lx = AB_LATTICE_PX / 2; lx < pA.w; lx += AB_LATTICE_PX) for (let ly = AB_LATTICE_PX / 2; ly < pA.h; ly += AB_LATTICE_PX) offsets.push([lx, ly]);
    const good = offsets.filter(
      ([lx, ly]) =>
        at(ctxA, pA, pA.x + lx, pA.y + ly) === 'rim' &&
        at(ctxB, pB, pB.x + lx, pB.y + ly) === 'lens' &&
        stable(ctxA, pA, pA.x + lx, pA.y + ly, 'rim') &&
        stable(ctxB, pB, pB.x + lx, pB.y + ly, 'lens'),
    );
    const bRimNode = offsets.filter(([lx, ly]) => at(ctxB, pB, pB.x + lx, pB.y + ly) === 'rim').length;
    const panelLine = `panel ${pA.w} × ${pA.h} at ${pA.pxPerTan.toFixed(2)} px/tan (${st.tier}); qualifying points ${good.length}; B rim lattice points (Node) ${bRimNode}`;
    console.log('NEW-7', panelLine);
    test.info().annotations.push({ type: 'NEW-7 Node', description: panelLine });
    expect(good.length, `≥ ${AB_MIN_POINTS} class-2/4-for-A, class-1-for-B points at this panel size`).toBeGreaterThanOrEqual(AB_MIN_POINTS);
    expect(bRimNode, 'B has no class-2/4 lattice point in its panel (precondition)').toBe(0);
    // The replies agree: the rim is in A's field only.
    const rim = Object.fromEntries(st.replies.map((r) => [r.panel, r.rimInField]));
    expect(rim).toEqual({ A: true, B: false });
    // On screen: the qualifying points are rim colour in the LEFT panel, never in the RIGHT one.
    const left = await pixels(page, good.map(([lx, ly]) => [pA.x + lx, pA.y + ly]));
    const right = await pixels(page, good.map(([lx, ly]) => [pB.x + lx, pB.y + ly]));
    const leftRim = left.filter((px) => near(px, RIM)).length;
    const rightRim = right.filter((px) => near(px, RIM)).length;
    // The whole-panel 4 px lattices.
    const latL = await pixels(page, offsets.map(([lx, ly]) => [pA.x + lx, pA.y + ly]));
    const latR = await pixels(page, offsets.map(([lx, ly]) => [pB.x + lx, pB.y + ly]));
    const latLRim = latL.filter((px) => near(px, RIM)).length;
    const latRRim = latR.filter((px) => near(px, RIM)).length;
    const line = `qualifying points rim colour: left ${leftRim} / ${good.length}, right ${rightRim} / ${good.length}; 4 px lattice (${offsets.length} points per panel) rim pixels: left ${latLRim}, right ${latRRim}`;
    console.log('NEW-7', line);
    test.info().annotations.push({ type: 'NEW-7 screen', description: line });
    expect(leftRim, 'rim colour in the LEFT (A) panel at the qualifying points').toBeGreaterThanOrEqual(1);
    expect(rightRim, 'no rim colour in the RIGHT (B) panel at the same points').toBe(0);
    expect(latLRim, 'rim pixels in the left lattice').toBeGreaterThan(0);
    expect(latRRim, 'rim pixels in the right lattice').toBe(0);
  });
});
