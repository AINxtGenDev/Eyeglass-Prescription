// Walking-skeleton smoke contract (DEPL-01, RX-02, RX-03, L10N-01, RES-06, SC-1, ENG-09).
// RED until plan 01-03 ships the German page; runs against `vite preview` locally
// and against the live Pages URL when BASE_URL is set.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settled, thickOf, sphOnly } from './helpers.js';
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
  // 02-01: card ids; the thickest point is #result-<eye>-thick, the weight is in whole grams.
  for (const id of ['#result-od-ct', '#result-od-thick', '#result-os-ct']) {
    await expect(page.locator(id)).toHaveText(/^\d+,\d\smm$/);
  }
  await expect(page.locator('#result-od-weight')).toHaveText(/^\d+\sg$/);
  // 02-02: the base curve is a Zwischenwert behind the Experten-Ansicht.
  await page.locator('#expert').check();
  await expect(page.locator('#result-od-basecurve')).toBeVisible();
  await expect(page.locator('#result-od-basecurve')).toContainText('Vogel');
});

test('malformed input shows an error, never NaN', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('1.000,25');
  // 02-03: field messages appear after a 600 ms pause or on blur.
  await page.locator('#rx-od-sph').blur();
  const err = page.locator('#rx-od-sph-err');
  await expect(err).toBeVisible();
  await expect(err).toContainText('Fehler:');
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
  await expect(page.locator('#result-od-thick')).toHaveText(/^\d+,\d/);
  const cr39 = await thickOf(page, 'od');
  await select.selectOption('idx167');
  await settled(page);
  await expect(page.locator('#result-od-material')).toContainText('1,67');
  expect(await thickOf(page, 'od')).toBeLessThan(cr39);
});

test('frame shape and PD change the edge', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('-6,00');
  await page.locator('#rx-os-sph').fill('-6,00');
  await settled(page);
  await expect(page.locator('input[name=frame-shape][value=rechteckig]')).toBeChecked();
  await expect(page.locator('#frame-a')).toHaveValue('52');
  await expect(page.locator('#rx-od-pd')).toHaveValue('32');
  // 02-01 lay words: −6,00 / −0,50 × 180 (example cylinder kept), PD 32 → 8,0 mm 'außen oben'.
  await expect(page.locator('#result-od-thick-loc')).toContainText('außen');
  const before = await thickOf(page, 'od');
  // 02-02: Dezentration is a Zwischenwert behind the Experten-Ansicht.
  await page.locator('#expert').check();
  await expect(page.locator('#result-od-dec')).toBeVisible();
  await expect(page.locator('#result-od-dec')).toHaveText(/^3,0\smm$/);
  await page.locator('#rx-od-pd').fill('28');
  await settled(page);
  await expect(page.locator('#result-od-dec')).toHaveText(/^7,0\smm$/);
  expect(await thickOf(page, 'od')).toBeGreaterThan(before);
  await page.locator('input[name=frame-shape][value=pilot]').check();
  await settled(page);
  await expect(page.locator('#frame-a')).toHaveValue('58');
  await expect(page.locator('#frame-b')).toHaveValue('50');
  await expect(page.locator('#frame-dbl')).toHaveValue('14');
  await expect(page.locator('body')).not.toContainText('NaN');
});

// evaluateLens of +3,00 −2,00 × 180 (OD, Rechteckig 52×38/18, PD 32, CR-39), 02-01 node re-check:
// CT 3,589, etMax 3,234 superior, etMin 1,000 temporal, 7,01 g → thickest(m) = CT 3,6 mm 'in der
// Mitte', fmtGramWhole 7 g. The −2,00 start (sphOnly) shows 1,8 / 3,7 / 2,5 mm and 6 g.
const PLUS_CYL_VALUES = [
  ['#result-od-ct', /^3,6\smm$/],
  ['#result-od-thick', /^3,6\smm$/],
  ['#result-od-etmin', /^1,0\smm$/],
  ['#result-od-weight', /^7\sg$/],
];

test('plus cylinder shows both forms', async ({ page }) => {
  await sphOnly(page);
  const CELLS = ['#result-od-ct', '#result-od-thick', '#result-od-etmin', '#result-od-weight'];
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
  await expect(page.locator('#result-od-thick-loc')).toHaveText('in der Mitte');
  await expect(page.locator('#result-od-status')).toBeEmpty();
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('cylinder without axis', async ({ page }) => {
  await page.locator('#rx-od-cyl').fill('-1,00');
  await page.locator('#rx-od-axis').fill('');
  await page.locator('#rx-od-axis').blur();
  await settled(page);
  const err = page.locator('#rx-od-axis-err');
  await expect(err).toBeVisible();
  await expect(err).toContainText('Fehler:');
  await expect(err).not.toBeEmpty();
  await expect(page.locator('#result-od-ct')).toHaveText('–');
  await expect(page.locator('body')).not.toContainText('NaN');
});

/** Fill the frame fieldset (shape first: it pre-fills A/B/DBL). */
async function setFrame(page, shape, A, B, DBL) {
  await page.locator(`input[name=frame-shape][value=${shape}]`).check();
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
  await expect(page.locator('#result-od-weight')).toHaveText(/^\d+\sg$/);
  await expect(page.locator('#diag-od')).toContainText('Großes Rohglas nötig');
  await expect(page.locator('#result-od-status')).toHaveText('Hinweis');
  await page.locator('#expert').check(); // 02-02: Zwischenwerte behind the Experten-Ansicht
  const bc = page.locator('#result-od-basecurve');
  await expect(bc).toBeVisible();
  for (const s of ['nahezu so dünn wie möglich', 'Faustregel nach Vogel', 'nicht berechnen']) await expect(bc).toContainText(s);
  await expect(page.locator('#result-od-ct')).toHaveText(/^38,3\smm$/);
  await expect(page.locator('body')).not.toContainText('NaN');
});

// 02-03: Sph +16 is outside the RX-04 input range (±12,00 dpt), so the field message explains it
// before the engine is asked; the engine's own +14,00 limit text (01-12) is no longer reachable
// from the Sph field.
test('very strong plus beyond the model range is explained (01-12, 02-03)', async ({ page }) => {
  await setFrame(page, 'rund', 40, 40, 18);
  await page.locator('#rx-od-pd').fill('32');
  await page.locator('#rx-od-sph').fill('+16');
  await page.locator('#rx-od-cyl').fill('');
  await page.locator('#rx-od-sph').blur();
  await settled(page);
  await expect(page.locator('#material')).toHaveValue('cr39');
  const err = page.locator('#rx-od-sph-err');
  await expect(err).toContainText('Außerhalb des Modells:');
  await expect(err).toContainText('+12,00');
  await expect(page.locator('#result-od-status')).toHaveText(/^Für dieses Glas wird nichts berechnet/);
  await expect(page.locator('#result-od-ct')).toHaveText('–');
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('normal lens shows Vogel reference', async ({ page }) => {
  await page.locator('#rx-od-sph').fill('-2');
  await settled(page);
  await page.locator('#expert').check(); // 02-02: Zwischenwerte behind the Experten-Ansicht
  const bc = page.locator('#result-od-basecurve');
  await expect(bc).toBeVisible();
  await expect(bc).toContainText('nahezu so dünn wie möglich');
  await expect(bc).toContainText('Faustregel nach Vogel');
  await expect(page.locator('#diag-od')).toBeEmpty();
});

test('axis message is specific (MINOR-5)', async ({ page }) => {
  await page.locator('#rx-od-cyl').fill('-1,00');
  const err = page.locator('#rx-od-axis-err');
  for (const axis of ['90,5', '-90']) {
    await page.locator('#rx-od-axis').fill(axis);
    await page.locator('#rx-od-axis').blur();
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
  await page.locator('#expert').check(); // 02-02: Zwischenwerte behind the Experten-Ansicht
  const bc = page.locator('#result-od-basecurve');
  await expect(bc).toBeVisible();
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

const msNum = (str) => Number(str.replace(',', '.'));
const INPUT_RE =
  /letzte 10 Eingaben\): Median (\d+,\d\d)\sms, längste (\d+,\d\d)\sms; Hauptthread je Eingabe einschließlich Darstellung: Median (\d+,\d\d)\sms, längste (\d+,\d\d)\sms/;
const RESULT_RE =
  /Eingabe bis Ergebnis sichtbar \(letzte (\d+) Ergebnisse\): Median (\d+,\d\d)\sms, längste (\d+,\d\d)\sms; Darstellung des Ergebnisses längstens (\d+,\d\d)\sms; davon Rechnen: Median (\d+,\d\d)\sms/;
const BUSY_RE = /„rechnet …“ angezeigt seit dem Laden: (\d+)-mal; längste Wartezeit auf ein Ergebnis: (\d+,\d\d)\sms/;

test('timing shows reaction, main-thread and result medians (ENG-09)', async ({ page }) => {
  await settled(page);
  const sph = page.locator('#rx-od-sph');
  const echo = page.locator('#rx-od-sph-echo');
  for (let i = 1; i <= 10; i++) {
    await sph.fill(String(-i));
    await settled(page);
    await expect(echo).toContainText(`−${i},00`);
  }
  const input = page.locator('#timing-input');
  await expect(input).toHaveText(INPUT_RE);
  const [, reactMed, reactMax, mainMed, mainMax] = (await input.textContent()).match(INPUT_RE).map(String);
  for (const v of [reactMed, reactMax, mainMed, mainMax]) expect(msNum(v)).toBeGreaterThan(0);
  expect(msNum(reactMed)).toBeGreaterThanOrEqual(msNum(mainMed));
  const result = page.locator('#timing-result');
  await expect(result).toHaveText(RESULT_RE);
  const [, n, ...resultValues] = (await result.textContent()).match(RESULT_RE);
  expect(Number(n)).toBe(10);
  for (const v of resultValues) expect(msNum(v)).toBeGreaterThan(0);
  await expect(page.locator('#timing-busy')).toHaveText(BUSY_RE);
});

const READOUT_IDS = ['#timing', '#timing-frame', '#timing-worst', '#timing-rescan'];

test('technical details show four readouts', async ({ page }) => {
  await settled(page);
  await page.locator('details#tech > summary').click();
  await expect(page.locator('#tech')).toHaveAttribute('data-bench-runs', '1', { timeout: 60_000 });
  for (const id of READOUT_IDS) await expect(page.locator(id)).toHaveText(/Median\s[\d,]+\sms/);
  await expect(page.locator('#timing')).toContainText('−4,00');
  await expect(page.locator('#timing')).toContainText('Rechteckig');
  await expect(page.locator('#timing-rescan')).toContainText('erweiterter Suche');
  await expect(page.locator('#timing-rescan')).toContainText('Einschleifhöhe');
});

test('bench re-entry is ignored; compute goes first', async ({ page }) => {
  test.setTimeout(90_000);
  // 02-01: start from Sph −2,00 without the example cylinder, so −3 gives the pinned 4,7 mm.
  await sphOnly(page);
  const et2 = await thickOf(page, 'od');
  const tech = page.locator('#tech');
  await page.locator('details#tech > summary').click();
  await expect(tech).toHaveAttribute('data-bench-runs', '1', { timeout: 60_000 });
  // Two synchronous clicks: the second must hit the guard and change nothing (MINOR-5, orchestrator MINOR-12).
  const r = await page.evaluate(() => {
    const el = document.getElementById('timing');
    const mo = new MutationObserver(() => {});
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    const button = document.getElementById('timing-rerun');
    button.click();
    const afterFirst = mo.takeRecords().length;
    button.click();
    const afterSecond = mo.takeRecords().length;
    mo.disconnect();
    return { afterFirst, afterSecond, text: el.textContent };
  });
  expect(r.afterFirst).toBe(1);
  expect(r.text).toBe('wird gemessen …');
  // runBench returned early: the readout was not reset to 'wird gemessen …' a second time.
  expect(r.afterSecond).toBe(0);
  await page.locator('#rx-od-sph').fill('-3');
  await settled(page, { timeout: 2000 });
  const et3 = await thickOf(page, 'od');
  expect(et3).not.toBe(et2);
  expect(et3).toBe(4.7);
  // Compute went ahead of the remaining bench runs: the bench is still running.
  await expect(tech).toHaveAttribute('aria-busy', 'true');
  await expect(tech).toHaveAttribute('data-bench-runs', '2', { timeout: 60_000 });
  await expect(page.locator('#timing-rerun')).not.toHaveAttribute('aria-disabled', /.*/);
  await page.waitForTimeout(500);
  await expect(tech).toHaveAttribute('data-bench-runs', '2');
});

test('message handler is negligible (measured, MINOR-13)', async ({ page }) => {
  await settled(page);
  await page.goto('./?msgprobe');
  await settled(page);
  const sph = page.locator('#rx-od-sph');
  for (let i = 0; i < 20; i++) {
    await sph.fill(i % 2 ? '-4,25' : '-4,00');
    await settled(page);
  }
  const ms = await page.evaluate(() => window.__msgMs);
  expect(ms.length).toBeGreaterThanOrEqual(20);
  const last = ms.slice(-20).sort((a, b) => a - b);
  const med = (last[9] + last[10]) / 2;
  console.info(`message handler (20 result deliveries): median ${med.toFixed(3)} ms, max ${last.at(-1).toFixed(3)} ms`);
  expect(Number.isFinite(med)).toBe(true);
});

test('event timing readout is filled', async ({ page }) => {
  await settled(page);
  const sph = page.locator('#rx-od-sph');
  await sph.fill('');
  await sph.pressSequentially('-3,75', { delay: 30 });
  await settled(page);
  const ev = page.locator('#timing-event');
  await expect(ev).not.toBeEmpty();
  await expect(ev).not.toContainText('{');
  await expect(ev).toContainText('Event Timing');
});

test('one recompute per frame (01-14)', async ({ page }) => {
  await settled(page);
  // thickest point, not CT: CT is 1,8 mm for every minus lens here (discrimination rule, lens-critic MAJOR-1).
  const etmax = page.locator('#result-od-thick');
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
    count('result-od-thick', 'etmax');
    count('rx-od-sph-echo', 'echo');
    const input = /** @type {HTMLInputElement} */ (document.getElementById('rx-od-sph'));
    for (const v of ['-1', '-2', '-3']) {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await settled(page);
  const r = await page.evaluate(() => ({ ...window.__mut, text: document.getElementById('result-od-thick').textContent }));
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
