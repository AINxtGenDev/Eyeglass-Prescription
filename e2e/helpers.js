// Shared e2e helpers (01-15).
import { expect, test } from '@playwright/test';
/* global requestAnimationFrame, self, window, document -- page/worker.evaluate bodies run in the browser */

/**
 * Wait until the page has nothing pending: no input frame scheduled, no eye open in the compute
 * client, no delivered result unpainted (#result[data-pending] = ''), then one more frame so the
 * paint is done. Playwright's fill/selectOption dispatch input/change synchronously, so 'input'
 * is already in the set when this runs.
 * @param {import('@playwright/test').Page} page
 */
export async function settled(page, { timeout = 10_000 } = {}) {
  await expect(page.locator('#result')).toHaveAttribute('data-pending', '', { timeout });
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0))));
}

/**
 * settled(), then wait until the comparison lane has nothing pending either (02-07):
 * #compare[data-pending] = '' (no compare job open, none delivered but unpainted), then one more
 * frame. After settled() the input frame has run, so a changed main input has already queued its
 * compare jobs.
 * @param {import('@playwright/test').Page} page
 */
export async function settledCompare(page, { timeout = 10_000 } = {}) {
  await settled(page, { timeout });
  await expect(page.locator('#compare')).toHaveAttribute('data-pending', '', { timeout });
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0))));
}

/**
 * settledCompare(), then wait until the cross-section has nothing pending (02-13):
 * #xsec[data-pending] = '' (no profile job open, none delivered but unpainted), then one more
 * frame. The compare paint requests the profile synchronously, so after settledCompare() a needed
 * profile is already marked pending.
 * @param {import('@playwright/test').Page} page
 */
export async function settledXsec(page, { timeout = 10_000 } = {}) {
  await settledCompare(page, { timeout });
  await expect(page.locator('#xsec')).toHaveAttribute('data-pending', '', { timeout });
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0))));
}

/**
 * settled(), then wait until the 3D view has nothing pending (03-05): #view[data-pending] = ''
 * (the lazy chunk loaded and the latest mesh request is attached), then one more frame.
 * Three.js and the first mesh can take a few seconds on CI, hence the 15 s default.
 * @param {import('@playwright/test').Page} page
 */
export async function settledView(page, { timeout = 15_000 } = {}) {
  await settled(page, { timeout });
  await expect(page.locator('#view')).toHaveAttribute('data-pending', '', { timeout });
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0))));
}

// Chromium's own GL driver performance notes ("GL Driver Message (OpenGL, Performance, …): GPU
// stall due to ReadPixels"). They appear in tests that never call readPixels: three.js r187 calls
// gl.readPixels only in readRenderTargetPixels(Async), which the app does not use, so they come
// from the headless browser reading the canvas back for its compositor. Not an app message.
const DRIVER_PERF_NOTE = /GL Driver Message \(OpenGL, Performance,/;

/**
 * Collect console errors and warnings from Three.js or WebGL (03-05). Register before the page
 * loads (a beforeEach that runs before guardPage's). Returns a getter for the collected texts.
 * @param {import('@playwright/test').Page} page
 * @returns {() => string[]}
 */
export function noThreeWarnings(page) {
  const seen = [];
  page.on('console', (m) => {
    const text = m.text();
    if ((m.type() === 'error' || m.type() === 'warning') && /THREE|WebGL|GL_/.test(text) && !DRIVER_PERF_NOTE.test(text)) {
      seen.push(`${m.type()}: ${text}`);
    }
  });
  return () => [...seen];
}

/**
 * Numeric value of #result-<eye>-etmax ("2,8 mm" → 2.8); NaN when the cell shows no number.
 * Since 02-01 this is the 'Dickster Rand' technical row (the edge value). Callers that mean the
 * shown thickest point use thickOf; perf-throttled discriminator() stays on the edge on purpose.
 * @param {import('@playwright/test').Page} page @param {'od'|'os'} eye
 */
export async function etmaxOf(page, eye) {
  const text = (await page.locator(`#result-${eye}-etmax`).textContent()) ?? '';
  const m = text.match(/^(\d+,\d)/);
  return m ? Number(m[1].replace(',', '.')) : Number.NaN;
}

/** Engine worker bundle under the sub-path (vite names it engine.worker-<hash>.js). */
export const WORKER_URL = /\/assets\/engine\.worker[^/]*\.js$/;
/**
 * Mesh worker bundle (03-04): a second worker, mesh.worker-<hash>.js. Tests that block or slow
 * "the worker" mean the engine worker (WORKER_URL); tests that block both route both patterns.
 * The lazy view chunk creates it after the first result paint (03-05).
 */
export const MESH_WORKER_URL = /\/assets\/mesh\.worker[^/]*\.js$/;

/**
 * Serve the real worker with messages of the given types delayed by delayMs (default only
 * `result`; READY, bench and error are never delayed). 02-07: `types: ['compare']` delays the
 * comparison lane only. Must be called before page.goto.
 * @param {import('@playwright/test').Page} page @param {number} delayMs
 * @param {{ types?: string[] }} [opts]
 */
export async function slowWorker(page, delayMs, { types = ['result'] } = {}) {
  const patch =
    `{const post = self.postMessage.bind(self); const slow = ${JSON.stringify(types)};` +
    `self.postMessage = (m, ...rest) => { if (m && slow.includes(m.type)) setTimeout(() => post(m, ...rest), ${Number(delayMs)}); else post(m, ...rest); };}\n`;
  await page.route(WORKER_URL, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: patch + body });
  });
}

/**
 * Serve the real worker with a test-controlled hold on `result` messages (02-08). While held,
 * results are queued inside the worker; release() posts them in order. Unlike slowWorker's
 * fixed delay, the busy window lasts exactly until the test releases it, so slow steps inside
 * the window (axe under load) cannot outlast it. Hold no longer than WATCHDOG_MS (10 s), or the
 * client falls back to direct computation. Must be called before page.goto.
 * @param {import('@playwright/test').Page} page
 */
export async function holdWorker(page) {
  const patch =
    '{const post = self.postMessage.bind(self); const q = []; self.__hold = false;' +
    'self.__release = () => { self.__hold = false; while (q.length) post(...q.shift()); };' +
    "self.postMessage = (m, ...rest) => { if (self.__hold && m && m.type === 'result') q.push([m, ...rest]); else post(m, ...rest); };}\n";
  await page.route(WORKER_URL, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: patch + body });
  });
  const worker = () => {
    const w = page.workers().find((x) => WORKER_URL.test(new URL(x.url()).pathname));
    if (!w) throw new Error('holdWorker: engine worker not found');
    return w;
  };
  return {
    hold: () => worker().evaluate(() => {
      self.__hold = true;
    }),
    release: () => worker().evaluate(() => self.__release()),
  };
}

/**
 * Serve the real mesh worker (03-04/03-05) with a test-controlled hold on its 'mesh' replies:
 * while held, replies are queued inside the worker; release() posts them in order (with their
 * transfer lists). READY is never held. Hold no longer than MESH_WATCHDOG_MS (10 s), or the mesh
 * client falls back to the main thread. Must be called before page.goto.
 * @param {import('@playwright/test').Page} page
 */
export async function holdMeshWorker(page) {
  const patch =
    '{const post = self.postMessage.bind(self); const q = []; self.__hold = false;' +
    'self.__release = () => { self.__hold = false; while (q.length) post(...q.shift()); };' +
    "self.postMessage = (m, ...rest) => { if (self.__hold && m && m.type === 'mesh') q.push([m, ...rest]); else post(m, ...rest); };}\n";
  await page.route(MESH_WORKER_URL, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: patch + body });
  });
  const worker = () => {
    const w = page.workers().find((x) => MESH_WORKER_URL.test(new URL(x.url()).pathname));
    if (!w) throw new Error('holdMeshWorker: mesh worker not found');
    return w;
  };
  return {
    hold: () => worker().evaluate(() => {
      self.__hold = true;
    }),
    release: () => worker().evaluate(() => self.__release()),
  };
}

/** Text without soft hyphens (U+00AD, RESEARCH Pitfall 6) and with NBSP / narrow NBSP as spaces. */
export function plain(s) {
  return (s ?? '').replace(/\u00AD/g, '').replace(/[\u00A0\u202F]/g, ' ');
}

/**
 * Test-only (03-05): the page never loads the 3D view (pipeline.js reads window.__eyeglassNo3d
 * once at load). Headless Chromium renders WebGL with SwiftShader on the CPU; with the view in
 * every test, 8 parallel workers starve each other and timing-based tests of the numbers path
 * fail although each passes alone (measured 2026-11-08). The view's own specs (view, layout,
 * a11y) keep it; VIZ-06 proves the numbers never wait for the mesh worker. Before page.goto.
 * @param {import('@playwright/test').Page} page
 */
export async function without3d(page) {
  await page.addInitScript(() => {
    window.__eyeglassNo3d = true;
  });
}

/**
 * Register the smoke.spec guard harness for the calling spec file: every test fails on a 4xx/5xx
 * response, a failed request, a request to another origin or a CSP console message. Each test
 * starts on the app page ('./'). 03-05: without the 3D view unless `view: true` (without3d).
 * 03-06: the returned allowFailed(re) exempts failed requests whose URL matches re, for the
 * current test only (a test that aborts a request on purpose).
 * @param {typeof import('@playwright/test').test} test
 * @param {{ view?: boolean }} [opts]
 * @returns {{ allowFailed: (re: RegExp) => void }}
 */
export function guardPage(test, { view = false } = {}) {
  /** @type {{ bad: string[], failed: string[], foreign: string[], csp: string[] }} */
  let seen;
  /** @type {RegExp[]} */
  let allowed = [];
  test.beforeEach(async ({ page, baseURL }) => {
    const origin = new URL(baseURL).origin;
    seen = { bad: [], failed: [], foreign: [], csp: [] };
    allowed = [];
    page.on('response', (r) => {
      if (r.status() >= 400) seen.bad.push(`${r.status()} ${r.url()}`);
    });
    page.on('requestfailed', (r) => seen.failed.push(`${r.failure()?.errorText} ${r.url()}`));
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.protocol.startsWith('http') && url.origin !== origin) seen.foreign.push(r.url());
    });
    page.on('console', (m) => {
      if (m.text().includes('Content Security Policy')) seen.csp.push(m.text());
    });
    if (!view) await without3d(page);
    await page.goto('./');
    expect(page.url()).toMatch(/\/Eyeglass-Prescription\/$/);
  });
  test.afterEach(() => {
    expect(seen.bad, 'responses with status >= 400').toEqual([]);
    const failed = seen.failed.filter((f) => !allowed.some((re) => re.test(f.split(' ').at(-1) ?? '')));
    expect(failed, 'failed requests').toEqual([]);
    expect(seen.foreign, 'requests to other origins').toEqual([]);
    expect(seen.csp, 'CSP violations').toEqual([]);
  });
  return {
    allowFailed: (re) => {
      allowed.push(re);
    },
  };
}

/**
 * Numeric value of the card's thickest point #result-<eye>-thick ("4,6 mm" → 4.6; thickest(m) =
 * max(CT, edge)); NaN when it shows no number. etmaxOf above reads the 'Dickster Rand' edge row.
 * @param {import('@playwright/test').Page} page @param {'od'|'os'} eye
 */
export async function thickOf(page, eye) {
  const text = (await page.locator(`#result-${eye}-thick`).textContent()) ?? '';
  const m = text.match(/^(\d+,\d)/);
  return m ? Number(m[1].replace(',', '.')) : Number.NaN;
}

/**
 * Replace the 02-01 example with the phase-1 start values the older specs were pinned on: Sph
 * '-2,00' both eyes, Zyl/Achse empty, PD 32 both eyes (Rechteckig 52×38/18, CR-39 unchanged).
 * Removes the example banner, so it cannot shift the layout later. Waits until settled.
 * @param {import('@playwright/test').Page} page
 */
export async function sphOnly(page) {
  await page.locator('#example-clear').click();
  for (const eye of ['od', 'os']) {
    await page.locator(`#rx-${eye}-pd`).fill('32');
    await page.locator(`#rx-${eye}-sph`).fill('-2,00');
  }
  await settled(page);
}

// ---- 03-08 (D-10): the eye chart covers part of the canvas ----
/** UI-SPEC colours: studio background #f3f4f6, chart ink #1a1a1a and paper #ffffff. */
const BACKGROUND = [243, 244, 246];
const INK = [26, 26, 26];
const PAPER = [255, 255, 255];
const near = (px, want, tol) => want.every((w, i) => Math.abs(px[i] - w) <= tol);
export const isChart = (px) => near(px, INK, 3) || near(px, PAPER, 3);
/**
 * 03-09 A2: a chart pixel seen at a distance can be a filtered mix of ink and paper (a neutral
 * grey), but never the studio background: neutral (r, g, b within 4) and not #f3f4f6 ± 6.
 */
export const isChartish = (px) =>
  !near(px, BACKGROUND, 6) && Math.abs(px[0] - px[1]) <= 4 && Math.abs(px[1] - px[2]) <= 4 && px[0] <= 255;
/** Chart plane corners (mm, z = −200) from the view's current chart rectangle (03-09 A2). */
const chartCorners = ({ x0, x1, y0, y1 }) => [
  [x0, y1],
  [x1, y1],
  [x1, y0],
  [x0, y0],
];
/** Point-in-convex-quad: p on the same side of all four edges (either winding). */
function inQuad(p, q) {
  const s = q.map((a, i) => {
    const b = q[(i + 1) % 4];
    return Math.sign((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  });
  return s.every((v) => v >= 0) || s.every((v) => v <= 0);
}

/**
 * 03-08 background probe (lens-critic MINOR 12): the first canvas corner (2 px inset) outside the
 * projected chart quad must show #f3f4f6 ± 2. If the chart covers all 4 corners (the 03-09 A2
 * default), the corner pixel must be a chart pixel instead (isChartish: at a distance the
 * mipmapped checker can read as a neutral grey), and the test is annotated.
 */
export async function backgroundProbe(page) {
  const rect = await page.evaluate(() => window.__eyeglassView.sceneInfo().chartRect);
  const { quad, size } = await page.evaluate(
    (corners) => ({
      quad: corners.map(([x, y]) => window.__eyeglassView.project(x, y, -200)),
      size: (({ clientWidth, clientHeight }) => [clientWidth, clientHeight])(document.getElementById('view-canvas')),
    }),
    chartCorners(rect),
  );
  const [w, h] = size;
  const canvasCorners = [
    [2, 2],
    [w - 3, 2],
    [w - 3, h - 3],
    [2, h - 3],
  ];
  const free = canvasCorners.find((c) => !inQuad(c, quad));
  if (free) {
    const px = await page.evaluate(([x, y]) => window.__eyeglassView.pixel(x, y), free);
    expect(near(px, BACKGROUND, 2), `background at ${free}: ${px}`).toBe(true);
    return;
  }
  test.info().annotations.push({ type: 'note', description: 'chart covers the canvas' });
  const px = await page.evaluate(() => window.__eyeglassView.pixel(2, 2));
  expect(isChartish(px), `chart pixel at the corner: ${px}`).toBe(true);
}
