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
