// 3D view, slice 4 (03-05, VIZ-01, VIZ-04, VIZ-06): both lenses as glass from the engine
// surfaces, built in the dedicated mesh worker, lazy-loaded after the first result paint.
import { test, expect } from '@playwright/test';
import { settled, settledView, etmaxOf, guardPage, holdMeshWorker, noThreeWarnings, plain } from './helpers.js';
/* global window */

// Registered before guardPage, so it listens before guardPage's page.goto.
let threeWarnings;
test.beforeEach(({ page }) => {
  threeWarnings = noThreeWarnings(page);
});
guardPage(test);
test.afterEach(() => {
  expect(threeWarnings(), 'Three.js / WebGL console warnings').toEqual([]);
});

const round1 = (v) => Math.round(v * 10) / 10;
const edgeMax = (page, slot) => page.evaluate((s) => window.__eyeglassView.edgeMax(s), slot);
const material = (page, id) => page.locator(`input[name=material][value=${id}]`);

test('VIZ-01 both lenses render at the card edge thickness', async ({ page }) => {
  await settledView(page);
  await expect(page.locator('#view-slot')).toBeVisible();
  const size = await page.locator('#view-canvas').evaluate((c) => [c.clientWidth, c.clientHeight]);
  expect(size[0]).toBeGreaterThan(0);
  expect(size[1]).toBeGreaterThan(0);
  for (const eye of ['OD', 'OS']) {
    const mesh = await edgeMax(page, eye);
    expect(mesh, `${eye} slot drawn`).not.toBeNull();
    expect(round1(mesh), eye).toBe(await etmaxOf(page, eye.toLowerCase()));
  }
});

test('VIZ-04 glass look', async ({ page }) => {
  await settledView(page);
  // No chart yet: the corner shows the clear colour #f3f4f6 (03-08 replaces this probe).
  const px = await page.evaluate(() => window.__eyeglassView.pixel(2, 2));
  for (const [i, want] of [243, 244, 246].entries()) expect(Math.abs(px[i] - want), `channel ${i}: ${px}`).toBeLessThanOrEqual(2);
  await expect(page.locator('.view-badge')).toHaveText('Visueller Eindruck');
  expect(plain(await page.locator('#view-caption').textContent())).toBe(
    'Visueller Eindruck – die Lichtbrechung im Glas ist nur angenähert. Form und Dicke der Gläser sind maßstabsgetreu berechnet.',
  );
  expect(await page.evaluate(() => window.__eyeglassView.ior('OD'))).toBe(1.5);
  await material(page, 'idx174').check();
  await settledView(page);
  expect(await page.evaluate(() => window.__eyeglassView.ior('OD'))).toBe(1.738);
  expect(await page.evaluate(() => window.__eyeglassView.ior('OS'))).toBe(1.738);
});

test('VIZ-06 numbers never wait for the mesh worker (MAJOR 3)', async ({ page }) => {
  // Let guardPage's first load finish (chunk + workers) before navigating again, so no
  // in-flight request is aborted (compare.spec.js precedent).
  await settledView(page);
  const gate = await holdMeshWorker(page);
  await page.goto('./');
  await settledView(page);
  const before = await page.locator('#result-od-thick').textContent();
  await gate.hold();
  await page.locator('#rx-od-sph').fill('-4');
  await settled(page);
  await expect(page.locator('#result-od-thick')).not.toHaveText(before ?? '');
  await expect(page.locator('#result')).toHaveAttribute('data-pending', '');
  await expect(page.locator('#view')).toHaveAttribute('data-pending', 'mesh');
  // The stale mesh stays visible with the badge after 100 ms.
  await expect(page.locator('.view-badge')).toHaveText('3D wird aktualisiert …');
  await gate.release();
  await settledView(page);
  await expect(page.locator('.view-badge')).toHaveText('Visueller Eindruck');
  expect(round1(await edgeMax(page, 'OD'))).toBe(await etmaxOf(page, 'od'));
});
