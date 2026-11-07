// Shared e2e helpers (01-15).
import { expect } from '@playwright/test';
/* global requestAnimationFrame -- page.evaluate bodies run in the browser */

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

/** Worker bundle under the sub-path (vite names it engine.worker-<hash>.js). */
export const WORKER_URL = /\/assets\/[^/]*worker[^/]*\.js$/;

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

/** Text without soft hyphens (U+00AD, RESEARCH Pitfall 6) and with NBSP / narrow NBSP as spaces. */
export function plain(s) {
  return (s ?? '').replace(/\u00AD/g, '').replace(/[\u00A0\u202F]/g, ' ');
}

/**
 * Register the smoke.spec guard harness for the calling spec file: every test fails on a 4xx/5xx
 * response, a failed request, a request to another origin or a CSP console message. Each test
 * starts on the app page ('./').
 * @param {typeof import('@playwright/test').test} test
 */
export function guardPage(test) {
  /** @type {{ bad: string[], failed: string[], foreign: string[], csp: string[] }} */
  let seen;
  test.beforeEach(async ({ page, baseURL }) => {
    const origin = new URL(baseURL).origin;
    seen = { bad: [], failed: [], foreign: [], csp: [] };
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
    await page.goto('./');
    expect(page.url()).toMatch(/\/Eyeglass-Prescription\/$/);
  });
  test.afterEach(() => {
    expect(seen.bad, 'responses with status >= 400').toEqual([]);
    expect(seen.failed, 'failed requests').toEqual([]);
    expect(seen.foreign, 'requests to other origins').toEqual([]);
    expect(seen.csp, 'CSP violations').toEqual([]);
  });
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
