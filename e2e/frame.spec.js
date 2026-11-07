// Frame section and smart PD (02-04, FRAME-02, FRAME-03, RX-06, UX-01): the temple stamp, our own
// "Wo finde ich das?" drawing, the shape radio cards, the A/B/DBL model ranges, the B estimate and
// the PD typed in whatever form the paper shows (D-05, D-06, D-10, D-11, D-12).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settled, plain, guardPage } from './helpers.js';
/* global document */

guardPage(test);

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const BLOCKED = /^Für dieses Glas wird nichts berechnet/;
const shape = (page, id) => page.locator(`input[name=frame-shape][value=${id}]`);
const text = async (page, sel) => plain(await page.locator(sel).textContent());

test('the temple stamp sets A and DBL; B is estimated from the shape and disclosed', async ({ page }) => {
  await page.locator('#frame-stamp').fill('56□16 145');
  await expect(page.locator('#frame-a')).toHaveValue('56');
  await expect(page.locator('#frame-dbl')).toHaveValue('16');
  // Rechteckig 52 × 38: B = round(56 × 38 / 52) = 41
  await expect(page.locator('#frame-b')).toHaveValue('41');
  await expect(page.locator('#frame-b-echo')).toContainText('geschätzt aus der Form');
  await expect(page.locator('#frame-stamp-echo')).toContainText('Bügellänge');
  await settled(page);
  const bNote = page.locator('#b-note');
  await expect(bNote).toBeVisible();
  expect(await text(page, '#b-note')).toContain('geschätzt');
  expect(await text(page, '#b-note')).toContain('41');
  await page.locator('#frame-b').fill('40');
  await settled(page);
  await expect(bNote).toBeHidden();
  await expect(page.locator('#frame-b-echo')).not.toContainText('geschätzt');
});

test('stamp separators and typing in A rewrites the stamp', async ({ page }) => {
  const stamp = page.locator('#frame-stamp');
  for (const s of ['52-18-140', '52 18 140', '52/18 145', '52 [] 18', '52x18']) {
    await stamp.fill('60□20');
    await stamp.fill(s);
    await expect(page.locator('#frame-a'), s).toHaveValue('52');
    await expect(page.locator('#frame-dbl'), s).toHaveValue('18');
  }
  await stamp.fill('52□18 140');
  await page.locator('#frame-a').fill('54');
  await expect(stamp).toHaveValue('54□18 140');
});

test('swapped stamp numbers: Hinweis with an apply button', async ({ page }) => {
  await page.locator('#frame-stamp').fill('16□56');
  const err = page.locator('#frame-stamp-err');
  await expect(err).toContainText('Hinweis:');
  await expect(err).toContainText('vertauscht');
  await err.getByRole('button', { name: '56□16 übernehmen' }).click();
  await expect(page.locator('#frame-stamp')).toHaveValue('56□16');
  await expect(page.locator('#frame-a')).toHaveValue('56');
  await expect(page.locator('#frame-dbl')).toHaveValue('16');
  await expect(err).toBeHidden();
});

test('"Wo finde ich das?" opens our own drawing of a temple', async ({ page }) => {
  const help = page.locator('#frame-stamp-help');
  const figure = page.locator('#frame-stamp-figure');
  await expect(help).toHaveText('Wo finde ich das?');
  await expect(help).toHaveAttribute('aria-expanded', 'false');
  await expect(figure).toBeHidden();
  await help.click();
  await expect(help).toHaveAttribute('aria-expanded', 'true');
  await expect(figure).toBeVisible();
  const svg = figure.locator('svg[role="img"]');
  await expect(svg).toHaveCount(1);
  await expect(svg.locator('title')).toHaveCount(1);
  for (const s of ['Glasbreite', 'Stegbreite', 'Bügellänge']) await expect(svg.locator('text', { hasText: s })).toHaveCount(1);
  await expect(figure.locator('img, image, use')).toHaveCount(0);
  await help.click();
  await expect(figure).toBeHidden();
});

test('shape cards: defaults while untyped, "Standardmaße übernehmen" after typing', async ({ page }) => {
  await expect(page.locator('input[name=frame-shape]')).toHaveCount(4);
  await expect(shape(page, 'rechteckig')).toBeChecked();
  await expect(page.locator('#frame-shape .radio-card svg.shape-thumb path')).toHaveCount(4);
  await shape(page, 'pilot').check();
  await expect(page.locator('#frame-a')).toHaveValue('58');
  await expect(page.locator('#frame-b')).toHaveValue('50');
  await expect(page.locator('#frame-dbl')).toHaveValue('14');
  await expect(page.locator('#frame-defaults')).toBeHidden();
  await page.locator('#frame-a').fill('50');
  await shape(page, 'rund').check();
  await expect(page.locator('#frame-a')).toHaveValue('50');
  const defaults = page.locator('#frame-defaults');
  await expect(defaults).toBeVisible();
  expect(await text(page, '#frame-defaults')).toContain('Standardmaße übernehmen');
  await defaults.click();
  await expect(page.locator('#frame-a')).toHaveValue('48');
  await expect(page.locator('#frame-b')).toHaveValue('44');
  await expect(page.locator('#frame-dbl')).toHaveValue('20');
  await expect(defaults).toBeHidden();
  await settled(page);
  await expect(page.locator('#result-od-ct')).toHaveText(/^\d+,\d\smm$/);
});

test('A outside 40–62 mm: Außerhalb des Modells, both eyes blocked, never clamped', async ({ page }) => {
  await page.locator('#frame-a').fill('39');
  const err = page.locator('#frame-a-err');
  await expect(err).toContainText('Außerhalb des Modells:');
  await expect(err).toContainText('40,0');
  await expect(page.locator('#frame-a')).toHaveValue('39');
  await settled(page);
  await expect(page.locator('#result-od-status')).toHaveText(BLOCKED);
  await expect(page.locator('#result-os-status')).toHaveText(BLOCKED);
  await expect(page.locator('#result-od-ct')).toHaveText('–');
  await page.locator('#result-os-jump').click();
  await expect(page.locator('#frame-a')).toBeFocused();
});

test.describe('smart PD (RX-06)', () => {
  test('"64" is the binocular PD: 32 mm per eye', async ({ page }) => {
    await page.locator('#rx-od-pd').fill('64');
    await page.locator('#rx-os-pd').fill('');
    await expect(page.locator('#rx-od-pd-echo')).toContainText('Gesamt-PD');
    expect(await text(page, '#rx-od-pd-echo')).toContain('64,0 mm Gesamt-PD → je 32,0 mm');
    expect(await text(page, '#rx-os-pd-echo')).toBe('32,0 mm');
    await settled(page);
    await page.locator('#expert').check();
    // PD 32 on 52□18: decentration (52 + 18) / 2 − 32 = 3,0 mm for both eyes
    await expect(page.locator('#result-od-dec')).toHaveText(/^3,0\smm$/);
    await expect(page.locator('#result-os-dec')).toHaveText(/^3,0\smm$/);
    await expect(page.locator('#pd-note')).toBeHidden();
  });

  test('"32/33" in the left field fills R 32 and L 33', async ({ page }) => {
    await page.locator('#rx-od-pd').fill('');
    await page.locator('#rx-os-pd').fill('32/33');
    await expect(page.locator('#rx-os-pd-echo')).toHaveText(/^32,0\smm rechts, 33,0\smm links$/);
    expect(await text(page, '#rx-od-pd-echo')).toBe('32,0 mm');
    await settled(page);
    await page.locator('#expert').check();
    await expect(page.locator('#result-od-dec')).toHaveText(/^3,0\smm$/);
    await expect(page.locator('#result-os-dec')).toHaveText(/^2,0\smm$/);
  });

  test('"45" asks whether it is one eye or both; that eye is not computed', async ({ page }) => {
    await page.locator('#rx-od-pd').fill('45');
    const err = page.locator('#rx-od-pd-err');
    await expect(err).toContainText('Hinweis:');
    expect(await text(page, '#rx-od-pd-err')).toContain('Ist 45,0 mm der Wert für ein Auge oder für beide zusammen?');
    await settled(page);
    await expect(page.locator('#result-od-status')).toHaveText(BLOCKED);
    await expect(page.locator('#result-os-ct')).toHaveText(/^\d+,\d\smm$/);
  });

  test('two values over 50 ask for the distance PD; 12 asks about the HSA', async ({ page }) => {
    await page.locator('#rx-od-pd').fill('64/61');
    await expect(page.locator('#rx-od-pd-err')).toContainText('Ferne');
    await page.locator('#rx-os-pd').fill('12');
    await expect(page.locator('#rx-os-pd-err')).toContainText('HSA');
    await settled(page);
    await expect(page.locator('#result-od-status')).toHaveText(BLOCKED);
    await expect(page.locator('#result-os-status')).toHaveText(BLOCKED);
  });

  test('empty PD: 32 mm per eye is assumed and stated', async ({ page }) => {
    await page.locator('#rx-od-pd').fill('');
    await page.locator('#rx-os-pd').fill('');
    await settled(page);
    const note = page.locator('#pd-note');
    await expect(note).toBeVisible();
    const s = await text(page, '#pd-note');
    for (const w of ['angenommen', '32,0 mm', 'rechts', 'links', 'Optiker']) expect(s).toContain(w);
    await expect(page.locator('#result-od-ct')).toHaveText(/^\d+,\d\smm$/);
    await page.locator('#rx-os-pd').fill('31,5');
    await settled(page);
    expect(await text(page, '#pd-note')).toContain('(rechts)');
  });
});

for (const vp of [
  { width: 320, height: 640 },
  { width: 1280, height: 800 },
]) {
  test.describe(`axe #frame-section at ${vp.width} px`, () => {
    test.use({ viewport: vp });
    test('figure and tips open, a message shown: zero violations, no horizontal scroll', async ({ page }) => {
      await page.locator('#frame-stamp-help').click();
      for (const b of await page.locator('#frame-section button.tip-btn').all()) await b.click();
      await expect(page.locator('#frame-section button.tip-btn[aria-expanded="true"]')).toHaveCount(4);
      await page.locator('#frame-stamp').fill('16□56');
      await page.locator('#frame-stamp').blur();
      await expect(page.locator('#frame-stamp-err')).toBeVisible();
      await settled(page);
      const { violations } = await new AxeBuilder({ page }).include('#frame-section').withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(client);
      if (process.env.RX_SHOT) await page.locator('#frame-section').screenshot({ path: `${process.env.RX_SHOT}/frame-${vp.width}.png` });
    });
  });
}
