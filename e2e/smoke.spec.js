// Walking-skeleton smoke contract (DEPL-01, RX-02, L10N-01, RES-06, SC-1, ENG-09).
// RED until plan 01-03 ships the German page; runs against `vite preview` locally
// and against the live Pages URL when BASE_URL is set.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

test('German page with visible disclaimer', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-AT');
  const disclaimer = page.locator('#disclaimer');
  await expect(disclaimer).toBeVisible();
  await expect(disclaimer).toContainText('Lernhilfe');
});

test('paper-style Sph is echoed in de-AT format', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('-2,25');
  await expect(page.locator('#rx-od-sph-echo')).toHaveText(/−2,25\sdpt/);
});

test('both eyes show thickness, weight and base curve', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('-2,25');
  await page.locator('#rx-os-sph').fill('+1 dpt');
  for (const id of ['#result-od-ct', '#result-od-etmax', '#result-od-weight', '#result-os-ct']) {
    await expect(page.locator(id)).toHaveText(/^\d+,\d\s(mm|g)/);
  }
  await expect(page.locator('#result-od-basecurve')).toContainText('Vogel');
});

test('malformed input shows an error, never NaN', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('1.000,25');
  const err = page.locator('#rx-od-sph-err');
  await expect(err).toBeVisible();
  await expect(err).not.toBeEmpty();
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('material choice changes thickness', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('-4,00');
  await page.locator('#rx-os-sph').fill('-4,00');
  const select = page.locator('#material');
  await expect(select.locator('option')).toHaveCount(6);
  await expect(select.locator('option', { hasText: 'Trivex 1,53' })).toHaveCount(1);
  await expect(select).toHaveValue('cr39');
  const etmax = page.locator('#result-od-etmax');
  await expect(etmax).toHaveText(/^\d+,\d/);
  const num = async () => Number((await etmax.textContent()).match(/^(\d+,\d)/)[1].replace(',', '.'));
  const cr39 = await num();
  await select.selectOption('idx167');
  await expect(page.locator('#result-od-material')).toContainText('1,67');
  await expect.poll(num).toBeLessThan(cr39);
});

test('frame shape and PD change the edge', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('-6,00');
  await page.locator('#rx-os-sph').fill('-6,00');
  await expect(page.locator('#frame-shape')).toHaveValue('rechteckig');
  await expect(page.locator('#frame-a')).toHaveValue('52');
  await expect(page.locator('#rx-od-pd')).toHaveValue('32');
  const etmax = page.locator('#result-od-etmax');
  await expect(etmax).toContainText('schläfenseitig');
  const num = async () => Number((await etmax.textContent()).match(/^(\d+,\d)/)[1].replace(',', '.'));
  const before = await num();
  await expect(page.locator('#result-od-dec')).toHaveText(/^3,0\smm$/);
  await page.locator('#rx-od-pd').fill('28');
  await expect(page.locator('#result-od-dec')).toHaveText(/^7,0\smm$/);
  await expect.poll(num).toBeGreaterThan(before);
  await page.locator('#frame-shape').selectOption('pilot');
  await expect(page.locator('#frame-a')).toHaveValue('58');
  await expect(page.locator('#frame-b')).toHaveValue('50');
  await expect(page.locator('#frame-dbl')).toHaveValue('14');
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('footer shows the build commit', async ({ page }) => {
  await expect(page.locator('#app-commit')).toHaveText(/^([0-9a-f]{7}|dev)$/);
});

test('technical details show the timing readout', async ({ page }) => {
  await page.locator('details#tech > summary').click();
  await expect(page.locator('#timing')).toHaveText(/Median\s[\d,]+\sms/, { timeout: 5000 });
});

test('no serious or critical accessibility violations', async ({ page }) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const severe = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
