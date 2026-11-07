// Material comparison (02-07, RES-02, D-15, D-16): "Was bringt ein anderes Material?" under the
// result, fed by the 02-06 compare lane. Expected values: 02-06-SUMMARY "Material rows",
// re-verified against the engine (example: 1,74 saves 1,6 mm and 4 g; plus case: 0,9 mm at the
// centre). The lane never delays the main result (worker.spec 'main result is not delayed').
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settled, settledCompare, plain, guardPage, slowWorker } from './helpers.js';
/* global document */

guardPage(test);

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const row = (page, id) => page.locator(`#cmp-material-table tbody tr[data-material=${id}]`);
const eyeRow = (page, id, eye) => page.locator(`#cmp-material-eyes-table tbody tr[data-material=${id}][data-eye=${eye}]`);
const text = async (loc) => plain(await loc.textContent());
const material = (page, id) => page.locator(`input[name=material][value=${id}]`);

/** R +3,00, L +2,75, no cylinder; PD 32 / 31,5 from the example (02-06 plus case). */
async function plusCase(page) {
  for (const [eye, sph] of [['od', '+3,00'], ['os', '+2,75']]) {
    await page.locator(`#rx-${eye}-sph`).fill(sph);
    await page.locator(`#rx-${eye}-cyl`).fill('');
    await page.locator(`#rx-${eye}-axis`).fill('');
  }
  await settledCompare(page);
}

test('example: six rows, 1,74 saves 1,6 mm and 4 g; switching moves "Ihre Auswahl"', async ({ page }) => {
  await settledCompare(page);
  await expect(page.locator('#cmp-material-table tbody tr')).toHaveCount(6);
  await expect(row(page, 'cr39')).toContainText('Ihre Auswahl');
  expect(await text(row(page, 'cr39').locator('td[data-col=thick]'))).toContain('4,6 mm');
  expect(await text(row(page, 'cr39').locator('td[data-col=ct]'))).toContain('1,8 mm');
  expect(await text(row(page, 'cr39').locator('td[data-col=weight]'))).toContain('14 g');
  const r174 = await text(row(page, 'idx174'));
  expect(r174).toContain('1,6 mm dünner, 4 g leichter');
  expect(r174).toContain('(≈ 35 % dünner)');
  expect(r174).not.toContain('Ihre Auswahl');
  await expect(page.locator('#cmp-material-table [data-cmp-stale]')).toHaveCount(0);

  await material(page, 'idx174').check();
  await settledCompare(page);
  await expect(row(page, 'idx174')).toContainText('Ihre Auswahl');
  await expect(row(page, 'cr39')).not.toContainText('Ihre Auswahl');
  const r150 = await text(row(page, 'cr39'));
  expect(r150).toContain('1,6 mm dicker, 4 g schwerer');
  expect(r150).toContain('dicker');
  expect(r150).toContain('schwerer');
});

test('plus case: thickest point in the centre, 1,74 saves 0,9 mm and 2 g', async ({ page }) => {
  await plusCase(page);
  expect(await text(page.locator('#cmp-material-intro'))).toContain('rechte');
  const thick = await text(row(page, 'cr39').locator('td[data-col=thick]'));
  expect(thick).toContain('3,9 mm');
  expect(thick).toContain('in der Mitte');
  expect(await text(row(page, 'idx174'))).toContain('0,9 mm dünner, 2 g leichter');
  expect(await text(row(page, 'pc'))).toContain('0,1 mm dünner, 1 g leichter');
});

test('per-eye details carry the thickest edge (RES-02 max edge)', async ({ page }) => {
  await plusCase(page);
  const details = page.locator('#cmp-material-eyes');
  await details.locator('summary').click();
  await expect(page.locator('#cmp-material-eyes-table thead')).toContainText('Dickster Rand');
  await expect(page.locator('#cmp-material-eyes-table tbody tr')).toHaveCount(12);
  expect(await text(eyeRow(page, 'cr39', 'OD').locator('td[data-col=edge]'))).toContain('2,8 mm');
  expect(await text(eyeRow(page, 'cr39', 'OS').locator('td[data-col=edge]'))).toContain('2,7 mm');
});

test('the assumed minimum edge of 1,67 and 1,74 is footnoted', async ({ page }) => {
  const note = page.locator('#cmp-assumed-note');
  await expect(note).toBeVisible();
  const s = await text(note);
  expect(s).toContain('1,67');
  expect(s).toContain('1,74');
  expect(s).toContain('angenommen');
  for (const n of ['1,50', '1,53', '1,59', '1,60']) expect(s).not.toContain(n);
});

test('comparison lane: "Vergleich rechnet …" and dotted old values, main settles first', async ({ page }) => {
  await slowWorker(page, 1500, { types: ['compare'] });
  await page.goto('./');
  await settledCompare(page, { timeout: 20_000 });
  const before = await text(row(page, 'idx174'));
  await page.locator('#rx-od-sph').fill('-4');
  await settled(page);
  await expect(page.locator('#result-od-thick')).not.toHaveAttribute('data-stale', /.*/);
  await expect(page.locator('#compare')).not.toHaveAttribute('data-pending', '');
  await expect(page.locator('#cmp-status')).toHaveText('Vergleich rechnet …');
  await expect(row(page, 'idx174').locator('[data-cmp-stale]').first()).toBeVisible();
  // Old values stay until the new ones are painted; the compare marks never use data-stale.
  expect(await text(row(page, 'idx174'))).toBe(before);
  expect(await page.locator('#compare [data-stale]').count()).toBe(0);
  await settledCompare(page, { timeout: 20_000 });
  await expect(page.locator('#cmp-status')).toHaveText('');
  await expect(page.locator('#compare [data-cmp-stale]')).toHaveCount(0);
  expect(await text(row(page, 'idx174'))).not.toBe(before);
});

for (const vp of [
  { width: 320, height: 640 },
  { width: 1280, height: 800 },
]) {
  test.describe(`axe #compare at ${vp.width} px`, () => {
    test.use({ viewport: vp });
    test('details open: zero violations, no horizontal scroll', async ({ page }) => {
      await settledCompare(page);
      await page.locator('#cmp-material-eyes summary').click();
      const { violations } = await new AxeBuilder({ page }).include('#compare').withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
