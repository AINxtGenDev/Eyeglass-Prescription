// Whole-page accessibility (02-14, UX-04, UX-01, UX-03, D-39, UI-SPEC "Accessibility Contract").
// Every earlier slice checked its own region; this spec checks the assembled page in every state:
// axe with the WCAG 2.2 AA tag list and zero violations of any impact, no horizontal overflow at
// 320 px with hyphenation off, the D-39 keyboard path, and the UX-01 toggletips.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settled, settledCompare, settledXsec, settledView, guardPage } from './helpers.js';
/* global document, window, getComputedStyle, requestAnimationFrame -- page.evaluate bodies run in the browser */

guardPage(test, { view: true });

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 1280, height: 800 },
];
const frame = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0))));

async function expectAxeClean(page, when) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const list = violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(list, `axe violations ${when}`).toEqual([]);
}

async function expectNoHorizontalScroll(page, when) {
  // Hyphenation is never relied on (Research Pitfall 6): automatic hyphens off before measuring.
  await page.evaluate(() => {
    document.body.style.hyphens = 'manual';
    document.body.style.webkitHyphens = 'manual';
  });
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, `scrollWidth <= clientWidth ${when}`).toBeLessThanOrEqual(client);
}

async function expertOn(page) {
  await page.locator('#expert').check();
  await settledXsec(page);
}

/** Comparison active with B = 1,74 (A = the example with CR-39). */
async function comparisonOn(page) {
  await page.locator('#cmp-start').click();
  await settledCompare(page);
  await page.locator('input[name=material][value=idx174]').check();
  await settledXsec(page);
  await expect(page.locator('#cmp-active')).toBeVisible();
}

/** Every visible toggletip, every <details> and the stamp figure open. */
async function everythingOpen(page) {
  await expertOn(page);
  await comparisonOn(page);
  const tips = page.locator('button.tip-btn[aria-expanded="false"]:visible');
  for (let n = await tips.count(); n > 0; n = await tips.count()) await tips.first().click();
  const closed = page.locator('details:not([open]) > summary:visible');
  for (let n = await closed.count(); n > 0; n = await closed.count()) await closed.first().click();
  await page.locator('#frame-stamp-help').click();
  await expect(page.locator('#frame-stamp-figure')).toBeVisible();
  await settledXsec(page);
  expect(await page.locator('details:not([open])').count(), 'closed <details> left').toBe(0);
  expect(await page.locator('button.tip-btn[aria-expanded="false"]:visible').count(), 'closed visible tips left').toBe(0);
}

const STATES = {
  simple: async () => {},
  'Experten-Ansicht': expertOn,
  'comparison active (B = 1,74)': async (page) => comparisonOn(page),
  'everything open (Expert + comparison + all tips, <details>, stamp figure)': everythingOpen,
};

// ---- 03-16 (D-29, UX-04 carried, T-03-53): every 3D state at 320×640 and 1280×800 ----
// Each entry: setup once, then per viewport wait (the view re-lays out after the resize: preset
// refit, callouts, split), check (state-specific preconditions before axe), the axe run and the
// overflow check; teardown after both viewports.
const VIEW_CHUNK = '**/assets/view-*.js';
const view = (page, fn) => page.evaluate(fn);
const frames2 = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 0)))));
const TABLE_ONLY = 'Für die Zahlen am Glas ist die Ansicht zu klein – alle Werte stehen in der Tabelle.';

async function viewSettled(page) {
  await settledXsec(page);
  await settledView(page);
  await frames2(page);
}
async function expertView(page) {
  await expertOn(page);
  await settledView(page);
}
async function heatOn(page) {
  await page.locator('#view-mode label', { hasText: 'Dickenkarte' }).click();
  await page.waitForFunction(() => window.__eyeglassView.mode() === 'heat' && window.__eyeglassView.heatScale() !== null);
  await frames2(page);
}
/** comparisonOn, then the view shows the comparison with the A lens attached (view-compare.spec.js). */
async function compareView(page) {
  await comparisonOn(page);
  await settledView(page);
  await page.waitForFunction(() => {
    const c = window.__eyeglassView.compareInfo();
    return c.active && c.aReady;
  });
  await frames2(page);
}
const expectMode = async (page, m) => expect(await view(page, () => window.__eyeglassView.mode())).toBe(m);

/** Released by the loading state's teardown; one test at a time per worker process. */
let releaseViewChunk = () => {};

const VIEW_STATES = {
  '3D Simple/Glas': {
    setup: settledView,
    check: (page) => expectMode(page, 'glass'),
  },
  '3D Expert/Glas': {
    setup: expertView,
    check: (page) => expectMode(page, 'glass'),
  },
  '3D Expert/Dickenkarte': {
    setup: async (page) => {
      await expertView(page);
      await heatOn(page);
    },
    // Axe runs in whichever callout state the page shows; the state is recorded per viewport.
    check: async (page, vp) => {
      await expectMode(page, 'heat');
      const li = await view(page, () => window.__eyeglassView.labelsInfo());
      const callouts = li.labels.filter((l) => l.kind === 'callout').length;
      test.info().annotations.push({ type: `calloutsFit ${vp.width}×${vp.height}`, description: JSON.stringify({ calloutsFit: li.calloutsFit, callouts }) });
    },
  },
  // lens-critic round 2 MINOR 6: the table-only state forced at both widths.
  '3D Expert/Dickenkarte nur Tabelle (?calloutsoff)': {
    setup: async (page) => {
      await settledView(page); // the first page's workers finish loading before the navigation
      await page.goto('./?calloutsoff');
      await settledView(page);
      await expertView(page);
      await heatOn(page);
    },
    check: async (page) => {
      await expectMode(page, 'heat');
      const li = await view(page, () => window.__eyeglassView.labelsInfo());
      expect(li.calloutsFit, 'calloutsFit under ?calloutsoff').toBe(false);
      expect(li.labels.filter((l) => l.kind === 'callout' || l.kind === 'dot'), 'visible callouts').toHaveLength(0);
      await expect(page.locator('#view-callout-note')).toBeVisible();
      await expect(page.locator('#view-callout-note')).toHaveText(TABLE_ONLY);
    },
  },
  '3D Vergleich Glas': {
    setup: compareView,
    check: async (page) => {
      await expectMode(page, 'glass');
      expect((await view(page, () => window.__eyeglassView.compareInfo())).active).toBe(true);
    },
  },
  '3D Vergleich Dickenkarte': {
    setup: async (page) => {
      await expertView(page);
      await compareView(page);
      await heatOn(page);
    },
    check: async (page) => {
      await expectMode(page, 'heat');
      expect((await view(page, () => window.__eyeglassView.compareInfo())).active).toBe(true);
    },
  },
  '3D ohne WebGL (?nowebgl)': {
    setup: async (page) => {
      await settledView(page);
      await page.goto('./?nowebgl');
      await settledView(page);
    },
    check: (page) => expect(page.locator('#view-stage')).toContainText('WebGL 2 fehlt'),
  },
  // The view chunk request is held until both axe runs are done, then released.
  '3D wird aufgebaut': {
    setup: async (page) => {
      await settledView(page);
      const gate = new Promise((res) => {
        releaseViewChunk = res;
      });
      await page.route(VIEW_CHUNK, async (route) => {
        await gate;
        await route.continue();
      });
      await page.goto('./');
      await settled(page);
    },
    wait: async (page) => {
      await settledXsec(page);
      await frame(page);
    },
    check: async (page) => {
      await expect(page.locator('#view')).toHaveAttribute('data-pending', 'load');
      await expect(page.locator('#view-slot')).toBeVisible();
      await expect(page.locator('#view-status')).toHaveText('3D-Ansicht wird aufgebaut …');
    },
    teardown: async (page) => {
      releaseViewChunk();
      await settledView(page);
      await page.unroute(VIEW_CHUNK);
    },
  },
};

const ALL_STATES = {
  ...Object.fromEntries(Object.entries(STATES).map(([name, setup]) => [name, { setup }])),
  ...VIEW_STATES,
};

for (const [name, st] of Object.entries(ALL_STATES)) {
  test(`axe WCAG 2.2 AA zero violations and no overflow at 320 px: ${name}`, async ({ page }) => {
    if (name.startsWith('3D ')) test.setTimeout(120_000); // SwiftShader renders on the CPU
    await settled(page);
    await st.setup(page);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      await frame(page);
      await (st.wait ?? (name.startsWith('3D ') ? viewSettled : settledXsec))(page);
      if (st.check) await st.check(page, vp);
      await expectAxeClean(page, `${name} at ${vp.width}×${vp.height}`);
      await expectNoHorizontalScroll(page, `${name} at ${vp.width}×${vp.height}`);
    }
    if (st.teardown) await st.teardown(page);
  });
}

// ---- Keyboard (D-39 test path, UI-SPEC "Keyboard order") ----

/** A short key for the focused element: '#id', 'radio:name', 'tip:tip-x', 'summary:details-id', 'chip:row-id'. */
const focusKey = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return 'body';
    if (a.tagName === 'INPUT' && a.type === 'radio') return `radio:${a.name}`;
    if (a.classList.contains('tip-btn')) return `tip:${a.getAttribute('aria-controls')}`;
    if (a.tagName === 'SUMMARY') return `summary:${a.parentElement?.id ?? ''}`;
    if (a.classList.contains('chip')) return `chip:${a.closest('.presets')?.id ?? ''}`;
    if (a.id) return `#${a.id}`;
    return a.classList.contains('col-results') ? '.col-results' : a.tagName.toLowerCase();
  });

/**
 * The focused element shows a focus indicator (its own outline, or the card / segment around a
 * radio via :has(:focus-visible)) and, while the phone summary bar is visible, is not hidden by it
 * (WCAG 2.4.11): its bottom is above the bar top, or for an element taller than the space above
 * the bar, its top is.
 */
const focusState = (page) =>
  page.evaluate(() => {
    const a = /** @type {HTMLElement} */ (document.activeElement);
    const outlined = (el) => !!el && getComputedStyle(el).outlineStyle !== 'none' && parseFloat(getComputedStyle(el).outlineWidth) >= 2;
    const ring = outlined(a) || outlined(a.closest('label')) || outlined(a.closest('.radio-card'));
    const r = a.getBoundingClientRect();
    const bar = document.getElementById('summary-bar');
    const barTop = bar && !bar.hidden && a !== bar ? bar.getBoundingClientRect().top : window.innerHeight;
    const coveredByBar = r.height <= barTop ? r.bottom > barTop + 0.5 : r.top >= barTop;
    return { focusVisible: a.matches(':focus-visible'), ring, coveredByBar, top: r.top, bottom: r.bottom, barTop };
  });

/** D-39 checkpoints in order (02-14: Rx chips after the table). */
const PATH = [
  '#expert',
  '#example-clear',
  'tip:tip-sph',
  '#rx-od-sph',
  '#rx-os-pd',
  '#rx-same',
  'chip:rx-presets',
  'summary:rx-other',
  'tip:tip-stamp',
  '#frame-stamp',
  '#frame-stamp-help',
  'radio:frame-shape',
  'chip:frame-presets',
  '#frame-a',
  '#frame-b',
  '#frame-dbl',
  'radio:material',
  '#expert-basecurve',
  '.col-results',
  '#cmp-start',
  'radio:cmp-show',
  '#xsec-meridian',
  'summary:tech',
];

test('keyboard only: the D-39 path with Tab, Space, Enter, arrows and Esc; focus always visible', async ({ page }) => {
  await settled(page);
  await page.locator('h1').first().click(); // sequential focus starts at the top of the page
  const seen = [];
  const done = new Set();
  for (let i = 0; i < 200 && !seen.includes('summary:tech'); i++) {
    await page.keyboard.press('Tab');
    const key = await focusKey(page);
    if (key === 'body') break;
    seen.push(key);
    const f = await focusState(page);
    expect(f.focusVisible, `${key} matches :focus-visible`).toBe(true);
    expect(f.ring, `${key} shows a focus outline`).toBe(true);
    expect(f.coveredByBar, `${key} hidden by the summary bar (top ${f.top}, bottom ${f.bottom}, bar ${f.barTop})`).toBe(false);
    if (done.has(key)) continue;
    done.add(key);
    if (key === '#expert') {
      await page.keyboard.press('Space');
      await expect(page.locator('#expert')).toBeChecked();
      await expect(page.locator('#expert')).toBeFocused();
      await settledXsec(page);
    } else if (key === 'tip:tip-sph') {
      const btn = page.locator('button.tip-btn[aria-controls="tip-sph"]');
      await page.keyboard.press('Enter');
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await expect(btn).toBeFocused();
    } else if (key.startsWith('radio:') && key !== 'radio:xsec-eye') {
      // one tab stop per group; an arrow key moves the checked value, the opposite arrow restores it
      const name = key.slice('radio:'.length);
      const checked = () => page.locator(`input[name=${name}]:checked`).getAttribute('value');
      const before = await checked();
      await page.keyboard.press('ArrowRight');
      expect(await checked(), `${name}: ArrowRight changes the checked value`).not.toBe(before);
      await page.keyboard.press('ArrowLeft');
      expect(await checked(), `${name}: ArrowLeft restores it`).toBe(before);
      await settledXsec(page);
    } else if (key === '#cmp-start') {
      await page.keyboard.press('Enter');
      await expect(page.locator('#cmp-diff')).toBeFocused();
      await settledXsec(page);
    }
  }
  // each checkpoint is reached, in this order
  const at = PATH.map((k) => seen.indexOf(k));
  expect(PATH.filter((k, i) => at[i] < 0), 'checkpoints never focused').toEqual([]);
  const order = PATH.map((k, i) => [k, at[i]]).sort((x, y) => x[1] - y[1]).map(([k]) => k);
  expect(order, 'checkpoint order').toEqual(PATH);
  // a radio group is a single tab stop
  for (const name of ['frame-shape', 'material', 'cmp-show', 'xsec-eye']) {
    expect(seen.filter((k) => k === `radio:${name}`), `${name} tab stops`).toHaveLength(1);
  }
  // no positive tabindex anywhere (UI-SPEC)
  expect(await page.locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').count()).toBe(0);
});

test('keyboard: the disclaimer link moves focus to the full Wichtiger Hinweis', async ({ page }) => {
  await settled(page);
  await page.locator('#disclaimer-jump').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#disclaimer')).toBeFocused();
  await expect(page.locator('#disclaimer')).toBeInViewport();
});

// ---- UX-01 toggletips ----

const UX01 = ['sph', 'cyl', 'axis', 'pd', 'index', 'basecurve', 'ct', 'et', 'a', 'b', 'dbl', 'dec'];

test('UX-01: every term has a tip that opens by click, Enter and Space and closes by Esc', async ({ page }) => {
  await settled(page);
  await expertOn(page); // Basiskurve and Dezentration are Expert terms
  for (const id of UX01) {
    const btn = page.locator(`button.tip-btn[aria-controls="tip-${id}"]`);
    const panel = page.locator(`#tip-${id}`);
    await expect(btn, `tip button for ${id}`).toHaveCount(1);
    await expect(btn).toHaveAccessibleName(/^Erklärung: \S/);
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await btn.focus();
    for (const key of ['Enter', 'Space']) {
      await page.keyboard.press(key);
      await expect(btn, `${id} opens by ${key}`).toHaveAttribute('aria-expanded', 'true');
      await expect(panel).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(btn, `${id} closes by Esc`).toHaveAttribute('aria-expanded', 'false');
      await expect(panel).toBeHidden();
      await expect(btn, `Esc leaves focus on the ${id} button`).toBeFocused();
    }
  }
});

// ---- 03-16 (D-29, D-13, 03-06 placement, lens-critic MAJOR 5): the keyboard path through the view ----

/** The focused element as a key ('#id', 'preset:front', 'tip:tip-et', …) and where it sits. */
const viewFocus = (page) =>
  page.evaluate(() => {
    const a = /** @type {HTMLElement} */ (document.activeElement);
    if (!a || a === document.body) return { key: 'body' };
    const key = a.dataset.preset
      ? `preset:${a.dataset.preset}`
      : a.classList.contains('tip-btn')
        ? `tip:${a.getAttribute('aria-controls')}`
        : a.id
          ? `#${a.id}`
          : a.classList.contains('col-results')
            ? '.col-results'
            : a.tagName.toLowerCase();
    const cs = getComputedStyle(a);
    return {
      key,
      inResult: !!a.closest('section#result'),
      inOdCard: !!a.closest('#result-od-card'),
      focusVisible: a.matches(':focus-visible'),
      outline: cs.outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth),
    };
  });

test('D-29 keyboard path through the view', async ({ page }) => {
  test.setTimeout(120_000);
  await settledView(page);
  const coarse = await page.evaluate(() => window.matchMedia('(any-pointer: coarse)').matches);
  const viewOrder = ['#view-stage', 'preset:front', 'preset:side', 'preset:top', 'preset:reset', ...(coarse ? ['#view-rotate'] : [])];
  for (const vp of VIEWPORTS) {
    const at = `${vp.width}×${vp.height}`;
    await page.setViewportSize(vp);
    await frame(page);
    await settledView(page);
    // Start on the results region (tabindex 0, the first stop of .col-results in the D-39 path).
    await page.locator('.col-results').focus();
    const seen = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const f = await viewFocus(page);
      if (f.key === 'body') break;
      seen.push(f);
      const s = seen.findIndex((x) => x.key === '#view-stage');
      if (s >= 0 && seen.length > s + viewOrder.length && seen.some((x) => x.inOdCard)) break;
    }
    const keys = seen.map((x) => x.key);
    test.info().annotations.push({ type: `tab order ${at}`, description: keys.join(' → ') });
    const stage = keys.indexOf('#view-stage');
    const firstOd = seen.findIndex((x) => x.inOdCard);
    expect(stage, `${at}: #view-stage reached`).toBeGreaterThanOrEqual(0);
    expect(firstOd, `${at}: a result card focusable reached`).toBeGreaterThanOrEqual(0);
    if (vp.width >= 900) {
      // D-13: the view is the first child of .col-results, before the result cards.
      expect(stage, `${at}: #view-stage before #result-od-card`).toBeLessThan(firstOd);
      expect(seen.slice(0, stage).some((x) => x.inResult), `${at}: nothing of section#result before the stage`).toBe(false);
    } else {
      // 03-06 (MAJOR 5): below 900 px the view follows section#result.
      expect(firstOd, `${at}: result cards before the stage`).toBeLessThan(stage);
      const lastResult = seen.slice(0, stage).findLastIndex((x) => x.inResult);
      expect(lastResult, `${at}: section#result focusables before the stage`).toBeGreaterThanOrEqual(0);
      expect(keys[lastResult + 1], `${at}: the stage right after the last focusable of section#result`).toBe('#view-stage');
    }
    // From the stage: Vorne → Seite → Oben → Ansicht zurücksetzen (→ '3D drehen' on a coarse pointer).
    expect(keys.slice(stage, stage + viewOrder.length), `${at}: order from the stage`).toEqual(viewOrder);
    if (!coarse) expect(keys[stage + viewOrder.length], `${at}: no '3D drehen' stop on a fine pointer`).not.toBe('#view-rotate');
    for (const f of seen.slice(stage, stage + viewOrder.length)) {
      expect(f.focusVisible, `${at}: ${f.key} matches :focus-visible`).toBe(true);
      expect(f.outline, `${at}: ${f.key} outline width`).toBeGreaterThanOrEqual(3);
    }
  }
});
