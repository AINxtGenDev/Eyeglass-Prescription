// Querschnitt (02-13, ANA-01, D-30, D-37): the meniscus profile of a meridian in the
// Experten-Analyse, drawn at 1:1 from the engine's meridianProfile (worker compare lane).
import { test, expect } from '@playwright/test';
import { settledCompare, settledXsec, plain, guardPage } from './helpers.js';
/* global document */

guardPage(test);

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
