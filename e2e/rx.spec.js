// Paper-shaped Rx table (02-03, RX-01, RX-04, RX-05, RX-07, RX-08, UX-01): row order, card
// reflow below 560 px, three message tiers after the 600 ms pause or blur, "±", "gleich wie
// rechts", the other-values details and the four toggletips.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settled, plain, guardPage } from './helpers.js';
/* global document */

guardPage(test);

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const TERMS = ['sph', 'cyl', 'axis', 'pd'];
const sph = (page) => page.locator('#rx-od-sph');
const err = (page) => page.locator('#rx-od-sph-err');
const status = (page) => page.locator('#result-od-status');
const labelWidth = async (page) => (await page.locator('label[for="rx-od-sph"]').boundingBox())?.width ?? 0;

test('row headers: R before L, in the paper wording', async ({ page }) => {
  await expect(page.locator('#rx-table tbody th[scope="row"]')).toHaveText(['Rechtes Auge (R / OD)', 'Linkes Auge (L / OS)']);
});

test.describe('card mode at 400 px', () => {
  test.use({ viewport: { width: 400, height: 800 } });
  test('field labels are visible inside #rx-table', async ({ page }) => {
    expect(await labelWidth(page)).toBeGreaterThan(20);
    await expect(page.locator('label[for="rx-os-pd"]')).toHaveText('PD linkes Auge in Millimetern');
  });
});

test.describe('table mode at 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('field labels are visually hidden, the column headers show the terms', async ({ page }) => {
    expect(await labelWidth(page)).toBeLessThanOrEqual(1);
    await expect(page.locator('#rx-table thead th[scope="col"]').nth(1)).toBeVisible();
  });
});

test('Hinweis "Meinten Sie …?" after the pause; the button applies the suggestion', async ({ page }) => {
  await sph(page).fill('-2,3');
  await expect(page.locator('#rx-od-sph-echo')).toHaveText(/^−2,30\sdpt$/);
  await expect(err(page)).toBeVisible();
  await expect(err(page)).toContainText('Hinweis:');
  await expect(err(page)).toContainText('Meinten Sie −2,25');
  await expect(sph(page)).not.toHaveAttribute('aria-invalid', 'true');
  await settled(page);
  // A Hinweis still computes, with the entered value.
  await expect(page.locator('#result-od-ct')).toHaveText(/^\d+,\d\smm$/);
  await err(page).getByRole('button', { name: '−2,25 übernehmen' }).click();
  await expect(sph(page)).toHaveValue('−2,25');
  await expect(sph(page)).toBeFocused();
  await expect(err(page)).toBeHidden();
  await expect(page.locator('#rx-od-sph-echo')).toHaveText(/^−2,25\sdpt$/);
});

test('Außerhalb des Modells: never clamped, card blocked, jump to the field', async ({ page }) => {
  await sph(page).fill('-13');
  await expect(err(page)).toContainText('Außerhalb des Modells:');
  await expect(err(page)).toContainText('−13,00');
  await expect(sph(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(sph(page)).toHaveValue('-13');
  await expect(page.locator('#rx-od-sph-echo')).toHaveText(/^−13,00\sdpt$/);
  await settled(page);
  await expect(status(page)).toHaveText('Für dieses Glas wird nichts berechnet. Bitte das markierte Feld korrigieren.');
  await expect(page.locator('#result-od-ct')).toHaveText('–');
  await page.locator('#result-od-jump').click();
  await expect(sph(page)).toBeFocused();
  await sph(page).fill('-12');
  await expect(err(page)).toBeHidden();
  await expect(sph(page)).not.toHaveAttribute('aria-invalid', 'true');
  await settled(page);
  await expect(page.locator('#result-od-jump')).toBeHidden();
  await expect(page.locator('#result-od-ct')).toHaveText(/^\d+,\d\smm$/);
});

test('plus cylinder: the Sph range is checked on the minus form', async ({ page }) => {
  await sph(page).fill('+11,00');
  await page.locator('#rx-od-cyl').fill('+2,00');
  await page.locator('#rx-od-axis').fill('90');
  await page.locator('#rx-od-axis').blur();
  await expect(err(page)).toContainText('Außerhalb des Modells:');
  await expect(err(page)).toContainText('+13,00');
  await expect(err(page)).toContainText('Ihre Eingabe: +11,00');
});

test('"Eingabe unvollständig …" before the message is due, Fehler on blur', async ({ page }) => {
  await sph(page).fill('abc');
  await expect(status(page)).toHaveText('Eingabe unvollständig …');
  await expect(err(page)).toBeHidden();
  await sph(page).blur();
  await expect(err(page)).toBeVisible();
  await expect(err(page)).toContainText('Fehler:');
  await expect(status(page)).toHaveText(/^Für dieses Glas wird nichts berechnet/);
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('the message slot is linked to the field', async ({ page }) => {
  for (const eye of ['od', 'os']) {
    for (const f of TERMS) {
      const ids = (await page.locator(`#rx-${eye}-${f}`).getAttribute('aria-describedby')).split(' ');
      expect(ids).toContain(`rx-${eye}-${f}-err`);
    }
  }
});

test('"±" inserts a minus into an empty field and flips a value', async ({ page }) => {
  await page.locator('#example-clear').click();
  const sign = page.getByRole('button', { name: 'Vorzeichen umkehren: Sph rechts' });
  await expect(page.locator('.rx-table button.sign')).toHaveCount(4);
  await sign.click();
  await expect(sph(page)).toHaveValue('−');
  await expect(sph(page)).toBeFocused();
  await sph(page).fill('2,25');
  await sign.click();
  await expect(sph(page)).toHaveValue('−2,25');
  await expect(page.locator('#rx-od-sph-echo')).toHaveText(/^−2,25\sdpt$/);
  await sign.click();
  await expect(sph(page)).toHaveValue('+2,25');
  await page.getByRole('button', { name: 'Vorzeichen umkehren: Zyl links' }).click();
  await expect(page.locator('#rx-os-cyl')).toHaveValue('−');
});

test('"Linkes Auge gleich wie rechtes" mirrors Sph, Zyl, Achse read-only; PD stays', async ({ page }) => {
  const same = page.locator('#rx-same');
  await expect(same).not.toBeChecked();
  const osPd = await page.locator('#rx-os-pd').inputValue();
  await page.getByLabel('Linkes Auge gleich wie rechtes (Sph, Zyl, Achse)').check();
  await expect(page.locator('#rx-mirror-note')).toHaveText('übernommen von rechts');
  for (const f of ['sph', 'cyl', 'axis']) {
    const l = page.locator(`#rx-os-${f}`);
    await expect(l).toHaveValue(await page.locator(`#rx-od-${f}`).inputValue());
    await expect(l).toHaveAttribute('readonly', '');
    await expect(l).toBeEnabled();
    expect((await l.getAttribute('aria-describedby')).split(' ')).toContain('rx-mirror-note');
  }
  await page.locator('#rx-os-sph').focus();
  await expect(page.locator('#rx-os-sph')).toBeFocused();
  await sph(page).fill('-4,00');
  await expect(page.locator('#rx-os-sph')).toHaveValue('-4,00');
  await expect(page.locator('#rx-os-pd')).toHaveValue(osPd);
  await same.uncheck();
  await expect(page.locator('#rx-os-sph')).toHaveValue('-4,00');
  await expect(page.locator('#rx-os-sph')).not.toHaveAttribute('readonly', '');
  expect((await page.locator('#rx-os-sph').getAttribute('aria-describedby')).split(' ')).not.toContain('rx-mirror-note');
  await settled(page);
  await expect(page.locator('#result-os-ct')).toHaveText(/^\d+,\d\smm$/);
});

test('the mirror never copies PD: "64" on the right still gives the left eye 32 (02-04)', async ({ page }) => {
  await page.locator('#rx-od-pd').fill('64');
  await page.locator('#rx-os-pd').fill('');
  await page.getByLabel('Linkes Auge gleich wie rechtes (Sph, Zyl, Achse)').check();
  await expect(page.locator('#rx-os-pd')).toHaveValue('');
  await expect(page.locator('#rx-os-pd')).not.toHaveAttribute('readonly', '');
  expect(plain(await page.locator('#rx-os-pd-echo').textContent())).toBe('32,0 mm');
  await settled(page);
  await expect(page.locator('#result-os-ct')).toHaveText(/^\d+,\d\smm$/);
});

test('other values on the paper (RX-08) are explained in a closed <details>', async ({ page }) => {
  const other = page.locator('#rx-other');
  expect(await other.evaluate((d) => d.open)).toBe(false);
  await other.locator('summary').click();
  const text = plain(await other.textContent());
  for (const s of ['Add', 'Prisma', 'HSA', 'F / N', 'EP / H', 'nicht berechnet', 'Ferne', 'ändert die Glasdicke nicht']) {
    expect(text).toContain(s);
  }
});

test('four toggletips open by click, Enter and Space, close by Esc with focus returned', async ({ page }) => {
  const names = { sph: 'Erklärung: Sphäre', cyl: 'Erklärung: Zylinder', axis: 'Erklärung: Achse', pd: 'Erklärung: Pupillendistanz' };
  for (const term of TERMS) {
    const btn = page.getByRole('button', { name: names[term] });
    const panel = page.locator(`#tip-${term}`);
    await expect(btn).toHaveAttribute('aria-controls', `tip-${term}`);
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await btn.press('Escape');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
    await expect(btn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(panel).toBeVisible();
    await page.keyboard.press('Space');
    await expect(panel).toBeHidden();
  }
});

for (const vp of [
  { width: 320, height: 640 },
  { width: 1280, height: 800 },
]) {
  test.describe(`axe #rx at ${vp.width} px`, () => {
    test.use({ viewport: vp });
    test('all tips open, a message of each tier: zero violations, no horizontal scroll', async ({ page }) => {
      for (const b of await page.locator('#rx button.tip-btn').all()) await b.click();
      await expect(page.locator('#rx button.tip-btn[aria-expanded="true"]')).toHaveCount(4);
      await page.locator('#rx-other summary').click();
      await sph(page).fill('-2,3');
      await page.locator('#rx-os-sph').fill('-13');
      await page.locator('#rx-od-cyl').fill('-1');
      await page.locator('#rx-od-axis').fill('');
      await page.locator('#rx-od-axis').blur();
      for (const id of ['#rx-od-sph-err', '#rx-os-sph-err', '#rx-od-axis-err']) await expect(page.locator(id)).toBeVisible();
      await settled(page);
      const { violations } = await new AxeBuilder({ page }).include('#rx').withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(client);
      if (process.env.RX_SHOT) await page.locator('#rx').screenshot({ path: `${process.env.RX_SHOT}/rx-${vp.width}.png` });
    });
  });
}
