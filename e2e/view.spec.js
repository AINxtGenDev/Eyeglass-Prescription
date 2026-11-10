// 3D view, slice 4 (03-05, VIZ-01, VIZ-04, VIZ-06): both lenses as glass from the engine
// surfaces, built in the dedicated mesh worker, lazy-loaded after the first result paint.
// 03-06 (D-16, D-17): the no-WebGL, load-failure/retry, blocked-eye and empty states.
// 03-08 (D-10…D-12): eye chart, background probe, quality tiers, context loss, re-mesh time.
import { test, expect } from '@playwright/test';
import { MATERIALS } from '../src/engine/materials.js';
import {
  settled,
  settledView,
  settledCompare,
  etmaxOf,
  guardPage,
  holdMeshWorker,
  noThreeWarnings,
  plain,
  MESH_WORKER_URL,
  backgroundProbe,
  isChart,
} from './helpers.js';
/* global window, document, Worker, requestAnimationFrame */

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
  // 03-08: a canvas corner outside the projected chart shows the clear colour #f3f4f6.
  await backgroundProbe(page);
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
  // A-IN-05 for no-WebGL: no dead preset buttons, no keyboard hint or tab stop, no empty image.
  await expect(page.locator('#view-tools')).toBeHidden();
  await expect(page.locator('#view-keys')).toBeHidden();
  await expect(page.locator('#view-canvas')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#view-stage')).not.toHaveAttribute('tabindex');
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
  // A-IN-05: no dead controls and no empty 'image' next to the message.
  await expect(page.locator('#view-tools')).toBeHidden();
  await expect(page.locator('#view-canvas')).toHaveAttribute('aria-hidden', 'true');
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
  await expect(page.locator('#view-tools')).toBeVisible();
  await expect(page.locator('#view-canvas')).not.toHaveAttribute('aria-hidden', /.*/);
  for (const eye of ['OD', 'OS']) {
    const mesh = await edgeMax(page, eye);
    expect(mesh, `${eye} slot drawn after the retry`).not.toBeNull();
    expect(round1(mesh), eye).toBe(await etmaxOf(page, eye.toLowerCase()));
  }
});

// 03-LC MINOR 2 (A-IN-06): a browser may keep a failed module import failed for the page's life
// (UNVERIFIED for Safari), so a second failure after 'Erneut versuchen' offers 'Seite neu laden',
// which reloads the page (location.reload()).
test('A-IN-06 second chunk failure after the retry offers Seite neu laden', async ({ page }) => {
  await settledView(page);
  guard.allowFailed(VIEW_CHUNK_RE);
  let aborted = 0;
  await page.route(VIEW_CHUNK, (route) => {
    aborted++;
    return route.abort();
  });
  await page.goto('./');
  await settledView(page);
  const stage = page.locator('#view-stage');
  const retry = stage.getByRole('button', { name: 'Erneut versuchen' });
  await expect(retry).toBeVisible();
  await retry.click();
  await settledView(page);
  expect(aborted, 'the chunk failed twice').toBeGreaterThanOrEqual(2);
  await expect(stage).toContainText('Die 3D-Ansicht konnte nicht geladen werden.');
  await expect(retry).toHaveCount(0);
  const reload = stage.getByRole('button', { name: 'Seite neu laden' });
  await expect(reload).toBeVisible();
  await expect(page.locator('#view-tools')).toBeHidden();
  // The click reloads: a marker on window is gone afterwards, and the fresh page offers the retry again.
  await page.evaluate(() => (window.__lcMarker = true));
  await Promise.all([page.waitForEvent('load'), reload.click()]);
  await settledView(page);
  expect(await page.evaluate(() => window.__lcMarker ?? null)).toBeNull();
  await expect(retry).toBeVisible();
});

// A-WR-02 / B-WR-09 (code review): a chunk that loads but whose mount or first update throws is not
// a load failure. No 'Erneut versuchen' (a retry would mount a second view with a second mesh
// worker), the reason is not 'Laden fehlgeschlagen', and nothing stays pending for the view.
test('A-WR-02 mount or update error: no retry, no second mount', async ({ page }) => {
  await settledView(page);
  await page.route(VIEW_CHUNK, (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: "export function mountView() { window.__mounts = (window.__mounts ?? 0) + 1; return { update() { throw new Error('test: update threw'); } }; }",
    }),
  );
  await page.goto('./');
  await settledView(page);
  const stage = page.locator('#view-stage');
  await expect(stage).toContainText('Die 3D-Ansicht ist vorübergehend nicht verfügbar.');
  await expect(stage.getByRole('button', { name: 'Erneut versuchen' })).toHaveCount(0);
  await expect(page.locator('#tech-view-unavailable')).not.toContainText('Laden fehlgeschlagen');
  await expect(page.locator('#tech-view-unavailable')).toContainText('3D-Ansicht nicht verfügbar:');
  await expect(page.locator('#view-tools')).toBeHidden();
  await expect(page.locator('#view-canvas')).toHaveAttribute('aria-hidden', 'true');
  await page.locator('#rx-od-sph').fill('-3');
  await settledView(page);
  await expect(page.locator('#result-od-thick')).toHaveText(/^\d+,\d\smm$/);
  expect(await page.evaluate(() => window.__mounts)).toBe(1);
});

// B-WR-06 (code review): a mesh job that is lost twice (no mesh worker, and the main-thread
// fallback chunk does not load either) shows the load-failure message instead of 'wird aufgebaut'
// forever; the next input builds again and clears it.
test('B-WR-06 mesh build failing twice shows the failure, the next input recovers', async ({ page }) => {
  test.setTimeout(90_000);
  await settledView(page);
  const SYNC_CHUNK = '**/assets/mesh-protocol-*.js';
  guard.allowFailed(MESH_WORKER_URL);
  guard.allowFailed(/\/assets\/mesh-protocol-[^/]*\.js$/);
  await page.route('**/assets/mesh.worker-*.js', (route) => route.abort());
  await page.route(SYNC_CHUNK, (route) => route.abort());
  await page.goto('./');
  await settledView(page);
  const status = page.locator('#view-status');
  await expect(status).toHaveText('Die 3D-Ansicht konnte nicht geladen werden. Die berechneten Werte gelten unverändert.');
  // In Technische Angaben (collapsed): shown means not [hidden].
  await expect(page.locator('#tech-view-unavailable')).not.toHaveAttribute('hidden', /.*/);
  await expect(page.locator('#tech-view-unavailable')).toHaveText('3D-Ansicht nicht verfügbar: Fehler beim Aufbau der Ansicht');
  await expect(page.locator('#result-od-thick')).toHaveText(/^\d+,\d\smm$/);
  await page.unroute(SYNC_CHUNK);
  await page.locator('#rx-od-sph').fill('-3');
  await settledView(page);
  await expect(status).toHaveText('');
  await expect(page.locator('#tech-view-unavailable')).toHaveAttribute('hidden', '');
  expect(await page.evaluate(() => window.__eyeglassView.meshMode())).toBe('sync');
  expect(round1(await edgeMax(page, 'OD'))).toBe(await etmaxOf(page, 'od'));
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
  // Centres, not left edges: 'L – nicht berechnet' is much wider than 'R' (03-07: with the frame
  // and temples in the default fit the lenses sit closer together on screen).
  expect(r.left + r.width / 2).toBeLessThan(l.left + l.width / 2);
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

// ---- 03-07 (VIZ-02, D-06, D-09): the frame ----
const frameInfo = (page) => page.evaluate(() => window.__eyeglassView.frameInfo());
const meshJobs = (page) => page.evaluate(() => window.__eyeglassView.meshJobs());
const memory = (page) => page.evaluate(() => window.__eyeglassView.memory());
const expertOn = async (page) => {
  await page.locator('#expert').check();
  await settledView(page);
};
const rimDepth = async (page, v) => {
  await page.locator('#frame-rim').fill(v);
  await settledView(page);
};
const stamp = async (page, v) => {
  await page.locator('#frame-stamp').fill(v);
  await settledView(page);
};
const cards = (page) =>
  page.evaluate(() => ['od', 'os'].flatMap((e) => ['ct', 'thick'].map((k) => document.getElementById(`result-${e}-${k}`)?.textContent)));

test('VIZ-02 bridge spans DBL', async ({ page }) => {
  await settledView(page);
  let info = await frameInfo(page);
  expect(info.rimVisible).toEqual({ OD: true, OS: true });
  expect(Math.abs(info.bridgeSpanX - 18)).toBeLessThanOrEqual(0.01);
  await page.locator('#frame-dbl').fill('20');
  await settledView(page);
  info = await frameInfo(page);
  expect(Math.abs(info.bridgeSpanX - 20)).toBeLessThanOrEqual(0.01);
});

test('VIZ-02 temple from the stamp', async ({ page }) => {
  await settledView(page);
  const temple = page.locator('#tech-view-temple');
  // The example stamp "52□18 140" counts as from the temple.
  await expect(temple).toContainText('140');
  await expect(temple).toContainText('vom Bügel');
  await stamp(page, '52□18 145');
  let info = await frameInfo(page);
  for (const eye of ['OD', 'OS']) expect(Math.abs(info.templeLen[eye] - 145), eye).toBeLessThanOrEqual(0.1);
  await expect(temple).toContainText('145');
  await expect(temple).toContainText('vom Bügel');
  await expect(page.locator('#tech-view-rimface')).toContainText('angenommener Wert');
  await expect(page.locator('#tech-view-planar')).toHaveText(
    'In der 3D-Ansicht sitzen die Gläser ohne Vorneigung und ohne Fassungsbogen, wie in der Berechnung.',
  );
  await stamp(page, '52□18');
  info = await frameInfo(page);
  for (const eye of ['OD', 'OS']) expect(Math.abs(info.templeLen[eye] - 140), eye).toBeLessThanOrEqual(0.1);
  await expect(temple).toContainText('140');
  await expect(temple).toContainText('angenommener Wert');
  // 03-03 clamp: a stamp temple outside the assumed drawing range is named, never shown as drawn.
  await stamp(page, '52□18 999');
  info = await frameInfo(page);
  for (const eye of ['OD', 'OS']) expect(Math.abs(info.templeLen[eye] - 160), eye).toBeLessThanOrEqual(0.1);
  expect(plain(await temple.textContent())).toBe(
    'Bügellänge in der 3D-Ansicht: 160,0 mm (laut Bügel 999,0 mm, für die Darstellung auf 110,0 mm bis 160,0 mm begrenzt – angenommener Bereich)',
  );
});

test('VIZ-02 rim depth is display only', async ({ page }) => {
  await settledView(page);
  await page.addInitScript(() => {
    window.__computeMsgs = 0;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (msg, ...rest) {
      if (msg?.type === 'compute') window.__computeMsgs++;
      return post.call(this, msg, ...rest);
    };
  });
  await page.reload();
  await settledView(page);
  await expertOn(page);
  expect((await frameInfo(page)).rimDepth).toBe(3);
  const n = await page.evaluate(() => window.__computeMsgs);
  expect(n, 'the counter must see the start-up compute').toBeGreaterThan(0);
  const before = await cards(page);
  await rimDepth(page, '5');
  expect(await page.evaluate(() => window.__computeMsgs)).toBe(n);
  expect((await frameInfo(page)).rimDepth).toBe(5);
  expect(await cards(page)).toEqual(before);
});

test('VIZ-02 blocked eye keeps its rim', async ({ page }) => {
  await settledView(page);
  await page.locator('#rx-os-cyl').fill('-1,00');
  await page.locator('#rx-os-axis').fill('');
  await page.locator('#rx-os-axis').blur();
  await settledView(page);
  await expect(page.locator('#rx-os-axis-err')).toBeVisible();
  expect(await edgeMax(page, 'OS')).toBeNull();
  const info = await frameInfo(page);
  expect(info.rimVisible).toEqual({ OD: true, OS: true });
  expect(info.lensZ.OS).toBe(0); // a blocked eye's rim is flat about the rim plane
});

test('VIZ-02 every shape', async ({ page }) => {
  // Five shape switches, each waiting for its mesh: 30 s was too short on the CI runner (2026-11-10).
  test.setTimeout(120_000);
  await settledView(page);
  const before = await memory(page);
  for (const id of ['rund', 'rechteckig', 'panto', 'pilot', 'rechteckig']) {
    await page.locator(`input[name=frame-shape][value=${id}]`).check();
    await settledView(page);
    const info = await frameInfo(page);
    expect(info.rimVisible, id).toEqual({ OD: true, OS: true });
    for (const eye of ['OD', 'OS']) expect(round1(await edgeMax(page, eye)), `${id} ${eye}`).toBe(await etmaxOf(page, eye.toLowerCase()));
  }
  expect(await memory(page)).toEqual(before);
});

test('VIZ-02 common rim plane (MINOR 9)', async ({ page }) => {
  await settledView(page);
  await page.locator('#rx-od-sph').fill('-2');
  await page.locator('#rx-os-sph').fill('-8');
  await settledView(page);
  const info = await frameInfo(page);
  for (const eye of ['OD', 'OS']) expect(Math.abs(info.lensGroupZ[eye] - info.lensZ[eye]), eye).toBeLessThanOrEqual(1e-6);
  expect(Math.abs(info.lensZ.OD - info.lensZ.OS)).toBeGreaterThan(0.01);
  for (const eye of ['OD', 'OS']) expect(round1(await edgeMax(page, eye)), eye).toBe(await etmaxOf(page, eye.toLowerCase()));
});

test('VIZ-02 per-item keys (round 2 MINOR 7)', async ({ page }) => {
  await settledView(page);
  await expertOn(page);
  await rimDepth(page, '5');
  expect((await meshJobs(page)).at(-1)).toEqual(['frame']);
  await stamp(page, '52□18 145');
  expect((await meshJobs(page)).at(-1)).toEqual(['frame']);
  await page.locator('#rx-od-sph').fill('-2');
  await settledView(page);
  const job = (await meshJobs(page)).at(-1);
  expect(job).toContain('OD');
  expect(job).toContain('frame');
  expect(job).not.toContain('OS');
});

test('VIZ-02 −2 → −3 → −2 while a job is outstanding attaches −2', async ({ page }) => {
  await settledView(page);
  const gate = await holdMeshWorker(page);
  await page.goto('./');
  await settledView(page);
  await page.locator('#rx-od-sph').fill('-2');
  await settledView(page);
  const want = await etmaxOf(page, 'od');
  await gate.hold();
  await page.locator('#rx-od-sph').fill('-3');
  await settled(page);
  await expect(page.locator('#view')).toHaveAttribute('data-pending', 'mesh');
  await page.locator('#rx-od-sph').fill('-2');
  await settled(page);
  await page.evaluate(() => new Promise((res) => setTimeout(res, 50)));
  // Nothing changed against the attached −2 meshes, but the −3 job is outstanding: an empty job
  // makes it stale.
  expect((await meshJobs(page)).at(-1)).toEqual([]);
  await gate.release();
  await settledView(page);
  expect(await etmaxOf(page, 'od')).toBe(want);
  expect(round1(await edgeMax(page, 'OD'))).toBe(want);
});

test('VIZ-02 failed frame keeps lensZ (round 2 MINOR 7)', async ({ page }) => {
  await settledView(page);
  await page.goto('./?failframe=7');
  await settledView(page);
  await page.locator('#rx-od-sph').fill('-2');
  await page.locator('#rx-os-sph').fill('-8');
  await settledView(page);
  await expertOn(page);
  const z = (await frameInfo(page)).lensGroupZ;
  await rimDepth(page, '7');
  let info = await frameInfo(page);
  expect(info.rimVisible).toEqual({ OD: false, OS: false });
  for (const eye of ['OD', 'OS']) {
    expect(Math.abs(info.lensGroupZ[eye] - z[eye]), eye).toBeLessThanOrEqual(1e-6);
    expect(round1(await edgeMax(page, eye)), eye).toBe(await etmaxOf(page, eye.toLowerCase()));
  }
  await expect(page.locator('#tech-view-temple')).toHaveText('');
  await rimDepth(page, '4');
  info = await frameInfo(page);
  expect(info.rimVisible).toEqual({ OD: true, OS: true });
  for (const eye of ['OD', 'OS']) expect(Math.abs(info.lensGroupZ[eye] - info.lensZ[eye]), eye).toBeLessThanOrEqual(1e-6);
});

// ---- 03-08 (VIZ-04, D-10…D-12): studio backdrop, tiers, context loss ----
const view = (page, fn, arg) => page.evaluate(fn, arg);
/**
 * A checker square centre (mm, z = −200) that projects at least 10 px inside the canvas, the one
 * nearest the canvas top-left corner, which is clear of the glasses in the default 3/4 view.
 * 03-09 (A1): the default view is framed closer, so the 03-08 fixed point (255, 95) left the
 * canvas; the square centres of a 20 mm grid over the chart are searched instead.
 */
async function chartProbe(page) {
  return page.evaluate(() => {
    const c = document.getElementById('view-canvas');
    const r = window.__eyeglassView.sceneInfo().chartRect;
    let best = null;
    for (let y = r.y1 - 5; y > r.y0; y -= 20) {
      for (let x = r.x0 + 5; x < r.x1; x += 20) {
        const [px, py] = window.__eyeglassView.project(x, y, -200);
        if (px > 10 && px < c.clientWidth - 10 && py > 10 && py < c.clientHeight - 10 && (!best || px + py < best[0] + best[1])) best = [px, py];
      }
    }
    return best;
  });
}

test('VIZ-04 chart through the glasses', async ({ page }) => {
  await settledView(page);
  const info = await view(page, () => window.__eyeglassView.sceneInfo());
  expect(info.chartZ).toBe(-200);
  expect(info.chartVisible).toBe(true);
  expect(info.shadowVisible).toBe(true);
  // A square centre (not the plan's (250, 150) mm, which is a square corner where the texture
  // filter mixes ink and paper): its pixel is an untone-mapped chart colour.
  const at = await chartProbe(page);
  expect(at, 'a chart square centre inside the canvas').not.toBeNull();
  const px = await view(page, (p) => window.__eyeglassView.pixel(...p), at);
  expect(isChart(px), `chart pixel ${px}`).toBe(true);
  await backgroundProbe(page);
});

test('D-12 tier', async ({ page }, testInfo) => {
  await settledView(page);
  const tierLine = page.locator('#tech-view-tier');
  await expect(page.locator('#tech-view-exact')).toHaveText('Form und Dicke der Gläser sind in jeder Qualitätsstufe gleich genau.');
  if (testInfo.project.name === 'mobile') {
    // The mobile project has hasTouch (Chromium then matches '(pointer: coarse)') and a 360 × 780
    // screen (playwright.config.js), so no media emulation is needed.
    expect(await view(page, () => window.matchMedia('(pointer: coarse)').matches)).toBe(true);
    expect(await view(page, () => window.__eyeglassView.tier())).toBe('mittel');
    await expect(tierLine).toContainText('mittel');
    for (const eye of ['OD', 'OS']) expect(await view(page, (s) => window.__eyeglassView.dispersion(s), eye)).toBe(0);
    expect((await view(page, () => window.__eyeglassView.sceneInfo())).chartSize).toBe('1024x683');
  } else {
    expect(await view(page, () => window.__eyeglassView.tier())).toBe('hoch');
    await expect(tierLine).toContainText('hoch');
    await expect(tierLine).toContainText('Abbe-Zahl νₑ (angenähert)');
    for (const eye of ['OD', 'OS']) {
      const d = await view(page, (s) => window.__eyeglassView.dispersion(s), eye);
      expect(Math.abs(d - 20 / MATERIALS.cr39.ve), eye).toBeLessThanOrEqual(1e-9);
    }
    expect((await view(page, () => window.__eyeglassView.sceneInfo())).chartSize).toBe('2048x1366');
    // A material with another νe changes the dispersion without a reload.
    await material(page, 'idx174').check();
    await settledView(page);
    expect(Math.abs((await view(page, () => window.__eyeglassView.dispersion('OD'))) - 20 / MATERIALS.idx174.ve)).toBeLessThanOrEqual(1e-9);
  }
});

test('context loss', async ({ page }) => {
  await settledView(page);
  const status = page.locator('#view-status');
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
  expect(lost, 'WEBGL_lose_context available').toBe(true);
  await expect(status).toHaveText('Die 3D-Ansicht wird neu aufgebaut …');
  await page.evaluate(
    () =>
      new Promise((res) => {
        const c = document.getElementById('view-canvas');
        c.addEventListener('webglcontextrestored', () => requestAnimationFrame(() => setTimeout(res, 0)), { once: true });
        window.__loseExt.restoreContext();
      }),
  );
  await expect(status).toHaveText('');
  await expect(page.locator('#tech-view-unavailable')).toBeHidden();
  await backgroundProbe(page);
  // The chart texture is drawn again after the restore.
  const at = await chartProbe(page);
  expect(isChart(await view(page, (p) => window.__eyeglassView.pixel(...p), at))).toBe(true);
  for (const eye of ['OD', 'OS']) expect(round1(await edgeMax(page, eye)), eye).toBe(await etmaxOf(page, eye.toLowerCase()));
  // The view keeps working after the restore.
  await page.locator('#rx-od-sph').fill('-5');
  await settledView(page);
  expect(round1(await edgeMax(page, 'OD'))).toBe(await etmaxOf(page, 'od'));
});

test('#tech-view-remesh shows the last 3D re-mesh time', async ({ page }) => {
  await settledView(page);
  await page.locator('#rx-od-sph').fill('-3');
  await settledView(page);
  await expect(page.locator('#tech-view-remesh')).toContainText('3D-Neuaufbau zuletzt:');
  await expect(page.locator('#tech-view-remesh')).toContainText('ms');
});

// ---- 03-15 (UX-03, D-14, R1-8, lens-critic MINOR 5 / 11, round 2 MINOR 1): the bar thumbnail ----
// Phone layout only (below 900 px). The thumbnail is made only while the bar is shown (the result
// cards out of view); with the 3D view on screen the bar is hidden and no thumbnail is needed.
const thumbInfo = (page) => page.evaluate(() => window.__eyeglassView.thumbInfo());
/**
 * A4 (03-16): pixel check of the thumbnail canvas (96×72 device px). cornerBg: share of the four
 * 8×8 corner blocks that are the plain #f3f4f6 background (± 6, as nonBackgroundRatio); with the
 * eye chart in the pass these were checker (≈ 5 % in the 03-15 screenshot). minL / bgL: darkest
 * and background relative luminance (Rec. 709 weights, 0-255), so the rims read darker.
 */
const thumbPixels = (page) =>
  page.locator('.bar-thumb').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const W = c.width;
    const H = c.height;
    const n = 8;
    const lum = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const isBg = (i) => Math.abs(d[i] - 243) <= 6 && Math.abs(d[i + 1] - 244) <= 6 && Math.abs(d[i + 2] - 246) <= 6;
    let bg = 0;
    let all = 0;
    for (const [x0, y0] of [[0, 0], [W - n, 0], [0, H - n], [W - n, H - n]]) {
      for (let y = y0; y < y0 + n; y++) {
        for (let x = x0; x < x0 + n; x++) {
          all++;
          if (isBg((y * W + x) * 4)) bg++;
        }
      }
    }
    let minL = 255;
    for (let i = 0; i < d.length; i += 4) minL = Math.min(minL, lum(i));
    return { cornerBg: bg / all, minL, bgL: 0.2126 * 243 + 0.7152 * 244 + 0.0722 * 246 };
  });
/** A4: the corners are plain background (no checker) and the rims are clearly darker. */
async function expectPlainThumb(page) {
  const px = await thumbPixels(page);
  test.info().annotations.push({ type: 'thumb pixels', description: JSON.stringify(px) });
  expect(px.cornerBg, 'thumbnail corners are the plain background').toBeGreaterThanOrEqual(0.98);
  expect(px.bgL - px.minL, 'rims darker than the background').toBeGreaterThan(100);
}
const camKey = (c) => [c.position.x, c.position.y, c.position.z, c.target.x, c.target.y, c.target.z].join();
/**
 * 03-LC (MINOR 3, A5): headless Chromium renders on SwiftShader (≈ 1 s per thumbnail frame), so
 * the self-timing guard turns the thumbnail off after two frames. The specs that prove the
 * thumbnail itself load the page with ?thumbguardoff (the guard measures but never trips).
 */
async function thumbPage(page) {
  await settledView(page); // guardPage's first load finishes before the next navigation
  await page.goto('./?thumbguardoff');
  await settledView(page);
}
/** Scroll to the top (the Rx fields; the result cards out of view) and wait for the bar. */
async function barShown(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('#summary-bar')).toBeVisible();
}
/**
 * 03-CI: the bar as shown, and the same bar with the thumbnail layout forced on (class thumb-off
 * removed, slot shown; restored in the same task, so nothing paints or fires in between). The
 * product rule (summary-bar.js fitThumb) is font-independent: the thumbnail stays iff the values
 * fit and the label is one line next to it. Which side a font lands on is not (DejaVu Sans on the
 * CI runner is wider than the Noto Sans of a dev machine), so the specs assert the rule.
 */
const measureBar = (page) =>
  page.evaluate(() => {
    const bar = document.getElementById('summary-bar');
    const slot = document.getElementById('bar-view-slot');
    const m = () => {
      const label = document.createRange();
      label.selectNodeContents(document.getElementById('summary-bar-label'));
      const v = document.getElementById('summary-bar-values');
      const r = document.createRange();
      r.selectNodeContents(v);
      const rv = r.getBoundingClientRect();
      return {
        labelLines: new Set([...label.getClientRects()].map((x) => Math.round(x.top))).size,
        need: rv.width,
        have: v.clientWidth,
        right: rv.right,
        barH: bar.getBoundingClientRect().height,
        sw: document.documentElement.scrollWidth,
      };
    };
    const shown = { ...m(), thumb: !slot.hidden, label: document.getElementById('summary-bar-label').textContent, text: document.getElementById('summary-bar-values').textContent };
    const cls = ['thumb-off', 'bar-tight', 'bar-wrap'].filter((c) => bar.classList.contains(c));
    const hid = slot.hidden;
    bar.classList.remove('thumb-off', 'bar-tight', 'bar-wrap');
    slot.hidden = false;
    const withThumb = m();
    bar.classList.add(...cls);
    slot.hidden = hid;
    return { ...shown, withThumb, fitsWithThumb: withThumb.labelLines === 1 && withThumb.need <= withThumb.have + 0.5 };
  });
/** The bar rule at 320 px: thumbnail iff it fits; never clipped, one-line label, no taller than the phase-2 bar. */
function expectBarRule(m) {
  expect(m.thumb, 'thumbnail shown iff the line fits next to it').toBe(m.fitsWithThumb);
  expect(m.labelLines, 'label on one line').toBe(1);
  expect(m.need).toBeLessThanOrEqual(m.have + 0.5);
  expect(m.right).toBeLessThanOrEqual(320);
  expect(m.sw).toBe(320);
  // Not taller than the phase-2 text bar (59,6 px: 8 px padding, 19,6 px label, 24 px values).
  expect(m.barH).toBeLessThanOrEqual(59.6);
}

test.describe('UX-03 bar thumbnail (03-15)', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone layout: mobile project only');

  test('UX-03 lens view stays visible while editing', async ({ page }) => {
    test.setTimeout(90_000);
    await thumbPage(page);
    await barShown(page);
    await page.locator('#rx-od-sph').focus();
    await expect.poll(async () => (await thumbInfo(page)).copies).toBeGreaterThan(0);
    const before = await thumbInfo(page);
    await page.locator('#rx-od-sph').fill('-2,5');
    await settledView(page);
    await expect(page.locator('#summary-bar')).toBeVisible();
    await expect(page.locator('#bar-view-slot')).toBeVisible();
    const box = await page.locator('.bar-thumb').boundingBox();
    expect(Math.abs(box.width - 48)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(box.height - 36)).toBeLessThanOrEqual(0.5);
    const after = await thumbInfo(page);
    expect(after.copies).toBeGreaterThan(before.copies);
    expect(after.passesPerThumbFrame).toBe(2);
    expect(after.nonBackgroundRatio).toBeGreaterThan(0.15);
    for (const eye of ['OD', 'OS']) expect(after.lensWidthPx[eye], eye).toBeGreaterThanOrEqual(16);
    test.info().annotations.push({ type: 'thumb', description: JSON.stringify(after) });
    await expectPlainThumb(page);
    // The thumbnail frame restores the camera: the pose is the same before and after one.
    const cam0 = await page.evaluate(() => window.__eyeglassView.camera());
    await page.evaluate(() => window.__eyeglassView.requestThumb());
    await expect.poll(async () => (await thumbInfo(page)).copies).toBe(after.copies + 1);
    expect(camKey(await page.evaluate(() => window.__eyeglassView.camera()))).toBe(camKey(cam0));
    // The bar's accessible name is unchanged: the canvas is aria-hidden.
    await expect(page.locator('.bar-thumb')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#summary-bar')).toHaveAccessibleName(/^Zum Ergebnis: Dickste Stelle · Gewicht R /);
  });

  // B-WR-03 (code review): no thumbnail is copied while a newer mesh job is in flight (it would show
  // the old mesh and cost a keystroke frame 2 passes); the attach of that job carries it.
  test('B-WR-03 no thumbnail copy while a mesh job is in flight', async ({ page }) => {
    test.setTimeout(90_000);
    await settledView(page); // the first load finishes before the reload (no aborted request)
    const gate = await holdMeshWorker(page);
    await page.goto('./?thumbguardoff');
    await settledView(page);
    await barShown(page);
    await page.locator('#rx-od-sph').focus();
    await expect.poll(async () => (await thumbInfo(page)).copies).toBeGreaterThan(0);
    await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0))));
    const c0 = (await thumbInfo(page)).copies;
    await gate.hold();
    await page.locator('#rx-od-sph').fill('-3');
    await expect(page.locator('#view')).toHaveAttribute('data-pending', 'mesh');
    const p0 = (await thumbInfo(page)).passes;
    await page.evaluate(() => window.__eyeglassView.requestThumb());
    await expect.poll(async () => (await thumbInfo(page)).passes).toBeGreaterThan(p0);
    expect((await thumbInfo(page)).copies, 'no copy while the mesh job is held').toBe(c0);
    await gate.release();
    await settledView(page);
    await expect.poll(async () => (await thumbInfo(page)).copies).toBe(c0 + 1);
    expect((await thumbInfo(page)).passesPerThumbFrame).toBe(2);
  });

  test('UX-03 no thumbnail copy during an orbit', async ({ page }) => {
    // Reduced motion: no damping after the drag, so the camera is at rest at touchEnd. With damping
    // SwiftShader (≈ 0,8 s per frame here) needs > 100 frames to come to rest (factor 0,08 per frame).
    test.setTimeout(90_000);
    await settledView(page); // the first load finishes before the reload (no aborted request)
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./?thumbguardoff');
    await settledView(page);
    // Stage at the top of the viewport: fully on screen ('3D drehen' needs ≥ 50 %) and the result
    // cards above it out of view, so the bar shows.
    await page.evaluate(() => document.getElementById('view-stage').scrollIntoView({ block: 'start' }));
    await expect(page.locator('#summary-bar')).toBeVisible();
    await page.locator('#view-rotate').click();
    await expect(page.locator('#view-rotate')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#summary-bar')).toBeVisible();
    await expect.poll(async () => (await thumbInfo(page)).copies).toBeGreaterThan(0);
    const c0 = (await thumbInfo(page)).copies;
    const box = await page.locator('#view-stage').boundingBox();
    const from = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
    // A thumbnail asked for in the middle of the drag waits until the camera is at rest.
    await page.evaluate(() => window.__eyeglassView.requestThumb());
    const seen = [];
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + 10 * i, y: from.y, id: 1 }] });
      await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
      seen.push((await thumbInfo(page)).copies);
    }
    expect(seen, 'copies during the drag').toEqual(seen.map(() => c0));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await thumbInfo(page)).copies, { timeout: 30_000 }).toBe(c0 + 1);
    expect(await page.evaluate(() => window.__eyeglassView.viewName())).toBe('free');
    await cdp.detach();
  });

  test.describe('split', () => {
    test.use({ viewport: { width: 412, height: 915 } });

    test('UX-03 split crop keeps the layout (MINOR 5)', async ({ page }) => {
      test.setTimeout(180_000);
      await thumbPage(page);
      await page.locator('#cmp-start').click();
      await settledCompare(page);
      await page.locator('input[name=material][value=idx174]').check();
      await settledView(page);
      await page.waitForFunction(() => {
        const c = window.__eyeglassView.compareInfo();
        return c.active && c.aReady && c.split;
      });
      await barShown(page);
      const mem = await page.evaluate(() => window.__eyeglassView.memory());
      const c0 = (await thumbInfo(page)).copies;
      // A re-mesh of B (the shown configuration) with the bar shown.
      await page.locator('#rx-od-sph').fill('-2,5');
      await settledView(page);
      await page.locator('#rx-os-sph').fill('-2,5');
      await settledView(page);
      await expect.poll(async () => (await thumbInfo(page)).copies).toBeGreaterThan(c0);
      const info = await thumbInfo(page);
      test.info().annotations.push({ type: 'thumb split', description: JSON.stringify(info) });
      expect(info.mainViewports).toHaveLength(2);
      expect(info.renderViewports.length).toBeGreaterThan(0);
      const key = (v) => `${v.w}x${v.h}`;
      const split = info.mainViewports.map(key);
      for (const v of info.renderViewports) expect(split, 'thumbnail viewport is a split half').toContain(key(v));
      expect(info.passesPerThumbFrame).toBe(2);
      // The source rectangle lies inside the shown half (Nachher (B), the right half), device px.
      const cv = await page.locator('#view-canvas').evaluate((c) => ({ W: c.clientWidth, H: c.clientHeight, pr: c.width / c.clientWidth }));
      const half = info.mainViewports[1];
      expect(info.src.x).toBeGreaterThanOrEqual((cv.W - half.w) * cv.pr - 0.5);
      expect(info.src.x + info.src.w).toBeLessThanOrEqual(cv.W * cv.pr + 0.5);
      expect(info.src.y + info.src.h).toBeLessThanOrEqual(cv.H * cv.pr + 0.5);
      expect(await page.evaluate(() => window.__eyeglassView.memory())).toEqual(mem);
      for (const eye of ['OD', 'OS']) if (info.lensWidthPx[eye] !== null) expect(info.lensWidthPx[eye], eye).toBeGreaterThanOrEqual(16);
      await expectPlainThumb(page);
    });
  });

  test.describe('320 px', () => {
    test.use({ viewport: { width: 320, height: 640 } });

    test('UX-03 the values are never clipped next to the thumbnail (03-15)', async ({ page }) => {
      test.setTimeout(90_000);
      await thumbPage(page);
      await barShown(page);
      // The longest realistic line: two-digit mm and g on both eyes.
      for (const eye of ['od', 'os']) await page.locator(`#rx-${eye}-sph`).fill('-12');
      await settledView(page);
      await barShown(page);
      // The thumbnail is enabled (first copy); whether it is shown or steps aside is the rule below.
      await expect(page.locator('#summary-bar')).toHaveClass(/has-thumb/);
      const fit = await measureBar(page);
      test.info().annotations.push({ type: 'fit 320', description: JSON.stringify(fit) });
      expect(plain(fit.text)).toMatch(/^R \d+,\d mm · \d+ g \| L \d+,\d mm · \d+ g$/);
      expectBarRule(fit);
    });

    // 03-CI: font-proof, whatever the system font: at 150 % text size the values line fits neither
    // next to the thumbnail nor at 1rem, so the bar takes the tight line and then wraps; never clipped.
    test('03-CI the values are never clipped at a larger text size', async ({ page }) => {
      test.setTimeout(90_000);
      await thumbPage(page);
      for (const eye of ['od', 'os']) await page.locator(`#rx-${eye}-sph`).fill('-12');
      await settledView(page);
      await barShown(page);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '150%';
        window.dispatchEvent(new Event('resize'));
      });
      const m = await measureBar(page);
      test.info().annotations.push({ type: 'fit 320 at 150 %', description: JSON.stringify(m) });
      expect(plain(m.text)).toMatch(/^R \d+,\d mm · \d+ g \| L \d+,\d mm · \d+ g$/);
      expect(m.thumb).toBe(false);
      await expect(page.locator('#summary-bar')).toHaveClass(/bar-wrap/);
      expect(m.need).toBeLessThanOrEqual(m.have + 0.5);
      expect(m.right).toBeLessThanOrEqual(320);
      // (No page scrollWidth check here: at 150 % other page content may reflow wider; this test is the bar.)
    });

    // 03-LC MINOR 6: with a 'Vorher (A):' / 'Nachher (B):' prefix the label must not wrap next to the
    // thumbnail (03-15 rule: the thumbnail steps aside rather than the bar growing or clipping).
    test('MINOR 6 the prefixed bar label never wraps next to the thumbnail', async ({ page }) => {
      test.setTimeout(150_000);
      await thumbPage(page);
      await barShown(page);
      await page.locator('#rx-od-sph').focus();
      await expect.poll(async () => (await thumbInfo(page)).copies).toBeGreaterThan(0);
      await page.locator('#cmp-start').click();
      await settledCompare(page);
      await page.locator('input[name=material][value=idx174]').check();
      await settledView(page);
      for (const which of ['b', 'a']) {
        await page.locator(`#cmp-show input[name=cmp-show][value=${which}]`).check();
        await settledView(page);
        await barShown(page);
        const m = await measureBar(page);
        test.info().annotations.push({ type: `bar 320 ${which}`, description: JSON.stringify(m) });
        expect(plain(m.label)).toMatch(which === 'b' ? /^Nachher \(B\): / : /^Vorher \(A\): /);
        expectBarRule(m);
      }
    });
  });

  // 03-LC MINOR 3 (A5): the guard as shipped. SwiftShader takes far longer than 50 ms per
  // thumbnail frame, so after two of them the thumbnail is off for the session: the slot hidden,
  // the bar the phase-2 text bar, no further copy on edits.
  test('MINOR 3 thumbnail guard: two slow thumbnail frames turn the thumbnail off', async ({ page }) => {
    test.setTimeout(120_000);
    await settledView(page);
    await barShown(page);
    await page.locator('#rx-od-sph').focus();
    const guard = async () => (await thumbInfo(page)).guard;
    await expect.poll(async () => (await guard()).frames).toBeGreaterThan(0);
    for (const v of ['-2,5', '-3']) {
      await page.locator('#rx-od-sph').fill(v);
      await settledView(page);
    }
    await expect.poll(async () => (await guard()).tripped).toBe(true);
    const g = await guard();
    test.info().annotations.push({ type: 'guard', description: JSON.stringify(g) });
    expect(g).toMatchObject({ tripped: true, thresholdMs: 50, run: 2, off: false });
    expect(g.frames).toBe(2);
    expect(g.lastMs).toBeGreaterThan(50);
    await expect(page.locator('#summary-bar')).toBeVisible();
    await expect(page.locator('#bar-view-slot')).toBeHidden();
    await expect(page.locator('#summary-bar')).not.toHaveClass(/has-thumb/);
    expect(plain(await page.locator('#summary-bar-values').textContent())).toMatch(/^R \d+,\d mm · \d+ g \| L \d+,\d mm · \d+ g$/);
    // Off for the session: another edit and an explicit request copy nothing.
    const c0 = (await thumbInfo(page)).copies;
    await page.locator('#rx-od-sph').fill('-3,5');
    await settledView(page);
    await page.evaluate(() => window.__eyeglassView.requestThumb());
    await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
    expect((await thumbInfo(page)).copies).toBe(c0);
    await expect(page.locator('#bar-view-slot')).toBeHidden();
  });

  test('UX-03 no WebGL: the thumbnail slot stays hidden', async ({ page }) => {
    await settledView(page);
    const all = threeWarnings;
    threeWarnings = () => all().filter((w) => !w.includes('3D view: no WebGL2'));
    await page.goto('./?nowebgl');
    await settledView(page);
    await expect(page.locator('#view-stage')).toContainText('WebGL 2 fehlt');
    await barShown(page);
    await page.locator('#rx-od-sph').fill('-2,5');
    await settledView(page);
    await expect(page.locator('#summary-bar')).toBeVisible();
    await expect(page.locator('#bar-view-slot')).toBeHidden();
    await expect(page.locator('#summary-bar')).not.toHaveClass(/has-thumb/);
  });
});
