// Service worker and offline (04-06; D-18, D-19, D-22, D-23, D-25, OFF-01, N12; UI-SPEC
// Verification items 17 and 18). Runs only in Playwright project 'pwa' (serviceWorkers allowed),
// against the PRODUCTION dist on the switch server (e2e/support/switch-server.js, port 4175), or
// against the live site with PWA_BASE_URL (`npm run test:pwa:live`, verify-live).
// No test handle here: the production build has none (04-02), and the @live tests run on Pages.
//
// Rules for this file:
// - A test whose title contains @live must work against the live site: no switch server, no
//   build files, no test handle.
// - The switch-server-only tests (04-14) go into one test.describe('switch server only', …) with
//   test.skip(LIVE, 'needs the local switch server'); 04-14 creates that describe.
// - Pitfall 10: offline means context.setOffline(true) AND every request route-aborted, and the
//   served responses are asserted to come from the service worker (fromServiceWorker()), so a
//   cache miss fails the test instead of reaching a server.
import { test, expect } from '@playwright/test';
import { settled, settledView } from './helpers.js';
import { swKillEffective } from '../sw-kill-switch.js';
import DE from '../src/i18n/de-AT.js';
/* global window, document, location -- page.evaluate bodies run in the browser */

// Read by the 'switch server only' describe that 04-14 adds (test.skip(LIVE, …)).
// eslint-disable-next-line no-unused-vars -- used from 04-14 on
const LIVE = Boolean(process.env.PWA_BASE_URL);
// NEW-1: the same effective flag the build used. In CI the env var is never set, so KILL equals
// SW_SELF_DESTROY; with the flag on there is no worker to test and the worker-dependent tests skip.
const KILL = swKillEffective(process.env);

// Must equal vite.config.js CSP exactly (copied from e2e/worker.spec.js, T-01-39).
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  "object-src 'none'; base-uri 'self'; form-action 'none'";

const READY = DE['tech.offline.ready'];
const VIEW_CHUNK_RE = /\/assets\/view-[^/]*\.js$/;
const VIEW_LOAD_FAILED = DE['view.loadFailed'];

/** Wait until #tech-offline reads the ready line and a service worker controls the page. */
async function ready(page) {
  await expect(page.locator('#tech-offline')).toHaveText(READY, { timeout: 30_000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
}

/** Cut the network both ways (Pitfall 10): offline, and every request that still goes out aborted. */
async function goOffline(context) {
  await context.setOffline(true);
  await context.route('**/*', (route) => route.abort());
}

/** Record every response from now on. */
function recordResponses(page) {
  const seen = [];
  page.on('response', (r) => seen.push(r));
  return seen;
}

const viewResponses = (seen) => seen.filter((r) => VIEW_CHUNK_RE.test(new URL(r.url()).pathname));

test('offline after one visit (item 17) @live', async ({ page, context }) => {
  test.skip(KILL, 'kill switch on');
  test.setTimeout(120_000);
  await page.goto('./');
  await settled(page);
  await ready(page);

  await goOffline(context);
  const seen = recordResponses(page);
  const nav = await page.reload();
  expect(nav, 'navigation response').not.toBeNull();
  expect(nav.fromServiceWorker(), 'navigation served by the service worker').toBe(true);
  await settled(page);
  // The controller path: onOfflineReady does not fire on a later visit.
  await expect(page.locator('#tech-offline')).toHaveText(READY, { timeout: 30_000 });

  const thick = page.locator('#result-od-thick');
  const before = await thick.textContent();
  await page.locator('#rx-od-sph').fill('-5,25');
  await settled(page);
  await expect(thick).toHaveText(/^\d+,\d\smm$/);
  await expect(thick).not.toHaveText(before ?? '');

  await settledView(page, { timeout: 60_000 });
  // The canvas stays visible in the load-failure state too, so the message is checked explicitly.
  await expect(page.locator('#view-stage')).not.toContainText(VIEW_LOAD_FAILED);
  await expect(page.locator('#view-canvas')).toBeVisible();
  const view = viewResponses(seen);
  expect(view.length, 'the 3D chunk was requested after the offline reload').toBeGreaterThan(0);
  for (const r of view) expect(r.fromServiceWorker(), r.url()).toBe(true);
});

test('scope and manifest (D-18) @live', async ({ page }) => {
  await page.goto('./');
  if (KILL) {
    test.info().annotations.push({ type: 'skip', description: 'scope assertion: kill switch on' });
  } else {
    const scope = await page.evaluate(async () => ({ scope: (await navigator.serviceWorker.ready).scope, origin: location.origin }));
    expect(scope.scope).toBe(scope.origin + '/Eyeglass-Prescription/');
  }
  const manifest = await page.evaluate(async () => {
    const link = /** @type {HTMLLinkElement} */ (document.querySelector('link[rel="manifest"]'));
    return (await fetch(link.href)).json();
  });
  expect(manifest.scope).toBe('/Eyeglass-Prescription/');
  expect(manifest.start_url).toBe('/Eyeglass-Prescription/');
});

// The page shows the example Rx at load (D-26), so its first paint starts the registration; the
// idle fallback for a page without a result is covered by src/ui/sw-core.test.js.
test('registers without input within 5 s of load (item 18)', async ({ page }) => {
  test.skip(KILL, 'kill switch on');
  await page.goto('./');
  const ms = await page.evaluate(async () => {
    const navEntry = /** @type {PerformanceNavigationTiming} */ (performance.getEntriesByType('navigation')[0]);
    while (!(await navigator.serviceWorker.getRegistration())) await new Promise((res) => window.setTimeout(res, 50));
    return performance.now() - navEntry.loadEventEnd;
  });
  expect(ms).toBeLessThan(5000);
});

// N12 / Pitfall 7: on a first visit the page was not controlled at navigation; clientsClaim must
// make it controlled once the worker is active, so a lazy chunk fetched later comes from the
// cache. The example at load (D-26) loads the 3D chunk with the first paint, so here the page's
// own request for it is aborted while online (the worker's precache request passes); the 3D chunk
// is then first loaded offline, by 'Erneut versuchen', after the first Sph was typed.
test('first visit, offline before the 3D view (N12)', async ({ page, context }) => {
  test.skip(KILL, 'kill switch on');
  test.setTimeout(120_000);
  await context.route(VIEW_CHUNK_RE, (route) => (route.request().serviceWorker() ? route.fallback() : route.abort()));
  await page.goto('./');
  await settled(page);
  const stage = page.locator('#view-stage');
  await expect(stage).toContainText(VIEW_LOAD_FAILED, { timeout: 30_000 });
  await ready(page);

  await goOffline(context);
  const seen = recordResponses(page);
  const thick = page.locator('#result-od-thick');
  const before = await thick.textContent();
  await page.locator('#rx-od-sph').fill('-5,25');
  await settled(page);
  await expect(thick).toHaveText(/^\d+,\d\smm$/);
  await expect(thick).not.toHaveText(before ?? '');

  await stage.getByRole('button', { name: 'Erneut versuchen' }).click();
  await settledView(page, { timeout: 60_000 });
  await expect(stage).not.toContainText(VIEW_LOAD_FAILED);
  await expect(page.locator('#view-canvas')).toBeVisible();
  const view = viewResponses(seen);
  expect(view.length, 'the 3D chunk was requested offline').toBeGreaterThan(0);
  for (const r of view) expect(r.fromServiceWorker(), r.url()).toBe(true);
});

test('CSP unchanged with the worker active (D-23) @live', async ({ page }) => {
  // With the flag on there is no worker to test; test/dist/pwa-build.test.js still asserts the
  // CSP meta on dist.
  test.skip(KILL, 'kill switch on');
  test.setTimeout(120_000);
  const cspMessages = [];
  page.on('console', (m) => {
    if (m.text().includes('Content Security Policy')) cspMessages.push(m.text());
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto('./');
  await ready(page);
  // Reload so the navigation, the chunks and the workers all go through the worker.
  const nav = await page.reload();
  expect(nav?.fromServiceWorker()).toBe(true);
  await settledView(page, { timeout: 60_000 });
  await expect(page.locator('#tech-offline')).toHaveText(READY, { timeout: 30_000 });
  const meta = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(meta).toBe(CSP);
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
  expect(cspMessages).toEqual([]);
});
