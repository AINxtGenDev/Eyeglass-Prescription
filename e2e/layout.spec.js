// Page layout from 320 px to desktop (02-02, UX-03, D-19, D-20, D-21): no horizontal scrolling,
// phone summary bar, two sticky columns on desktop, reserved phase-3 slots.
// Pinned values: 02-01-SUMMARY Task 2 table (example 4,597 / 4,597 mm, 6,86 / 6,75 g; R +3,00 CT
// 3,902, 7,23 g; L +2,75 CT 3,737, 7,00 g; CR-39, Rechteckig 52×38/18).
import { test, expect } from '@playwright/test';
import { settled, plain, guardPage } from './helpers.js';
/* global document, window, getComputedStyle -- page.evaluate bodies run in the browser */

guardPage(test);

const noHorizontalScroll = (page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    return { scroll: d.scrollWidth, client: d.clientWidth };
  });

async function expectNoHorizontalScroll(page, when) {
  const { scroll, client } = await noHorizontalScroll(page);
  expect(scroll, `scrollWidth <= clientWidth ${when}`).toBeLessThanOrEqual(client);
}

const barValues = async (page) => plain(await page.locator('#summary-bar-values').textContent());

test('viewport meta resizes the content for the on-screen keyboard', async ({ page }) => {
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).toContain('interactive-widget=resizes-content');
});

test.describe('320 × 640', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('never scrolls horizontally, also with a long value and without hyphenation', async ({ page }) => {
    await settled(page);
    await expectNoHorizontalScroll(page, 'on load');
    await page.locator('#rx-od-sph').fill('-12,00');
    await settled(page);
    await expectNoHorizontalScroll(page, "after '-12,00'");
    // Hyphenation is never relied on: a test-only stylesheet (Playwright, not the app CSP) turns
    // automatic hyphenation off; overflow-wrap: anywhere must still keep the page inside.
    await page.addStyleTag({ content: 'body{-webkit-hyphens:manual;hyphens:manual}' });
    expect(await page.evaluate(() => getComputedStyle(document.body).hyphens)).toBe('manual');
    await expectNoHorizontalScroll(page, 'with hyphens: manual');
    await page.locator('#expert').check();
    await expectNoHorizontalScroll(page, 'with the Experten-Ansicht on');
  });
});

test.describe('360 × 780', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('summary bar shows both eyes while the result is out of view', async ({ page }) => {
    await settled(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('#rx-od-sph')).toBeInViewport();
    await expect(page.locator('#result')).not.toBeInViewport();
    const bar = page.locator('#summary-bar');
    await expect(bar).toBeVisible();
    expect(await barValues(page)).toBe('R 4,6 mm · 7 g | L 4,6 mm · 7 g');
    await expect(page.locator('#summary-bar-label')).toHaveText('Dickste Stelle · Gewicht');
    // the bar repeats the card strings, it never formats on its own (T-02-05)
    const card = plain(await page.locator('#result-od-thick').textContent());
    expect(await barValues(page)).toContain(`R ${card} · `);
    await expect(bar).not.toHaveAttribute('aria-live', /.*/);
    await expect(bar).toHaveAttribute('aria-label', /^Zum Ergebnis: rechts dickste Stelle 4,6\smm, 7\sg; links dickste Stelle 4,6\smm, 7\sg$/);
  });

  test('plus lenses: the bar shows the centre as the thickest point', async ({ page }) => {
    await page.locator('#example-clear').click();
    await page.locator('#rx-od-pd').fill('32');
    await page.locator('#rx-os-pd').fill('31,5');
    await page.locator('#rx-od-sph').fill('+3,00');
    await page.locator('#rx-os-sph').fill('+2,75');
    await settled(page);
    expect(await barValues(page)).toBe('R 3,9 mm · 7 g | L 3,7 mm · 7 g');
  });

  test('the bar hides while the result cards are in view', async ({ page }) => {
    await settled(page);
    await page.locator('#result-od-card').scrollIntoViewIfNeeded();
    await expect(page.locator('#result-od-card')).toBeInViewport();
    await expect(page.locator('#summary-bar')).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('#summary-bar')).toBeVisible();
  });

  test('a focused field at the bottom edge is not covered by the bar (WCAG 2.4.11)', async ({ page }) => {
    await settled(page);
    const pd = page.locator('#rx-os-pd');
    // put the field's bottom edge on the viewport's bottom edge, behind where the bar sits
    await page.evaluate(() => {
      const r = document.getElementById('rx-os-pd').getBoundingClientRect();
      window.scrollBy(0, r.bottom - window.innerHeight);
    });
    await expect(page.locator('#summary-bar')).toBeVisible();
    await pd.focus();
    await expect(pd).toBeFocused();
    const field = await pd.boundingBox();
    const bar = await page.locator('#summary-bar').boundingBox();
    expect(field.y + field.height, 'field bottom <= bar top').toBeLessThanOrEqual(bar.y);
  });

  test('tapping the bar moves focus to the result heading', async ({ page }) => {
    await settled(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('#summary-bar').click();
    await expect(page.locator('#result-title')).toBeFocused();
    await expect(page.locator('#result-title')).toHaveAttribute('tabindex', '-1');
  });

  test('never scrolls horizontally', async ({ page }) => {
    await settled(page);
    await expectNoHorizontalScroll(page, 'at 360 px');
  });
});

test.describe('1280 × 800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('two columns: sticky results with the empty phase-3 slot first, no bar', async ({ page }) => {
    await settled(page);
    const results = page.locator('.col-results');
    expect(await results.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
    const first = await results.evaluate((el) => el.firstElementChild?.id ?? null);
    expect(first).toBe('view-slot');
    await expect(page.locator('#view-slot')).toHaveAttribute('hidden', '');
    await expect(page.locator('#view-slot')).toBeEmpty();
    await expect(page.locator('#bar-view-slot')).toHaveAttribute('hidden', '');
    await expect(page.locator('#summary-bar')).toBeHidden();
    // inputs left, results right
    const inputs = await page.locator('.col-inputs').boundingBox();
    const res = await results.boundingBox();
    expect(res.x).toBeGreaterThan(inputs.x + inputs.width - 1);
    await expectNoHorizontalScroll(page, 'at 1280 px');
  });
});
