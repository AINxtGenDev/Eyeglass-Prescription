// RES-03 3D part (03-14; D-24 as amended, D-25; UI-SPEC "A/B in 3D"; lens-critic round 2 MINOR 4)
// and the 03-14 amendment A3 (keyboard hint fades, callouts return).
// While 'Variante vergleichen' is active the view shows the compared eye as Vorher (A) | Nachher (B)
// side by side (stage ≥ 360 px) or toggled by #cmp-show (below), one camera, one scale. Every
// number asserted here is compared against the result cards or the heat table (engine values).
// Reduced motion by default (instant camera cut): SwiftShader renders ≈ 1 s per frame, two halves
// ≈ 2 s. Waits are deterministic (data-pending, debug handle states), never fixed sleeps.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settledView, settledCompare, settledXsec, guardPage, noThreeWarnings, plain, etmaxOf } from './helpers.js';
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
const info = (page) => ev(page, () => window.__eyeglassView.compareInfo());
const memory = (page) => ev(page, () => window.__eyeglassView.memory());
const labelsInfo = (page) => ev(page, () => window.__eyeglassView.labelsInfo());
const frames = (page) => ev(page, () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 0)))));
const mmOf = (s) => Number(plain(s).match(/(\d+,\d+)/)[1].replace(',', '.'));
const showRadio = (page, v) => page.locator(`#cmp-show input[name=cmp-show][value=${v}]`);
const cell = (page, row, col) => page.locator(`#view-heat-table td[data-row=${row}][data-col=${col}] .cell-val`);
const desktopOnly = (testInfo) => test.skip(testInfo.project.name !== 'desktop', 'desktop project (pointer path) only');

/** The view shows the comparison with the A lens of the current A input attached. */
async function compareReady(page) {
  await settledView(page);
  await page.waitForFunction(() => {
    const c = window.__eyeglassView.compareInfo();
    return c.active && c.aReady;
  });
  await frames(page);
}

/** Comparison active with B = 1,74 (A = the example with CR-39), as e2e/a11y.spec.js comparisonOn. */
async function comparisonOn(page) {
  await page.locator('#cmp-start').click();
  await settledCompare(page);
  await page.locator('input[name=material][value=idx174]').check();
  await settledXsec(page);
  await expect(page.locator('#cmp-active')).toBeVisible();
  await compareReady(page);
}

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

/** A card value read with #cmp-show on Vorher ('a') or Nachher ('b'); the toggle is put back to Nachher. */
async function cardValue(page, which, read) {
  await showRadio(page, which).check();
  await settledView(page);
  const v = await read();
  await showRadio(page, 'b').check();
  await settledView(page);
  return v;
}

test('RES-03 side by side at ≥ 360 px', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.setTimeout(120_000);
  await settledView(page);
  const before = await memory(page);
  await comparisonOn(page);
  const c = await info(page);
  expect(c).toMatchObject({ active: true, split: true, aReady: true });
  await expect(page.locator('#view-labels')).toContainText('Vorher (A)');
  await expect(page.locator('#view-labels')).toContainText('Nachher (B)');
  await expect(page.locator('.view-divider')).toBeVisible();
  await expect(page.locator('#view-caption')).toContainText('im Vergleich');
  await expect(page.locator('#view-caption')).toHaveText(`${c.eye === 'OD' ? 'Rechtes' : 'Linkes'} Glas im Vergleich – gleicher Maßstab, gleicher Blickwinkel.`);
  // The heat-eye picker is not offered in the comparison; no eye labels.
  expect((await labelsInfo(page)).labels.filter((l) => l.kind === 'eye')).toEqual([]);
  // Mesh edge = the card's Dickster Rand (rounded to 0,1 mm), A against Vorher and B against Nachher.
  const eyeId = c.eye.toLowerCase();
  const edgeA = await ev(page, () => window.__eyeglassView.edgeMax('A'));
  const edgeB = await ev(page, (e) => window.__eyeglassView.edgeMax(e), c.eye);
  const cardA = await cardValue(page, 'a', () => etmaxOf(page, eyeId));
  const cardB = await etmaxOf(page, eyeId);
  expect(Math.round(edgeA * 10) / 10, 'A edge = Vorher card').toBe(cardA);
  expect(Math.round(edgeB * 10) / 10, 'B edge = Nachher card').toBe(cardB);
  expect(cardA).toBeGreaterThan(cardB); // 1,50 → 1,74 is thinner
  // Canvas name: thickest point of A and B, the same text as the cards' Dickste Stelle.
  const thickA = await cardValue(page, 'a', async () => plain(await page.locator(`#result-${eyeId}-thick`).textContent()));
  const thickB = plain(await page.locator(`#result-${eyeId}-thick`).textContent());
  await expect
    .poll(async () => plain(await page.locator('#view-canvas').getAttribute('aria-label')))
    .toContain(`Vorher (A): dickste Stelle ${thickA}. Nachher (B): dickste Stelle ${thickB}.`);
  // No GPU resource was created for the first comparison (warm-up at the first attach).
  expect(await memory(page), 'memory before and during the first comparison').toEqual(before);
});

test('RES-03 same scale: a smaller B frame looks smaller', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.setTimeout(120_000);
  await settledView(page);
  await expect(page.locator('#frame-a')).toHaveValue('52');
  await comparisonOn(page);
  await page.locator('#frame-a').fill('46');
  await settledXsec(page);
  await compareReady(page);
  await page.locator('#view-tools [data-preset=front]').click();
  await page.waitForFunction(() => window.__eyeglassView.viewName() === 'front');
  await frames(page);
  const front = (await info(page)).widthPx;
  expect(front.A).toBeGreaterThan(50);
  const ratio = front.B / front.A;
  expect(Math.abs(ratio / (46 / 52) - 1), `Vorne: B/A = ${ratio.toFixed(4)}, 46/52 = ${(46 / 52).toFixed(4)}`).toBeLessThanOrEqual(0.02);
  await page.locator('#view-tools [data-preset=reset]').click();
  await page.waitForFunction(() => window.__eyeglassView.viewName() === 'default');
  await frames(page);
  const def = (await info(page)).widthPx;
  const ratioDefault = def.B / def.A;
  test.info().annotations.push({
    type: 'width ratio',
    description: `Vorne ${front.A.toFixed(1)} / ${front.B.toFixed(1)} px → ${ratio.toFixed(4)}; schräg ${def.A.toFixed(1)} / ${def.B.toFixed(1)} px → ${ratioDefault.toFixed(4)}; 46/52 = ${(46 / 52).toFixed(4)}`,
  });
  expect(Math.abs(ratioDefault / (46 / 52) - 1), 'default 3/4 view').toBeLessThanOrEqual(0.02);
});

test.describe('RES-03 phone toggle', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test('below 360 px one viewport follows Vorher | Nachher, the camera stays', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile project (touch path) only');
    test.setTimeout(120_000);
    await settledView(page);
    await comparisonOn(page);
    expect(await info(page)).toMatchObject({ active: true, split: false, shown: 'B' });
    await expect(page.locator('.view-divider')).toBeHidden();
    const cam0 = await ev(page, () => window.__eyeglassView.camera());
    let caps = (await labelsInfo(page)).labels.filter((l) => l.kind === 'caption').map((l) => l.text);
    expect(caps).toEqual(['Nachher (B)']);
    await showRadio(page, 'a').check();
    await page.waitForFunction(() => window.__eyeglassView.compareInfo().shown === 'A');
    await settledView(page);
    await frames(page);
    const cam1 = await ev(page, () => window.__eyeglassView.camera());
    expect(cam1.position).toEqual(cam0.position);
    expect(cam1.target).toEqual(cam0.target);
    caps = (await labelsInfo(page)).labels.filter((l) => l.kind === 'caption').map((l) => l.text);
    expect(caps).toEqual(['Vorher (A)']);
    expect((await info(page)).widthPx.A).toBeGreaterThan(50);
    await showRadio(page, 'b').check();
    await page.waitForFunction(() => window.__eyeglassView.compareInfo().shown === 'B');
    await settledView(page);
    expect((await ev(page, () => window.__eyeglassView.camera())).position).toEqual(cam0.position);
    const sw = await ev(page, () => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sw[0]).toBeLessThanOrEqual(sw[1]);
  });
});

test('D-25 shared heat scale over all four lenses; table Vorher (A) · Nachher (B)', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.setTimeout(150_000);
  await settledView(page);
  await expertOn(page);
  await heatOn(page);
  await comparisonOn(page);
  await page.waitForFunction(() => window.__eyeglassView.heatScale() !== null);
  const s = await ev(page, () => window.__eyeglassView.heatScale());
  // The four card values: thinnest and thickest of R and L for Vorher and Nachher.
  const read = async () => {
    const out = [];
    for (const e of ['od', 'os']) {
      out.push({ thin: mmOf(await page.locator(`#result-${e}-thin`).textContent()), thick: mmOf(await page.locator(`#result-${e}-thick`).textContent()) });
    }
    return out;
  };
  const vA = await cardValue(page, 'a', read);
  const vB = await read();
  const all = [...vA, ...vB];
  const min = Math.min(...all.map((v) => v.thin));
  const max = Math.max(...all.map((v) => v.thick));
  // Card values are rounded to 0,1 mm; the scale carries the engine values.
  expect(Math.abs(s.min - min), `scale min ${s.min} vs cards ${min}`).toBeLessThanOrEqual(0.05);
  expect(Math.abs(s.max - max), `scale max ${s.max} vs cards ${max}`).toBeLessThanOrEqual(0.05);
  expect(Math.max(...vA.map((v) => v.thick))).toBeGreaterThan(Math.max(...vB.map((v) => v.thick)));
  const c = await info(page);
  expect(s.eye).toBe(c.eye);
  const head = plain(await page.locator('#view-heat-table thead').textContent());
  expect(head).toContain('Vorher (A)');
  expect(head).toContain('Nachher (B)');
  await expect(page.locator('#view-heat-table caption')).toHaveText(`Dicke an markanten Stellen – ${c.eye === 'OD' ? 'rechtes' : 'linkes'} Glas`);
  await expect(page.locator('#view-heat-eye')).toBeHidden();
  // Table = engine: Mitte A/B equal the cards' Mittendicke of the compared eye.
  const eyeId = c.eye.toLowerCase();
  const ctA = await cardValue(page, 'a', async () => plain(await page.locator(`#cmp-row-ct${c.eye} td[data-col=a] .cmp-val`).textContent()));
  expect(plain(await cell(page, 'centre', 'A').textContent())).toBe(ctA);
  expect(plain(await cell(page, 'centre', 'B').textContent())).toBe(plain(await page.locator(`#cmp-row-ct${c.eye} td[data-col=b] .cmp-val`).textContent()));
  expect(plain(await cell(page, 'thickest', 'B').textContent())).toContain(plain(await page.locator(`#result-${eyeId}-thick`).textContent()));
  // Ending the comparison restores the per-eye table.
  await page.locator('#cmp-end').click();
  await page.waitForFunction(() => !window.__eyeglassView.compareInfo().active);
  await settledView(page);
  await expect(page.locator('#view-heat-table caption')).toHaveText('Dicke an markanten Stellen');
  expect(plain(await page.locator('#view-heat-table thead').textContent())).toContain('Rechtes Glas');
});

for (const vp of [
  { width: 1280, height: 800 },
  { width: 412, height: 915 },
]) {
  test.describe(`D-25 callouts at ${vp.width}×${vp.height}`, () => {
    test.use({ viewport: vp });
    test('callouts on both halves or neither (round 2 MINOR 4)', async ({ page }, testInfo) => {
      desktopOnly(testInfo);
      test.setTimeout(150_000);
      await settledView(page);
      await expertOn(page);
      await heatOn(page);
      await comparisonOn(page);
      await frames(page);
      const c = await info(page);
      expect(c.split, 'the stage is ≥ 360 px wide').toBe(true);
      const li = await labelsInfo(page);
      const callouts = li.labels.filter((l) => l.kind === 'callout');
      const nA = callouts.filter((l) => l.half === 'A').length;
      const nB = callouts.filter((l) => l.half === 'B').length;
      const note = page.locator('#view-callout-note');
      if (li.calloutsFit) {
        expect([5, 6]).toContain(nA);
        expect([5, 6]).toContain(nB);
        await expect(note).toBeHidden();
        // Each half's numbers are its own table column.
        for (const l of callouts) {
          const v = plain(await cell(page, l.key, l.half).textContent());
          expect(plain(l.text).match(/\d+,\d+/)[0], `${l.half} ${l.key}`).toBe(v.match(/\d+,\d+/)[0]);
        }
      } else {
        expect(callouts).toEqual([]);
        await expect(note).toBeVisible();
        await expect(note).toHaveText('Für die Zahlen am Glas ist die Ansicht zu klein – alle Werte stehen in der Tabelle.');
      }
      // No label crosses its half or another label; none covers the badge.
      const stage = await ev(page, () => {
        const r = document.getElementById('view-stage').getBoundingClientRect();
        return { x: r.x, w: r.width };
      });
      const mid = stage.x + stage.w / 2;
      const rects = li.labels;
      for (const l of rects) {
        if (l.half === 'A') expect(l.rect.x + l.rect.w, `${l.kind} ${l.text} in half A`).toBeLessThanOrEqual(mid + 0.5);
        if (l.half === 'B') expect(l.rect.x, `${l.kind} ${l.text} in half B`).toBeGreaterThanOrEqual(mid - 1.5);
      }
      const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(hit(rects[i].rect, rects[j].rect), `${rects[i].text} × ${rects[j].text}`).toBe(false);
      testInfo.annotations.push({
        type: `callouts ${vp.width}×${vp.height}`,
        description: li.calloutsFit ? `both halves: A ${nA}, B ${nB}` : 'neither half (table-only note)',
      });
    });
  });
}

test('RES-03 end: back to the full glasses at the default camera', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.setTimeout(120_000);
  await settledView(page);
  await comparisonOn(page);
  await page.locator('#view-tools [data-preset=side]').click();
  await page.waitForFunction(() => window.__eyeglassView.viewName() === 'side');
  await page.locator('#cmp-end').click();
  await page.waitForFunction(() => !window.__eyeglassView.compareInfo().active);
  await settledView(page);
  await frames(page);
  expect(await ev(page, () => window.__eyeglassView.viewName())).toBe('default');
  expect(await ev(page, () => window.__eyeglassView.edgeMax('OD'))).not.toBeNull();
  expect(await ev(page, () => window.__eyeglassView.edgeMax('OS'))).not.toBeNull();
  await expect(page.locator('.view-divider')).toBeHidden();
  const kinds = (await labelsInfo(page)).labels.map((l) => l.kind);
  expect(kinds).not.toContain('caption');
  expect(kinds.filter((k) => k === 'eye')).toHaveLength(2);
  await expect(page.locator('#view-caption')).not.toContainText('im Vergleich');
});

test('RES-03 no GPU churn over 5 compare start/end cycles (T-03-39)', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.setTimeout(300_000);
  await settledView(page);
  const before = await memory(page);
  const during = [];
  const after = [];
  for (let i = 0; i < 5; i++) {
    await page.locator('#cmp-start').click();
    await settledCompare(page);
    // Alternate B's material so A and B differ and the A lens is rebuilt in place on some cycles.
    await page.locator(`input[name=material][value=${i % 2 === 0 ? 'idx174' : 'cr39'}]`).check();
    await settledXsec(page);
    await compareReady(page);
    during.push(await memory(page));
    await page.locator('#cmp-end').click();
    await page.waitForFunction(() => !window.__eyeglassView.compareInfo().active);
    await settledView(page);
    after.push(await memory(page));
  }
  testInfo.annotations.push({ type: 'memory', description: JSON.stringify({ before, during, after }) });
  for (const m of [...during, ...after]) expect(m).toEqual(before);
});

// ---- A3 (03-14 orchestrator amendment): the keyboard hint fades, the callouts come back. ----
for (const motion of /** @type {const} */ (['reduce', 'no-preference'])) {
  test.describe(`A3 keyboard hint, motion ${motion}`, () => {
    test.use({ viewport: { width: 412, height: 915 }, reducedMotion: motion });
    test('hint shows on keyboard focus, then hides; the callouts return and equal the table', async ({ page }, testInfo) => {
      desktopOnly(testInfo);
      test.setTimeout(120_000);
      await settledView(page);
      await expertOn(page);
      await heatOn(page);
      await page.waitForFunction(() => window.__eyeglassView.labelsInfo().calloutsFit);
      // Keyboard focus: the checked Darstellung radio, then Tab to the stage (D-39 order).
      await page.locator('#view-mode input[value=heat]').focus();
      await page.keyboard.press('Tab');
      await expect(page.locator('#view-stage')).toBeFocused();
      expect(await ev(page, () => document.getElementById('view-stage').matches(':focus-visible'))).toBe(true);
      expect(await ev(page, () => window.__eyeglassView.keysHint())).toBe('shown');
      await expect(page.locator('#view-keys')).toBeVisible();
      const note = page.locator('#view-callout-note');
      await expect(note).toBeVisible({ timeout: 15_000 });
      expect((await labelsInfo(page)).labels.filter((l) => l.kind === 'callout')).toEqual([]);
      // After KEYS_SHOW_MS (+ the 300 ms fade with motion) the hint is hidden and no obstacle.
      await page.waitForFunction(() => window.__eyeglassView.keysHint() === 'hidden', null, { timeout: 15_000 });
      await expect(note).toBeHidden({ timeout: 15_000 });
      const li = await labelsInfo(page);
      expect(li.calloutsFit).toBe(true);
      const callouts = li.labels.filter((l) => l.kind === 'callout');
      expect([5, 6]).toContain(callouts.length);
      const eye = (await ev(page, () => window.__eyeglassView.heatScale())).eye;
      for (const c of callouts) {
        const v = plain(await cell(page, c.key, eye).textContent());
        expect(plain(c.text).match(/\d+,\d+/)[0], c.key).toBe(v.match(/\d+,\d+/)[0]);
      }
      // Still the stage's description for screen readers; still focused.
      await expect(page.locator('#view-stage')).toHaveAttribute('aria-describedby', 'view-keys');
      await expect(page.locator('#view-keys')).toHaveText(/^Tastatur: Pfeiltasten drehen/);
      await expect(page.locator('#view-stage')).toBeFocused();
      // A new keyboard focus shows it again.
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      expect(await ev(page, () => window.__eyeglassView.keysHint())).toBe('shown');
      await expect(page.locator('#view-keys')).toBeVisible();
    });
  });
}

for (const vp of [
  { width: 320, height: 640 },
  { width: 1280, height: 800 },
]) {
  test.describe(`axe in the comparison at ${vp.width}×${vp.height}`, () => {
    test.use({ viewport: vp });
    test('compare Glas and compare Dickenkarte', async ({ page }, testInfo) => {
      desktopOnly(testInfo);
      test.setTimeout(150_000);
      await settledView(page);
      await comparisonOn(page);
      const axe = async (when) => {
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), when).toEqual([]);
      };
      await axe('compare Glas');
      await expertOn(page);
      await heatOn(page);
      await compareReady(page);
      await axe('compare Dickenkarte');
      if (vp.width === 320) {
        const [sw, iw] = await ev(page, () => [document.documentElement.scrollWidth, window.innerWidth]);
        expect(sw, 'no horizontal scroll at 320').toBeLessThanOrEqual(iw);
      }
    });
  });
}

// ---- 03-LC lens-critic M2: #view-protrusion during a comparison ----
// While comparing, the block shows only the compared eye: one 'Vorher (A):' pair and one
// 'Nachher (B):' pair, each from the same engine rule (bevelSplit, frontLeadMm) as the Expert rim
// lines. The Expert rim lines follow the painted main result, so A's are read before the start
// (A = that configuration, frozen) and B's after the material change.
test('M2 protrusion block: Vorher (A) and Nachher (B) lines equal the Expert rim lines of A and B', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.setTimeout(150_000);
  await settledView(page);
  await expertOn(page);
  const rim = async (eyeId) => ({
    edge: plain(await page.locator(`#frame-rim-result-${eyeId}`).textContent()),
    lead: plain(await page.locator(`#frame-rim-lead-${eyeId}`).textContent()),
  });
  const before = { od: await rim('od'), os: await rim('os') };
  await comparisonOn(page);
  const c = await info(page);
  const eyeId = c.eye.toLowerCase();
  const rimA = before[eyeId];
  const rimB = await rim(eyeId);
  const mm = (s) => plain(s).match(/(\d+,\d) mm/g) ?? [];
  expect(mm(rimB.edge), 'A and B differ (CR-39 against 1,74)').not.toEqual(mm(rimA.edge));
  const block = page.locator('#view-protrusion');
  await expect(block).toBeVisible();
  const lines = (await block.locator('p:not(.view-protrusion-title):not(.small)').allTextContents()).map(plain).filter((s) => s !== '');
  test.info().annotations.push({ type: 'M2 block', description: JSON.stringify({ lines, rimA, rimB }) });
  expect(lines).toHaveLength(4);
  const [edgeA, leadA, edgeB, leadB] = lines;
  expect(edgeA).toMatch(/^Vorher \(A\): Glasrand /);
  expect(leadA).toMatch(/^Vorher \(A\): Vorderfläche /);
  expect(edgeB).toMatch(/^Nachher \(B\): Glasrand /);
  expect(leadB).toMatch(/^Nachher \(B\): Vorderfläche /);
  expect(mm(edgeA), 'A edge = Expert rim line of A').toEqual(mm(rimA.edge));
  expect(mm(leadA), 'A lead = Expert lead line of A').toEqual(mm(rimA.lead));
  expect(mm(edgeB), 'B edge = Expert rim line of B').toEqual(mm(rimB.edge));
  expect(mm(leadB), 'B lead = Expert lead line of B').toEqual(mm(rimB.lead));
  // No 'Rechts:' / 'Links:' line for the other eye while comparing.
  expect(lines.some((s) => /^(Rechts|Links):/.test(s))).toBe(false);
  // End: back to one pair per eye.
  await page.locator('#cmp-end').click();
  await settledView(page);
  await expect(page.locator('#view-protrusion-od')).toHaveText(/^Rechts: Glasrand /);
  await expect(page.locator('#view-protrusion-os')).toHaveText(/^Links: Glasrand /);
});
