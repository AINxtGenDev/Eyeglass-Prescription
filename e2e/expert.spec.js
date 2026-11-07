// Experten-Ansicht (02-02, UX-02, ANA-02, D-32): switch off on every load, Zwischenwerte behind it,
// Expert ids filled while hidden, toggling rewrites only the location suffixes (no compute).
// Pinned values: 02-01-SUMMARY Task 2 table (node, src/engine/evaluate.js, CR-39, Rechteckig 52×38/18).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settled, settledCompare, plain, guardPage, slowWorker } from './helpers.js';
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

// ---- Glas-Einstellungen (02-10, MAT-03, MAT-04) ----
const bcField = (page) => page.locator('#expert-basecurve');
const material = (page, id) => page.locator(`input[name=material][value=${id}]`);

test('manual base curve: 6 is used, 0 computes, 12 is Außerhalb des Modells', async ({ page }) => {
  await settled(page);
  await sw(page).check();
  await bcField(page).fill('6');
  await settled(page);
  await expect(page.locator('#result-od-basecurve')).toContainText('von Ihnen vorgegeben');
  await expect(page.locator('#result-od-basecurve')).toContainText('+6,00');
  await bcField(page).fill('0');
  await settled(page);
  await expect(page.locator('#result-od-basecurve')).toContainText('von Ihnen vorgegeben');
  await expect(page.locator('#result-od-basecurve')).toContainText('0,00');
  await expect(page.locator('#expert-basecurve-err')).not.toContainText('Außerhalb');
  await bcField(page).fill('12');
  await bcField(page).blur();
  await expect(page.locator('#expert-basecurve-err')).toContainText('Außerhalb des Modells');
  await settled(page);
  // never clamped: both eyes are blocked, no numbers
  await expect(page.locator('#result-od-ct')).toHaveText('–');
  await expect(page.locator('#result-os-ct')).toHaveText('–');
  await bcField(page).fill('');
  await settled(page);
  await expect(page.locator('#result-od-basecurve')).toContainText('nahezu so dünn wie möglich');
});

test('minimum thicknesses: pre-filled per material, typed value kept, Standardwerte setzen, switch off', async ({ page }) => {
  await settled(page);
  const autoCt = await text(page, '#result-od-ct');
  expect(autoCt).toBe('1,8 mm');
  await sw(page).check();
  const minCt = page.locator('#expert-min-ct');
  await expect(minCt).toHaveValue('1,8');
  await material(page, 'idx174').check();
  await settled(page);
  await expect(minCt).toHaveValue('1,1');
  await minCt.fill('2,5');
  await settled(page);
  await expect(page.locator('#result-od-ct')).toHaveText('2,5 mm');
  await material(page, 'idx160').check();
  await settled(page);
  await expect(minCt).toHaveValue('2,5');
  await material(page, 'idx174').check();
  await settled(page);
  await page.locator('#expert-min-reset').click();
  await settled(page);
  await expect(minCt).toHaveValue('1,1');
  await minCt.fill('2,5');
  await settled(page);
  await expect(page.locator('#result-od-ct')).toHaveText('2,5 mm');
  await sw(page).uncheck();
  await settled(page);
  // overrides stop applying; 1,74 minimum CT 1,1 mm
  await expect(page.locator('#result-od-ct')).not.toHaveText('2,5 mm');
  await material(page, 'cr39').check();
  await settled(page);
  await expect(page.locator('#result-od-ct')).toHaveText(autoCt);
  // the typed value is kept for later
  await sw(page).check();
  await expect(minCt).toHaveValue('2,5');
  await settled(page);
  await expect(page.locator('#result-od-ct')).toHaveText('2,5 mm');
});

test('convex manual back: warning with the steeper-curve advice, a steeper curve clears it', async ({ page }) => {
  // +2,00, manual 0,50: D2 = Sph − D1v ≈ +1,50 dpt > 0 (engine pin: +1,4995 in rechteckig 52×38/18, PD 32)
  await sphPair(page, '+2,00', '+2,00');
  await sw(page).check();
  await bcField(page).fill('0,5');
  await settled(page);
  const box = page.locator('#diag-od');
  await expect(box).toContainText('Rückfläche zum Auge hin gewölbt');
  await expect(box).toContainText('stärker gewölbte');
  // still computed: a warning keeps the numbers
  await expect(page.locator('#result-od-ct')).not.toHaveText('–');
  await bcField(page).fill('3');
  await settled(page);
  await expect(box).not.toContainText('Rückfläche zum Auge hin gewölbt');
});

test('min-thickness source: 1,74 minimum edge is assumed, 1,50 is the manufacturer value', async ({ page }) => {
  await settled(page);
  await sw(page).check();
  await material(page, 'idx174').check();
  await settled(page);
  await expect(page.locator('#expert-min-et-echo')).toContainText('angenommen');
  await expect(page.locator('#expert-min-ct-echo')).toContainText('Herstellerangabe');
  await material(page, 'cr39').check();
  await settled(page);
  await expect(page.locator('#expert-min-et-echo')).toContainText('Herstellerangabe');
  await page.locator('#expert-min-et').fill('1,5');
  await settled(page);
  await expect(page.locator('#expert-min-et-echo')).toContainText('von Ihnen vorgegeben');
});

test('Vogel apply, automatic line, minus note and the comparison footnote', async ({ page }) => {
  await settledCompare(page);
  await sw(page).check();
  await settledCompare(page);
  await expect(page.locator('#cmp-footnote')).toBeHidden();
  // Example R −2,75 −0,50 × 180: SE −3,00, Vogel −3/2 + 6 = +4,50; the thinnest rule gives +0,50
  await expect(page.locator('#expert-bc-auto-od')).toContainText('automatisch: +0,50');
  await expect(page.locator('#expert-bc-auto-od')).toContainText('gerundet: +4,50');
  await expect(page.locator('#expert-bc-auto-od')).toContainText('dicksten Stelle');
  await expect(page.locator('#expert-bc-minus-note')).toBeVisible();
  await expect(page.locator('#expert-binding-od')).toContainText('Rechtes Glas: Die Mittendicke ist durch den Mindestwert');
  const autoThick = await text(page, '#result-od-thick');
  await page.locator('#expert-bc-vogel').click();
  await expect(bcField(page)).toHaveValue('4,50');
  await settledCompare(page);
  await expect(page.locator('#result-od-basecurve')).toContainText('+4,50');
  await expect(page.locator('#result-od-basecurve')).toContainText('von Ihnen vorgegeben');
  // the automatic value stays in view next to the manual one
  await expect(page.locator('#expert-bc-auto-od')).toContainText('automatisch: +0,50');
  const num = (s) => Number(s.replace(/[^\d,]/g, '').replace(',', '.'));
  expect(num(await text(page, '#result-od-thick'))).toBeGreaterThan(num(autoThick));
  await expect(page.locator('#cmp-footnote')).toBeVisible();
  await expect(page.locator('#cmp-footnote')).toContainText('eigenen Mindestdicken');
  await bcField(page).fill('');
  await settledCompare(page);
  await expect(page.locator('#cmp-footnote')).toBeHidden();
});

test('Glas-Einstellungen: no WCAG violations in the material section with the switch on', async ({ page }) => {
  await settled(page);
  await sw(page).check();
  await bcField(page).fill('12');
  await bcField(page).blur();
  await expect(page.locator('#expert-basecurve-err')).toBeVisible();
  for (const id of ['tip-basecurve', 'tip-minct', 'tip-minet']) await page.locator(`[aria-controls=${id}]`).click();
  const { violations } = await new AxeBuilder({ page })
    .include('#material-section')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await expect(page.locator('#tip-dec')).toBeHidden();
  await page.locator('[aria-controls=tip-dec]').click();
  await expect(page.locator('#tip-dec')).toContainText('optische Mittelpunkt');
});

