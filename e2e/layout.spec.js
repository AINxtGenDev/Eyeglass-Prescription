// Page layout from 320 px to desktop (02-02, UX-03, D-19, D-20, D-21): no horizontal scrolling,
// phone summary bar, two sticky columns on desktop, reserved phase-3 slots.
// Pinned values: 02-01-SUMMARY Task 2 table (example 4,597 / 4,597 mm, 6,86 / 6,75 g; R +3,00 CT
// 3,902, 7,23 g; L +2,75 CT 3,737, 7,00 g; CR-39, Rechteckig 52×38/18).
import { test, expect } from '@playwright/test';
import { settled, settledXsec, settledView, slowWorker, plain, guardPage, noThreeWarnings, etmaxOf } from './helpers.js';
/* global document, window, getComputedStyle, requestAnimationFrame -- page.evaluate bodies run in the browser */

// Registered before guardPage, so it listens before guardPage's page.goto (03-06 breakpoint test).
let threeWarnings;
test.beforeEach(({ page }) => {
  threeWarnings = noThreeWarnings(page);
});
guardPage(test, { view: true });

const noHorizontalScroll = (page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    return { scroll: d.scrollWidth, client: d.clientWidth };
  });

async function expectNoHorizontalScroll(page, when) {
  const { scroll, client } = await noHorizontalScroll(page);
  expect(scroll, `scrollWidth <= clientWidth ${when}`).toBeLessThanOrEqual(client);
}

const barValues = async (page) => plain(await page.locator('#summary-bar-values').textContent());

const nextFrame = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0))));

/** Wait until window.scrollY is the same over 3 frames (smooth scrolling has ended). */
async function scrollSettled(page) {
  let last = null;
  let same = 0;
  for (let i = 0; i < 200 && same < 3; i++) {
    await nextFrame(page);
    const y = await page.evaluate(() => window.scrollY);
    same = y === last ? same + 1 : 0;
    last = y;
  }
}

/**
 * lens-critic MAJOR 5 pass/fail: #result-od-thick lies fully inside the viewport and above the
 * summary bar (when the bar is shown). Returns the measured box for the record.
 */
async function expectFirstValueInView(page, when) {
  const m = await page.evaluate(() => {
    const r = document.getElementById('result-od-thick').getBoundingClientRect();
    const bar = document.getElementById('summary-bar');
    const barTop = bar.hidden ? window.innerHeight : bar.getBoundingClientRect().top;
    return { top: r.top, bottom: r.bottom, limit: Math.min(window.innerHeight, barTop), barHidden: bar.hidden };
  });
  expect(m.top, `#result-od-thick top >= 0 ${when} (${JSON.stringify(m)})`).toBeGreaterThanOrEqual(0);
  expect(m.bottom, `#result-od-thick bottom <= viewport / bar top ${when} (${JSON.stringify(m)})`).toBeLessThanOrEqual(m.limit);
  return m;
}

/** MAJOR 5 test body, shared by 320 × 640 and 360 × 780. */
async function numbersBeforeView(page) {
  await settledView(page);
  expect(await page.locator('#view-slot').evaluate((el) => el.previousElementSibling?.id ?? null)).toBe('result');
  // Where a user arriving at the results lands: the results region at the top of the viewport.
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.col-results').getBoundingClientRect().top + window.scrollY));
  await nextFrame(page);
  await expectFirstValueInView(page, 'with the results region at the top');
  // From the inputs, a tap on the summary bar scrolls to the result.
  await page.locator('#rx-od-sph').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('#summary-bar')).toBeVisible();
  await page.locator('#summary-bar').click();
  await scrollSettled(page);
  await expectFirstValueInView(page, 'after a summary-bar tap');
}

test('viewport meta resizes the content for the on-screen keyboard', async ({ page }) => {
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).toContain('interactive-widget=resizes-content');
});

test.describe('320 × 640', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('MAJOR 5 numbers come before the 3D view', async ({ page }) => {
    await numbersBeforeView(page);
    await expectNoHorizontalScroll(page, 'at 320 px with the 3D view');
  });

  test('never scrolls horizontally, also with a long value and without hyphenation', async ({ page }) => {
    await settled(page);
    await expectNoHorizontalScroll(page, 'on load');
    await page.locator('#rx-od-sph').fill('-12,00');
    await settled(page);
    await expectNoHorizontalScroll(page, "after '-12,00'");
    // Hyphenation is never relied on: turn automatic hyphenation off and overflow-wrap: anywhere
    // must still keep the page inside. page.addStyleTag is blocked by the app CSP (style-src
    // 'self'); setting single element.style properties from script is allowed (RESEARCH Pitfall 7).
    await page.evaluate(() => {
      document.body.style.hyphens = 'manual';
      document.body.style.webkitHyphens = 'manual';
    });
    const body = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      return { hyphens: cs.hyphens, overflowWrap: cs.overflowWrap };
    });
    expect(body).toEqual({ hyphens: 'manual', overflowWrap: 'anywhere' });
    await expectNoHorizontalScroll(page, 'with hyphens: manual');
    await page.locator('#expert').check();
    await expectNoHorizontalScroll(page, 'with the Experten-Ansicht on');
  });
});

test.describe('360 × 780', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('summary bar shows both eyes while the result is out of view', async ({ page }) => {
    await settled(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('#result')).not.toBeInViewport();
    const bar = page.locator('#summary-bar');
    await expect(bar).toBeVisible();
    // 02-14: the Rx preset chips follow the table, so the Rx entry starts on the first screen:
    // the table caption is in view and R Sph begins above the summary bar. Measured against the
    // 720 px bar top (02-15): 685 px with Noto Sans, 704 px with DejaVu Sans (the CI runner font).
    await expect(page.locator('#rx-table caption')).toBeInViewport();
    const sphTop = (await page.locator('#rx-od-sph').boundingBox()).y;
    expect(sphTop, 'R Sph top above the summary bar top').toBeLessThan((await bar.boundingBox()).y);
    expect(await barValues(page)).toBe('R 4,6 mm · 7 g | L 4,6 mm · 7 g');
    await expect(page.locator('#summary-bar-label')).toHaveText('Dickste Stelle · Gewicht');
    // the bar repeats the card strings, it never formats on its own (T-02-05)
    const card = plain(await page.locator('#result-od-thick').textContent());
    expect(await barValues(page)).toContain(`R ${card} · `);
    await expect(bar).not.toHaveAttribute('aria-live', /.*/);
    // name = hidden "Zum Ergebnis:" + the visible text (WCAG 2.5.3 Label in Name)
    await expect(bar).not.toHaveAttribute('aria-label', /.*/);
    await expect(bar).toHaveAccessibleName(/^Zum Ergebnis: Dickste Stelle · Gewicht R 4,6\smm · 7\sg \| L 4,6\smm · 7\sg$/);
  });

  test('plus lenses: the bar shows the centre as the thickest point', async ({ page }) => {
    await page.locator('#example-clear').click();
    await page.locator('#rx-od-pd').fill('32');
    await page.locator('#rx-os-pd').fill('31,5');
    await page.locator('#rx-od-sph').fill('+3,00');
    await page.locator('#rx-os-sph').fill('+2,75');
    await settled(page);
    expect(await barValues(page)).toBe('R 3,9 mm · 7 g | L 3,7 mm · 7 g');
  });

  test('the bar hides while the result cards are in view', async ({ page }) => {
    await settled(page);
    await page.locator('#result-od-card').scrollIntoViewIfNeeded();
    await expect(page.locator('#result-od-card')).toBeInViewport();
    await expect(page.locator('#summary-bar')).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('#summary-bar')).toBeVisible();
  });

  test('a focused field at the bottom edge is not covered by the bar (WCAG 2.4.11)', async ({ page }) => {
    await settled(page);
    const pd = page.locator('#rx-os-pd');
    // put the field's bottom edge on the viewport's bottom edge, behind where the bar sits
    await page.evaluate(() => {
      const r = document.getElementById('rx-os-pd').getBoundingClientRect();
      window.scrollBy(0, r.bottom - window.innerHeight);
    });
    await expect(page.locator('#summary-bar')).toBeVisible();
    await pd.focus();
    await expect(pd).toBeFocused();
    const field = await pd.boundingBox();
    const bar = await page.locator('#summary-bar').boundingBox();
    expect(field.y + field.height, 'field bottom <= bar top').toBeLessThanOrEqual(bar.y);
  });

  test('tapping the bar moves focus to the result heading', async ({ page }) => {
    await settled(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('#summary-bar').click();
    await expect(page.locator('#result-title')).toBeFocused();
    await expect(page.locator('#result-title')).toHaveAttribute('tabindex', '-1');
  });

  test('never scrolls horizontally', async ({ page }) => {
    await settled(page);
    await expectNoHorizontalScroll(page, 'at 360 px');
  });
});

test.describe('360 × 780, 3D view placement', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('MAJOR 5 numbers come before the 3D view', async ({ page }) => {
    await numbersBeforeView(page);
    await expectNoHorizontalScroll(page, 'at 360 px with the 3D view');
  });
});

test.describe('1280 × 800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('D-13 view stays first on desktop', async ({ page }) => {
    await settledView(page);
    expect(await page.locator('.col-results').evaluate((el) => el.firstElementChild?.id ?? null)).toBe('view-slot');
  });

  test('breakpoint change keeps the view', async ({ page }) => {
    await settledView(page);
    await page.locator('#view-canvas').evaluate((c) => {
      window.__lost = 0;
      c.addEventListener('webglcontextlost', () => window.__lost++);
    });
    const check = async (when, prev) => {
      await settledView(page);
      await nextFrame(page);
      const place = await page.locator('#view-slot').evaluate((el) => ({
        prev: el.previousElementSibling?.id ?? null,
        first: el.parentElement?.firstElementChild === el,
      }));
      if (prev) expect(place.prev, when).toBe(prev);
      else expect(place.first, when).toBe(true);
      const mesh = await page.evaluate(() => window.__eyeglassView.edgeMax('OD'));
      expect(Math.round(mesh * 10) / 10, `OD mesh = card ${when}`).toBe(await etmaxOf(page, 'od'));
      // A fresh render still draws: the corner shows the clear colour #f3f4f6.
      const px = await page.evaluate(() => window.__eyeglassView.pixel(2, 2));
      for (const [i, want] of [243, 244, 246].entries()) expect(Math.abs(px[i] - want), `${when} channel ${i}: ${px}`).toBeLessThanOrEqual(2);
      expect(await page.evaluate(() => window.__lost), `webglcontextlost events ${when}`).toBe(0);
    };
    await check('at 1280 px', null);
    await page.setViewportSize({ width: 360, height: 780 });
    await check('after 1280 → 360', 'result');
    await page.setViewportSize({ width: 1280, height: 800 });
    await check('after 360 → 1280', null);
    expect(threeWarnings(), 'Three.js / WebGL console warnings').toEqual([]);
  });

  test('two columns: sticky results with the 3D view first, no bar', async ({ page }) => {
    await settled(page);
    const results = page.locator('.col-results');
    expect(await results.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
    const first = await results.evaluate((el) => el.firstElementChild?.id ?? null);
    expect(first).toBe('view-slot');
    // 03-05 (D-13): the slot holds the 3D view and shows once the view chunk loads.
    await expect(page.locator('#view-slot > #view')).toHaveCount(1);
    await settledView(page);
    await expect(page.locator('#view-slot')).toBeVisible();
    await expect(page.locator('#bar-view-slot')).toHaveAttribute('hidden', '');
    await expect(page.locator('#summary-bar')).toBeHidden();
    // inputs left, results right
    const inputs = await page.locator('.col-inputs').boundingBox();
    const res = await results.boundingBox();
    expect(res.x).toBeGreaterThan(inputs.x + inputs.width - 1);
    await expectNoHorizontalScroll(page, 'at 1280 px');
  });
});

// RES-06: the full 'Wichtiger Hinweis' text is always readable. At the page bottom the sticky
// results column must not slide over the full-width block below the two columns (02-09 fix).
for (const width of [1280, 900]) {
  test.describe(`${width} × 800, scrolled to the bottom`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const expert of [false, true]) {
      test(`the sticky results column never covers the disclaimer${expert ? ' (Experten-Ansicht)' : ''}`, async ({
        page,
      }) => {
        await settled(page);
        // 02-14: no wait for the Querschnitt drawing; its box and table rows are reserved.
        if (expert) await page.locator('#expert').check();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0))));
        const hit = await page.evaluate(() => {
          const d = document.getElementById('disclaimer');
          const r = d.getBoundingClientRect();
          const c = document.querySelector('.col-results').getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          const el = document.elementFromPoint(x, y);
          const overlap =
            Math.max(0, Math.min(r.right, c.right) - Math.max(r.left, c.left)) *
            Math.max(0, Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top));
          return {
            inView: r.top >= 0 && r.bottom <= window.innerHeight,
            centreIsDisclaimer: !!el && d.contains(el),
            hitId: el?.closest('[id]')?.id ?? el?.className ?? null,
            overlap,
          };
        });
        expect(hit.inView, 'disclaimer fully in the viewport at the page bottom').toBe(true);
        expect(hit.centreIsDisclaimer, `elementFromPoint at the disclaimer centre hit ${hit.hitId}`).toBe(true);
        expect(hit.overlap, 'overlap area of .col-results and #disclaimer (px²)').toBe(0);
      });
    }
  });
}

// 02-14: the Querschnitt is drawn one worker job after the switch turns on. Its figure box and
// table rows are reserved, so the drawing's arrival moves nothing below it (no layout shift).
// The profile message is delayed, so the 'before' read is taken while the drawing is pending.
for (const width of [360, 1280]) {
  test.describe(`${width} × 800, Experten-Ansicht on`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('the arriving cross-section does not move the disclaimer', async ({ page }) => {
      // guardPage's first load must be complete before navigating again (02-08: aborted worker fetch;
      // 03-05: that includes the lazy 3D view and its mesh worker)
      await settledView(page);
      await slowWorker(page, 1500, { types: ['profile'] });
      await page.goto('./');
      await settled(page);
      await page.locator('#expert').check();
      // The switch handler unhides the Expert fields and marks the profile pending at once; their
      // echo lines (Basiskurve, Mindestdicken: +48 px at 1280, +72 px at 360) are written by the
      // input frame, a requestAnimationFrame callback that runs before the next paint. A read in
      // the task gap between the change event and that frame sees a layout that is never painted
      // (one layout-shift entry per switch, also at 6x CPU throttle), so wait for the input frame
      // first: 'before' is the first painted layout while the drawing is pending (02-15).
      await settled(page);
      await expect(page.locator('#xsec')).toHaveAttribute('data-pending', 'profile');
      await expect(page.locator('#xsec-figure svg')).toHaveCount(0);
      const top = () =>
        page.evaluate(() => document.getElementById('disclaimer').getBoundingClientRect().top + window.scrollY);
      const before = await top();
      await settledXsec(page);
      await expect(page.locator('#xsec-figure svg')).toHaveCount(1);
      await expect(page.locator('#xsec-table td[data-row="ct"]')).toHaveText(/^\d+,\d\smm$/);
      expect(await top(), 'disclaimer top (page px) after the drawing arrived').toBe(before);
    });
  });
}
