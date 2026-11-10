// Fullscreen toggle of the 3D view (user request 2026-11-10): the button in the stage's top-right
// corner fills the screen with the stage, the same button returns. Both paths: the Fullscreen API
// and the CSS fallback for browsers without element fullscreen (iPhone Safari). On the mobile
// project (coarse pointer) fullscreen also switches '3D drehen' on and restores it afterwards.
import { test, expect } from '@playwright/test';
import { settledView, guardPage, noThreeWarnings } from './helpers.js';
/* global window, document, Document */

let threeWarnings;
test.beforeEach(({ page }) => {
  threeWarnings = noThreeWarnings(page);
});
guardPage(test, { view: true });
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
