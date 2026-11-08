// 3D view, slice 4 (03-05, VIZ-01, VIZ-04, VIZ-06): both lenses as glass from the engine
// surfaces, built in the dedicated mesh worker, lazy-loaded after the first result paint.
// 03-06 (D-16, D-17): the no-WebGL, load-failure/retry, blocked-eye and empty states.
// 03-08 (D-10…D-12): eye chart, background probe, quality tiers, context loss, re-mesh time.
import { test, expect } from '@playwright/test';
import { MATERIALS } from '../src/engine/materials.js';
import {
  settled,
  settledView,
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
/** A checker square centre (mm) above the frame and off to the side, clear of the glasses. */
const CHART_PROBE = [255, 95, -200];

test('VIZ-04 chart through the glasses', async ({ page }) => {
  await settledView(page);
  const info = await view(page, () => window.__eyeglassView.sceneInfo());
  expect(info.chartZ).toBe(-200);
  expect(info.chartVisible).toBe(true);
  expect(info.shadowVisible).toBe(true);
  // A square centre (not the plan's (250, 150) mm, which is a square corner where the texture
  // filter mixes ink and paper): its pixel is an untone-mapped chart colour.
  const at = await view(page, (p) => window.__eyeglassView.project(...p), CHART_PROBE);
  const size = await page.locator('#view-canvas').evaluate((c) => [c.clientWidth, c.clientHeight]);
  expect(at[0] > 0 && at[0] < size[0] && at[1] > 0 && at[1] < size[1], `probe ${at} inside ${size}`).toBe(true);
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
  const at = await view(page, (p) => window.__eyeglassView.project(...p), CHART_PROBE);
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
