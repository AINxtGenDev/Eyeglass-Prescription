// 3D view, slice 4 (03-05, VIZ-01, VIZ-04, VIZ-06): both lenses as glass from the engine
// surfaces, built in the dedicated mesh worker, lazy-loaded after the first result paint.
// 03-06 (D-16, D-17): the no-WebGL, load-failure/retry, blocked-eye and empty states.
import { test, expect } from '@playwright/test';
import { settled, settledView, etmaxOf, guardPage, holdMeshWorker, noThreeWarnings, plain, MESH_WORKER_URL } from './helpers.js';
/* global window */

// Registered before guardPage, so it listens before guardPage's page.goto.
let threeWarnings;
test.beforeEach(({ page }) => {
  threeWarnings = noThreeWarnings(page);
});
const guard = guardPage(test, { view: true });
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
  // The meshes come from the dedicated mesh worker under the sub-path and the site CSP (guardPage
  // fails on CSP console messages and failed requests), not from the main-thread fallback.
  expect(page.workers().some((w) => MESH_WORKER_URL.test(new URL(w.url()).pathname))).toBe(true);
  expect(await page.evaluate(() => window.__eyeglassView.meshMode())).toBe('worker');
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

const VIEW_CHUNK = '**/assets/view-*.js';
const VIEW_CHUNK_RE = /\/assets\/view-[^/]*\.js$/;

test('D-17 no WebGL: the note, and the numbers keep working', async ({ page }) => {
  // Let the first load finish (chunk + workers) before navigating again.
  await settledView(page);
  // ?nowebgl makes createScene throw like a browser without WebGL2; it warns '3D view: no WebGL2'
  // on purpose (asserted below), so that one warning is exempt from noThreeWarnings.
  const all = threeWarnings;
  threeWarnings = () => all().filter((w) => !w.includes('3D view: no WebGL2'));
  await page.goto('./?nowebgl');
  await settledView(page);
  expect(all().some((w) => w.includes('3D view: no WebGL2')), 'the deliberate no-WebGL warning').toBe(true);
  await expect(page.locator('#view-stage')).toContainText('WebGL 2 fehlt');
  await expect(page.locator('#view-status svg.icon')).toHaveCount(1);
  await expect(page.locator('#view')).toHaveAttribute('data-pending', '');
  await expect(page.locator('#result-od-ct')).toHaveText(/^\d+,\d+\smm$/);
  // A minus lens keeps the minimum centre thickness, so the change shows in the thickest point.
  const before = await page.locator('#result-od-thick').textContent();
  await page.locator('#rx-od-sph').fill('-6');
  await settledView(page);
  await expect(page.locator('#result-od-thick')).toHaveText(/^\d+,\d\smm$/);
  await expect(page.locator('#result-od-thick')).not.toHaveText(before ?? '');
  await expect(page.locator('#view-stage')).toContainText('WebGL 2 fehlt');
});

test('D-16 load failure and retry', async ({ page }) => {
  await settledView(page);
  // The aborted chunk request is the point of this test: exempt it from guardPage's
  // failed-request check for this test only (every other failed request still fails it).
  guard.allowFailed(VIEW_CHUNK_RE);
  await page.route(VIEW_CHUNK, (route) => route.abort());
  await page.goto('./');
  await settledView(page);
  const stage = page.locator('#view-stage');
  await expect(stage).toContainText('Die 3D-Ansicht konnte nicht geladen werden.');
  const retry = stage.getByRole('button', { name: 'Erneut versuchen' });
  await expect(retry).toBeVisible();
  await expect(page.locator('#result-od-thick')).toHaveText(/^\d+,\d\smm$/);
  // An input while the message is shown leaves nothing pending for the view.
  await page.locator('#rx-od-sph').fill('-3');
  await settledView(page);
  await expect(retry).toBeVisible();
  await page.unroute(VIEW_CHUNK);
  await retry.click();
  await settledView(page);
  await expect(retry).toHaveCount(0);
  await expect(page.locator('#view-stage')).toBeFocused();
  for (const eye of ['OD', 'OS']) {
    const mesh = await edgeMax(page, eye);
    expect(mesh, `${eye} slot drawn after the retry`).not.toBeNull();
    expect(round1(mesh), eye).toBe(await etmaxOf(page, eye.toLowerCase()));
  }
});

test('VIZ-01 blocked eye: not drawn, labelled, the other eye renders', async ({ page }) => {
  await settledView(page);
  await expect(page.locator('#view-labels .view-label:visible')).toHaveText(['R', 'L']);
  // Zyl set and Achse empty: the left eye has a field error (Fehler), so it is not computed.
  await page.locator('#rx-os-cyl').fill('-1,00');
  await page.locator('#rx-os-axis').fill('');
  await page.locator('#rx-os-axis').blur();
  await settledView(page);
  await expect(page.locator('#rx-os-axis-err')).toBeVisible();
  await expect(page.locator('#view-labels')).toContainText('L – nicht berechnet');
  await expect(page.locator('#view-labels .view-label:visible')).toHaveText(['R', 'L – nicht berechnet']);
  expect(await edgeMax(page, 'OS')).toBeNull();
  const od = await edgeMax(page, 'OD');
  expect(od).not.toBeNull();
  expect(round1(od)).toBe(await etmaxOf(page, 'od'));
  // The labels sit below the lenses inside the stage, R left of L on screen (wearer's right).
  const stage = await page.locator('#view-stage').boundingBox();
  const [r, l] = await page.locator('#view-labels .view-label').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  for (const b of [r, l]) {
    expect(b.left).toBeGreaterThanOrEqual(stage.x);
    expect(b.right).toBeLessThanOrEqual(stage.x + stage.width);
    expect(b.bottom).toBeLessThanOrEqual(stage.y + stage.height);
  }
  expect(r.left).toBeLessThan(l.left);
});

test('VIZ-01 empty: no computable eye', async ({ page }) => {
  await settledView(page);
  await page.locator('#rx-od-sph').fill('');
  await page.locator('#rx-os-sph').fill('');
  await settledView(page);
  expect(plain(await page.locator('#view-caption').textContent())).toBe('Noch keine Gläser – tragen Sie den Sph-Wert ein.');
  expect(await edgeMax(page, 'OD')).toBeNull();
  expect(await edgeMax(page, 'OS')).toBeNull();
  await expect(page.locator('#view-labels .view-label:visible')).toHaveCount(0);
  // Typing a Sph value brings the lens and the glass caption back.
  await page.locator('#rx-od-sph').fill('-2');
  await settledView(page);
  expect(round1(await edgeMax(page, 'OD'))).toBe(await etmaxOf(page, 'od'));
  expect(plain(await page.locator('#view-caption').textContent())).toMatch(/^Visueller Eindruck – /);
});
