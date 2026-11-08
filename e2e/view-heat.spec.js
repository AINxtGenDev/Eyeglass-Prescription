// VIZ-05 / UX-02 Dickenkarte, slice 9 (03-12; UI-SPEC "Heatmap", "Heatmap colours", R1-5; lens-critic
// MAJOR 4 and the MINOR 1 rebuttal). Expert-only switch, the heat-eye camera, the shared engine
// scale, the colour-free legend and table, pixel = legend colour, no leak over mode cycles, axe.
// Reduced motion everywhere (instant camera cut): SwiftShader renders ≈ 1 s per frame (03-09).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cividisRGB } from '../src/ui/view/cividis.js';
import { meridianEndLabels } from '../src/engine/profile.js';
import { settledView, settledXsec, guardPage, noThreeWarnings, plain } from './helpers.js';
/* global window, document, requestAnimationFrame */

let threeWarnings;
test.beforeEach(({ page }) => {
  threeWarnings = noThreeWarnings(page);
});
test.use({ reducedMotion: 'reduce' });
guardPage(test, { view: true });
test.afterEach(() => {
  expect(threeWarnings(), 'Three.js / WebGL console warnings').toEqual([]);
});

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const mode = (page) => ev(page, () => window.__eyeglassView.mode());
const memory = (page) => ev(page, () => window.__eyeglassView.memory());
const text = async (page, sel) => plain(await page.locator(sel).textContent());
const cell = (page, row, col) => page.locator(`#view-heat-table td[data-row=${row}][data-col=${col}] .cell-val`);
const frames = (page) => ev(page, () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 0)))));
const mm = (s) => Number(plain(s).match(/(\d+,\d+)/)[1].replace(',', '.'));

async function expertOn(page) {
  await page.locator('#expert').check();
  await settledXsec(page);
  await settledView(page);
}

async function heatOn(page) {
  await page.locator('#view-mode label', { hasText: 'Dickenkarte' }).click();
  await page.waitForFunction(() => window.__eyeglassView.mode() === 'heat' && window.__eyeglassView.heatScale() !== null);
  await frames(page);
}

async function glassOn(page) {
  await page.locator('#view-mode label', { hasText: 'Glas' }).click();
  await page.waitForFunction(() => window.__eyeglassView.mode() === 'glass');
  await frames(page);
}

test('UX-02 switch only in Expert', async ({ page }) => {
  await settledView(page);
  await expect(page.locator('#view-mode')).toBeHidden();
  expect(await mode(page)).toBe('glass');
  await expertOn(page);
  await expect(page.locator('#view-mode')).toBeVisible();
  await expect(page.locator('#view-mode legend')).toContainText('Darstellung');
  await expect(page.locator('#view-mode input[value=glass]')).toBeChecked();
  await expect(page.locator('#view-mode input[value=heat]')).toBeEnabled();
  const before = await memory(page);
  await heatOn(page);
  expect(await mode(page)).toBe('heat');
  expect(await ev(page, () => window.__eyeglassView.viewName())).toBe('front');
  await expect(page.locator('.view-badge')).toHaveText('Dickenkarte');
  await expect(page.locator('#view-caption')).toHaveText(
    'Die Farbe zeigt die Dicke an jeder Stelle: dunkler = dicker. Alle Zahlen stehen auch in der Tabelle unter der Ansicht.',
  );
  await expect(page.locator('#view-legend')).toBeVisible();
  await expect(page.locator('#view-heat-table')).toBeVisible();
  // MINOR 1 rebuttal: the heat program was compiled at mount (hidden carrier), not on the switch.
  expect((await memory(page)).programs, 'programs unchanged by the first Dickenkarte').toBe(before.programs);
  // D-29: the accessible name says Dickenkarte with the engine scale.
  const s = await ev(page, () => window.__eyeglassView.heatScale());
  await expect(page.locator('#view-canvas')).toHaveAttribute('aria-label', /^Dickenkarte, von vorne\. Dünnste Stelle /, { timeout: 5000 });
  const aria = plain(await page.locator('#view-canvas').getAttribute('aria-label'));
  expect(aria).toContain(`Dünnste Stelle ${new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(s.min)} mm`);
  // Expert off → Glas, legend hidden.
  await page.locator('#expert').uncheck();
  await page.waitForFunction(() => window.__eyeglassView.mode() === 'glass');
  await expect(page.locator('#view-legend')).toBeHidden();
  await expect(page.locator('#view-heat-table')).toBeHidden();
  await expect(page.locator('#view-mode')).toBeHidden();
  await expect(page.locator('.view-badge')).toHaveText('Visueller Eindruck');
  await expect(page.locator('#view-canvas')).toHaveAttribute('aria-label', /^3D-Ansicht der Brille/, { timeout: 5000 });
  await expertOn(page);
  await expect(page.locator('#view-mode input[value=glass]')).toBeChecked();
});

test.describe('320×640', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('VIZ-05 Dickenkarte frames the heat eye (MAJOR 4)', async ({ page }) => {
    await settledView(page);
    await expertOn(page);
    await heatOn(page);
    const s = await ev(page, () => window.__eyeglassView.heatScale());
    // Default rule: larger max(ct, etMax); the example's eyes tie within 0,05 mm (4,6 / 4,6) → OD.
    expect(s.eye).toBe('OD');
    const { target } = await ev(page, () => window.__eyeglassView.camera());
    const box = (await ev(page, () => window.__eyeglassView.frameInfo())).eyeBox[s.eye];
    for (const k of ['x', 'y', 'z']) {
      expect(Math.abs(target[k] - (box.min[k] + box.max[k]) / 2), `target.${k}`).toBeLessThanOrEqual(0.5);
    }
    const [a, b] = await ev(
      page,
      (t) => [window.__eyeglassView.project(t.x, t.y, t.z), window.__eyeglassView.project(t.x, t.y + 10, t.z)],
      target,
    );
    const px10 = Math.hypot(a[0] - b[0], a[1] - b[1]);
    test.info().annotations.push({ type: 'scale', description: `${(px10 / 10).toFixed(2)} px/mm at 320×640` });
    expect(px10).toBeGreaterThanOrEqual(30);
  });

  test('VIZ-05 axe and no horizontal scroll at 320 (Expert + Dickenkarte)', async ({ page }) => {
    await settledView(page);
    await expertOn(page);
    await heatOn(page);
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    const { scroll, client } = await ev(page, () => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(scroll).toBeLessThanOrEqual(client);
    // Legend not clipped: the SVG fits inside the legend box.
    const fit = await ev(page, () => {
      const l = document.getElementById('view-legend').getBoundingClientRect();
      const svg = document.querySelector('#view-legend svg').getBoundingClientRect();
      const labels = [...document.querySelectorAll('#view-legend text')].map((t) => t.getBoundingClientRect());
      return { l: [l.left, l.right], svg: [svg.left, svg.right], labels: labels.map((r) => [r.left, r.right]) };
    });
    expect(fit.svg[0]).toBeGreaterThanOrEqual(fit.l[0] - 0.5);
    expect(fit.svg[1]).toBeLessThanOrEqual(fit.l[1] + 0.5);
    for (const [l, r] of fit.labels) {
      expect(l).toBeGreaterThanOrEqual(fit.l[0] - 0.5);
      expect(r).toBeLessThanOrEqual(fit.l[1] + 0.5);
    }
  });
});

test('VIZ-05 table = engine numbers', async ({ page }) => {
  await settledView(page);
  await expertOn(page);
  await heatOn(page);
  await expect(page.locator('#view-heat-table caption')).toHaveText('Dicke an markanten Stellen');
  const heads = (await page.locator('#view-heat-table thead th').allTextContents()).map(plain);
  expect(heads).toEqual(['Stelle', 'Rechtes Glas', 'Linkes Glas']);
  const rows = (await page.locator('#view-heat-table tbody th').allTextContents()).map(plain);
  expect(rows).toEqual([
    'Mitte (optischer Mittelpunkt)',
    'innen (nasal)',
    'außen (temporal)',
    'oben (superior)',
    'unten (inferior)',
    'dickste Stelle',
  ]);
  for (const [e, col] of [
    ['od', 'OD'],
    ['os', 'OS'],
  ]) {
    expect(plain(await cell(page, 'centre', col).textContent())).toBe(await text(page, `#result-${e}-ct`));
    const thick = plain(await cell(page, 'thickest', col).textContent());
    expect(thick).toContain(await text(page, `#result-${e}-thick`));
    // In the Experten-Ansicht the card adds the technical word: 'außen oben (temporal-superior)'.
    const cardLoc = (await text(page, `#result-${e}-thick-loc`)).replace(/ \(.*\)$/, '');
    expect(thick).toBe(`${await text(page, `#result-${e}-thick`)} (${cardLoc})`);
  }
  // innen / außen of OD = the Querschnitt end values at 0° (same meridianProfile), right eye, 0°.
  await expect(page.locator('#xsec-eye input[value=OD]')).toBeChecked();
  expect(await page.locator('#xsec-meridian').inputValue()).toBe('0');
  const codes = meridianEndLabels('OD', 0);
  for (const [i, key] of [
    [0, 'end0'],
    [1, 'end1'],
  ]) {
    const xs = plain(await page.locator(`#xsec-table td[data-row=${key}][data-col=b]`).textContent());
    expect(plain(await cell(page, codes[i], 'OD').textContent()), codes[i]).toBe(xs);
  }
  await expect(page.locator('#view-heat-nochord')).toBeHidden();
});

test('VIZ-05 legend', async ({ page }) => {
  await settledView(page);
  await expertOn(page);
  await heatOn(page);
  const svg = page.locator('#view-legend svg[role=img]');
  await expect(svg).toHaveCount(1);
  await expect(page.locator('#view-legend svg > title')).toHaveText('Farbskala der Dicke');
  await expect(page.locator('#view-legend .view-legend-title')).toHaveText('Dicke in mm');
  await expect(page.locator('#view-legend .view-legend-ends')).toHaveText('dünnerdicker');
  const desc = plain(await page.locator('#view-legend svg > desc').textContent());
  const thin = Math.min(mm(await text(page, '#result-od-thin')), mm(await text(page, '#result-os-thin')));
  const thick = Math.max(mm(await text(page, '#result-od-thick')), mm(await text(page, '#result-os-thick')));
  const f1 = (v) => new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
  expect(desc).toMatch(new RegExp(`^Von ${f1(thin)} mm \\(dünner, hell\\) bis ${f1(thick)} mm \\(dicker, dunkel\\), Linien alle `));
  const s = await ev(page, () => window.__eyeglassView.heatScale());
  expect(s.values.length).toBeGreaterThanOrEqual(2);
  expect(s.values.length).toBeLessThanOrEqual(8);
  await expect(page.locator('#view-legend text')).toHaveCount(s.values.length + 2);
  await expect(page.locator('#view-legend linearGradient stop')).toHaveCount(11);
  await expect(page.locator('#view-legend-step')).toHaveText(/^Linien alle \d+,\d{1,2}\u00a0mm$/);
  // The shader got the same engine scale (D-23).
  expect(s.uniforms).toEqual({ scaleMin: s.scaleMin, scaleMax: s.scaleMax, isoStep: s.step });
  test.info().annotations.push({ type: 'scale', description: JSON.stringify({ min: s.min, max: s.max, step: s.step, values: s.values }) });
});

test('VIZ-05 pixel = legend colour', async ({ page }) => {
  await settledView(page);
  await expertOn(page);
  await heatOn(page);
  const s = await ev(page, () => window.__eyeglassView.heatScale());
  const ct = await ev(page, (e) => window.__eyeglassView.ocWorld(e), s.eye);
  expect(ct).not.toBeNull();
  // Engine CT of the heat eye (it rounds to the card's Mitte); the precondition keeps the OC off an iso line.
  const ctMm = ct[3];
  expect(plain(new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ctMm)) + ' mm').toBe(
    await text(page, `#result-${s.eye.toLowerCase()}-ct`),
  );
  const q = ctMm / s.step;
  test.skip(Math.abs(q - Math.round(q)) < 0.05, 'OC on an iso line for this Rx');
  const [x, y] = await ev(page, (p) => window.__eyeglassView.project(p[0], p[1], p[2]), ct);
  const px = await ev(page, (p) => window.__eyeglassView.pixel(p[0], p[1]), [x, y]);
  const tt = (ctMm - s.scaleMin) / (s.scaleMax - s.scaleMin);
  const want = cividisRGB(1 - tt);
  test.info().annotations.push({ type: 'pixel', description: `${px.slice(0, 3)} vs ${want.map((v) => v.toFixed(1))}` });
  for (let i = 0; i < 3; i++) expect(Math.abs(px[i] - want[i]), `channel ${i}: ${px} vs ${want}`).toBeLessThanOrEqual(6);
});

test('UX-02 Glas ↔ Dickenkarte does not leak', async ({ page }) => {
  test.setTimeout(180_000);
  await settledView(page);
  await expertOn(page);
  await heatOn(page);
  await glassOn(page);
  const before = await memory(page);
  for (let i = 0; i < 5; i++) {
    await heatOn(page);
    await glassOn(page);
  }
  const after = await memory(page);
  test.info().annotations.push({ type: 'memory', description: `${JSON.stringify(before)} → ${JSON.stringify(after)}` });
  expect(after).toEqual(before);
});

test('VIZ-05 axe at the project viewport (Expert + Dickenkarte)', async ({ page }) => {
  await settledView(page);
  await expertOn(page);
  await heatOn(page);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});
