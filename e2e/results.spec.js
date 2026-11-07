// Result cards per eye (RES-01), L/R callout (RES-04) and the example at load (RES-05 / D-26), 02-01.
// Pinned values: node with src/engine/evaluate.js, CR-39, Rechteckig 52×38/18 unless stated,
// re-verified 2026-11-07 after the 02-01 tie rule (values in 02-01-SUMMARY.md).
import { test, expect } from '@playwright/test';
import { settled, plain, guardPage } from './helpers.js';

guardPage(test);

const RX = ['sph', 'cyl', 'axis', 'pd'];
const text = async (page, id) => plain(await page.locator(id).textContent());

/** Clear the example, then type one sphere per eye with Zyl/Achse empty. */
async function sphPair(page, od, os, { pdOD = '32', pdOS = '31,5' } = {}) {
  await page.locator('#example-clear').click();
  await page.locator('#rx-od-pd').fill(pdOD);
  await page.locator('#rx-os-pd').fill(pdOS);
  await page.locator('#rx-od-sph').fill(od);
  await page.locator('#rx-os-sph').fill(os);
  await settled(page);
}

async function expectThick(page, od, os) {
  await expect(page.locator('#result-od-thick')).toHaveText(new RegExp(`^${od}\\smm$`));
  await expect(page.locator('#result-os-thick')).toHaveText(new RegExp(`^${os}\\smm$`));
}

test('example at load: banner, both cards with the pinned values, no L/R sentence', async ({ page }) => {
  await settled(page);
  await expect(page.locator('#example-banner')).toBeVisible();
  await expect(page.locator('#example-banner')).toContainText('Beispiel');
  await expect(page.locator('#result-od-card h3')).toHaveText('Rechtes Glas (R)');
  await expect(page.locator('#result-os-card h3')).toHaveText('Linkes Glas (L)');
  // OD −2,75/−0,50×180 PD 32: CT 1,800, etMax 4,597 temporal-superior, etMin 2,980 superior, 6,86 g.
  // OS −2,50/−0,75×170 PD 31,5: CT 1,800, etMax 4,597 temporal-superior, etMin 2,969 superior, 6,75 g.
  for (const eye of ['od', 'os']) {
    await expect(page.locator(`#result-${eye}-thick`)).toHaveText(/^4,6\smm$/);
    await expect(page.locator(`#result-${eye}-thick-loc`)).toHaveText('außen oben');
    await expect(page.locator(`#result-${eye}-etmin`)).toHaveText(/^3,0\smm$/);
    await expect(page.locator(`#result-${eye}-etmin-loc`)).toHaveText('oben');
    await expect(page.locator(`#result-${eye}-ct`)).toHaveText(/^1,8\smm$/);
    await expect(page.locator(`#result-${eye}-weight`)).toHaveText(/^7\sg$/);
    await expect(page.locator(`#result-${eye}-grid dd`)).toHaveCount(4);
  }
  expect(await text(page, '#result-od-headline')).toBe(
    'Rechtes Glas: am dicksten 4,6 mm außen oben, am dünnsten 3,0 mm oben. Mitte 1,8 mm, Gewicht 7 g.',
  );
  expect(await text(page, '#result-os-headline')).toBe(
    'Linkes Glas: am dicksten 4,6 mm außen oben, am dünnsten 3,0 mm oben. Mitte 1,8 mm, Gewicht 7 g.',
  );
  await expect(page.locator('#lr-callout')).toBeHidden();
});

test('banner disappears on the first Rx edit', async ({ page }) => {
  await expect(page.locator('#example-banner')).toBeVisible();
  await page.locator('#rx-os-sph').fill('-3,00');
  await expect(page.locator('#example-banner')).toHaveCount(0);
});

test('"Eigene Werte eingeben" empties the eight Rx fields and focuses R Sph', async ({ page }) => {
  await page.locator('#example-clear').click();
  await expect(page.locator('#example-banner')).toHaveCount(0);
  for (const eye of ['od', 'os']) {
    for (const f of RX) await expect(page.locator(`#rx-${eye}-${f}`)).toHaveValue('');
  }
  await expect(page.locator('#rx-od-sph')).toBeFocused();
});

test.describe('L/R callout (RES-04)', () => {
  test('R −4,00 / L −5,25: the left glass is thicker (5,8 / 7,2 mm)', async ({ page }) => {
    // thickest 5,755 / 7,223 mm → displayed Δ 1,4 mm
    await sphPair(page, '-4,00', '-5,25');
    await expectThick(page, '5,8', '7,2');
    const callout = page.locator('#lr-callout');
    await expect(callout).toBeVisible();
    await expect(callout).toContainText('linke');
    await expect(callout).toContainText('dicker');
  });

  test('R −4,00 / L −4,50: no sentence (5,8 / 6,4 mm)', async ({ page }) => {
    // thickest 5,755 / 6,406 mm → displayed Δ 0,6 mm; weights 7,76 / 8,22 g → 8 / 8 g
    await sphPair(page, '-4,00', '-4,50');
    await expectThick(page, '5,8', '6,4');
    await expect(page.locator('#lr-callout')).toBeHidden();
  });

  test('R −2,00 / L −1,00: no sentence (3,7 / 2,8 mm)', async ({ page }) => {
    // thickest 3,748 / 2,798 mm → displayed Δ 0,9 mm; weights 6,10 / 5,29 g → 6 / 5 g
    await sphPair(page, '-2,00', '-1,00');
    await expectThick(page, '3,7', '2,8');
    await expect(page.locator('#lr-callout')).toBeHidden();
  });

  test('same Rx −4,00, PD 29 / 34: the right glass is thicker because of the PD', async ({ page }) => {
    // thickest 6,494 / 5,310 mm → displayed 6,5 / 5,3, Δ 1,2 mm, cause pd
    await sphPair(page, '-4,00', '-4,00', { pdOD: '29', pdOS: '34' });
    await expectThick(page, '6,5', '5,3');
    const callout = page.locator('#lr-callout');
    await expect(callout).toBeVisible();
    await expect(callout).toContainText('rechte');
    await expect(callout).toContainText('dicker');
    // soft hyphen in Pupillen·distanz (02-02, UI-SPEC Typography): compare the plain text
    expect(plain(await callout.textContent())).toContain('Pupillendistanz');
    await expect(callout).not.toContainText('Rezeptwerte');
  });

  test('same Rx −10,00, PD 32 / 30,5: the sentence names the PD (12,9 / 14,0 mm)', async ({ page }) => {
    // thickest 12,866 / 14,028 mm → displayed Δ 1,1 mm, cause pd
    await sphPair(page, '-10,00', '-10,00', { pdOD: '32', pdOS: '30,5' });
    await expectThick(page, '12,9', '14,0');
    expect(await text(page, '#lr-callout')).toContain('Pupillendistanz');
  });
});

test('uniform edge: rund 50/50/18, PD 34, −3,00 both eyes', async ({ page }) => {
  // decentration 0, etMax = etMin = 3,692 mm, CT 1,800, 7,11 g
  await page.locator('#example-clear').click();
  await page.locator('#frame-shape').selectOption('rund');
  await page.locator('#frame-a').fill('50');
  await page.locator('#frame-b').fill('50');
  await page.locator('#frame-dbl').fill('18');
  await page.locator('#rx-od-pd').fill('34');
  await page.locator('#rx-os-pd').fill('34');
  await page.locator('#rx-od-sph').fill('-3,00');
  await page.locator('#rx-os-sph').fill('-3,00');
  await settled(page);
  expect(await text(page, '#result-od-headline')).toBe(
    'Rechtes Glas: Rand ringsum 3,7 mm dick, Mitte 1,8 mm. Gewicht 7 g.',
  );
  await expect(page.locator('#result-od-thick-loc')).toHaveText('am ganzen Rand');
  await expect(page.locator('#result-od-etmin-loc')).toHaveText('am ganzen Rand');
});

test('plus lens is thickest in the middle', async ({ page }) => {
  // R +3,00 PD 32: CT 3,902, etMax 2,824 superior, etMin 1,000 temporal-superior, 7,23 g.
  // L +2,75 PD 31,5: CT 3,737 → 3,7 mm in der Mitte.
  await sphPair(page, '+3,00', '+2,75');
  expect(await text(page, '#result-od-headline')).toBe(
    'Rechtes Glas: am dicksten 3,9 mm in der Mitte, am dünnsten 1,0 mm außen oben. Mitte 3,9 mm, Gewicht 7 g.',
  );
  await expect(page.locator('#result-od-thick-loc')).toHaveText('in der Mitte');
  await expect(page.locator('#result-os-thick')).toHaveText(/^3,7\smm$/);
  await expect(page.locator('#result-os-thick-loc')).toHaveText('in der Mitte');
});

test('mixed cylinder: the edge wins over the centre', async ({ page }) => {
  // R +2,00 / −3,00 × 90 PD 32: CT 1,800, etMax 2,659 temporal → 2,7 mm außen (zur Schläfe)
  await page.locator('#example-clear').click();
  await page.locator('#rx-od-pd').fill('32');
  await page.locator('#rx-od-sph').fill('+2,00');
  await page.locator('#rx-od-cyl').fill('-3,00');
  await page.locator('#rx-od-axis').fill('90');
  await settled(page);
  await expect(page.locator('#result-od-thick')).toHaveText(/^2,7\smm$/);
  await expect(page.locator('#result-od-thick-loc')).toHaveText('außen (zur Schläfe)');
});
