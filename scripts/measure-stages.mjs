// One-off (04-03 Task 3 step 0, lens-critic MINOR 2): the real #view-stage content-box size per
// viewport on the PRODUCTION preview, the input to P0 and E10. The Durchblick does not exist yet;
// switching to it never changes the stage size (UI-SPEC), so the Glas stage is the right input.
//
// Run after `GITHUB_SHA=$(git rev-parse HEAD) npm run build` and `npm run preview` (port 4173):
//   EXPECT_COMMIT=$(git rev-parse HEAD | cut -c1-7) node scripts/measure-stages.mjs
// The script reads #app-commit from the page and exits 1 unless it equals EXPECT_COMMIT, so a
// wrong server never yields a table. Prints a Markdown table on stdout.
import { chromium } from '@playwright/test';
/* global getComputedStyle -- the page.evaluate body runs in the browser */

const URL_ = process.env.STAGE_URL ?? 'http://localhost:4173/Eyeglass-Prescription/';
const EXPECT = process.env.EXPECT_COMMIT;
if (!EXPECT) {
  console.error('EXPECT_COMMIT is not set');
  process.exit(1);
}

// 1024 × 768: a viewport in the 900–1199 px band, where the results column is 400 px (style.css).
const VIEWPORTS = [
  { w: 412, h: 915, note: 'phone' },
  { w: 320, h: 640, note: 'small phone' },
  { w: 1164, h: 593, note: 'tablet landscape' },
  { w: 1280, h: 800, note: 'desktop' },
  { w: 1024, h: 768, note: '400 px desktop column (900–1199 px band)' },
];
const SPLIT_MIN_PX = 360; // UI-SPEC "Narrow stage fallback": two panels from 360 px stage width
const DIVIDER_PX = 2;

const browser = await chromium.launch();
const rows = [];
try {
  for (const vp of VIEWPORTS) {
    for (const fullscreen of [false, true]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      await page.goto(URL_);
      const commit = (await page.locator('#app-commit').textContent())?.trim();
      if (commit !== EXPECT) {
        console.error(`served #app-commit "${commit}" is not ${EXPECT}: wrong server, no table`);
        process.exit(1);
      }
      await page.locator('#rx-od-sph').fill('-1');
      await page.locator('#rx-os-sph').fill('-1');
      await page.locator('#view-stage').scrollIntoViewIfNeeded();
      await page.locator('#view-canvas').waitFor({ state: 'visible', timeout: 30_000 });
      if (fullscreen) {
        const fs = page.locator('#view-fullscreen');
        await fs.waitFor({ state: 'visible', timeout: 30_000 });
        await fs.click();
        await page.waitForTimeout(500);
      }
      const box = await page.locator('#view-stage').evaluate((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const bx = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
        const by = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
        const px = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const py = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        return { sw: r.width - bx - px, sh: r.height - by - py, cw: el.clientWidth, ch: el.clientHeight };
      });
      const two = box.sw >= SPLIT_MIN_PX;
      const panelW = two ? (box.sw - DIVIDER_PX) / 2 : box.sw;
      rows.push({ ...vp, fullscreen, ...box, two, panelW, panelH: box.sh });
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const f = (v) => v.toFixed(2).replace('.', ',');
console.log(`served #app-commit: ${EXPECT}`);
console.log('');
console.log('| Viewport | Stage | #view-stage content box (px) | clientWidth × clientHeight | Panels | Panel (px) |');
console.log('|---|---|---|---|---|---|');
for (const r of rows) {
  console.log(
    `| ${r.w} × ${r.h} (${r.note}) | ${r.fullscreen ? 'fullscreen' : 'in page'} | ${f(r.sw)} × ${f(r.sh)} | ${r.cw} × ${r.ch} | ${r.two ? 'two' : 'one'} | ${f(r.panelW)} × ${f(r.panelH)} |`,
  );
}
console.log('');
console.log('JSON ' + JSON.stringify(rows));
