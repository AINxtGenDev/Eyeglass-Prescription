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
//   test.skip(LIVE, 'needs the local switch server') and test.skip(KILL, 'kill switch on').
// - Pitfall 10: offline means context.setOffline(true) AND every request route-aborted, and the
//   served responses are asserted to come from the service worker (fromServiceWorker()), so a
//   cache miss fails the test instead of reaching a server.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { settled, settledCompare, settledView } from './helpers.js';
import { swKillEffective } from '../sw-kill-switch.js';
import { checkDestroyerSw } from '../test/dist/sw-shape.js';
import { APP_VERSION } from '../version.js';
import DE from '../src/i18n/de-AT.js';
/* global window, document, location, ServiceWorker, requestAnimationFrame -- page.evaluate bodies run in the browser */

// The live site has no switch server: the 'switch server only' describe is skipped there.
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
const WARP_WORKER_RE = /\/assets\/warp\.worker[^/]*\.js$/;
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

/** Serve another build on the switch server: '/__switch/a' = dist, '/__switch/b' = dist-b (04-14). */
async function switchTo(request, baseURL, switchPath) {
  const r = await request.get(new URL(switchPath, baseURL).href);
  expect(r.status(), switchPath).toBe(200);
}

// NEW-6: the switch server's served build is global state that survives a failed test, a worker
// restart and, with a reused server, a previous run; reset to build A before the top-level tests.
test.beforeAll(async ({ request }, testInfo) => {
  if (!LIVE) await switchTo(request, testInfo.project.use.baseURL, '/__switch/a');
});

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

  // 04-08 (item 17): the Durchblick works offline too; its warp worker comes from the precache.
  await page.locator('#view-mode label', { hasText: 'Durchblick' }).click();
  await expect(page.locator('#view')).toHaveAttribute('data-pending', '', { timeout: 60_000 });
  await expect(page.locator('#view-stage .view-badge')).toHaveText(DE['view.badge.ref'], { timeout: 60_000 });
  const warp = seen.filter((r) => WARP_WORKER_RE.test(new URL(r.url()).pathname));
  expect(warp.length, 'the warp worker was requested offline').toBeGreaterThan(0);
  for (const r of warp) expect(r.fromServiceWorker(), r.url()).toBe(true);
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

// lens-critic M1 / round-2 NEW-1 fix 4: the check for a real kill deploy (verify-live runs it).
// A fresh browser context has no old worker, so this test proves only the deployed sw.js shape
// and that the app does not register; it does NOT prove removal for returning visitors. Removal
// is proven by the local rehearsal ('kill switch rehearsal' below) and, for a real kill deploy, by
// the manual check (5) of the KILL SWITCH comment in a browser profile that has the old worker
// installed.
test('kill switch active @live', async ({ page }) => {
  test.skip(!KILL, 'kill switch off');
  await page.goto('./');
  await settled(page);
  await page.reload();
  await settled(page);
  await expect(page.locator('#tech-offline')).toHaveText(DE['tech.offline.failed'], { timeout: 30_000 });
  // Time for a registration that should not happen (the gate starts update.js after the paint).
  await page.waitForTimeout(3_000);
  const state = await page.evaluate(async () => ({
    registrations: (await navigator.serviceWorker.getRegistrations()).length,
    caches: await window.caches.keys(),
    sw: await (await fetch('sw.js', { cache: 'no-store' })).text(),
  }));
  expect(state.registrations).toBe(0);
  expect(state.caches.filter((n) => n.includes('eyeglass-rx'))).toEqual([]);
  expect(state.sw).not.toContain('precacheAndRoute');
  expect(state.sw).toContain('caches.keys');
  expect(state.sw).toContain('unregister');
});

// ---------------------------------------------------------------------------------------------
// 04-14 (D-20, D-21; UI-SPEC Verification items 19–24, plan-checker warnings 3 and 4, MINOR 9):
// the update prompt and the input handover, proven on the production build with a real second
// version (dist-b, label 'dev-b') served by the switch server. Every test here needs the local
// switch server and a registered worker, so the whole describe is skipped on the live site and
// while the kill switch is on (with the flag on, update.js never registers).
// ---------------------------------------------------------------------------------------------

const HANDOVER_KEY = 'eyeglass-rx:v1:handover';
const B_VERSION = 'dev-b';
const doneText = (key, version = B_VERSION) => DE[key].replace('{version}', version);

/** Rebuild out/ with `npm run <script>` when out/index.html is missing or older than dist/index.html. */
function buildLazily(script, out) {
  const stale = !existsSync(`${out}/index.html`) || statSync(`${out}/index.html`).mtimeMs < statSync('dist/index.html').mtimeMs;
  console.log(`${out}: ${stale ? `building with npm run ${script}` : 'up to date, not rebuilt'}`);
  if (stale) execFileSync('npm', ['run', script], { stdio: 'inherit', timeout: 180_000 });
}

/** The handover key of this tab (read in the test page, never in app code). */
const handoverKey = (page) => page.evaluate((k) => window.sessionStorage.getItem(k), HANDOVER_KEY);

/** Ask the registration for an update now (the switch server already serves build B). */
async function checkForUpdate(page) {
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
}

/** Wait until the update banner is shown in update mode. */
async function bannerShown(page) {
  await expect(page.locator('#app-update')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#app-update-apply')).toBeVisible();
}

/** Load the page on build A and wait until a worker controls it. */
async function openOnA(page) {
  await page.goto('./');
  await settled(page);
  await ready(page);
  await expect(page.locator('#app-version')).toHaveText(APP_VERSION);
}

/**
 * page.reload() that tolerates a navigation the page or the worker starts meanwhile (the
 * destroyer's client.navigate, a controllerchange reload): wait for that load, then retry.
 */
async function reloadTolerant(page) {
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.reload();
      return;
    } catch (e) {
      console.log(`kill rehearsal: reload interrupted (${String(e.message).split('\n')[0]}), retrying`);
      await page.waitForLoadState('load').catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  throw new Error('page.reload failed 3 times');
}

/** True once no worker controls the page, polled across navigations; false after ms. */
async function uncontrolledWithin(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const controlled = await page.evaluate(() => navigator.serviceWorker.controller !== null).catch(() => true);
    if (!controlled) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

test.describe('switch server only', () => {
  test.skip(LIVE, 'needs the local switch server');
  test.skip(KILL, 'kill switch on');
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(() => {
    // Belt and braces: a lazy build must never run in a kill or live run.
    if (LIVE || KILL) return;
    buildLazily('build:b', 'dist-b');
  });

  test.beforeEach(async ({ request, baseURL }) => {
    await switchTo(request, baseURL, '/__switch/a');
  });

  test('item 19: banner, keyboard route, handover after "Aktualisieren"', async ({ page, request, baseURL }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await openOnA(page);
    await page.locator('#rx-od-sph').fill('-3,25');
    await page.locator('#rx-os-sph').fill('-2,75');
    await settled(page);
    // A non-field control at the top: the bar shows (the result is out of view) and the banner
    // is not hidden for typing.
    await page.locator('#expert').focus();
    await page.evaluate(() => window.scrollTo(0, 0));

    await switchTo(request, baseURL, '/__switch/b');
    await checkForUpdate(page);
    await bannerShown(page);
    await expect(page.locator('#expert'), 'the banner does not take focus').toBeFocused();
    await expect(page.getByRole('region', { name: 'Hinweis zur neuen Version' })).toBeVisible();
    await expect(page.locator('#app-update-body')).toHaveText(DE['update.body']);
    await expect(page.locator('#app-update-live')).toContainText(DE['update.title']);
    // First in the Tab order: the first tabbable element of the document is "Aktualisieren", and
    // Shift+Tab from the header's switch goes back through "Später" to "Aktualisieren".
    const firstTabbable = await page.evaluate(() => {
      const all = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')];
      const el = all.find((e) => e.tabIndex >= 0 && !e.disabled && e.getClientRects().length > 0);
      return el?.id ?? null;
    });
    expect(firstTabbable).toBe('app-update-apply');
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#app-update-later')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#app-update-apply')).toBeFocused();
    // Never on the summary bar (412 × 915, bar shown).
    await expect(page.locator('#summary-bar')).toBeVisible();
    const [banner, bar] = await Promise.all([page.locator('#app-update').boundingBox(), page.locator('#summary-bar').boundingBox()]);
    expect(banner.y + banner.height, 'banner bottom above the bar top').toBeLessThanOrEqual(bar.y);
    await page.screenshot({ path: test.info().outputPath('04-14-banner-412x915.png') });

    await page.keyboard.press('Enter');
    await expect(page.locator('#app-version')).toHaveText(B_VERSION, { timeout: 60_000 });
    await settled(page);
    await expect(page.locator('#rx-od-sph')).toHaveValue('-3,25');
    await expect(page.locator('#rx-os-sph')).toHaveValue('-2,75');
    await expect(page.locator('#result-od-thick')).toHaveText(/^\d+,\d\smm$/);
    expect(await handoverKey(page)).toBeNull();
    await expect(page.locator('#app-update-body')).toHaveText(doneText('update.done'));
    await expect(page.locator('#app-update-close')).toBeVisible();
    await expect(page.locator('#app-update-apply')).toBeHidden();
    await expect(page.locator('#app-update-live')).toHaveText(doneText('update.done'));
    await page.screenshot({ path: test.info().outputPath('04-14-confirmation-412x915.png') });
    // The confirmation hides on the first input edit.
    await page.locator('#rx-od-sph').fill('-3,5');
    await expect(page.locator('#app-update')).toBeHidden();
  });

  // N8: nothing is asserted about page D's banner; only the outcomes.
  test('item 20: four pages, "Aktualisieren" in A reloads all with their own inputs', async ({ context, request, baseURL }) => {
    const pageD = await context.newPage();
    await openOnA(pageD);
    await switchTo(request, baseURL, '/__switch/b');
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    const pageC = await context.newPage();
    for (const p of [pageA, pageB, pageC]) {
      await p.goto('./');
      await settled(p);
    }
    await checkForUpdate(pageA);
    for (const p of [pageA, pageB, pageC]) await bannerShown(p);
    await pageC.locator('#app-update-later').click();
    await expect(pageC.locator('#app-update')).toBeHidden();
    const rx = new Map([
      [pageA, '-2,25'],
      [pageB, '-3,5'],
      [pageC, '-4,75'],
      [pageD, '-1,25'],
    ]);
    for (const [p, v] of rx) {
      await p.locator('#rx-od-sph').fill(v);
      await settled(p);
    }

    await pageA.locator('#app-update-apply').click();
    for (const [p, v] of rx) {
      await expect(p.locator('#app-version')).toHaveText(B_VERSION, { timeout: 60_000 });
      await settled(p);
      await expect(p.locator('#rx-od-sph')).toHaveValue(v);
      expect(await handoverKey(p)).toBeNull();
    }
    await expect(pageA.locator('#app-update-body')).toHaveText(doneText('update.done'));
    for (const p of [pageB, pageC, pageD]) await expect(p.locator('#app-update-body')).toHaveText(doneText('update.done.other'));
  });

  test('item 20b: a first-visit page reloads too and loads its lazy chunks', async ({ context, request, baseURL }) => {
    // The first page installs the worker (clientsClaim makes it controlled without a reload).
    const first = await context.newPage();
    await first.goto('./');
    await settled(first);
    await ready(first);
    const other = await context.newPage();
    await openOnA(other);
    await switchTo(request, baseURL, '/__switch/b');
    await checkForUpdate(other);
    await bannerShown(other);

    const seen = recordResponses(first);
    await other.locator('#app-update-apply').click();
    await expect(other.locator('#app-version')).toHaveText(B_VERSION, { timeout: 60_000 });
    await expect(first.locator('#app-version')).toHaveText(B_VERSION, { timeout: 60_000 });
    await settledView(first, { timeout: 60_000 });
    await expect(first.locator('#view-stage')).not.toContainText(VIEW_LOAD_FAILED);
    await expect(first.locator('#view-canvas')).toBeVisible();
    const view = viewResponses(seen);
    expect(view.length, 'the 3D chunk was requested after the reload').toBeGreaterThan(0);
    for (const r of view) expect(r.status(), r.url()).toBe(200);
  });

  test('item 21: "Später" hides for this page only, stores nothing', async ({ page, request, baseURL }) => {
    await openOnA(page);
    await switchTo(request, baseURL, '/__switch/b');
    await checkForUpdate(page);
    await bannerShown(page);
    const lengths = () => page.evaluate(() => [window.sessionStorage.length, window.localStorage.length]);
    const before = await lengths();
    await page.locator('#app-update-later').click();
    await expect(page.locator('#app-update')).toBeHidden();
    expect(await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null)).toBe(true);
    expect(await lengths()).toEqual(before);
    await page.reload();
    await settled(page);
    await expect(page.locator('#app-version')).toHaveText(APP_VERSION);
    await bannerShown(page);
  });

  test('item 22: hidden while a field has focus on a phone', async ({ page, request, baseURL }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await openOnA(page);
    await switchTo(request, baseURL, '/__switch/b');
    await checkForUpdate(page);
    await bannerShown(page);
    await page.locator('#rx-od-sph').focus();
    await expect(page.locator('#app-update')).toBeHidden();
    await page.screenshot({ path: test.info().outputPath('04-14-typing-412x915.png') });
    await page.locator('.tip-btn').first().focus();
    await expect(page.locator('#app-update')).toBeVisible();
  });

  test('item 23: no activation within 10 s → button back, update.failed, nothing written', async ({ page, request, baseURL }) => {
    await page.addInitScript(() => {
      const post = ServiceWorker.prototype.postMessage;
      ServiceWorker.prototype.postMessage = function (msg, ...rest) {
        if (msg && msg.type === 'SKIP_WAITING') return undefined;
        return post.call(this, msg, ...rest);
      };
    });
    await openOnA(page);
    await switchTo(request, baseURL, '/__switch/b');
    await checkForUpdate(page);
    await bannerShown(page);
    const apply = page.locator('#app-update-apply');
    await apply.click();
    await expect(apply).toHaveText(DE['update.applying']);
    await expect(apply).toBeDisabled();
    await expect(apply).toBeEnabled({ timeout: 15_000 });
    await expect(apply).toHaveText(DE['update.apply']);
    await expect(page.locator('#app-update-body')).toHaveText(DE['update.failed']);
    await expect(page.locator('#app-update-live')).toHaveText(DE['update.failed']);
    expect(await handoverKey(page)).toBeNull();
    await expect(page.locator('#app-version')).toHaveText(APP_VERSION);
  });

  test('item 24a: storage blocked before the banner → reset wording', async ({ page, request, baseURL }) => {
    await page.addInitScript(() => {
      window.Storage.prototype.setItem = () => {
        throw new window.DOMException('blocked', 'SecurityError');
      };
    });
    await openOnA(page);
    await switchTo(request, baseURL, '/__switch/b');
    await checkForUpdate(page);
    await bannerShown(page);
    await expect(page.locator('#app-update-body')).toHaveText(DE['update.body.reset']);
  });

  test('item 24b: storage blocked after the banner → warn first, second click reloads', async ({ page, request, baseURL }) => {
    await openOnA(page);
    await switchTo(request, baseURL, '/__switch/b');
    await checkForUpdate(page);
    await bannerShown(page);
    await expect(page.locator('#app-update-body')).toHaveText(DE['update.body']);
    await page.evaluate(() => {
      window.__sameDocument = true;
      window.Storage.prototype.setItem = () => {
        throw new window.DOMException('blocked', 'SecurityError');
      };
    });
    const apply = page.locator('#app-update-apply');
    await apply.click();
    await expect(page.locator('#app-update-body')).toHaveText(DE['update.body.reset']);
    await expect(page.locator('#app-update-live')).toHaveText(DE['update.body.reset']);
    await expect(apply).toBeEnabled();
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__sameDocument === true), 'the first click did not reload').toBe(true);
    await expect(page.locator('#app-version')).toHaveText(APP_VERSION);

    await apply.click();
    await expect(page.locator('#app-version')).toHaveText(B_VERSION, { timeout: 60_000 });
    await settled(page);
    // No key was written (setItem threw), so no confirmation.
    expect(await handoverKey(page)).toBeNull();
    await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 500))));
    await expect(page.locator('#app-update')).toBeHidden();
  });

  // 04-07 carry-over: a comparison is restored (focus on #cmp-diff, as on a click) and an
  // estimated lens height B keeps its "geschätzt" note.
  test('handover keeps a comparison and the B estimate', async ({ page, request, baseURL }) => {
    await openOnA(page);
    await page.locator('#cmp-start').click();
    await settledCompare(page);
    await expect(page.locator('#cmp-active')).toBeVisible();
    await page.locator('#frame-a').fill('50');
    await settledCompare(page);
    const estimated = new RegExp(DE['frame.bEstimated'].replace('{B}', '.+'));
    await expect(page.locator('#frame-b-echo')).toHaveText(estimated);
    const bText = await page.locator('#frame-b-echo').textContent();
    await page.locator('#expert').focus();

    await switchTo(request, baseURL, '/__switch/b');
    await checkForUpdate(page);
    await bannerShown(page);
    await page.locator('#app-update-apply').click();
    await expect(page.locator('#app-version')).toHaveText(B_VERSION, { timeout: 60_000 });
    await settledCompare(page);
    await expect(page.locator('#cmp-active')).toBeVisible();
    await expect(page.locator('#cmp-diff')).toBeFocused();
    await expect(page.locator('#frame-a')).toHaveValue('50');
    await expect(page.locator('#frame-b-echo')).toHaveText(bText ?? '');
    await expect(page.locator('#app-update-body')).toHaveText(doneText('update.done'));
  });

  // 04-07 carry-over: formValid() goes into the snapshot, so an input that was already invalid
  // at the update is restored as typed and not reported as lost.
  test('handover of a half-typed invalid input is not reported as lost', async ({ page, request, baseURL }) => {
    await openOnA(page);
    await page.locator('#rx-od-cyl').fill('abc');
    await settled(page);
    await page.locator('#expert').focus();
    await switchTo(request, baseURL, '/__switch/b');
    await checkForUpdate(page);
    await bannerShown(page);
    await page.locator('#app-update-apply').click();
    await expect(page.locator('#app-version')).toHaveText(B_VERSION, { timeout: 60_000 });
    await settled(page);
    await expect(page.locator('#rx-od-cyl')).toHaveValue('abc');
    await expect(page.locator('#app-update-body')).toHaveText(doneText('update.done'));
  });

  // lens-critic M1: the kill switch rehearsed both ways. The switch server's build A runs with the
  // flag off; dist-kill is built with SW_KILL_REHEARSAL=1, which goes through the same
  // swKillEffective → SW_KILL → selfDestroying + __SW_KILL__ path as the real constant (round-2
  // NEW-1 fix 1), so this exercises production's destroyer worker AND production's
  // no-registration app code.
  test('kill switch rehearsal: kill and re-enable (M1)', async ({ page, request, baseURL }) => {
    test.setTimeout(240_000);
    buildLazily('build:kill', 'dist-kill');
    expect(checkDestroyerSw('dist-kill'), 'dist-kill/sw.js is the destroyer').toEqual([]);

    // (a) Build A installed, its caches present, plus a stand-in for a sibling project's cache.
    await openOnA(page);
    const cachesNow = () => page.evaluate(() => window.caches.keys());
    const registrations = () => page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length));
    expect((await cachesNow()).some((n) => n.includes('eyeglass-rx')), 'eyeglass-rx caches before the kill').toBe(true);
    await page.evaluate(() => window.caches.open('sibling-probe'));
    const before = await cachesNow();
    console.log(`kill rehearsal: caches before the kill: ${JSON.stringify(before)}`);
    expect(before).toContain('sibling-probe');

    // (b) Kill: count main-frame navigations from here.
    await switchTo(request, baseURL, '/__switch/kill');
    let navigations = 0;
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame()) navigations += 1;
    });
    await reloadTolerant(page);
    if (!(await uncontrolledWithin(page, 5_000))) console.log('kill rehearsal: still controlled 5 s after the first reload');
    await reloadTolerant(page);
    await settled(page);
    const navCount = navigations;
    console.log(`kill rehearsal: navigations from /__switch/kill to the second reload: ${navCount}`);
    // ≤ 4: the two test reloads plus at most two destroyer navigations; the first reload is still
    // served from build A's precache, whose update.js registers, so one more destroyer cycle is
    // possible; from the second load on dist-kill's update.js does not register (no loop).
    expect(navCount).toBeLessThanOrEqual(4);
    // dist-kill's update.js took the __SW_KILL__ no-registration branch.
    await expect(page.locator('#tech-offline')).toHaveText(DE['tech.offline.failed'], { timeout: 30_000 });
    await expect.poll(registrations, { timeout: 15_000 }).toBe(0);
    await expect.poll(cachesNow, { timeout: 15_000 }).toEqual([]);
    console.log(`kill rehearsal: registrations ${await registrations()}, caches after the kill: ${JSON.stringify(await cachesNow())}`);
    await reloadTolerant(page);
    await settled(page);
    await expect(page.locator('#tech-offline')).toHaveText(DE['tech.offline.failed'], { timeout: 30_000 });
    // Give a stray registration time to appear before asserting it does not.
    await page.waitForTimeout(3_000);
    expect(await registrations(), 'still no registration after one more reload').toBe(0);
    expect(await cachesNow(), 'the sibling-probe cache is gone too: the blast radius').toEqual([]);

    // (c) Re-enable: build A again registers, precaches and works offline.
    await switchTo(request, baseURL, '/__switch/a');
    await page.reload();
    await settled(page);
    await ready(page);
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope ?? null);
    expect(scope).toBe(new URL('/Eyeglass-Prescription/', baseURL).href);
    expect((await cachesNow()).some((n) => n.includes('eyeglass-rx')), 'precached again').toBe(true);
    await goOffline(page.context());
    const nav = await page.reload();
    expect(nav?.fromServiceWorker(), 'offline reload served by the worker after re-enable').toBe(true);
    await settled(page);
    await expect(page.locator('#tech-offline')).toHaveText(READY, { timeout: 30_000 });
    console.log('kill rehearsal: re-enabled, offline reload served by the worker');
  });
});
