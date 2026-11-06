// Walking-skeleton smoke contract (DEPL-01, RX-02, RX-03, L10N-01, RES-06, SC-1, ENG-09).
// RED until plan 01-03 ships the German page; runs against `vite preview` locally
// and against the live Pages URL when BASE_URL is set.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
/* global document, window, requestAnimationFrame, MutationObserver -- page.evaluate bodies run in the browser */

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
  const select = page.locator('#material');
  await expect(select.locator('option')).toHaveCount(6);
  await expect(select.locator('option', { hasText: 'Trivex 1,53' })).toHaveCount(1);
  await expect(select).toHaveValue('cr39');
  const etmax = page.locator('#result-od-etmax');
  await expect(etmax).toHaveText(/^\d+,\d/);
  const num = async () => Number((await etmax.textContent()).match(/^(\d+,\d)/)[1].replace(',', '.'));
  const cr39 = await num();
  await select.selectOption('idx167');
  await expect(page.locator('#result-od-material')).toContainText('1,67');
  await expect.poll(num).toBeLessThan(cr39);
});

test('frame shape and PD change the edge', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('-6,00');
  await page.locator('#rx-os-sph').fill('-6,00');
  await expect(page.locator('#frame-shape')).toHaveValue('rechteckig');
  await expect(page.locator('#frame-a')).toHaveValue('52');
  await expect(page.locator('#rx-od-pd')).toHaveValue('32');
  const etmax = page.locator('#result-od-etmax');
  await expect(etmax).toContainText('schläfenseitig');
  const num = async () => Number((await etmax.textContent()).match(/^(\d+,\d)/)[1].replace(',', '.'));
  const before = await num();
  await expect(page.locator('#result-od-dec')).toHaveText(/^3,0\smm$/);
  await page.locator('#rx-od-pd').fill('28');
  await expect(page.locator('#result-od-dec')).toHaveText(/^7,0\smm$/);
  await expect.poll(num).toBeGreaterThan(before);
  await page.locator('#frame-shape').selectOption('pilot');
  await expect(page.locator('#frame-a')).toHaveValue('58');
  await expect(page.locator('#frame-b')).toHaveValue('50');
  await expect(page.locator('#frame-dbl')).toHaveValue('14');
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('plus cylinder shows both forms', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('+1,00');
  await page.locator('#rx-od-cyl').fill('+2,00');
  await page.locator('#rx-od-axis').fill('90');
  const forms = page.locator('#rx-od-forms');
  await expect(forms).toBeVisible();
  for (const s of ['+3,00', '−2,00', '180°', '+2,00', '90°', 'umgerechnet']) await expect(forms).toContainText(s);
  for (const id of ['#result-od-ct', '#result-od-etmax', '#result-od-etmin', '#result-od-weight']) {
    await expect(page.locator(id)).toHaveText(/^\d+,\d\s(mm|g)/);
  }
  await expect(page.locator('#result-od-status')).toBeEmpty();
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('cylinder without axis', async ({ page }) => {
  await page.locator('#rx-od-cyl').fill('-1,00');
  await page.locator('#rx-od-axis').fill('');
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
  await expect(page.locator('#material')).toHaveValue('cr39');
  await expect(line).toContainText('Abbe-Zahl 56');
  await page.locator('#material').selectOption('pc');
  await expect(line).toContainText('Abbe-Zahl 29');
});

// Oversized E2E reference case from 01-12-SUMMARY: vogelD1 18, vogelClampedD1 14 (D-A).
test('Vogel raw value with clamp note (MINOR-1)', async ({ page }) => {
  await setFrame(page, 'rechteckig', 62, 55, 24);
  await page.locator('#rx-od-pd').fill('25');
  await page.locator('#rx-od-sph').fill('+12');
  await page.locator('#rx-od-cyl').fill('');
  const bc = page.locator('#result-od-basecurve');
  await expect(bc).toContainText('Faustregel nach Vogel +18,00');
  await expect(bc).toContainText('begrenzt auf +14,00\u00A0dpt');
  await expect(bc).toContainText('dpt, begrenzt auf');
  await expect(bc).not.toContainText('dpt dpt');
  await expect(bc).not.toContainText('dpt\u00A0dpt');
  await page.locator('#rx-od-sph').fill('-2');
  await expect(bc).toContainText('Faustregel nach Vogel');
  await expect(bc).not.toContainText('begrenzt');
});

test('footer shows the build commit', async ({ page }) => {
  await expect(page.locator('#app-commit')).toHaveText(/^([0-9a-f]{7}|dev)$/);
});

test('technical details show the timing readout', async ({ page }) => {
  await page.locator('details#tech > summary').click();
  await expect(page.locator('#timing')).toHaveText(/Median\s[\d,]+\sms/, { timeout: 5000 });
});

// 01-14: the page has rendered its first frame (results are written from a rAF callback).
const firstFrame = (page) => expect(page.locator('#result-od-ct')).toHaveText(/mm$/);

test('timing shows work and latency medians (ENG-09)', async ({ page }) => {
  await firstFrame(page);
  const sph = page.locator('#rx-od-sph');
  const echo = page.locator('#rx-od-sph-echo');
  for (let i = 1; i <= 10; i++) {
    await sph.fill(String(-i));
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
  await page.locator('details#tech > summary').click();
  for (const id of ['#timing', '#timing-frame', '#timing-worst']) {
    await expect(page.locator(id)).toHaveText(/Median\s[\d,]+\sms/, { timeout: 10_000 });
  }
  await expect(page.locator('#timing')).toContainText('−4,00');
  await expect(page.locator('#timing')).toContainText('Rechteckig');
});

test('one recompute per frame (01-14)', async ({ page }) => {
  await firstFrame(page);
  const ct = page.locator('#result-od-ct');
  const echo = page.locator('#rx-od-sph-echo');
  await page.locator('#rx-od-sph').fill('-3');
  await expect(echo).toContainText('−3,00');
  const ct3 = await ct.textContent();
  await page.locator('#rx-od-sph').fill('-2,5');
  await expect(echo).toContainText('−2,50');
  const r = await page.evaluate(async () => {
    const el = document.getElementById('result-od-ct');
    let n = 0;
    const mo = new MutationObserver((recs) => {
      n += recs.length;
    });
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    const input = /** @type {HTMLInputElement} */ (document.getElementById('rx-od-sph'));
    for (const v of ['-1', '-2', '-3']) {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    mo.disconnect();
    return { n, text: el.textContent };
  });
  // Without coalescing every input would rewrite the cell: 3 mutations.
  expect(r.n).toBe(1);
  expect(r.text).toBe(ct3);
  await expect(echo).toContainText('−3,00');
});

test('unchanged diagnostics are not re-announced (MINOR-11)', async ({ page }) => {
  // Oversized reference case (01-12-SUMMARY "E2E reference cases"): BLANK_EXCEEDS_STOCK.
  await setFrame(page, 'rechteckig', 62, 55, 24);
  await page.locator('#rx-od-pd').fill('25');
  await page.locator('#rx-od-sph').fill('+12');
  await page.locator('#rx-od-cyl').fill('');
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
  await expect(ct).not.toHaveText(ctBefore);
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0))));
  expect(await diag.textContent()).toBe(before);
  expect(await page.evaluate(() => window.__diagMutations)).toBe(0);
});

test('no serious or critical accessibility violations', async ({ page }) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const severe = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
