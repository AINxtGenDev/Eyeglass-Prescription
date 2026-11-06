// Walking-skeleton smoke contract (DEPL-01, RX-02, RX-03, L10N-01, RES-06, SC-1, ENG-09).
// RED until plan 01-03 ships the German page; runs against `vite preview` locally
// and against the live Pages URL when BASE_URL is set.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settled, etmaxOf } from './helpers.js';
/* global document, window, MutationObserver -- page.evaluate bodies run in the browser */

/** @type {{ bad: string[], failed: string[], foreign: string[], csp: string[] }} */
let seen;

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  seen = { bad: [], failed: [], foreign: [], csp: [] };
  page.on('response', (r) => {
    if (r.status() >= 400) seen.bad.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => seen.failed.push(`${r.failure()?.errorText} ${r.url()}`));
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.origin !== origin) seen.foreign.push(r.url());
  });
  page.on('console', (m) => {
    if (m.text().includes('Content Security Policy')) seen.csp.push(m.text());
  });
  await page.goto('./');
  expect(page.url()).toMatch(/\/Eyeglass-Prescription\/$/);
});

test.afterEach(() => {
  expect(seen.bad, 'responses with status >= 400').toEqual([]);
  expect(seen.failed, 'failed requests').toEqual([]);
  expect(seen.foreign, 'requests to other origins').toEqual([]);
  expect(seen.csp, 'CSP violations').toEqual([]);
});

test('German page with visible disclaimer', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-AT');
  const disclaimer = page.locator('#disclaimer');
  await expect(disclaimer).toBeVisible();
  await expect(disclaimer).toContainText('Lernhilfe');
});

test('paper-style Sph is echoed in de-AT format', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('-2,25');
  await expect(page.locator('#rx-od-sph-echo')).toHaveText(/−2,25\sdpt/);
});

test('both eyes show thickness, weight and base curve', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('-2,25');
  await page.locator('#rx-os-sph').fill('+1 dpt');
  await settled(page);
  for (const id of ['#result-od-ct', '#result-od-etmax', '#result-od-weight', '#result-os-ct']) {
    await expect(page.locator(id)).toHaveText(/^\d+,\d\s(mm|g)/);
  }
  await expect(page.locator('#result-od-basecurve')).toContainText('Vogel');
});

test('malformed input shows an error, never NaN', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('1.000,25');
  const err = page.locator('#rx-od-sph-err');
  await expect(err).toBeVisible();
  await expect(err).not.toBeEmpty();
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('material choice changes thickness', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('-4,00');
  await page.locator('#rx-os-sph').fill('-4,00');
  await settled(page);
  const select = page.locator('#material');
  await expect(select.locator('option')).toHaveCount(6);
  await expect(select.locator('option', { hasText: 'Trivex 1,53' })).toHaveCount(1);
  await expect(select).toHaveValue('cr39');
  await expect(page.locator('#result-od-etmax')).toHaveText(/^\d+,\d/);
  const cr39 = await etmaxOf(page, 'od');
  await select.selectOption('idx167');
  await settled(page);
  await expect(page.locator('#result-od-material')).toContainText('1,67');
  expect(await etmaxOf(page, 'od')).toBeLessThan(cr39);
});

test('frame shape and PD change the edge', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('-6,00');
  await page.locator('#rx-os-sph').fill('-6,00');
  await settled(page);
  await expect(page.locator('#frame-shape')).toHaveValue('rechteckig');
  await expect(page.locator('#frame-a')).toHaveValue('52');
  await expect(page.locator('#rx-od-pd')).toHaveValue('32');
  await expect(page.locator('#result-od-etmax')).toContainText('schläfenseitig');
  const before = await etmaxOf(page, 'od');
  await expect(page.locator('#result-od-dec')).toHaveText(/^3,0\smm$/);
  await page.locator('#rx-od-pd').fill('28');
  await settled(page);
  await expect(page.locator('#result-od-dec')).toHaveText(/^7,0\smm$/);
  expect(await etmaxOf(page, 'od')).toBeGreaterThan(before);
  await page.locator('#frame-shape').selectOption('pilot');
  await settled(page);
  await expect(page.locator('#frame-a')).toHaveValue('58');
  await expect(page.locator('#frame-b')).toHaveValue('50');
  await expect(page.locator('#frame-dbl')).toHaveValue('14');
  await expect(page.locator('body')).not.toContainText('NaN');
});

// evaluateLens of +3,00 −2,00 × 180 (OD, Rechteckig 52×38/18, PD 32, CR-39), formatted with
// fmtMm/fmtGram; the −2,00 default shows 1,8 / 3,7 / 2,5 mm and 6,1 g.
const PLUS_CYL_VALUES = [
  ['#result-od-ct', /^3,6\smm$/],
  ['#result-od-etmax', /^3,2\smm – /],
  ['#result-od-etmin', /^1,0\smm – /],
  ['#result-od-weight', /^7,0\sg$/],
];

test('plus cylinder shows both forms', async ({ page }) => {
  await settled(page);
  const CELLS = ['#result-od-ct', '#result-od-etmax', '#result-od-etmin', '#result-od-weight'];
  const before = await Promise.all(CELLS.map((id) => page.locator(id).textContent()));
  await page.locator('#rx-od-sph').fill('+1,00');
  await page.locator('#rx-od-cyl').fill('+2,00');
  await page.locator('#rx-od-axis').fill('90');
  await settled(page);
  const forms = page.locator('#rx-od-forms');
  await expect(forms).toBeVisible();
  for (const s of ['+3,00', '−2,00', '180°', '+2,00', '90°', 'umgerechnet']) await expect(forms).toContainText(s);
  // Pinned values of +3,00 −2,00 × 180 (Rechteckig 52×38/18, PD 32, CR-39); none equals the −2,00 default.
  for (const [i, [id, re]] of PLUS_CYL_VALUES.entries()) {
    expect(re.test(before[i]), `${id} default must not match`).toBe(false);
    await expect(page.locator(id)).toHaveText(re);
  }
  expect(PLUS_CYL_VALUES.map(([id]) => id)).toEqual(CELLS);
  await expect(page.locator('#result-od-status')).toBeEmpty();
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('cylinder without axis', async ({ page }) => {
  await page.locator('#rx-od-cyl').fill('-1,00');
  await page.locator('#rx-od-axis').fill('');
  await settled(page);
  const err = page.locator('#rx-od-axis-err');
  await expect(err).toBeVisible();
  await expect(err).not.toBeEmpty();
  await expect(page.locator('#result-od-ct')).toHaveText('–');
  await expect(page.locator('body')).not.toContainText('NaN');
});

/** Fill the frame fieldset (shape first: it pre-fills A/B/DBL). */
async function setFrame(page, shape, A, B, DBL) {
  await page.locator('#frame-shape').selectOption(shape);
  await page.locator('#frame-a').fill(String(A));
  await page.locator('#frame-b').fill(String(B));
  await page.locator('#frame-dbl').fill(String(DBL));
}

test('SC-4 impossible lens is explained', async ({ page }) => {
  await setFrame(page, 'rechteckig', 62, 55, 18);
  await page.locator('#rx-od-pd').fill('32');
  await page.locator('#rx-od-sph').fill('-12');
  await page.locator('#rx-od-cyl').fill('-6');
  await page.locator('#rx-od-axis').fill('10');
  await settled(page);
  const box = page.locator('#diag-od');
  await expect(box).toContainText('nicht herstellbar');
  await expect(box).toContainText('kleinere');
  await expect(box).toContainText('Modell');
  await expect(box).not.toContainText('BACK_SAG');
  await expect(page.locator('#result-od-status')).toHaveText('Nicht herstellbar');
  await expect(page.locator('#result-od-ct')).toHaveText('–');
  await expect(page.locator('body')).not.toContainText('NaN');
  await expect(page.locator('body')).not.toContainText('Code ');
  await page.locator('#material').selectOption('idx174');
  await settled(page);
  await expect(page.locator('#result-od-ct')).toHaveText(/^\d+,\d\smm$/);
  // 1,74 makes it computable; the 62×55 frame still needs a large blank (warning, numbers stay)
  await expect(box).not.toContainText('nicht herstellbar');
  await expect(box).toContainText('Großes Rohglas nötig');
});

// Re-derived from the 01-12 GREEN engine (E2E reference case in 01-12-SUMMARY): computes with
// BLANK_EXCEEDS_STOCK, D1 9,19, CT 38,3 mm, Vogel 18 → clamped 14, Vogel lens not computable.
test('oversized lens warns', async ({ page }) => {
  await setFrame(page, 'rechteckig', 62, 55, 24);
  await page.locator('#rx-od-pd').fill('25');
  await page.locator('#rx-od-sph').fill('+12');
  await page.locator('#rx-od-cyl').fill('');
  await settled(page);
  await expect(page.locator('#material')).toHaveValue('cr39');
  await expect(page.locator('#result-od-ct')).toHaveText(/^\d+,\d\smm$/);
  await expect(page.locator('#result-od-weight')).toHaveText(/^\d+,\d\sg$/);
  await expect(page.locator('#diag-od')).toContainText('Großes Rohglas nötig');
  await expect(page.locator('#result-od-status')).toHaveText('Hinweis');
  const bc = page.locator('#result-od-basecurve');
  for (const s of ['nahezu so dünn wie möglich', 'Faustregel nach Vogel', 'nicht berechnen']) await expect(bc).toContainText(s);
  await expect(page.locator('#result-od-ct')).toHaveText(/^38,3\smm$/);
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('very strong plus beyond the model range is explained (01-12)', async ({ page }) => {
  await setFrame(page, 'rund', 40, 40, 18);
  await page.locator('#rx-od-pd').fill('32');
  await page.locator('#rx-od-sph').fill('+16');
  await page.locator('#rx-od-cyl').fill('');
  await settled(page);
  await expect(page.locator('#material')).toHaveValue('cr39');
  await expect(page.locator('#result-od-status')).toHaveText('Nicht berechenbar');
  const box = page.locator('#diag-od');
  await expect(box).toContainText('+14,00 dpt');
  await expect(box).toContainText('Optiker');
  await expect(box).not.toContainText('BACK_SURFACE');
  await expect(page.locator('#result-od-ct')).toHaveText('–');
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('normal lens shows Vogel reference', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('-2');
  await settled(page);
  const bc = page.locator('#result-od-basecurve');
  await expect(bc).toContainText('nahezu so dünn wie möglich');
  await expect(bc).toContainText('Faustregel nach Vogel');
  await expect(page.locator('#diag-od')).toBeEmpty();
});

test('axis message is specific (MINOR-5)', async ({ page }) => {
  await page.locator('#rx-od-cyl').fill('-1,00');
  const err = page.locator('#rx-od-axis-err');
  for (const axis of ['90,5', '-90']) {
    await page.locator('#rx-od-axis').fill(axis);
    await expect(err).toBeVisible();
    await expect(err).toContainText('ganze');
    await expect(err).toContainText('180');
  }
});

test('material line shows the Abbe number (MAT-01)', async ({ page }) => {
  const line = page.locator('#result-od-material');
  await settled(page);
  await expect(page.locator('#material')).toHaveValue('cr39');
  await expect(line).toContainText('Abbe-Zahl 56');
  await page.locator('#material').selectOption('pc');
  await settled(page);
  await expect(line).toContainText('Abbe-Zahl 29');
});

// Oversized E2E reference case from 01-12-SUMMARY: vogelD1 18, vogelClampedD1 14 (D-A).
test('Vogel raw value with clamp note (MINOR-1)', async ({ page }) => {
  await setFrame(page, 'rechteckig', 62, 55, 24);
  await page.locator('#rx-od-pd').fill('25');
  await page.locator('#rx-od-sph').fill('+12');
  await page.locator('#rx-od-cyl').fill('');
  await settled(page);
  const bc = page.locator('#result-od-basecurve');
  await expect(bc).toContainText('Faustregel nach Vogel +18,00');
  await expect(bc).toContainText('begrenzt auf +14,00\u00A0dpt');
  await expect(bc).toContainText('dpt, begrenzt auf');
  await expect(bc).not.toContainText('dpt dpt');
  await expect(bc).not.toContainText('dpt\u00A0dpt');
  await page.locator('#rx-od-sph').fill('-2');
  await settled(page);
  await expect(bc).toContainText('Faustregel nach Vogel');
  await expect(bc).not.toContainText('begrenzt');
});

test('footer shows the build commit', async ({ page }) => {
  await expect(page.locator('#app-commit')).toHaveText(/^([0-9a-f]{7}|dev)$/);
});

test('technical details show the timing readout', async ({ page }) => {
  await settled(page);
  await page.locator('details#tech > summary').click();
  await expect(page.locator('#timing')).toHaveText(/Median\s[\d,]+\sms/, { timeout: 5000 });
});

test('timing shows work and latency medians (ENG-09)', async ({ page }) => {
  await settled(page);
  const sph = page.locator('#rx-od-sph');
  const echo = page.locator('#rx-od-sph-echo');
  for (let i = 1; i <= 10; i++) {
    await sph.fill(String(-i));
    await settled(page);
    await expect(echo).toContainText(`−${i},00`);
  }
  const timing = page.locator('#timing-input');
  const re = /Median der letzten 10 Eingaben\): Rechenarbeit (\d+,\d\d)\sms, Wartezeit inklusive (\d+,\d\d)\sms/;
  await expect(timing).toHaveText(re);
  const [, work, latency] = (await timing.textContent()).match(re);
  const num = (s) => Number(s.replace(',', '.'));
  expect(num(work)).toBeGreaterThan(0);
  expect(num(latency)).toBeGreaterThan(0);
  expect(num(latency)).toBeGreaterThanOrEqual(num(work));
});

test('technical details show three readouts', async ({ page }) => {
  await settled(page);
  await page.locator('details#tech > summary').click();
  for (const id of ['#timing', '#timing-frame', '#timing-worst']) {
    await expect(page.locator(id)).toHaveText(/Median\s[\d,]+\sms/, { timeout: 10_000 });
  }
  await expect(page.locator('#timing')).toContainText('−4,00');
  await expect(page.locator('#timing')).toContainText('Rechteckig');
});

test('one recompute per frame (01-14)', async ({ page }) => {
  await settled(page);
  // etmax, not CT: CT is 1,8 mm for every minus lens here (discrimination rule, lens-critic MAJOR-1).
  const etmax = page.locator('#result-od-etmax');
  const echo = page.locator('#rx-od-sph-echo');
  await page.locator('#rx-od-sph').fill('-3');
  await settled(page);
  const et3 = await etmax.textContent();
  await page.locator('#rx-od-sph').fill('-2,5');
  await settled(page);
  const et25 = await etmax.textContent();
  expect(et3).not.toBe(et25);
  await page.evaluate(() => {
    window.__mut = { etmax: 0, echo: 0 };
    const count = (id, k) =>
      new MutationObserver((recs) => {
        window.__mut[k] += recs.length;
      }).observe(document.getElementById(id), { childList: true, characterData: true, subtree: true });
    count('result-od-etmax', 'etmax');
    count('rx-od-sph-echo', 'echo');
    const input = /** @type {HTMLInputElement} */ (document.getElementById('rx-od-sph'));
    for (const v of ['-1', '-2', '-3']) {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await settled(page);
  const r = await page.evaluate(() => ({ ...window.__mut, text: document.getElementById('result-od-etmax').textContent }));
  // update() writes the echo once per run: without coalescing it would be 3 (lens-critic r3 M1).
  // The etmax count alone cannot fail: latest-wins drops −1 and −2 even without coalescing.
  expect(r.echo).toBe(1);
  expect(r.etmax).toBe(1);
  expect(r.text).toBe(et3);
  await expect(echo).toContainText('−3,00');
});

test('unchanged diagnostics are not re-announced (MINOR-11)', async ({ page }) => {
  // Oversized reference case (01-12-SUMMARY "E2E reference cases"): BLANK_EXCEEDS_STOCK.
  await setFrame(page, 'rechteckig', 62, 55, 24);
  await page.locator('#rx-od-pd').fill('25');
  await page.locator('#rx-od-sph').fill('+12');
  await page.locator('#rx-od-cyl').fill('');
  await settled(page);
  const diag = page.locator('#diag-od');
  const ct = page.locator('#result-od-ct');
  await expect(ct).toHaveText(/^38,3\smm$/);
  await expect(diag).toContainText('Großes Rohglas nötig');
  const before = await diag.textContent();
  const ctBefore = await ct.textContent();
  await page.evaluate(() => {
    const box = document.getElementById('diag-od');
    window.__diagMutations = 0;
    new MutationObserver((recs) => {
      window.__diagMutations += recs.length;
    }).observe(box, { childList: true, characterData: true, subtree: true, attributes: true });
  });
  // −0,25 dpt: OD recomputes (memo miss); the warning text depends on frame and PD only (mbsMm).
  await page.locator('#rx-od-sph').fill('+11,75');
  await settled(page);
  await expect(ct).not.toHaveText(ctBefore);
  expect(await diag.textContent()).toBe(before);
  expect(await page.evaluate(() => window.__diagMutations)).toBe(0);
});

test('no serious or critical accessibility violations', async ({ page }) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const severe = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
