// Preset chips and the inline confirm (02-09, RES-05, D-27, UI-SPEC "Preset chips", "Inline confirm").
// Pinned values: node with src/engine/evaluate.js, CR-39, Rechteckig 52×38/18, PD 32 / 31,5, re-run
// 2026-11-07 for 02-09 (values in 02-09-SUMMARY.md):
//   Leicht kurzsichtig  R −1,25: etMax 3,013 temporal-superior, CT 1,800, 5,48 g
//                       L −1,00: etMax 2,798 temporal-superior, CT 1,800, 5,29 g
//   Stark kurzsichtig   R −6,50/−0,75×10: etMax 8,743 temporal-superior, CT 1,800, 10,14 g
//                       L −6,00/−0,50×170: etMax 8,263 temporal-superior, CT 1,800, 9,67 g
//   Weitsichtig         R +3,00: CT 3,902, etMax 2,824 superior, etMin 1,000 temporal-superior, 7,23 g
//                       L +2,75: CT 3,737, etMax 2,748 superior, 7,00 g
//   Hornhautverkrümmung R −0,50/−2,00×180: etMax 2,868 temporal-superior, CT 1,800, 5,42 g
//                       L −0,75/−1,75×10: etMax 3,294 temporal-inferior, CT 1,800, 5,58 g
// Frame: estimateB('rechteckig', 48 | 52 | 56) = 35 | 38 | 41.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settled, plain, guardPage } from './helpers.js';

guardPage(test);

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const text = async (page, sel) => plain(await page.locator(sel).textContent());
const chip = (page, name) => page.locator('#rx-presets .chip', { hasText: name });
const frameChip = (page, name) => page.locator('#frame-presets .chip', { hasText: name });
const confirmGroup = (page) => page.locator('[role="group"][aria-labelledby="preset-confirm-q"]');

/** Thickest point, its place, centre and weight of one card. */
async function card(page, eye) {
  return {
    thick: await text(page, `#result-${eye}-thick`),
    loc: await text(page, `#result-${eye}-thick-loc`),
    ct: await text(page, `#result-${eye}-ct`),
    weight: await text(page, `#result-${eye}-weight`),
  };
}

test.describe('chip rows', () => {
  test('Rx and frame chips with their labels, as buttons in labelled groups', async ({ page }) => {
    await settled(page);
    await expect(page.locator('#rx-presets')).toHaveAttribute('role', 'group');
    await expect(page.locator('#rx-presets-label')).toHaveText('Beispiele zum Ausprobieren:');
    const rx = (await page.locator('#rx-presets .chip').allTextContents()).map(plain);
    expect(rx).toEqual(['Leicht kurzsichtig', 'Stark kurzsichtig', 'Weitsichtig', 'Hornhautverkrümmung']);
    await expect(page.locator('#frame-presets')).toHaveAttribute('role', 'group');
    await expect(page.locator('#frame-presets-label')).toHaveText('Typische Größen:');
    const fr = (await page.locator('#frame-presets .chip').allTextContents()).map(plain);
    expect(fr).toEqual(['Klein (48□18)', 'Mittel (52□18)', 'Groß (56□18)']);
    for (const b of await page.locator('.chip').all()) await expect(b).toHaveAttribute('type', 'button');
  });
});

test.describe('untouched example: a preset applies at once', () => {
  test("'Stark kurzsichtig' removes the banner, keeps PD and shows the pinned values", async ({ page }) => {
    await settled(page);
    await chip(page, 'Stark kurzsichtig').click();
    await expect(confirmGroup(page)).toHaveCount(0);
    await expect(page.locator('#example-banner')).toHaveCount(0);
    await settled(page);
    expect(await page.locator('#rx-od-sph').inputValue()).toBe('-6,50');
    expect(await page.locator('#rx-od-cyl').inputValue()).toBe('-0,75');
    expect(await page.locator('#rx-od-axis').inputValue()).toBe('10');
    expect(await page.locator('#rx-os-sph').inputValue()).toBe('-6,00');
    expect(await page.locator('#rx-os-cyl').inputValue()).toBe('-0,50');
    expect(await page.locator('#rx-os-axis').inputValue()).toBe('170');
    expect(await page.locator('#rx-od-pd').inputValue()).toBe('32');
    expect(await page.locator('#rx-os-pd').inputValue()).toBe('31,5');
    expect(await card(page, 'od')).toEqual({ thick: '8,7 mm', loc: 'außen oben', ct: '1,8 mm', weight: '10 g' });
    expect(await card(page, 'os')).toEqual({ thick: '8,3 mm', loc: 'außen oben', ct: '1,8 mm', weight: '10 g' });
  });

  test("'Leicht kurzsichtig' empties Zyl and Achse", async ({ page }) => {
    await settled(page);
    await chip(page, 'Leicht kurzsichtig').click();
    await settled(page);
    for (const f of ['cyl', 'axis']) {
      expect(await page.locator(`#rx-od-${f}`).inputValue()).toBe('');
      expect(await page.locator(`#rx-os-${f}`).inputValue()).toBe('');
    }
    expect(await card(page, 'od')).toEqual({ thick: '3,0 mm', loc: 'außen oben', ct: '1,8 mm', weight: '5 g' });
    expect(await card(page, 'os')).toEqual({ thick: '2,8 mm', loc: 'außen oben', ct: '1,8 mm', weight: '5 g' });
  });

  test("'Weitsichtig': thickest in the centre; Experten-Ansicht edge rows 2,8 / 2,7 mm", async ({ page }) => {
    await settled(page);
    await chip(page, 'Weitsichtig').click();
    await settled(page);
    expect(await text(page, '#result-od-headline')).toContain('am dicksten 3,9 mm in der Mitte');
    expect(await text(page, '#result-od-headline')).toBe(
      'Rechtes Glas: am dicksten 3,9 mm in der Mitte, am dünnsten 1,0 mm außen oben. Mitte 3,9 mm, Gewicht 7 g.',
    );
    expect(await card(page, 'od')).toEqual({ thick: '3,9 mm', loc: 'in der Mitte', ct: '3,9 mm', weight: '7 g' });
    expect(await card(page, 'os')).toEqual({ thick: '3,7 mm', loc: 'in der Mitte', ct: '3,7 mm', weight: '7 g' });
    await page.locator('#expert').check();
    // 2,748 mm rounds to 2,7 (lens-critic MINOR-7)
    expect(await text(page, '#result-od-etmax')).toBe('2,8 mm');
    expect(await text(page, '#result-os-etmax')).toBe('2,7 mm');
  });

  test("'Hornhautverkrümmung': R außen oben (mirror tie), L außen unten", async ({ page }) => {
    await settled(page);
    await chip(page, /Hornhaut\u00AD?verkrümmung/).click();
    await settled(page);
    // Achse 180 makes the two temporal corners of R a mirror tie (values 4,4e-16 mm apart before
    // 02-01). The engine's TIE_TOL_MM rule (02-01 Task 1, larger y wins) resolves it to the upper
    // corner, so the pin equals the Achse 0 result. validateRxEye also normalises 180 to axisDeg 0
    // (02-09 scratch check), so both axes send the same spec.
    expect(await card(page, 'od')).toEqual({ thick: '2,9 mm', loc: 'außen oben', ct: '1,8 mm', weight: '5 g' });
    // L axis 10 is a genuine inferior corner: 3,294 vs the mirror corner 2,774 mm.
    expect(await card(page, 'os')).toEqual({ thick: '3,3 mm', loc: 'außen unten', ct: '1,8 mm', weight: '6 g' });
    const at180 = await text(page, '#result-od-thick-loc');
    await page.locator('#rx-od-axis').fill('0');
    await settled(page);
    expect(await text(page, '#result-od-thick-loc')).toBe(at180);
    expect(await text(page, '#result-od-thick')).toBe('2,9 mm');
  });

  test('"Gleich für beide Augen" is switched off so L gets its own preset values', async ({ page }) => {
    await settled(page);
    await page.locator('#rx-same').check();
    await settled(page);
    // the mirror rewrote L (−2,75 / −0,50 × 180), so L no longer shows what the page wrote: own values
    await chip(page, 'Stark kurzsichtig').click();
    await expect(confirmGroup(page)).toHaveCount(1);
    await confirmGroup(page).getByRole('button', { name: 'Ersetzen' }).click();
    await settled(page);
    await expect(page.locator('#rx-same')).not.toBeChecked();
    expect(await page.locator('#rx-os-sph').inputValue()).toBe('-6,00');
    expect(await page.locator('#rx-os-sph').getAttribute('readonly')).toBeNull();
  });
});

test.describe('own values: inline confirm', () => {
  test('focus on "Eingaben behalten", Esc keeps, focus back on the chip; then "Ersetzen" applies', async ({ page }) => {
    await settled(page);
    await page.locator('#rx-od-sph').fill('-1,00');
    await settled(page);
    const weit = chip(page, 'Weitsichtig');
    await weit.click();
    const group = confirmGroup(page);
    await expect(group).toHaveCount(1);
    await expect(page.locator('#preset-confirm-q')).toHaveText('Ihre Eingaben ersetzen?');
    await expect(group).toContainText('„Weitsichtig“');
    // directly after the Rx chip row
    expect(await group.evaluate((g) => g.parentElement?.id)).toBe('rx-preset-confirm-slot');
    const keep = group.getByRole('button', { name: 'Eingaben behalten' });
    await expect(keep).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(group).toHaveCount(0);
    expect(await page.locator('#rx-od-sph').inputValue()).toBe('-1,00');
    await expect(weit).toBeFocused();

    await weit.click();
    await expect(group).toHaveCount(1);
    await group.getByRole('button', { name: 'Ersetzen' }).click();
    await expect(group).toHaveCount(0);
    await expect(weit).toBeFocused();
    await settled(page);
    expect(await page.locator('#rx-od-sph').inputValue()).toBe('+3,00');
    expect(await page.locator('#rx-os-sph').inputValue()).toBe('+2,75');
    expect(await text(page, '#result-od-headline')).toContain('am dicksten 3,9 mm in der Mitte');
  });

  test('"Eingaben behalten" by click keeps the values', async ({ page }) => {
    await settled(page);
    await page.locator('#rx-os-cyl').fill('-1,25');
    await chip(page, 'Leicht kurzsichtig').click();
    await confirmGroup(page).getByRole('button', { name: 'Eingaben behalten' }).click();
    await expect(confirmGroup(page)).toHaveCount(0);
    expect(await page.locator('#rx-os-cyl').inputValue()).toBe('-1,25');
    await expect(chip(page, 'Leicht kurzsichtig')).toBeFocused();
  });

  test('one confirm at a time: a second chip replaces the question', async ({ page }) => {
    await settled(page);
    await page.locator('#rx-od-sph').fill('-1,00');
    await chip(page, 'Weitsichtig').click();
    await chip(page, 'Stark kurzsichtig').click();
    await expect(confirmGroup(page)).toHaveCount(1);
    await expect(confirmGroup(page)).toContainText('„Stark kurzsichtig“');
  });

  test('trying presets one after another asks only while own values are on screen', async ({ page }) => {
    await settled(page);
    await chip(page, 'Leicht kurzsichtig').click();
    await settled(page);
    // the fields hold preset values, not typed ones → no question
    await chip(page, 'Weitsichtig').click();
    await expect(confirmGroup(page)).toHaveCount(0);
    await settled(page);
    expect(await page.locator('#rx-od-sph').inputValue()).toBe('+3,00');
  });

  test('"Eigene Werte eingeben" (empty fields) applies without a question', async ({ page }) => {
    await page.locator('#example-clear').click();
    await chip(page, 'Weitsichtig').click();
    await expect(confirmGroup(page)).toHaveCount(0);
    await settled(page);
    expect(await page.locator('#rx-od-sph').inputValue()).toBe('+3,00');
  });

  test('axe: no WCAG violations in the Rx form with the confirm open', async ({ page }) => {
    await settled(page);
    await page.locator('#rx-od-sph').fill('-1,00');
    await chip(page, 'Weitsichtig').click();
    await expect(confirmGroup(page)).toHaveCount(1);
    const { violations } = await new AxeBuilder({ page }).include('#rx').withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('keyboard only: Tab to the chip, Enter, Esc, focus back on the chip', async ({ page }) => {
    await settled(page);
    await page.locator('#rx-od-sph').fill('-1,00');
    await page.locator('#example-clear').waitFor({ state: 'detached' });
    await page.locator('#expert').focus();
    const first = chip(page, 'Leicht kurzsichtig');
    await page.keyboard.press('Tab');
    await expect(first).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(confirmGroup(page).getByRole('button', { name: 'Eingaben behalten' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(confirmGroup(page)).toHaveCount(0);
    await expect(first).toBeFocused();
    expect(await page.locator('#rx-od-sph').inputValue()).toBe('-1,00');
  });
});

test.describe('frame chips', () => {
  test("'Groß' sets A 56, DBL 18, B follows the shape (41, geschätzt), shape stays checked", async ({ page }) => {
    await settled(page);
    await frameChip(page, 'Groß').click();
    await expect(confirmGroup(page)).toHaveCount(0);
    await settled(page);
    expect(await page.locator('#frame-a').inputValue()).toBe('56');
    expect(await page.locator('#frame-dbl').inputValue()).toBe('18');
    expect(await page.locator('#frame-b').inputValue()).toBe('41');
    await expect(page.locator('#frame-b-echo')).toContainText('geschätzt');
    await expect(page.locator('input[name=frame-shape][value=rechteckig]')).toBeChecked();
    expect(await page.locator('#frame-stamp').inputValue()).toMatch(/^56□18/);
    // the Rx example is not touched by a frame chip
    await expect(page.locator('#example-banner')).toHaveCount(1);
  });

  test('a picked shape is kept: Rund + Klein gives B from the round ratio', async ({ page }) => {
    await settled(page);
    await page.locator('#frame-shape label', { hasText: 'Rund' }).click();
    await settled(page);
    await frameChip(page, 'Klein').click();
    await settled(page);
    await expect(page.locator('input[name=frame-shape][value=rund]')).toBeChecked();
    expect(await page.locator('#frame-a').inputValue()).toBe('48');
    // estimateB('rund', 48) = 44 (02-09 scratch check), not the rectangle's 35
    expect(await page.locator('#frame-b').inputValue()).toBe('44');
    await expect(page.locator('#frame-b-echo')).toContainText('geschätzt');
  });

  test('typed A asks before replacing; Esc keeps it, focus back on the chip', async ({ page }) => {
    await settled(page);
    await page.locator('#frame-a').fill('50');
    await settled(page);
    const mittel = frameChip(page, 'Mittel');
    await mittel.click();
    const group = confirmGroup(page);
    await expect(group).toHaveCount(1);
    expect(await group.evaluate((g) => g.parentElement?.id)).toBe('frame-preset-confirm-slot');
    await expect(group.getByRole('button', { name: 'Eingaben behalten' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(group).toHaveCount(0);
    expect(await page.locator('#frame-a').inputValue()).toBe('50');
    await expect(mittel).toBeFocused();
    await mittel.click();
    await group.getByRole('button', { name: 'Ersetzen' }).click();
    await settled(page);
    expect(await page.locator('#frame-a').inputValue()).toBe('52');
    expect(await page.locator('#frame-b').inputValue()).toBe('38');
  });

  test('a frame chip after a frame chip does not ask', async ({ page }) => {
    await settled(page);
    await frameChip(page, 'Groß').click();
    await settled(page);
    await frameChip(page, 'Klein').click();
    await expect(confirmGroup(page)).toHaveCount(0);
    await settled(page);
    expect(await page.locator('#frame-a').inputValue()).toBe('48');
    expect(await page.locator('#frame-b').inputValue()).toBe('35');
  });
});
