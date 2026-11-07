// Querschnitt (02-13, ANA-01, D-30, D-37): the meniscus profile of a meridian in the
// Experten-Analyse, drawn at 1:1 from the engine's meridianProfile (worker compare lane).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settledCompare, settledXsec, plain, guardPage } from './helpers.js';
/* global document */

guardPage(test);

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const text = async (loc) => plain(await loc.textContent());
const svg = (page) => page.locator('#xsec-figure svg');
const cell = (page, row, col = 'b') => page.locator(`#xsec-table td[data-row=${row}][data-col=${col}]`);

async function expertOn(page) {
  await settledCompare(page);
  await page.locator('#expert').check();
  await settledXsec(page);
}

test('example OD: horizontal section with title, CT and two end values in SVG and table', async ({ page }) => {
  await expertOn(page);
  await expect(page.locator('#xsec svg[role=img]')).toHaveCount(1);
  const title = await text(svg(page).locator('title'));
  expect(title).toContain('Querschnitt');
  expect(title).toContain('0°');
  expect(await text(cell(page, 'ct'))).toBe('1,8 mm');
  for (const row of ['ct', 'end0', 'end1']) {
    expect(await text(svg(page).locator(`text[data-val=${row}]`))).toBe(await text(cell(page, row)));
  }
  expect(await text(svg(page).locator('desc'))).toContain('1,8 mm');
});

test('example OD (Zyl −0,50 × 180): the meridian select offers 0° and 90°', async ({ page }) => {
  await expertOn(page);
  await expect(page.locator('#xsec-meridian option')).toHaveCount(2);
  await expect(page.locator('#xsec-meridian option').nth(0)).toHaveAttribute('value', '0');
  await expect(page.locator('#xsec-meridian option').nth(1)).toHaveAttribute('value', '90');
});

test('comparison with 1,74 as B: one dashed path and the text legend', async ({ page }) => {
  await expertOn(page);
  await page.locator('#cmp-start').click();
  await page.locator('input[name=material][value=idx174]').check();
  await settledXsec(page);
  await expect(svg(page).locator('path[stroke-dasharray]')).toHaveCount(1);
  await expect(svg(page).locator('path.xs-lens')).toHaveCount(2);
  await expect(page.locator('#xsec-legend')).toBeVisible();
  expect(await text(page.locator('#xsec-legend'))).toBe('A (Vorher) — durchgezogen · B (Nachher) — gestrichelt');
  await expect(page.locator('#xsec-table td[data-col=a]')).toHaveCount(3);
});

test('true 1:1 aspect: px per mm equal in x and y', async ({ page }) => {
  await expertOn(page);
  const { sx, sy } = await page.evaluate(() => {
    const p = /** @type {SVGGraphicsElement} */ (document.querySelector('#xsec-figure svg path.xs-lens'));
    const b = p.getBBox();
    const r = p.getBoundingClientRect();
    return { sx: r.width / b.width, sy: r.height / b.height };
  });
  expect(sx).toBeGreaterThan(2);
  expect(Math.abs(sx - sy) / sx).toBeLessThan(0.02);
});

test('the CT in the section equals the result card; end values equal the table', async ({ page }) => {
  await expertOn(page);
  const card = await text(page.locator('#result-od-ct'));
  expect(await text(svg(page).locator('text[data-val=ct]'))).toBe(card);
  expect(await text(cell(page, 'ct'))).toBe(card);
  const desc = await text(svg(page).locator('desc'));
  for (const row of ['end0', 'end1']) expect(desc).toContain(await text(cell(page, row)));
  // Example OD horizontal: the end in +x is nasal (OD), the other temporal.
  await expect(page.locator('#xsec-table tbody th').nth(1)).toHaveText('Rand Nase');
  await expect(page.locator('#xsec-table tbody th').nth(2)).toHaveText('Rand Schläfe');
});

test('switching to the left lens redraws (title, CT from the left card)', async ({ page }) => {
  await expertOn(page);
  await page.locator('#xsec-eye label', { hasText: 'Linkes Glas' }).click();
  await settledXsec(page);
  expect(await text(svg(page).locator('title'))).toContain('Linkes Glas');
  expect(await text(cell(page, 'ct'))).toBe(await text(page.locator('#result-os-ct')));
});

test('Hornhautverkrümmung preset: choosing the principal meridian 90° changes the title angle', async ({ page }) => {
  await expertOn(page);
  await page.locator('#rx-presets .chip', { hasText: 'Hornhaut' }).click();
  await settledXsec(page);
  await expect(page.locator('#xsec-meridian option')).toHaveCount(2);
  expect(await text(page.locator('#xsec-meridian option').nth(1))).toBe('Hauptschnitt 90° (−2,50 dpt)');
  expect(await text(svg(page).locator('title'))).toContain('Schnitt 0°');
  const ct0 = await text(cell(page, 'ct'));
  const end0 = await text(cell(page, 'end0'));
  await page.locator('#xsec-meridian').selectOption('90');
  await settledXsec(page);
  expect(await text(svg(page).locator('title'))).toContain('Schnitt 90°');
  expect(await text(cell(page, 'ct'))).toBe(ct0);
  expect(await text(cell(page, 'end0'))).not.toBe(end0);
  await expect(page.locator('#xsec-table tbody th').nth(1)).toHaveText('Rand oben');
  await expect(page.locator('#xsec-table tbody th').nth(2)).toHaveText('Rand unten');
});

test('oblique principal meridian R −1,00 / −2,00 × 30: two-word end labels', async ({ page }) => {
  await expertOn(page);
  await page.locator('#rx-od-sph').fill('-1,00');
  await page.locator('#rx-od-cyl').fill('-2,00');
  await page.locator('#rx-od-axis').fill('30');
  await settledXsec(page);
  await expect(page.locator('#xsec-meridian option')).toHaveCount(3);
  await page.locator('#xsec-meridian').selectOption('30');
  await settledXsec(page);
  // meridianEndLabels('OD', 30) = ['nasal-superior', 'temporal-inferior']
  await expect(page.locator('#xsec-table tbody th').nth(1)).toHaveText('Rand Nase oben');
  await expect(page.locator('#xsec-table tbody th').nth(2)).toHaveText('Rand Schläfe unten');
  await page.locator('#xsec-meridian').selectOption('120');
  await settledXsec(page);
  // ('OD', 120) = ['temporal-superior', 'nasal-inferior']
  await expect(page.locator('#xsec-table tbody th').nth(1)).toHaveText('Rand Schläfe oben');
  await expect(page.locator('#xsec-table tbody th').nth(2)).toHaveText('Rand Nase unten');
});

test('no style attributes inside #xsec (CSP); the switch off stops profile work', async ({ page }) => {
  await expertOn(page);
  await page.locator('#cmp-start').click();
  await page.locator('input[name=material][value=idx174]').check();
  await settledXsec(page);
  expect(await page.evaluate(() => document.querySelectorAll('#xsec [style]').length)).toBe(0);
  expect(await page.evaluate(() => document.querySelectorAll('#xsec style').length)).toBe(0);
  await page.locator('#expert').uncheck();
  await page.locator('#rx-od-sph').fill('-3,00');
  await settledCompare(page);
  await expect(page.locator('#xsec')).toHaveAttribute('data-pending', '');
  await expect(page.locator('#xsec')).toBeHidden();
});

for (const width of [320, 1280]) {
  test(`axe: no WCAG violations in #xsec at ${width} px; no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await expertOn(page);
    await page.locator('#cmp-start').click();
    await page.locator('input[name=material][value=idx174]').check();
    await settledXsec(page);
    const { violations } = await new AxeBuilder({ page }).include('#xsec').withTags(WCAG).analyze();
    expect(violations).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
