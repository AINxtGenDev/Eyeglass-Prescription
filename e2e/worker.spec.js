// Worker e2e (01-15, ENG-09): module worker under the exact CSP and the sub-path, sync fallback,
// watchdog, slow-worker latest-wins, per-eye "rechnet …" without layout shift (360 px mobile
// project) and axe in the busy state, cache restore, German worker error.
// Discrimination rule (lens-critic MAJOR-1): compare the thickest point #result-*-thick (CT is 1,8 mm for every minus lens
// here), and assert the stored pair differs before the main assertion.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settled, settledCompare, thickOf, sphOnly, slowWorker, holdWorker, WORKER_URL } from './helpers.js';
/* global window, document, MutationObserver -- page.evaluate bodies run in the browser */

// Must equal vite.config.js CSP exactly (T-01-39).
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  "object-src 'none'; base-uri 'self'; form-action 'none'";

/** @type {string[]} */
let consoleErrors;

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
});

const sph = (page) => page.locator('#rx-od-sph');
const mmText = (v) => String(v).replace('.', ',');

/** Type an OD Sph value, wait until settled, return the OD thickest point. */
async function etAt(page, value) {
  await sph(page).fill(value);
  await settled(page);
  return thickOf(page, 'od');
}

test('engine runs in a module worker under the sub-path (ENG-09)', async ({ page }) => {
  const workerResponse = page.waitForResponse((r) =>
    /^\/Eyeglass-Prescription\/assets\/.*worker.*\.js$/.test(new URL(r.url()).pathname),
  );
  await page.goto('./');
  const resp = await workerResponse;
  expect(resp.status()).toBe(200);
  expect(resp.headers()['content-type']).toMatch(/javascript/);
  await expect(page.locator('#compute-mode')).toHaveAttribute('data-mode', 'worker');
  await settled(page);
  await expect(page.locator('#result-od-thick')).toHaveText(/^\d+,\d\smm/);
  await expect(page.locator('#compute-mode')).toHaveAttribute('data-mode', 'worker');
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).toBe(CSP);
});

test('falls back to direct computation when the worker cannot load', async ({ page }) => {
  await page.route(WORKER_URL, (route) => route.abort());
  await page.goto('./');
  const mode = page.locator('#compute-mode');
  await expect(mode).toHaveAttribute('data-mode', 'sync');
  await expect(mode).toContainText('direkt');
  // 02-01: Sph −2,00 without the example cylinder, so −3 gives the pinned 4,7 mm.
  await sphOnly(page);
  for (const eye of ['od', 'os']) await expect(page.locator(`#result-${eye}-thick`)).toHaveText(/^\d+,\d\smm/);
  await expect(page.locator('body')).not.toContainText('NaN');
  const et2 = await thickOf(page, 'od');
  const et3 = await etAt(page, '-3');
  expect(et3).not.toBe(et2);
  expect(et3).toBe(4.7);
  // Sync fallback: opening #tech must not start the bench (MINOR-6, lens-critic r3 M2).
  const timing = page.locator('#timing');
  const before = await timing.textContent();
  await page.locator('details#tech > summary').click();
  await page.waitForTimeout(1000);
  expect(await timing.textContent()).toBe(before);
  await expect(timing).not.toContainText('wird gemessen');
  await expect(timing).not.toContainText('Median');
  await expect(page.locator('#tech')).not.toHaveAttribute('aria-busy', /.*/);
});

test('sync fallback: the Querschnitt waits for "Vergleich berechnen" (02-13, T-02-18)', async ({ page }) => {
  await page.route(WORKER_URL, (route) => route.abort());
  await page.goto('./');
  await expect(page.locator('#compute-mode')).toHaveAttribute('data-mode', 'sync');
  await settled(page);
  await page.locator('#expert').check();
  await settled(page);
  await expect(page.locator('#xsec')).toHaveAttribute('data-pending', '');
  await expect(page.locator('#xsec-figure svg')).toHaveCount(0);
  await expect(page.locator('#cmp-run')).toBeVisible();
  await page.locator('#cmp-run').click();
  await expect(page.locator('#xsec-figure svg[role=img]')).toHaveCount(1);
  await expect(page.locator('#xsec')).toHaveAttribute('data-pending', '');
  await expect(page.locator('#xsec-table td[data-row=ct]')).toHaveText(/^1,8\smm$/);
});

test('watchdog falls back when the worker never answers', async ({ page }) => {
  test.setTimeout(30_000);
  await page.route(WORKER_URL, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* silent */' }));
  await page.goto('./');
  const mode = page.locator('#compute-mode');
  await expect(mode).toHaveAttribute('data-mode', 'sync', { timeout: 15_000 });
  await expect(mode).toContainText('nicht geantwortet');
  await settled(page);
  await expect(page.locator('#result-od-thick')).toHaveText(/^\d+,\d\smm/);
});

test('latest input wins (slow worker)', async ({ page }) => {
  await slowWorker(page, 300);
  await page.goto('./');
  await settled(page);
  const et = {};
  for (const v of ['-1', '-2', '-3']) et[v] = await etAt(page, v);
  expect(et['-1']).not.toBe(et['-2']);
  expect(et['-2']).not.toBe(et['-3']);
  expect(et['-1']).not.toBe(et['-3']);
  await etAt(page, '-2');
  await page.evaluate(() => {
    window.__etSeq = [];
    const el = document.getElementById('result-od-thick');
    new MutationObserver(() => window.__etSeq.push(el.textContent)).observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await sph(page).fill('-1');
  await expect(page.locator('#result-od-status')).toHaveText('rechnet …');
  await sph(page).fill('-3');
  await settled(page);
  expect(await thickOf(page, 'od')).toBe(et['-3']);
  const seq = await page.evaluate(() => window.__etSeq);
  console.info(`etmax sequence after −2 → −1 → −3: ${JSON.stringify(seq)}`);
  expect(seq.some((s) => s.startsWith(mmText(et['-1'])))).toBe(false);
});

// MINOR-4 (orchestrator, lens-critic r3): the result-rAF isCurrent re-check on its own. A Worker
// wrapper dispatches an input event inside the result message task, before the page's handler
// runs. The input frame is therefore queued before the delivery frame. It requests −3, so the
// delivered −1 is no longer current when the delivery frame runs. The client accepted the −1
// delivery (its seq was current at that moment), so only the re-check stops the stale paint.
test('result frame re-checks isCurrent (input between message and frame)', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.Worker;
    window.Worker = class extends Native {
      set onmessage(fn) {
        super.onmessage = (e) => {
          if (e.data?.type === 'result' && window.__beforeResult) {
            const f = window.__beforeResult;
            window.__beforeResult = null;
            f();
          }
          fn(e);
        };
      }
      get onmessage() {
        return super.onmessage;
      }
    };
  });
  await page.goto('./');
  await settled(page);
  const et1 = await etAt(page, '-1');
  const et3 = await etAt(page, '-3');
  expect(et1).not.toBe(et3);
  await etAt(page, '-2');
  await page.evaluate(() => {
    window.__etSeq = [];
    const el = document.getElementById('result-od-thick');
    new MutationObserver(() => window.__etSeq.push(el.textContent)).observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    window.__beforeResult = () => {
      const input = /** @type {HTMLInputElement} */ (document.getElementById('rx-od-sph'));
      input.value = '-3';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
  });
  await sph(page).fill('-1');
  await settled(page);
  expect(await page.evaluate(() => window.__beforeResult), 'hook did not run').toBeNull();
  expect(await thickOf(page, 'od')).toBe(et3);
  const seq = await page.evaluate(() => window.__etSeq);
  console.info(`etmax sequence, input inside the result task: ${JSON.stringify(seq)}`);
  expect(seq.some((s) => s.startsWith(mmText(et1)))).toBe(false);
});

// 02-08: the busy window is held open by the test (holdWorker), not by a 2000 ms timer. Under
// parallel load the axe scan inside the window took longer than 2000 ms and the guard below
// failed ('busy window too short') although the app behaved correctly.
test('"rechnet …" marks old values per eye, input stays responsive, nothing moves (slow worker)', async ({ page }) => {
  const gate = await holdWorker(page);
  await page.goto('./');
  await settled(page);
  // 02-01: the first Rx input removes the example banner; remove it before the baseline boxes.
  await sphOnly(page);
  // 02-07: the material table under the result fills in after the main result; the baseline
  // boxes are taken once it is complete.
  await settledCompare(page);
  // 02-02: the phase-1 .result-table is gone (its rows are Zwischenwerte behind the
  // Experten-Ansicht), so the two result cards are measured instead: they hold the values that are
  // marked stale and sit above #calc-status, so any growth of a card would also move the others.
  const SELECTORS = ['#result-od-card', '#result-os-card', '#calc-status', '#disclaimer'];
  const boxes = async () => {
    const out = [];
    for (const s of SELECTORS) out.push(await page.locator(s).boundingBox());
    return out;
  };
  const expectSame = (a, b, when) => {
    for (const [i, s] of SELECTORS.entries()) {
      for (const k of ['x', 'y', 'width', 'height']) {
        expect(Math.abs(a[i][k] - b[i][k]), `${s}.${k} ${when}`).toBeLessThanOrEqual(0.5);
      }
    }
  };
  const b0 = await boxes();
  await gate.hold();
  // 02-01: −2,50 against L −2,00 (3,7 → 4,2 mm vs 3,7 mm) stays below the 1,0 mm L/R rule, so
  // the #lr-callout does not appear; −3 (4,7 mm) would add the sentence and move the boxes.
  await sph(page).fill('-2,5');
  const quick = { timeout: 300 };
  await expect(page.locator('#rx-od-sph-echo')).toContainText('−2,50', quick);
  await expect(page.locator('#result')).toHaveAttribute('aria-busy', 'true', quick);
  await expect(page.locator('#result-od-status')).toHaveText('rechnet …', quick);
  await expect(page.locator('#result-od-thick')).toHaveAttribute('data-stale', 'true', quick);
  await expect(page.locator('#result-os-thick')).not.toHaveAttribute('data-stale', /.*/);
  await expect(page.locator('#result-os-status')).not.toHaveText('rechnet …');
  await expect(page.locator('#calc-status')).toContainText('vorigen Eingabe', quick);
  expectSame(b0, await boxes(), 'while busy');
  const { violations } = await new AxeBuilder({ page }).include('#result').analyze();
  const severe = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  expect(await page.locator('#result').getAttribute('aria-busy'), 'busy window too short').toBe('true');
  await gate.release();
  await settled(page);
  await expect(page.locator('#result')).not.toHaveAttribute('aria-busy', /.*/);
  expect(await page.locator('[data-stale]').count()).toBe(0);
  await expect(page.locator('#calc-status')).toHaveText('');
  expectSame(b0, await boxes(), 'after the result');
});

test('retyping the previous value while busy restores the result (MINOR-3)', async ({ page }) => {
  await slowWorker(page, 2000);
  await page.goto('./');
  await settled(page);
  const et3 = await etAt(page, '-3');
  const et2 = await etAt(page, '-2');
  expect(et2).not.toBe(et3);
  const et2Text = await page.locator('#result-od-thick').textContent();
  await sph(page).fill('-3');
  await expect(page.locator('#result-od-status')).toHaveText('rechnet …');
  await sph(page).fill('-2');
  const quick = { timeout: 300 };
  await expect(page.locator('#result-od-status')).not.toHaveText('rechnet …', quick);
  await expect(page.locator('#result-od-thick')).toHaveText(et2Text, quick);
  await expect(page.locator('#result-od-thick')).not.toHaveAttribute('data-stale', /.*/, quick);
  await page.waitForTimeout(2500);
  expect(await thickOf(page, 'od')).toBe(et2);
  expect(await thickOf(page, 'od')).not.toBe(et3);
});

// 02-07 (D-16, T-02-17, T-02-50): compare jobs queue behind main work, so a slow comparison
// lane never holds back the main result. #result[data-pending] stays main-only.
test('main result is not delayed by the comparison', async ({ page }) => {
  await slowWorker(page, 300, { types: ['compare'] });
  await page.goto('./');
  await settledCompare(page);
  await page.evaluate(() => {
    window.__statusSeen = [];
    for (const id of ['result-od-status', 'result-os-status']) {
      const el = document.getElementById(id);
      new MutationObserver(() => window.__statusSeen.push(el.textContent)).observe(el, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
  });
  const before = await thickOf(page, 'od');
  await sph(page).fill('-4');
  await settled(page);
  const after = await thickOf(page, 'od');
  expect(after).not.toBe(before);
  // The main result is painted while the comparison is still open.
  const cmpPending = await page.locator('#compare').getAttribute('data-pending');
  expect(cmpPending).not.toBe('');
  expect(cmpPending).not.toBeNull();
  expect(await page.locator('#result').getAttribute('data-pending')).toBe('');
  expect(await page.evaluate(() => window.__statusSeen)).not.toContain('rechnet …');
  await settledCompare(page);
  expect(await thickOf(page, 'od')).toBe(after);
});

// 02-07 (T-02-18): in the sync fallback the comparison would run on the main thread, so it only
// runs after 'Vergleich berechnen'.
test('sync fallback: the comparison runs only after "Vergleich berechnen"', async ({ page }) => {
  await page.route(WORKER_URL, (route) => route.abort());
  await page.goto('./');
  await expect(page.locator('#compute-mode')).toHaveAttribute('data-mode', 'sync');
  await settled(page);
  const run = page.locator('#cmp-run');
  await expect(run).toBeVisible();
  await expect(run).toHaveText('Vergleich berechnen');
  await page.waitForTimeout(500);
  await expect(page.locator('#cmp-material-table tbody tr[data-material=idx174]')).not.toContainText('dünner');
  await run.click();
  await expect(page.locator('#cmp-material-table tbody tr[data-material=idx174]')).toContainText(/1,6\smm dünner/);
  await expect(page.locator('#compare')).toHaveAttribute('data-pending', '');
  await expect(run).toBeHidden();
});

test('no "rechnet …" for a normal edit', async ({ page }) => {
  await page.goto('./');
  await settled(page);
  await page.evaluate(() => {
    window.__statusSeen = [];
    const el = document.getElementById('result-od-status');
    new MutationObserver(() => window.__statusSeen.push(el.textContent)).observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  for (const v of ['-1', '-2,5', '-3', '-4', '-2']) await etAt(page, v);
  const seen = await page.evaluate(() => window.__statusSeen);
  expect(seen).not.toContain('rechnet …');
});

test('worker failure shows a German message, never NaN', async ({ page }) => {
  const body =
    "self.postMessage({ type: 'ready' });\n" +
    "self.onmessage = (e) => self.postMessage({ type: 'error', id: e.data.id, eyes: Object.keys(e.data.eyes ?? {}), message: 'test' });\n";
  await page.route(WORKER_URL, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body }));
  await page.goto('./');
  await settled(page);
  for (const eye of ['od', 'os']) {
    await expect(page.locator(`#result-${eye}-status`)).toHaveText('Berechnung abgebrochen');
    await expect(page.locator(`#result-${eye}-thick`)).toHaveText('–');
  }
  await expect(page.locator('body')).not.toContainText('NaN');
  await expect(page.locator('#compute-mode')).toHaveAttribute('data-mode', 'worker');
});
