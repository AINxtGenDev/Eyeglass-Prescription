// Experten-Ansicht (02-02, UX-02, ANA-02, D-32): switch off on every load, Zwischenwerte behind it,
// Expert ids filled while hidden, toggling rewrites only the location suffixes (no compute).
// Pinned values: 02-01-SUMMARY Task 2 table (node, src/engine/evaluate.js, CR-39, Rechteckig 52×38/18).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settled, plain, guardPage, slowWorker } from './helpers.js';
/* global window, document, Worker -- page.evaluate / addInitScript bodies run in the browser */

guardPage(test);

const text = async (page, id) => plain(await page.locator(id).textContent());
const sw = (page) => page.locator('#expert');

/** Clear the example, then type one sphere per eye with Zyl/Achse empty. */
async function sphPair(page, od, os) {
  await page.locator('#example-clear').click();
  await page.locator('#rx-od-pd').fill('32');
  await page.locator('#rx-os-pd').fill('31,5');
  await page.locator('#rx-od-sph').fill(od);
  await page.locator('#rx-os-sph').fill(os);
  await settled(page);
}

test('switch is off on load and after a reload; Expert blocks hidden', async ({ page }) => {
  await settled(page);
  await expect(sw(page)).not.toBeChecked();
  await expect(page.locator('#expert-analysis')).toBeHidden();
  await sw(page).check();
  await expect(page.locator('#expert-analysis')).toBeVisible();
  await expect(sw(page)).toBeFocused();
  await page.reload();
  await settled(page);
  await expect(sw(page)).not.toBeChecked();
  for (const el of await page.locator('[data-expert]').all()) await expect(el).toBeHidden();
});

test('Expert ids exist and are filled while the switch is off', async ({ page }) => {
  await settled(page);
  await expect(page.locator('#expert-analysis')).toBeHidden();
  const values = await page.evaluate(() =>
    ['dec', 'etmax', 'basecurve'].map((c) => document.getElementById(`result-od-${c}`)?.textContent ?? null),
  );
  expect(values.map(plain)).toEqual(['3,0 mm', '4,6 mm', expect.stringContaining('Vogel')]);
});

test('Zwischenwerte for the example (A 52, DBL 18, PD 32 / 31,5)', async ({ page }) => {
  await settled(page);
  await sw(page).check();
  // (52 + 18) / 2 − 32 = 3,0 mm and − 31,5 = 3,5 mm toward the nose
  expect(await text(page, '#result-od-dec')).toBe('3,0 mm');
  expect(await text(page, '#result-os-dec')).toBe('3,5 mm');
  const bc = page.locator('#result-od-basecurve');
  await expect(bc).toContainText('Vogel');
  await expect(bc).toContainText('nahezu so dünn wie möglich');
  // CT 1,800 = the CR-39 minimum centre thickness → minCT binds
  await expect(page.locator('#result-od-binding')).toContainText('Mindestwert');
  // 6,86 g → 6,9 g; the card keeps whole grams
  expect(await text(page, '#result-od-weight-precise')).toBe('6,9 g');
  expect(await text(page, '#result-od-weight')).toBe('7 g');
  await expect(page.locator('#result-od-d2')).toContainText('dpt');
  await expect(page.locator('#result-od-radii')).toContainText('R1');
  await expect(page.locator('#result-od-radii')).toContainText('mm');
  await expect(page.locator('#result-od-sags')).toContainText('innen (zur Nase): vorne');
  await expect(page.locator('body')).not.toContainText('NaN');
  const { violations } = await new AxeBuilder({ page }).include('#expert-analysis').analyze();
  const severe = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('no serious or critical accessibility violations with the switch on', async ({ page }) => {
  await settled(page);
  await sw(page).check();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const severe = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('plus lens: thickest in the middle (optischer Mittelpunkt), Dickster Rand 2,8 mm', async ({ page }) => {
  // R +3,00 PD 32: CT 3,902, etMax 2,824 superior
  await sphPair(page, '+3,00', '+2,75');
  expect(await text(page, '#result-od-thick-loc')).toBe('in der Mitte');
  await sw(page).check();
  expect(await text(page, '#result-od-thick-loc')).toBe('in der Mitte (optischer Mittelpunkt)');
  expect(await text(page, '#result-od-etmax')).toBe('2,8 mm');
  expect(await text(page, '#result-od-etmax-loc')).toBe('oben (superior)');
});

test('uniform edge keeps "am ganzen Rand" with the Expert suffix', async ({ page }) => {
  // rund 50/50/18, PD 34, −3,00 both eyes: etMax = etMin = 3,692 mm (02-01 uniform-edge setup)
  await page.locator('#example-clear').click();
  await page.locator('input[name=frame-shape][value=rund]').check();
  await page.locator('#frame-a').fill('50');
  await page.locator('#frame-b').fill('50');
  await page.locator('#frame-dbl').fill('18');
  await page.locator('#rx-od-pd').fill('34');
  await page.locator('#rx-os-pd').fill('34');
  await page.locator('#rx-od-sph').fill('-3,00');
  await page.locator('#rx-os-sph').fill('-3,00');
  await settled(page);
  await sw(page).check();
  expect(await text(page, '#result-od-etmin-loc')).toBe('am ganzen Rand (rundum gleich)');
  expect(await text(page, '#result-od-thick-loc')).toBe('am ganzen Rand (rundum gleich)');
});

test('toggling rewrites the location suffix and sends no compute message', async ({ page }) => {
  // guardPage already loaded the page: let its worker finish loading before the reload, so the
  // guard sees no aborted request.
  await settled(page);
  await page.addInitScript(() => {
    window.__computeMsgs = 0;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (msg, ...rest) {
      // 'compute' = the main → worker job type of src/state/compute-protocol.js
      if (msg?.type === 'compute') window.__computeMsgs++;
      return post.call(this, msg, ...rest);
    };
  });
  await page.reload();
  await settled(page);
  await expect(page.locator('#compute-mode')).toHaveAttribute('data-mode', 'worker');
  const n = await page.evaluate(() => window.__computeMsgs);
  expect(n, 'the counter must see the start-up compute').toBeGreaterThan(0);
  const loc = page.locator('#result-od-thick-loc');
  expect(plain(await loc.textContent())).toBe('außen oben');
  await sw(page).check();
  await expect(loc).toHaveText('außen oben (temporal-superior)');
  await sw(page).uncheck();
  await expect(loc).toHaveText('außen oben');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__computeMsgs)).toBe(n);
  await expect(page.locator('#result')).toHaveAttribute('data-pending', '');
});

test('an empty eye stays empty across the toggle', async ({ page }) => {
  await settled(page);
  await page.locator('#rx-os-sph').fill('');
  await settled(page);
  await expect(page.locator('#result-os-headline')).toContainText('Noch kein Ergebnis für das linke Glas');
  await sw(page).check();
  await expect(page.locator('#result-os-headline')).toContainText('Noch kein Ergebnis für das linke Glas');
  await expect(page.locator('#result-os-thick')).toHaveText('–');
  await expect(page.locator('#result-os-thick-loc')).toHaveText('');
  await expect(page.locator('#result-os-dec')).toHaveText('–');
  await expect(page.locator('#result-od-thick-loc')).toHaveText('außen oben (temporal-superior)');
});

test('the stale mark survives the toggle', async ({ page }) => {
  await settled(page);
  await slowWorker(page, 2000);
  await page.reload();
  await settled(page);
  await page.locator('#rx-od-sph').fill('-3,00');
  // set by onBusy after BUSY_AFTER_MS = 50 ms while the result is held back
  const quick = { timeout: 1000 };
  await expect(page.locator('#result-od-thick')).toHaveAttribute('data-stale', 'true', quick);
  await sw(page).check();
  await expect(page.locator('#result-od-thick-loc')).toContainText('(', quick);
  await expect(page.locator('#result-od-thick')).toHaveAttribute('data-stale', 'true');
  await expect(page.locator('#result-od-dec')).toHaveAttribute('data-stale', 'true');
  await expect(page.locator('#result-od-status')).toHaveText('rechnet …');
  await settled(page);
  await expect(page.locator('[data-stale]')).toHaveCount(0);
});
