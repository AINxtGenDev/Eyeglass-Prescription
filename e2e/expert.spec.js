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
  expect(await text(page, '#result-od-etmax-loc')).toBe('am ganzen Rand (rundum gleich)');
  expect(await text(page, '#result-od-thick-loc')).toBe('am ganzen Rand (rundum gleich)');
  // Thinnest point = the centre (02-16), with the Expert suffix.
  expect(await text(page, '#result-od-thin-loc')).toBe('in der Mitte (optischer Mittelpunkt)');
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


// ---- Vorderfläche and Randtiefe (02-11, MAT-05, FRAME-02) ----
const front = (page, v) => page.locator(`input[name=expert-front][value=${v}]`);
const kField = (page) => page.locator('#expert-k');
const num = (s) => Number(s.replace(/[^\d,−-]/g, '').replace('−', '-').replace(',', '.'));
/** First signed decimal of the base-curve cell ("+3,95 dpt – …"). */
const d1Of = async (page) => num((await text(page, '#result-od-basecurve')).match(/[+−-]?\d+,\d+/)[0]);

test('aspheric front: k field and note only for asphärisch, thinner plus centre, same base curve', async ({ page }) => {
  // engine: +4,00 CR-39 rechteckig 52×38/18 CT 4,876 (k 0) → 4,817 (−1) → 4,613 (−5); D1 3,9508 → 3,9514 at −5
  await sphPair(page, '+4,00', '+4,00');
  await sw(page).check();
  await settled(page);
  await expect(front(page, 'sph')).toBeChecked();
  await expect(page.locator('#expert-k-wrap')).toBeHidden();
  const ctSph = num(await text(page, '#result-od-ct'));
  const d1Sph = await d1Of(page);
  await expect(page.locator('#expert-bc-auto-od')).not.toContainText('für sphärische Vorderfläche bestimmt');
  await front(page, 'asph').check();
  await expect(page.locator('#expert-k-wrap')).toBeVisible();
  await expect(kField(page)).toHaveValue('−1');
  await expect(page.locator('#expert-asph-note')).toHaveText('In diesem Modell ändert die asphärische Vorderfläche vor allem Plusgläser.');
  await settled(page);
  expect(num(await text(page, '#result-od-ct'))).toBeLessThan(ctSph);
  expect(Math.abs((await d1Of(page)) - d1Sph)).toBeLessThan(0.01);
  await expect(page.locator('#expert-bc-auto-od')).toContainText('für sphärische Vorderfläche bestimmt');
  await expect(page.locator('#result-od-basecurve')).toContainText('für sphärische Vorderfläche bestimmt');
  await expect(page.locator('#cmp-footnote')).toBeVisible();
  // k = −5 keeps the base curve (engine raise +0,0006 dpt) and thins the centre further
  const ctK1 = num(await text(page, '#result-od-ct'));
  await kField(page).fill('−5');
  await settled(page);
  expect(Math.abs((await d1Of(page)) - d1Sph)).toBeLessThan(0.01);
  expect(num(await text(page, '#result-od-ct'))).toBeLessThan(ctK1);
  // back to sphärisch: the sphere result and no spherical-basis label
  await front(page, 'sph').check();
  await expect(page.locator('#expert-k-wrap')).toBeHidden();
  await settled(page);
  expect(num(await text(page, '#result-od-ct'))).toBe(ctSph);
  await expect(page.locator('#expert-bc-auto-od')).not.toContainText('für sphärische Vorderfläche bestimmt');
});

test('k range: −6, 0 and −0,5 are Außerhalb des Modells; −1 and −5 compute', async ({ page }) => {
  await sphPair(page, '+4,00', '+4,00');
  await sw(page).check();
  await front(page, 'asph').check();
  for (const k of ['−6', '0', '−0,5']) {
    await kField(page).fill(k);
    await kField(page).blur();
    await expect(page.locator('#expert-k-err')).toContainText('Außerhalb des Modells');
    await settled(page);
    await expect(page.locator('#result-od-ct')).toHaveText('–');
  }
  for (const k of ['−1', '−5']) {
    await kField(page).fill(k);
    await kField(page).blur();
    await settled(page);
    await expect(page.locator('#expert-k-err')).toBeHidden();
    await expect(page.locator('#result-od-ct')).not.toHaveText('–');
  }
  // the sign button flips the value
  await page.locator('button.sign[data-for=expert-k]').click();
  await expect(kField(page)).toHaveValue('+5,00');
});

test('Randtiefe: default 3,0 mm, the example edge stands out 1,6 mm at the back, 10 fits, no recompute', async ({ page }) => {
  await settled(page);
  // same compute-message counter as the toggle test above
  await page.addInitScript(() => {
    window.__computeMsgs = 0;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (msg, ...rest) {
      if (msg?.type === 'compute') window.__computeMsgs++;
      return post.call(this, msg, ...rest);
    };
  });
  await page.reload();
  await settled(page);
  await sw(page).check();
  await settled(page);
  await expect(page.locator('#compute-mode')).toHaveAttribute('data-mode', 'worker');
  const n = await page.evaluate(() => window.__computeMsgs);
  expect(n, 'the counter must see the start-up compute').toBeGreaterThan(0);
  const rim = page.locator('#frame-rim');
  await expect(rim).toHaveValue('3,0');
  await expect(page.locator('#frame-rim-note')).toContainText('angenommener Wert, keine Herstellerangabe');
  // 03-01 (D-05, bevel '1:2'): example etMax 4,597 mm (OD and OS): back 4,597·2/3 − 1,5 = 1,565
  // → 1,6 mm, front 4,597/3 − 1,5 = 0,032 → bündig. Front-surface lead OD 0,515, OS 0,528 → 0,5 mm.
  await expect(page.locator('#frame-rim-result-od')).toHaveText(
    'Rechtes Glas: Der Glasrand steht an seiner dicksten Stelle hinten 1,6 mm aus der Fassung, vorne ist er bündig.',
  );
  await expect(page.locator('#frame-rim-result-os')).toContainText('hinten 1,6 mm');
  await expect(page.locator('#frame-rim-lead-od')).toHaveText(
    'Rechtes Glas: Die Vorderfläche wölbt sich bis zu 0,5 mm vor die Fassung.',
  );
  await expect(page.locator('#frame-rim-lead-os')).toContainText('bis zu 0,5 mm');
  await expect(page.locator('#frame-rim-bevel')).toBeVisible();
  await expect(page.locator('#frame-rim-bevel')).toContainText('angenommen');
  const ct = await text(page, '#result-od-ct');
  const weight = await text(page, '#result-od-weight');
  await rim.fill('5');
  // back 3,065 − 2,5 = 0,565 → 0,6 mm; lead 0,515 − 1 < 0
  await expect(page.locator('#frame-rim-result-od')).toContainText('hinten 0,6 mm');
  for (const eye of ['od', 'os']) {
    await expect(page.locator(`#frame-rim-lead-${eye}`)).toContainText('Die Vorderfläche wölbt sich nicht vor die Fassung.');
  }
  await rim.fill('10');
  await expect(page.locator('#frame-rim-result-od')).toHaveText('Rechtes Glas: Der Glasrand passt in die Tiefe der Fassung.');
  await expect(page.locator('#frame-rim-lead-od')).toHaveText('Rechtes Glas: Die Vorderfläche wölbt sich nicht vor die Fassung.');
  await expect(page.locator('#frame-rim-lead-os')).toHaveText('Linkes Glas: Die Vorderfläche wölbt sich nicht vor die Fassung.');
  // display only: never a compute job, so never 'rechnet …' and no pending result
  await expect(page.locator('#result-od-status')).not.toHaveText('rechnet …');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__computeMsgs)).toBe(n);
  await expect(page.locator('#result')).toHaveAttribute('data-pending', '');
  expect(await text(page, '#result-od-ct')).toBe(ct);
  expect(await text(page, '#result-od-weight')).toBe(weight);
  await rim.fill('12');
  await rim.blur();
  await expect(page.locator('#frame-rim-err')).toContainText('Außerhalb des Modells');
  await expect(page.locator('#frame-rim-result-od')).toHaveText('');
  await expect(page.locator('#frame-rim-lead-od')).toHaveText('');
  await expect(page.locator('#frame-rim-bevel')).toBeHidden();
  // it never blocks an eye
  await expect(page.locator('#result-od-ct')).toHaveText(ct);
});

test('Vorderfläche and Randtiefe: no WCAG violations with the switch on', async ({ page }) => {
  await settled(page);
  await sw(page).check();
  await front(page, 'asph').check();
  await kField(page).fill('−6');
  await kField(page).blur();
  await expect(page.locator('#expert-k-err')).toBeVisible();
  for (const id of ['tip-k', 'tip-rim']) await page.locator(`[aria-controls=${id}]`).click();
  await expect(page.locator('#tip-k')).toContainText('0 ist eine Kugel');
  await expect(page.locator('#tip-rim')).toContainText('Rand der Fassung');
  const { violations } = await new AxeBuilder({ page })
    .include('#glass-settings')
    .include('#frame-rim-wrap')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

// ---- Eigenes Material (02-12, MAT-06, D-17) ----
const customCard = (page) => page.locator('#material-custom-card');
/** Select 'Eigenes Material' and type its five values (empty strings leave a field as it is). */
async function customMaterial(page, { ne = '', density = '', abbe = '', minCT = '', minET = '' } = {}) {
  await material(page, 'custom').check();
  for (const [id, v] of Object.entries({ ne, density, abbe, 'min-ct': minCT, 'min-et': minET })) {
    if (v !== '') await page.locator(`#custom-${id}`).fill(v);
  }
}
const cardValues = async (page) => {
  const out = [];
  for (const e of ['od', 'os']) for (const c of ['thick', 'ct', 'thin', 'weight']) out.push(await text(page, `#result-${e}-${c}`));
  return out;
};

test('Eigenes Material: card only in the Experten-Ansicht; CR-39 constants give the 1,50 numbers, labelled', async ({ page }) => {
  await settled(page);
  await expect(customCard(page)).toBeHidden();
  const cr39 = await cardValues(page);
  await expect(page.locator('#result-od-custom')).toBeHidden();
  await sw(page).check();
  await expect(customCard(page)).toBeVisible();
  await expect(customCard(page)).toContainText('Eigenes Material');
  await expect(customCard(page)).toContainText('Werte selbst eingeben');
  await expect(page.locator('#custom-material')).toBeHidden();
  await material(page, 'custom').check();
  await expect(page.locator('#custom-material')).toBeVisible();
  // pre-filled from the listed material with the nearest nₑ (1,500 while nₑ is empty)
  await expect(page.locator('#custom-min-ct')).toHaveValue('1,8');
  await expect(page.locator('#custom-min-et')).toHaveValue('1,0');
  // the Glas-Einstellungen minimums are replaced by the custom ones
  await expect(page.locator('#expert-min')).toBeHidden();
  await customMaterial(page, { ne: '1,5', density: '1,32', abbe: '56', minCT: '1,8', minET: '1,0' });
  await settled(page);
  expect(await cardValues(page)).toEqual(cr39);
  for (const e of ['od', 'os']) {
    await expect(page.locator(`#result-${e}-custom`)).toBeVisible();
    await expect(page.locator(`#result-${e}-custom`)).toHaveText('beruht auf Ihren Angaben, kein geprüftes Material');
    await expect(page.locator(`#result-${e}-material`)).toContainText('Eigenes Material');
    await expect(page.locator(`#result-${e}-material`)).toContainText('beruht auf Ihren Angaben, kein geprüftes Material');
  }
  await expect(page.locator('#result-od-material')).toContainText('1,500');
  await expect(page.locator('#result-od-material')).toContainText('Abbe-Zahl 56');
});

test('Eigenes Material: nₑ prefill follows the nearest listed material until a minimum is typed', async ({ page }) => {
  await settled(page);
  await sw(page).check();
  await customMaterial(page, { ne: '1,62', density: '1,3' });
  // 1,62 is nearest to 1,60 (1,598): minus CT 1,2, plus ET 1,1
  await expect(page.locator('#custom-min-ct')).toHaveValue('1,2');
  await expect(page.locator('#custom-min-et')).toHaveValue('1,1');
  await expect(page.locator('#custom-min-ct-echo')).toContainText('vorbelegt wie 1,60');
  await page.locator('#custom-min-ct').fill('2,0');
  await page.locator('#custom-ne').fill('1,74');
  await settled(page);
  await expect(page.locator('#custom-min-ct')).toHaveValue('2,0');
  await expect(page.locator('#result-od-ct')).toHaveText('2,0 mm');
  // no Abbe number: computes, the line says so
  await expect(page.locator('#result-od-material')).toContainText('ohne Abbe-Zahl');
});

test('Eigenes Material: nₑ 2,1 is a Fehler and blocks; 1,95 is a Hinweis and computes', async ({ page }) => {
  await settled(page);
  await sw(page).check();
  await customMaterial(page, { ne: '2,1', density: '1,32', abbe: '56' });
  await page.locator('#custom-ne').blur();
  await expect(page.locator('#custom-ne-err')).toContainText('Fehler:');
  await expect(page.locator('#custom-ne-err')).toContainText('Brechungsindex nₑ 2,1');
  await settled(page);
  for (const e of ['od', 'os']) {
    await expect(page.locator(`#result-${e}-thick`)).toHaveText('–');
    await expect(page.locator(`#result-${e}-jump`)).toBeVisible();
  }
  await page.locator('#result-od-jump').click();
  await expect(page.locator('#custom-ne')).toBeFocused();
  await page.locator('#custom-ne').fill('1,95');
  await page.locator('#custom-ne').blur();
  await expect(page.locator('#custom-ne-err')).toContainText('Hinweis:');
  await settled(page);
  await expect(page.locator('#result-od-thick')).toHaveText(/^\d+,\d/);
  await expect(page.locator('#result-od-custom')).toBeVisible();
  // the tip explains ne against nd
  await page.locator('[aria-controls=tip-ne]').click();
  await expect(page.locator('#tip-ne')).toContainText('0,001 bis 0,007');
});

test('Eigenes Material: crown glass is heavier; the comparison has it on top and six sourced rows', async ({ page }) => {
  await settledCompare(page);
  const cr39Weight = await text(page, '#result-od-weight');
  await sw(page).check();
  await customMaterial(page, { ne: '1,523', density: '2,54', abbe: '58' });
  await settledCompare(page);
  const n = (s) => Number(s.replace(/[^\d,]/g, '').replace(',', '.'));
  expect(n(await text(page, '#result-od-weight'))).toBeGreaterThan(n(cr39Weight));
  const visibleRows = page.locator('#cmp-material-table tbody tr:visible');
  await expect(visibleRows).toHaveCount(7);
  await expect(visibleRows.first()).toHaveAttribute('data-material', 'custom');
  await expect(visibleRows.first()).toContainText('Eigenes Material');
  await expect(visibleRows.first()).toContainText('Ihre Auswahl');
  await expect(page.locator('#cmp-material-table tbody tr[data-selected]')).toHaveCount(1);
  // every sourced material is compared against it (lighter than crown glass)
  for (const id of ['cr39', 'trivex', 'pc', 'idx160', 'idx167', 'idx174']) {
    await expect(page.locator(`#cmp-material-table tbody tr[data-material=${id}]`)).toContainText('leichter');
  }
  await expect(page.locator('#cmp-custom-note')).toBeVisible();
  await expect(page.locator('#cmp-custom-note')).toHaveText(
    'Ihr eigenes Material ist hier nicht aufgeführt; verglichen werden nur geprüfte Materialien.',
  );
  // back to a listed material: six rows, no note
  await material(page, 'idx160').check();
  await settledCompare(page);
  await expect(visibleRows).toHaveCount(6);
  await expect(page.locator('#cmp-custom-note')).toBeHidden();
});

test('Eigenes Material: switching the Experten-Ansicht off falls back to the last listed material', async ({ page }) => {
  await settled(page);
  await sw(page).check();
  await material(page, 'idx167').check();
  await settled(page);
  const idx167 = await cardValues(page);
  await customMaterial(page, { ne: '1,523', density: '2,54', abbe: '58' });
  await settled(page);
  await expect(page.locator('#result-od-custom')).toBeVisible();
  await sw(page).uncheck();
  await settled(page);
  await expect(material(page, 'idx167')).toBeChecked();
  await expect(customCard(page)).toBeHidden();
  await expect(page.locator('#custom-material')).toBeHidden();
  await expect(page.locator('#material-err')).toBeVisible();
  await expect(page.locator('#material-err')).toHaveText(
    'Hinweis: Eigenes Material gilt nur in der Experten-Ansicht. Es wird wieder 1,67 · Hochbrechend verwendet.',
  );
  for (const e of ['od', 'os']) await expect(page.locator(`#result-${e}-custom`)).toBeHidden();
  await expect(page.locator('#result-od-material')).not.toContainText('Eigenes Material');
  expect(await cardValues(page)).toEqual(idx167);
  // switching on again keeps 1,67 selected and the typed values
  await sw(page).check();
  await expect(material(page, 'idx167')).toBeChecked();
  await expect(page.locator('#material-err')).toBeHidden();
  await material(page, 'custom').check();
  await expect(page.locator('#custom-ne')).toHaveValue('1,523');
});

test('Eigenes Material: no WCAG violations in the material section with the fields open', async ({ page }) => {
  await settled(page);
  await sw(page).check();
  await customMaterial(page, { ne: '2,1', density: '1,32' });
  await page.locator('#custom-ne').blur();
  await expect(page.locator('#custom-ne-err')).toBeVisible();
  await page.locator('[aria-controls=tip-ne]').click();
  const { violations } = await new AxeBuilder({ page })
    .include('#material-section')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('Eigenes Material as Vorher (A): frozen constants, labelled when Vorher is shown', async ({ page }) => {
  await settled(page);
  await sw(page).check();
  await customMaterial(page, { ne: '1,523', density: '2,54', abbe: '58' });
  await settledCompare(page);
  const glassWeight = await text(page, '#result-od-weight');
  await page.locator('#cmp-start').click();
  await settledCompare(page);
  await expect(page.locator('#cmp-a-status')).toContainText('Eigenes Material');
  await expect(page.locator('#cmp-diff')).toContainText('noch gleich');
  await material(page, 'cr39').check();
  await settledCompare(page);
  await expect(page.locator('#cmp-diff')).toContainText('leichter');
  await expect(page.locator('#result-od-custom')).toBeHidden();
  await page.locator('#cmp-show input[name=cmp-show][value=a]').check();
  await settledCompare(page);
  await expect(page.locator('#result-od-custom')).toBeVisible();
  await expect(page.locator('#result-od-material')).toContainText('Eigenes Material, nₑ 1,523');
  expect(await text(page, '#result-od-weight')).toBe(glassWeight);
});

// lens-critic m8 (02-19): every Expert-only element, listed explicitly from index.html (no generic
// selector that could match nothing), is hidden in the Simple view at load and again after the
// switch was on and off; 'Eigenes Material' with its fields and the Expert-override footnote too.
const EXPERT_ONLY = [
  '#frame-rim-wrap', // Randtiefe (rim depth)
  '#material-custom-card', // 'Eigenes Material' card
  '#custom-material', // its five fields
  '#custom-ne',
  '#glass-settings', // Glas-Einstellungen
  '#expert-basecurve',
  '#expert-min-ct',
  '#expert-min-et',
  '#expert-analysis', // Zwischenwerte and Querschnitt
  '#result-od-dec',
  '#result-os-basecurve',
  '#xsec', // Querschnitt
  '#cmp-footnote', // Expert-override footnote of the material table
];

test('UX-02 Simple view hides every Expert-only element (m8)', async ({ page }) => {
  expect(EXPERT_ONLY.length).toBeGreaterThanOrEqual(5);
  const allHidden = async (when) => {
    for (const sel of EXPERT_ONLY) {
      await expect(page.locator(sel), `${sel} exists (${when})`).toHaveCount(1);
      await expect(page.locator(sel), `${sel} hidden (${when})`).toBeHidden();
    }
    // the technical location name is an Expert suffix too
    await expect(page.locator('#result-od-thick-loc')).not.toContainText('(');
  };
  await settledCompare(page);
  await allHidden('load');

  await sw(page).check();
  for (const sel of ['#frame-rim-wrap', '#material-custom-card', '#glass-settings', '#expert-analysis']) await expect(page.locator(sel)).toBeVisible();
  await expect(page.locator('#result-od-thick-loc')).toContainText('(temporal-superior)');
  // An override shows the footnote, 'Eigenes Material' shows its fields.
  await page.locator('#expert-basecurve').fill('4');
  await settledCompare(page);
  await expect(page.locator('#cmp-footnote')).toBeVisible();
  await material(page, 'custom').check();
  await expect(page.locator('#custom-material')).toBeVisible();

  await sw(page).uncheck();
  await settledCompare(page);
  await allHidden('after on → off');
  await expect(material(page, 'custom')).not.toBeChecked();
});
