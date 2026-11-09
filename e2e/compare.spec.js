// Material comparison (02-07, RES-02, D-15, D-16): "Was bringt ein anderes Material?" under the
// result, fed by the 02-06 compare lane. Expected values: 02-06-SUMMARY "Material rows",
// re-verified against the engine (example: 1,74 saves 1,6 mm and 4 g; plus case: 0,9 mm at the
// centre). The lane never delays the main result (worker.spec 'main result is not delayed').
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settled, settledCompare, plain, guardPage, slowWorker } from './helpers.js';
/* global document, window, requestAnimationFrame -- page.evaluate bodies run in the browser */

guardPage(test);

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const row = (page, id) => page.locator(`#cmp-material-table tbody tr[data-material=${id}]`);
const eyeRow = (page, id, eye) => page.locator(`#cmp-material-eyes-table tbody tr[data-material=${id}][data-eye=${eye}]`);
const text = async (loc) => plain(await loc.textContent());
const material = (page, id) => page.locator(`input[name=material][value=${id}]`);

/** R +3,00, L +2,75, no cylinder; PD 32 / 31,5 from the example (02-06 plus case). */
async function plusCase(page) {
  for (const [eye, sph] of [['od', '+3,00'], ['os', '+2,75']]) {
    await page.locator(`#rx-${eye}-sph`).fill(sph);
    await page.locator(`#rx-${eye}-cyl`).fill('');
    await page.locator(`#rx-${eye}-axis`).fill('');
  }
  await settledCompare(page);
}

test('example: six rows, 1,74 saves 1,6 mm and 4 g; switching moves "Ihre Auswahl"', async ({ page }) => {
  await settledCompare(page);
  await expect(page.locator('#cmp-material-table tbody tr:visible')).toHaveCount(6);
  await expect(row(page, 'cr39')).toContainText('Ihre Auswahl');
  expect(await text(row(page, 'cr39').locator('td[data-col=thick]'))).toContain('4,6 mm');
  expect(await text(row(page, 'cr39').locator('td[data-col=ct]'))).toContain('1,8 mm');
  expect(await text(row(page, 'cr39').locator('td[data-col=weight]'))).toContain('14 g');
  const r174 = await text(row(page, 'idx174'));
  expect(r174).toContain('1,6 mm dünner, 4 g leichter');
  expect(r174).toContain('(≈ 35 % dünner)');
  expect(r174).not.toContain('Ihre Auswahl');
  await expect(page.locator('#cmp-material-table [data-cmp-stale]')).toHaveCount(0);

  await material(page, 'idx174').check();
  await settledCompare(page);
  await expect(row(page, 'idx174')).toContainText('Ihre Auswahl');
  await expect(row(page, 'cr39')).not.toContainText('Ihre Auswahl');
  const r150 = await text(row(page, 'cr39'));
  expect(r150).toContain('1,6 mm dicker, 4 g schwerer');
  expect(r150).toContain('dicker');
  expect(r150).toContain('schwerer');
});

// lens-critic m3, m4 (02-19): the example is a tie (4,6 / 4,6 mm), so "das dickere Glas" would be
// untrue; the intro always names the per-material minimum thickness.
test('RES-02 intro: example tie names the shown eye, and each material its own minimum (m3, m4)', async ({ page }) => {
  await settledCompare(page);
  expect(await text(page.locator('#cmp-material-intro'))).toBe(
    'Gleiches Rezept, gleiche Fassung, jedes Material mit seiner eigenen Mindestdicke. Dickste Stelle (Mitte oder Rand): beide Gläser gleich dick – gezeigt: das rechte Glas. Gewicht: beide Gläser zusammen.',
  );
});

test("RES-02 intro: 'Stark kurzsichtig' (R 8,7 / L 8,3 mm) names the thicker glass (m3, m4)", async ({ page }) => {
  await settled(page);
  await page.locator('#rx-presets .chip', { hasText: 'Stark kurzsichtig' }).click();
  await settledCompare(page);
  const intro = await text(page.locator('#cmp-material-intro'));
  expect(intro).toContain('das rechte Glas (das dickere Glas)');
  expect(intro).toContain('jedes Material mit seiner eigenen Mindestdicke');
  expect(intro).not.toContain('gleich dick');
});

test('plus case: thickest point in the centre, 1,74 saves 0,9 mm and 2 g', async ({ page }) => {
  await plusCase(page);
  expect(await text(page.locator('#cmp-material-intro'))).toContain('rechte');
  const thick = await text(row(page, 'cr39').locator('td[data-col=thick]'));
  expect(thick).toContain('3,9 mm');
  expect(thick).toContain('in der Mitte');
  expect(await text(row(page, 'idx174'))).toContain('0,9 mm dünner, 2 g leichter');
  expect(await text(row(page, 'pc'))).toContain('0,1 mm dünner, 1 g leichter');
});

test('per-eye details carry the thickest edge (RES-02 max edge)', async ({ page }) => {
  await plusCase(page);
  const details = page.locator('#cmp-material-eyes');
  await details.locator('summary').click();
  await expect(page.locator('#cmp-material-eyes-table thead')).toContainText('Dickster Rand');
  await expect(page.locator('#cmp-material-eyes-table tbody tr:visible')).toHaveCount(12);
  expect(await text(eyeRow(page, 'cr39', 'OD').locator('td[data-col=edge]'))).toContain('2,8 mm');
  expect(await text(eyeRow(page, 'cr39', 'OS').locator('td[data-col=edge]'))).toContain('2,7 mm');
});

test('the assumed minimum edge of 1,67 and 1,74 is footnoted', async ({ page }) => {
  const note = page.locator('#cmp-assumed-note');
  await expect(note).toBeVisible();
  const s = await text(note);
  expect(s).toContain('1,67');
  expect(s).toContain('1,74');
  expect(s).toContain('angenommen');
  for (const n of ['1,50', '1,53', '1,59', '1,60']) expect(s).not.toContain(n);
});

test('comparison lane: "Vergleich rechnet …" and dotted old values, main settles first', async ({ page }) => {
  // 02-08: let guardPage's first page load its worker before navigating again; otherwise the
  // in-flight worker request is aborted and the guard counts a failed request (2/40 before).
  await settled(page);
  await slowWorker(page, 1500, { types: ['compare'] });
  await page.goto('./');
  await settledCompare(page, { timeout: 20_000 });
  const before = await text(row(page, 'idx174'));
  await page.locator('#rx-od-sph').fill('-4');
  await settled(page);
  await expect(page.locator('#result-od-thick')).not.toHaveAttribute('data-stale', /.*/);
  await expect(page.locator('#compare')).not.toHaveAttribute('data-pending', '');
  await expect(page.locator('#cmp-status')).toHaveText('Vergleich rechnet …');
  await expect(row(page, 'idx174').locator('[data-cmp-stale]').first()).toBeVisible();
  // Old values stay until the new ones are painted; the compare marks never use data-stale.
  expect(await text(row(page, 'idx174'))).toBe(before);
  expect(await page.locator('#compare [data-stale]').count()).toBe(0);
  await settledCompare(page, { timeout: 20_000 });
  await expect(page.locator('#cmp-status')).toHaveText('');
  await expect(page.locator('#compare [data-cmp-stale]')).toHaveCount(0);
  expect(await text(row(page, 'idx174'))).not.toBe(before);
});

for (const vp of [
  { width: 320, height: 640 },
  { width: 1280, height: 800 },
]) {
  test.describe(`axe #compare at ${vp.width} px`, () => {
    test.use({ viewport: vp });
    test('details open: zero violations, no horizontal scroll', async ({ page }) => {
      await settledCompare(page);
      await page.locator('#cmp-material-eyes summary').click();
      const { violations } = await new AxeBuilder({ page }).include('#compare').withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

// ---- 02-08 configuration comparison (RES-03, D-28, D-29 as changed by the UI-SPEC) ----
// Expected values: engine 2026-11-07 (02-08-SUMMARY). Example A = 1,50: R/L 4,6 mm, 1,8 mm,
// 7 + 7 = 14 g; B = 1,74: 3,0 mm, 1,1 mm, 5 + 5 = 10 g. Plus case A 3,9 / 3,7 mm, B 3,0 / 2,9 mm,
// 14 → 12 g. R −4,00 (cyl −0,50 × 180 kept): A 5,9 mm, B 3,8 mm.
const cfgCell = (page, id, col) => page.locator(`#cmp-row-${id} td[data-col=${col}] .cmp-val`);
const showRadio = (page, v) => page.locator(`#cmp-show input[name=cmp-show][value=${v}]`);

/** Click 'Variante vergleichen', then choose 1,74 as Nachher (B). */
async function compareWith174(page) {
  await page.locator('#cmp-start').click();
  await material(page, 'idx174').check();
  await settledCompare(page);
}

test('configuration comparison: freeze A, change the material, read the difference', async ({ page }) => {
  await settledCompare(page);
  await expect(page.locator('#cmp-active')).toBeHidden();
  await page.locator('#cmp-start').click();
  await expect(page.locator('#cmp-active')).toBeVisible();
  await expect(page.locator('#cmp-diff')).toBeFocused();
  await settledCompare(page);
  expect(await text(page.locator('#cmp-diff'))).toContain('Nachher ist noch gleich wie Vorher');
  const status = await text(page.locator('#cmp-a-status'));
  expect(status).toContain('Rechteckig 52□18');
  expect(status).toContain('1,50');

  await material(page, 'idx174').check();
  await settledCompare(page);
  const diff = await text(page.locator('#cmp-diff'));
  expect(diff).toContain('Nachher (B) ist an der dicksten Stelle 1,6 mm dünner und insgesamt 4 g leichter als Vorher (A).');
  expect(await text(cfgCell(page, 'thickOD', 'a'))).toBe('4,6 mm');
  expect(await text(cfgCell(page, 'thickOD', 'b'))).toBe('3,0 mm');
  expect(await text(cfgCell(page, 'thickOD', 'diff'))).toBe('1,6 mm dünner');
  expect(await text(cfgCell(page, 'ctOS', 'a'))).toBe('1,8 mm');
  expect(await text(cfgCell(page, 'ctOS', 'b'))).toBe('1,1 mm');
  expect(await text(cfgCell(page, 'weightBoth', 'a'))).toBe('14 g');
  expect(await text(cfgCell(page, 'weightBoth', 'b'))).toBe('10 g');
  expect(await text(cfgCell(page, 'weightBoth', 'diff'))).toBe('4 g leichter');
  // A's status names the frozen material, not the current one
  expect(await text(page.locator('#cmp-a-status'))).toContain('1,50');
});

test('Vorher | Nachher toggle switches the result cards and the summary bar both ways', async ({ page }) => {
  await settledCompare(page);
  await compareWith174(page);
  await expect(showRadio(page, 'b')).toBeChecked();
  expect(await text(page.locator('#result-od-thick'))).toBe('3,0 mm');
  await showRadio(page, 'a').check();
  await expect(page.locator('#result-od-thick')).toHaveText(/^4,6\smm$/);
  await expect(page.locator('#result-os-thick')).toHaveText(/^4,6\smm$/);
  expect(await text(page.locator('#result-od-title'))).toContain('Vorher (A)');
  expect(await text(page.locator('#summary-bar-values'))).toContain('4,6 mm · 7 g');
  expect(await text(page.locator('#result-od-material'))).toContain('CR-39');
  await showRadio(page, 'b').check();
  await expect(page.locator('#result-od-thick')).toHaveText(/^3,0\smm$/);
  expect(await text(page.locator('#result-od-title'))).not.toContain('Vorher');
  expect(await text(page.locator('#summary-bar-values'))).toContain('3,0 mm · 5 g');
  expect(await text(page.locator('#result-od-material'))).toContain('1,74');
});

test('configuration comparison, plus case: the centre counts, 0,9 mm and 2 g', async ({ page }) => {
  await plusCase(page);
  await compareWith174(page);
  const diff = await text(page.locator('#cmp-diff'));
  expect(diff).toContain('0,9 mm dünner');
  expect(diff).toContain('2 g leichter');
  expect(await text(cfgCell(page, 'thickOD', 'a'))).toBe('3,9 mm');
  expect(await text(cfgCell(page, 'thickOS', 'b'))).toBe('2,9 mm');
});

test('an Rx change recomputes A and B with the new Rx (D-28: the Rx is shared)', async ({ page }) => {
  await settledCompare(page);
  await compareWith174(page);
  await page.locator('#rx-od-sph').fill('-4,00');
  await settledCompare(page);
  expect(await text(cfgCell(page, 'thickOD', 'a'))).toBe('5,9 mm');
  expect(await text(cfgCell(page, 'thickOD', 'b'))).toBe('3,8 mm');
  expect(await text(page.locator('#cmp-diff'))).toContain('2,1 mm dünner');
  // while A is shown, an Rx change repaints the cards with the new A
  await showRadio(page, 'a').check();
  await expect(page.locator('#result-od-thick')).toHaveText(/^5,9\smm$/);
  await page.locator('#rx-od-sph').fill('-2,75');
  await settledCompare(page);
  await expect(page.locator('#result-od-thick')).toHaveText(/^4,6\smm$/);
  expect(await text(cfgCell(page, 'thickOD', 'a'))).toBe('4,6 mm');
});

test('Vorher shown before A is computed: the B values on the card are marked, then A is painted (T-02-21)', async ({ page }) => {
  await settled(page);
  await slowWorker(page, 1500, { types: ['compare'] });
  await page.goto('./');
  await settledCompare(page, { timeout: 20_000 });
  await page.locator('#cmp-start').click();
  await material(page, 'idx174').check();
  await settled(page);
  await expect(page.locator('#compare')).not.toHaveAttribute('data-pending', '');
  await showRadio(page, 'a').check();
  await expect(page.locator('#result-od-thick')).toHaveAttribute('data-stale', 'true');
  expect(await text(page.locator('#result-od-title'))).toContain('Vorher (A)');
  await settledCompare(page, { timeout: 20_000 });
  await expect(page.locator('#result-od-thick')).toHaveText(/^4,6\smm$/);
  await expect(page.locator('#result-od-thick')).not.toHaveAttribute('data-stale', /.*/);
});

test("'Vergleich beenden' keeps B, hides the comparison and focuses 'Variante vergleichen'", async ({ page }) => {
  await settledCompare(page);
  await compareWith174(page);
  await showRadio(page, 'a').check();
  await expect(page.locator('#result-od-thick')).toHaveText(/^4,6\smm$/);
  await page.locator('#cmp-end').click();
  await expect(page.locator('#cmp-active')).toBeHidden();
  await expect(page.locator('#cmp-start')).toBeFocused();
  await expect(page.locator('#result-od-thick')).toHaveText(/^3,0\smm$/);
  expect(await text(page.locator('#result-od-title'))).not.toContain('Vorher');
  await expect(material(page, 'idx174')).toBeChecked();
  await expect(showRadio(page, 'b')).toBeChecked();
});

for (const vp of [
  { width: 320, height: 640 },
  { width: 1280, height: 800 },
]) {
  test.describe(`axe #compare with the configuration comparison active at ${vp.width} px`, () => {
    test.use({ viewport: vp });
    test('zero violations, no horizontal scroll, the difference sentence visible', async ({ page }) => {
      await settledCompare(page);
      await compareWith174(page);
      await expect(page.locator('#cmp-diff')).toBeVisible();
      await expect(page.locator('#cmp-config-table')).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).include('#compare').withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

// RES-03, lens-critic M2 (02-17): while the cards show Vorher (A), the phone summary bar repeats
// A's card strings, so it must say so ('Vorher (A):' before its label). 03-LC MINOR 6: while a
// comparison runs and the cards show Nachher (B), the bar says 'Nachher (B):'; 'Vergleich
// beenden' drops the prefix. The toggle is never switched for the user (WCAG 3.2.2 spirit).
const barLabel = async (page) => plain(await page.locator('#summary-bar-label').textContent());
const barVals = async (page) => plain(await page.locator('#summary-bar-values').textContent());
const cardBar = async (page) => {
  const v = async (eye, f) => text(page.locator(`#result-${eye}-${f}`));
  return `R ${await v('od', 'thick')} · ${await v('od', 'weight')} | L ${await v('os', 'thick')} · ${await v('os', 'weight')}`;
};
async function barInView(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('#result')).not.toBeInViewport();
  await expect(page.locator('#summary-bar')).toBeVisible();
}

test.describe('RES-03 summary bar marks Vorher (A), 360 × 780', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('RES-03 summary bar: Vorher (A) prefix through toggle, frame edit and end', async ({ page }) => {
    await settledCompare(page);
    await barInView(page);
    expect(await barLabel(page)).toBe('Dickste Stelle · Gewicht');
    await compareWith174(page);
    // MINOR 6: the comparison starts on Nachher (B), and the bar says so.
    await barInView(page);
    expect(await barLabel(page)).toBe('Nachher (B): Dickste Stelle · Gewicht');
    expect(await barVals(page)).toBe(await cardBar(page));
    await showRadio(page, 'a').check();
    await expect(page.locator('#result-od-thick')).toHaveText(/^4,6\smm$/);
    await barInView(page);
    expect(await barLabel(page)).toMatch(/^Vorher \(A\): /);
    const aBar = await cardBar(page);
    expect(await barVals(page)).toBe(aBar);

    // a frame edit changes B only; the cards and the bar keep A and stay marked
    await page.locator('#frame-presets .chip', { hasText: 'Klein' }).click();
    await settledCompare(page);
    await barInView(page);
    expect(await barLabel(page)).toMatch(/^Vorher \(A\): /);
    expect(await cardBar(page)).toBe(aBar);
    expect(await barVals(page)).toBe(aBar);

    await showRadio(page, 'b').check();
    await expect(page.locator('#result-od-title')).not.toContainText('Vorher');
    await barInView(page);
    expect(await barLabel(page)).toMatch(/^Nachher \(B\): /);
    expect(await barVals(page)).toBe(await cardBar(page));
    expect(await barVals(page)).not.toBe(aBar);

    await showRadio(page, 'a').check();
    await barInView(page);
    expect(await barLabel(page)).toMatch(/^Vorher \(A\): /);
    await page.locator('#cmp-end').click();
    await barInView(page);
    expect(await barLabel(page)).toBe('Dickste Stelle · Gewicht');
    expect(await barVals(page)).toBe(await cardBar(page));
  });
});

test.describe('RES-03 summary bar with the Vorher prefix, 320 × 640', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  // style.css scroll-padding-bottom: 72px (WCAG 2.4.11) assumes the bar does not grow: the prefix
  // must not wrap the label. Measured 02-17: the bar is 59,6 px tall with and without the prefix
  // (8 + 19,6 label + 24 values + 8; min-height 56 px), so the gate is "same height as without
  // the prefix, label on one line, bar below the 72 px scroll padding".
  test('RES-03 summary bar: the prefixed bar does not wrap and stays under the scroll padding', async ({ page }) => {
    await settledCompare(page);
    await barInView(page);
    const plainBox = await page.locator('#summary-bar').boundingBox();
    await compareWith174(page);
    const fits = async (re) => {
      await barInView(page);
      expect(await barLabel(page)).toMatch(re);
      const box = await page.locator('#summary-bar').boundingBox();
      const label = await page.locator('#summary-bar-label').boundingBox();
      expect(Math.abs(box.height - plainBox.height), 'prefix adds no line').toBeLessThanOrEqual(1);
      expect(label.height, 'label on one line (14 px × 1.4)').toBeLessThanOrEqual(20.6);
      expect(box.height, 'bar below scroll-padding-bottom').toBeLessThan(72);
    };
    // MINOR 6: 'Nachher (B):' is one character longer than 'Vorher (A):'.
    await fits(/^Nachher \(B\): /);
    await showRadio(page, 'a').check();
    await expect(page.locator('#result-od-thick')).toHaveText(/^4,6\smm$/);
    await fits(/^Vorher \(A\): /);
  });
});

// ---- 02-20 (lens-critic M4, amendments MJ-1 / m-c): the compare start runs in a following task ----

const selectedThick = async (page) => text(page.locator('#cmp-material-table tbody tr[data-selected] td[data-col=thick]'));
const tableText = (page) => page.evaluate(() => document.querySelector('#cmp-material-table tbody').textContent);

test('ENG-09 RES-02: five quick R Sph values, the comparison converges to the last one (latest-wins)', async ({ page }) => {
  await settledCompare(page);
  const sph = page.locator('#rx-od-sph');
  for (const v of ['-1', '-2,5', '-3', '-5,25', '-4']) await sph.fill(v);
  await settledCompare(page);
  const card = await text(page.locator('#result-od-thick'));
  expect(await selectedThick(page)).toContain(card.replace(/\s.*$/, ''));
  const after = await tableText(page);
  // A fresh page that only ever saw the last value paints the same table.
  await page.goto('./');
  await settledCompare(page);
  await page.locator('#rx-od-sph').fill('-4');
  await settledCompare(page);
  expect(await tableText(page)).toBe(after);
});

test('ENG-09 RES-02: #compare[data-pending] carries "queued" from the input frame on, and the start runs after the frame (MJ-1)', async ({ page }) => {
  await settledCompare(page);
  // The input frame is the next rAF after the input event: the page's rAF callback (update) was
  // registered first, so this one runs right after it, inside the same frame.
  const seen = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const el = /** @type {HTMLInputElement} */ (document.getElementById('rx-od-sph'));
        el.value = '-3,5';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        requestAnimationFrame(() => resolve(document.getElementById('compare').dataset.pending));
      }),
  );
  expect(seen.split(' ')).toContain('queued');
  await settledCompare(page);
  await expect(page.locator('#compare')).toHaveAttribute('data-pending', '');
  // The deferred task is measured: the readout and its start-after-input-frame gap (never < 0).
  await expect(page.locator('#timing-compare-start')).toHaveText(/\(letzte \d+\): Median [\d,]+\sms, längste [\d,]+\sms/);
  expect(Number(await page.locator('#timing-compare-start').getAttribute('data-min-gap'))).toBeGreaterThanOrEqual(0);
});

test('ENG-09 RES-02: while the compare start is queued, no old rows are painted next to the new selection (m-c)', async ({ page }) => {
  await settled(page);
  // Test-only delay of the deferred compare start (?cmpdelay=<ms>).
  await page.goto('./?cmpdelay=1200');
  await settledCompare(page);
  const before = await tableText(page);
  await page.locator('#rx-od-sph').fill('-4');
  await settled(page); // the main result for -4 is painted
  await expect(page.locator('#compare')).toHaveAttribute('data-pending', /queued/);
  // Inside the delay the table is not repainted: it still shows the previous input's rows only.
  expect(await tableText(page)).toBe(before);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(await tableText(page)).toBe(before);
  await settledCompare(page);
  const card = await text(page.locator('#result-od-thick'));
  expect(await selectedThick(page)).toContain(card.replace(/\s.*$/, ''));
  expect(await tableText(page)).not.toBe(before);
});
