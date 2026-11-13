// Fullscreen toggle of the 3D view (user request 2026-11-10): the button in the stage's top-right
// corner fills the screen with the stage, the same button returns. Both paths: the Fullscreen API
// and the CSS fallback for browsers without element fullscreen (iPhone Safari). On the mobile
// project (coarse pointer) fullscreen also switches '3D drehen' on and restores it afterwards.
// 04-12 (F-02, UI-SPEC item 15): in Durchblick and Dickenkarte the mode's info blocks are moved
// into #view-fs-info, the stage's second grid row, and back on exit.
import { test, expect } from '@playwright/test';
import { settledView, settledRef, settledXsec, guardPage, noThreeWarnings } from './helpers.js';
/* global window, document, Document */

let threeWarnings;
test.beforeEach(({ page }) => {
  threeWarnings = noThreeWarnings(page);
});
// 04-11: the Durchblick guard measures but never steps down (?refguardoff); these tests expect
// "Durchblick · berechnet" and test no guard behaviour.
guardPage(test, { view: true, search: '?refguardoff' });
test.afterEach(() => {
  expect(threeWarnings(), 'Three.js / WebGL console warnings').toEqual([]);
});

const btn = (page) => page.locator('#view-fullscreen');
const stageBox = (page) =>
  page.evaluate(() => {
    const s = document.getElementById('view-stage').getBoundingClientRect();
    const c = document.getElementById('view-canvas');
    return { w: Math.round(s.width), h: Math.round(s.height), vw: window.innerWidth, vh: window.innerHeight, cw: c.clientWidth, ch: c.clientHeight };
  });
const fills = (b) => Math.abs(b.w - b.vw) <= 1 && Math.abs(b.h - b.vh) <= 1;

async function roundTrip(page, { css }) {
  await settledView(page);
  await expect(btn(page)).toBeVisible();
  await expect(btn(page)).toHaveAccessibleName('3D-Ansicht im Vollbild');
  const before = await stageBox(page);
  expect(fills(before), JSON.stringify(before)).toBe(false);
  // Top-right corner of the stage.
  const r = await page.evaluate(() => {
    const s = document.getElementById('view-stage').getBoundingClientRect();
    const b = document.getElementById('view-fullscreen').getBoundingClientRect();
    return { right: s.right - b.right, top: b.top - s.top, w: b.width, h: b.height };
  });
  expect(r.right).toBeGreaterThanOrEqual(0);
  expect(r.right).toBeLessThanOrEqual(12);
  expect(r.top).toBeLessThanOrEqual(12);
  expect(r.w).toBeGreaterThanOrEqual(44);
  expect(r.h).toBeGreaterThanOrEqual(44);
  const touch = await page.locator('#view-rotate').isVisible();

  await btn(page).click();
  await expect(btn(page)).toHaveAccessibleName('Vollbild beenden');
  await expect.poll(async () => fills(await stageBox(page)), { timeout: 10_000 }).toBe(true);
  await expect.poll(async () => { const b = await stageBox(page); return b.cw === b.w || b.cw === b.w - 2; }).toBe(true);
  if (css) await expect(page.locator('#view-stage')).toHaveClass(/view-stage--fs/);
  else await expect(page.locator('#view-stage')).not.toHaveClass(/view-stage--fs/);
  if (!css) expect(await page.evaluate(() => document.fullscreenElement?.id)).toBe('view-stage');
  if (touch) await expect(page.locator('#view-rotate')).toHaveAttribute('aria-pressed', 'true');
  // 04-12 (F-02): Glas moves nothing, so the info panel stays hidden.
  await expect(page.locator('#view-fs-info')).toBeHidden();

  await btn(page).click();
  await expect(btn(page)).toHaveAccessibleName('3D-Ansicht im Vollbild');
  await expect.poll(async () => (await stageBox(page)).w, { timeout: 10_000 }).toBe(before.w);
  expect(fills(await stageBox(page))).toBe(false);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  if (touch) await expect(page.locator('#view-rotate')).toHaveAttribute('aria-pressed', 'false');
}

test('fullscreen button: Fullscreen API round trip', async ({ page }) => {
  test.setTimeout(120_000);
  await roundTrip(page, { css: false });
});

// ---- 04-12 (F-02, UI-SPEC "Fullscreen", item 15) ----
const REF_BLOCKS = ['view-hint', 'view-ref-lens', 'view-ref-eye', 'view-ref-size', 'view-ref-scope', 'view-ref-degraded'];
const HEAT_BLOCKS = ['view-legend', 'view-callout-note'];
/** Every id inside #view with its parent, in document order (the DOM order to restore). */
const domOrder = (page) => page.evaluate(() => [...document.querySelectorAll('#view [id]')].map((e) => `${e.parentElement.id || e.parentElement.tagName}>${e.id}`));
const duplicateIds = (page) =>
  page.evaluate(() => {
    const seen = new Set();
    const dup = [];
    for (const e of document.querySelectorAll('[id]')) {
      if (seen.has(e.id)) dup.push(e.id);
      seen.add(e.id);
    }
    return dup;
  });
/** Canvas and info-panel rects, the blocks outside the panel, and the drawing-buffer vs CSS aspect. */
const fsInfo = (page, ids) =>
  page.evaluate((list) => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const c = /** @type {HTMLCanvasElement} */ (document.getElementById('view-canvas'));
    const info = document.getElementById('view-fs-info');
    return {
      canvas: rect(c),
      info: rect(info),
      infoHidden: info.hidden,
      outside: list.filter((id) => document.getElementById(id)?.parentElement !== info),
      order: [...info.children].map((e) => e.id),
      bufferAspect: c.width / c.height,
      cssAspect: c.clientWidth / c.clientHeight,
    };
  }, ids);
const overlapArea = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

async function refOn(page) {
  await page.locator('#view-mode label', { hasText: 'Durchblick' }).click();
  await settledRef(page);
}
async function heatOn(page) {
  await page.locator('#expert').check();
  await settledXsec(page);
  await settledView(page);
  await page.locator('#view-mode label', { hasText: 'Dickenkarte' }).click();
  await page.waitForFunction(() => window.__eyeglassView.mode() === 'heat' && window.__eyeglassView.heatScale() !== null);
}

/** Enter fullscreen and check the moved blocks, unique ids and the two rows (item 15). */
async function enterWithPanel(page, ids) {
  await btn(page).click();
  await expect(btn(page)).toHaveAccessibleName('Vollbild beenden');
  await expect.poll(async () => fills(await stageBox(page)), { timeout: 10_000 }).toBe(true);
  await expect(page.locator('#view-fs-info')).toBeVisible();
  // The canvas re-fits to row 1 (ResizeObserver, one rAF): no stretched picture.
  await expect.poll(async () => {
    const f = await fsInfo(page, ids);
    return Math.abs(f.bufferAspect - f.cssAspect) < 0.01 && f.canvas.y + f.canvas.h <= f.info.y + 0.5;
  }, { timeout: 10_000 }).toBe(true);
  const f = await fsInfo(page, ids);
  expect(f.infoHidden).toBe(false);
  expect(f.outside, 'blocks not inside #view-fs-info').toEqual([]);
  expect(f.order, 'moved in DOM order').toEqual(ids);
  expect(overlapArea(f.canvas, f.info), `info panel ${JSON.stringify(f.info)} covers the canvas ${JSON.stringify(f.canvas)}`).toBe(0);
  expect(f.info.h, 'the panel has a height').toBeGreaterThan(0);
  const vh = await page.evaluate(() => window.innerHeight);
  expect(f.info.h, 'max-height 40 % of the stage').toBeLessThanOrEqual(0.4 * vh + 1);
  expect(await duplicateIds(page), 'duplicate ids').toEqual([]);
  return f;
}

/** Exit and check that the original DOM order is back and the panel is hidden and empty. */
async function exitRestores(page, before) {
  await btn(page).click();
  await expect.poll(async () => fills(await stageBox(page)), { timeout: 10_000 }).toBe(false);
  await expect(page.locator('#view-fs-info')).toBeHidden();
  expect(await page.locator('#view-fs-info > *').count()).toBe(0);
  expect(await domOrder(page), 'DOM order after exit').toEqual(before);
  expect(await duplicateIds(page)).toEqual([]);
}

/** The Bild toggle is operable by keyboard inside fullscreen: button → Tab → the toggle. */
async function bildByKeyboard(page) {
  await btn(page).focus();
  await page.keyboard.press('Tab');
  // A panel taller than its 40 % scrolls and is then itself the first stop (keyboard scrolling).
  const scrolls = await page.locator('#view-fs-info').evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  test.info().annotations.push({ type: 'info panel scrolls', description: String(scrolls) });
  if (scrolls) {
    await expect(page.locator('#view-fs-info')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.locator('#view-fs-info').evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.locator('#view-fs-info').evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.keyboard.press('Tab');
  } else {
    expect(await page.locator('#view-fs-info').getAttribute('tabindex'), 'no Tab stop when it does not scroll').toBeNull();
  }
  expect(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'Tab after the fullscreen button').toBe('view-ref-lens');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('input[name=view-ref-lens][value=off]')).toBeChecked();
  await expect(page.locator('.view-badge')).toHaveText('Durchblick · ohne Glas');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('input[name=view-ref-lens][value=on]')).toBeChecked();
  await expect(page.locator('.view-badge')).toHaveText('Durchblick · berechnet');
}

test('item 15: Durchblick fullscreen moves the toggle, hint and size block into the info panel', async ({ page }) => {
  test.setTimeout(180_000);
  await settledView(page);
  await refOn(page);
  await expect(btn(page)).toHaveAccessibleName('Durchblick im Vollbild');
  const before = await domOrder(page);
  await enterWithPanel(page, REF_BLOCKS);
  await expect(page.locator('#view-fs-info #view-hint')).toBeVisible();
  await expect(page.locator('#view-fs-info #view-ref-size')).toBeVisible();
  // The Durchblick scale is recomputed from the smaller picture row (panels inside the canvas box).
  await settledRef(page);
  const { panels } = await page.evaluate(() => window.__eyeglassView.ref());
  const c = (await fsInfo(page, REF_BLOCKS)).canvas;
  for (const p of panels) expect(p.y + p.h, `panel ${p.id} inside the picture row (${c.h} px)`).toBeLessThanOrEqual(c.h + 0.5);
  await bildByKeyboard(page);
  // A mode change while fullscreen (the switch is behind the stage; the radio is clicked directly).
  await page.evaluate(() => /** @type {HTMLInputElement} */ (document.querySelector('#view-mode input[value=glass]')).click());
  await expect(page.locator('#view-fs-info')).toBeHidden();
  expect((await fsInfo(page, REF_BLOCKS)).outside).toEqual(REF_BLOCKS);
  expect(await domOrder(page), 'Glas in fullscreen: the Durchblick blocks are home').toEqual(before);
  await page.evaluate(() => /** @type {HTMLInputElement} */ (document.querySelector('#view-mode input[value=ref]')).click());
  await expect(page.locator('#view-fs-info')).toBeVisible();
  expect((await fsInfo(page, REF_BLOCKS)).outside).toEqual([]);
  await settledRef(page);
  await exitRestores(page, before);
});

test('item 15: Dickenkarte fullscreen moves the legend and the callout note into the info panel', async ({ page }) => {
  test.setTimeout(180_000);
  await settledView(page);
  await heatOn(page);
  const before = await domOrder(page);
  await enterWithPanel(page, HEAT_BLOCKS);
  await expect(page.locator('#view-fs-info #view-legend')).toBeVisible();
  await exitRestores(page, before);
});

test.describe('without the element Fullscreen API', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
    });
    // guardPage's first load must finish first (an aborted worker fetch counts as a failed request).
    await settledView(page);
    await page.reload();
  });

  test('fullscreen button: CSS fallback round trip', async ({ page }) => {
    test.setTimeout(120_000);
    await roundTrip(page, { css: true });
  });

  test('CSS fallback: Tab stays inside the stage, the page behind is inert (WCAG 2.4.11)', async ({ page }) => {
    test.setTimeout(120_000);
    await settledView(page);
    await btn(page).click();
    await expect.poll(async () => fills(await stageBox(page)), { timeout: 10_000 }).toBe(true);
    await btn(page).focus();
    const reached = new Set();
    for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      reached.add(await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
    }
    // Only the stage and its button (BODY when focus wraps past the end of the document).
    expect([...reached].filter((id) => !['view-stage', 'view-fullscreen', 'BODY'].includes(id))).toEqual([]);
    expect(await page.locator('#view-tools, #rx').evaluateAll((els) => els.map((e) => e.closest('[inert]') !== null))).toEqual([true, true]);
    await btn(page).click();
    await expect.poll(async () => fills(await stageBox(page)), { timeout: 10_000 }).toBe(false);
    expect(await page.locator('[inert]').count()).toBe(0);
    await expect(page.locator('.col-results')).toHaveAttribute('tabindex', '0');
    await expect(btn(page)).toBeFocused();
  });

  test('item 15 (CSS fallback): Durchblick info panel, Tab reaches the Bild toggle inside the stage, Esc restores the DOM', async ({ page }) => {
    test.setTimeout(180_000);
    await settledView(page);
    await refOn(page);
    const before = await domOrder(page);
    await enterWithPanel(page, REF_BLOCKS);
    await expect(page.locator('#view-stage')).toHaveClass(/view-stage--fs/);
    await settledRef(page); // the toggle is enabled again once the new layout's first picture is drawn
    await bildByKeyboard(page);
    // The moved controls are not inert; the page behind still is.
    expect(await page.locator('#view-fs-info').evaluate((el) => el.closest('[inert]') === null)).toBe(true);
    expect(await page.locator('#rx').evaluate((el) => el.closest('[inert]') !== null)).toBe(true);
    // Focus on the toggle while leaving: it stays on the toggle, back in its place.
    await page.locator('input[name=view-ref-lens]:checked').focus();
    await page.keyboard.press('Escape');
    await expect.poll(async () => fills(await stageBox(page)), { timeout: 10_000 }).toBe(false);
    expect(await domOrder(page)).toEqual(before);
    // The new layout disables the toggle until its first picture; focus returns to it (ref-mode.js).
    await settledRef(page);
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('name'))).toBe('view-ref-lens');
    expect(await page.locator('[inert]').count()).toBe(0);
  });

  test('fullscreen button: Esc leaves the CSS fallback', async ({ page }) => {
    test.setTimeout(120_000);
    await settledView(page);
    await btn(page).click();
    await expect.poll(async () => fills(await stageBox(page)), { timeout: 10_000 }).toBe(true);
    await page.keyboard.press('Escape');
    await expect(btn(page)).toHaveAccessibleName('3D-Ansicht im Vollbild');
    await expect.poll(async () => fills(await stageBox(page)), { timeout: 10_000 }).toBe(false);
  });
});
