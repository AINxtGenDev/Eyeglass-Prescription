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
 * Numeric value of #result-<eye>-etmax ("2,8 mm – …" → 2.8); NaN when the cell shows no number.
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
 * Serve the real worker with `result` messages delayed by delayMs (READY, bench and error are
 * not delayed). Must be called before page.goto.
 * @param {import('@playwright/test').Page} page @param {number} delayMs
 */
export async function slowWorker(page, delayMs) {
  const patch =
    `{const post = self.postMessage.bind(self);` +
    `self.postMessage = (m, ...rest) => { if (m && m.type === 'result') setTimeout(() => post(m, ...rest), ${Number(delayMs)}); else post(m, ...rest); };}\n`;
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
