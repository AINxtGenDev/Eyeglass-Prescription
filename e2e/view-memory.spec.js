// D-27 / VIZ-06 memory part (03-15, T-03-40; RESEARCH Pitfall 5; lens-critic MINOR 6 and round 2
// MINOR 3): no GPU memory, program or buffer growth over 50+ input changes.
//
// Method: a documented warm-up first (Glas → Dickenkarte → Glas, compare start → end, one shape
// change, one preset cycle), so every resource the view ever needs exists; then a snapshot of
// renderer.info.memory.geometries / .textures, renderer.info.programs.length and the buffer
// allocation counters (page pools: allocLensBuffers / allocFrameBuffers calls; worker: the mesh
// replies' `reallocated` flags), then ≥ 50 input changes, then the same values must equal the
// snapshot. A growing program count means a material recompiles; a growing allocation counter
// means buffer sets are lost or recreated.
//
// EXPECTED is derived from the resource list, not copied from a run (MINOR 6: an expectation
// taken from the first run would only check itself).
//
// Geometries: three.js r187 counts a geometry in info.memory.geometries only in
// WebGLGeometries.get (node_modules/three/src/renderers/webgl/WebGLGeometries.js line 67,
// `info.memory.geometries ++`), which objects.update reaches for objects drawn in a render
// (WebGLRenderer.js lines 1912 and 1929, `const geometry = objects.update( object )` inside the
// visible-object walk). compile() does not count a hidden mesh (round 2 MINOR 3). So only meshes
// drawn at least once are counted:
//   lens slots OD, OS, A (front, back, band)                     3 × 3 = 9  (A: the 03-14 warm-up)
//   frame (rimOD, rimOS, bridge, templeOD/OS, hingeOD/OS)            = 7
//   frameA: only its two rims are ever drawn (warm-up and the compare pass hide the rest) = 2
//   chart checker + letter band (backdrop.js)                        = 2
//   contact shadow                                                    = 1
//                                                                 G = 21
//   Not counted: the hidden carriers (frame fade ×2, frameA fade ×2, heat ×1) are only compiled.
// Textures (info.memory.textures: WebGLTextures.js line 814 on the first upload of a texture,
// line 2090 when a render target is set up):
//   PMREM environment (PMREMGenerator.fromScene keeps its target; the source target is disposed) 1
//   chart tile + letter band CanvasTextures (backdrop.js createChart)                          2
//   contact shadow CanvasTexture                                                                1
//   transmission render target of the one camera (WebGLRenderer.js line 2029)                  1
//   DFG LUT DataTexture of the physical materials (WebGLRenderer.js line 2756, getDFGLUT())     1
//                                                                                          T = 6
import { test, expect } from '@playwright/test';
import { settledView, settledXsec, settledRef, guardPage, noThreeWarnings } from './helpers.js';
/* global window, document, HTMLCanvasElement, requestAnimationFrame */

const EXPECTED = { geometries: 21, textures: 6 };

// 04-11 (D-14, D-27, item 16): the Durchblick pass (refraction.js) is created on the first entry
// and kept for the session (its chart texture is costly to rebuild, 04-08); its panel grids are
// re-allocated on a layout change only (setLayout disposes the old ones). Counted as above, only
// meshes drawn at least once, so after a warm-up whose last Durchblick layout is two drawn panels:
//   per drawn panel: the grid chart mesh + its rim and noView meshes + the leaf mesh  4 × 2 = 8
//   the 2 px divider (PlaneGeometry, visible with two panels)                              = 1
//                                                                              G_ref = G + 9 = 30
//   chart CanvasTexture (refraction.js drawChart)                              T_ref = T + 1 = 7
// Not counted: grids allocated for a layout that was left before its first draw (never rendered),
// blocked / empty panels (group hidden). The leaf geometry that grows past its capacity is
// disposed before its replacement is drawn (net 0).
const EXPECTED_REF = { geometries: EXPECTED.geometries + 4 * 2 + 1, textures: EXPECTED.textures + 1 };
const LEAK_TITLE = 'Durchblick mode switches do not leak (D-14, item 16)';

let threeWarnings;
test.beforeEach(({ page }) => {
  threeWarnings = noThreeWarnings(page);
});
// Reduced motion: preset changes are cuts, so each change settles in one or two renders.
test.use({ reducedMotion: 'reduce' });
// 04-11: count the WebGL contexts the page ever creates (registered before guardPage navigates).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const contexts = [];
    window.__glContexts = contexts;
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      const ctx = get.call(this, type, ...rest);
      if (ctx && /webgl/.test(String(type)) && !contexts.includes(ctx)) contexts.push(ctx);
      return ctx;
    };
  });
});
// The leak test runs with ?refguardoff: a guard step re-allocates the grids too (balanced), but the
// fixed sequence should not depend on the runner's speed.
guardPage(test, { view: true, search: (info) => (info.title === LEAK_TITLE ? '?refguardoff' : '') });

const snap = (page) =>
  page.evaluate(() => {
    const v = window.__eyeglassView;
    const m = v.memory();
    const a = v.allocs();
    return { geometries: m.geometries, textures: m.textures, programs: m.programs, allocPage: a.page, allocWorker: a.worker };
  });

test('D-27 no GPU memory, program or buffer growth over 50+ changes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough (desktop project)');
  test.setTimeout(480_000);
  let changes = 0;
  // Every lane idle (result, comparison, cross-section), then the view: one change never overlaps
  // the mesh job of the previous one. Overlapping jobs need extra buffer sets by design (the pools
  // grow to the input rate, lenses.js), which is not the growth this test is about.
  const idle = async () => {
    await settledXsec(page);
    await settledView(page);
  };
  const radio = (name, value) => page.locator(`input[name=${name}][value=${value}]`);
  const fill = async (sel, v) => {
    await page.locator(sel).fill(v);
    await idle();
    changes++;
  };
  const check = async (loc) => {
    await loc.check();
    await idle();
    changes++;
  };
  const mode = async (name) => {
    await page.locator('#view-mode label', { hasText: name }).click();
    await page.waitForFunction((heat) => window.__eyeglassView.mode() === (heat ? 'heat' : 'glass'), name === 'Dickenkarte');
    await idle();
    changes++;
  };
  const preset = async (p) => {
    await page.locator(`#view-tools [data-preset=${p}]`).click();
    await idle();
    changes++;
  };
  const compare = async () => {
    await page.locator('#cmp-start').click();
    await idle();
    await page.waitForFunction(() => {
      const c = window.__eyeglassView.compareInfo();
      return c.active && c.aReady;
    });
    changes++;
    await page.locator('#cmp-end').click();
    await page.waitForFunction(() => !window.__eyeglassView.compareInfo().active);
    await idle();
    changes++;
  };

  await settledView(page);
  await page.locator('#expert').check();
  await settledXsec(page);
  await settledView(page);

  // ---- Warm-up (documented, Pitfall 5) ----
  await mode('Dickenkarte');
  await mode('Glas');
  await compare();
  await check(radio('frame-shape', 'rund'));
  for (const p of ['front', 'side', 'top', 'reset']) await preset(p);
  changes = 0;
  const base = await snap(page);
  testInfo.annotations.push({ type: 'snapshot after warm-up', description: JSON.stringify(base) });
  expect({ geometries: base.geometries, textures: base.textures }, 'derived EXPECTED').toEqual(EXPECTED);

  // ---- 50+ changes ----
  const sph = ['-1', '-1,5', '-2', '-3', '-4,25', '-6', '+1', '+2,5', '-0,5', '-2', '-3,5', '-2'];
  for (let i = 0; i < sph.length; i++) await fill(i % 2 ? '#rx-os-sph' : '#rx-od-sph', sph[i]);
  // Zyl and Achse as separate changes (each settled), so no two Rx inputs share one mesh job window.
  for (const [cyl, axis] of [['-1,00', '90'], ['-2,00', '45'], ['-0,75', '180'], ['-1,50', '10']]) {
    await fill('#rx-od-cyl', cyl);
    await fill('#rx-od-axis', axis);
  }
  for (const [sel, v] of [['#frame-a', '50'], ['#frame-b', '36'], ['#frame-dbl', '20'], ['#frame-a', '54'], ['#frame-b', '40'], ['#frame-dbl', '17']]) {
    await fill(sel, v);
  }
  for (const s of ['panto', 'pilot', 'rechteckig', 'rund']) await check(radio('frame-shape', s));
  for (const m of ['idx174', 'trivex', 'pc', 'idx160', 'idx167', 'cr39']) await check(radio('material', m));
  for (const r of ['4', '5', '3']) await fill('#frame-rim', r);
  for (const st of ['52□18 145', '52□18 135', '52□18 140']) await fill('#frame-stamp', st);
  for (const m of ['Dickenkarte', 'Glas', 'Dickenkarte', 'Glas']) await mode(m);
  for (let i = 0; i < 3; i++) await compare();
  for (const p of ['front', 'side', 'top', 'reset']) await preset(p);

  const end = await snap(page);
  testInfo.annotations.push({ type: 'after changes', description: JSON.stringify({ changes, end }) });
  expect(changes).toBeGreaterThanOrEqual(50);
  expect(end).toEqual(base);
  expect(threeWarnings(), 'Three.js / WebGL console warnings').toEqual([]);
});

test(LEAK_TITLE, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough (desktop project; it resizes the window)');
  test.setTimeout(600_000);
  const WIDE = { width: 1280, height: 800 };
  const NARROW = { width: 340, height: 800 }; // stage below 360 px: one panel
  await page.setViewportSize(WIDE);
  let changes = 0;
  const log = [];
  const idle = async () => {
    await settledXsec(page);
    await settledView(page);
  };
  const viewMode = () => page.evaluate(() => window.__eyeglassView.mode());
  /** In Durchblick: the stage on screen and the current job drawn (a job is posted on screen only, M4). */
  const refIdle = async () => {
    await idle();
    await page.locator('#view-stage').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__eyeglassView.ref().onScreen);
    await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 0)))));
    await settledRef(page);
  };
  const settle = async () => ((await viewMode()) === 'ref' ? refIdle() : idle());
  const step = async (name, act) => {
    await act();
    await settle();
    changes++;
    log.push(name);
  };
  const mode = (name) =>
    step(`mode ${name}`, async () => {
      const want = { Glas: 'glass', Dickenkarte: 'heat', Durchblick: 'ref' }[name];
      await page.locator('#view-mode label').filter({ has: page.locator(`input[value=${want}]`) }).click();
      await page.waitForFunction((w) => window.__eyeglassView.mode() === w, want);
    });
  const lensToggle = (name) =>
    step(`lens ${name}`, async () => {
      await page.locator('#view-ref-lens label', { hasText: name }).click();
      await page.waitForFunction((on) => window.__eyeglassView.ref().lens === on, name === 'Mit Glas' ? 'on' : 'off');
    });
  let sphI = 0;
  const SPH = ['-1,00', '-2,50', '-4,00', '+1,50', '-3,25', '-0,75', '+2,00', '-5,00'];
  const rx = () =>
    step('rx', async () => {
      const eye = sphI % 2 ? 'os' : 'od';
      await page.locator(`#rx-${eye}-sph`).fill(SPH[sphI++ % SPH.length]);
    });
  const resize = (vp) =>
    step(`resize ${vp.width}`, async () => {
      await page.setViewportSize(vp);
      const n = vp.width === WIDE.width ? 2 : 1;
      await page.waitForFunction((k) => window.__eyeglassView.mode() !== 'ref' || window.__eyeglassView.ref().panels.length === k, n);
    });
  const cmpStart = () =>
    step('compare start', async () => {
      await page.locator('#cmp-start').click();
      await page.waitForFunction(() => window.__eyeglassView.compareInfo().active);
    });
  const cmpEnd = () =>
    step('compare end', async () => {
      await page.locator('#cmp-end').click();
      await page.waitForFunction(() => !window.__eyeglassView.compareInfo().active);
    });
  const material = (m) => step(`material ${m}`, () => page.locator(`input[name=material][value=${m}]`).check());
  const cmpShow = (v) => step(`cmp-show ${v}`, () => page.locator(`#cmp-show input[name=cmp-show][value=${v}]`).check());

  await settledView(page);
  await page.locator('#expert').check();
  await idle();

  // ---- Warm-up (documented): the 03-15 warm-up (Dickenkarte, a 3D comparison) and one pass through
  // every Durchblick state (enter, Ohne/Mit Glas, one panel, A/B), ending in Glas after two drawn
  // panels at 1280 × 800. ----
  await mode('Dickenkarte');
  await mode('Glas');
  await cmpStart();
  await page.waitForFunction(() => window.__eyeglassView.compareInfo().aReady);
  await cmpEnd();
  await mode('Durchblick');
  await lensToggle('Ohne Glas');
  await lensToggle('Mit Glas');
  await resize(NARROW);
  await resize(WIDE);
  await cmpStart();
  await cmpEnd();
  await mode('Glas');
  changes = 0;
  log.length = 0;
  const base = await snap(page);
  testInfo.annotations.push({ type: 'snapshot after warm-up', description: JSON.stringify(base) });
  expect({ geometries: base.geometries, textures: base.textures }, 'derived EXPECTED_REF').toEqual(EXPECTED_REF);

  // ---- 50+ changes in a fixed sequence ----
  for (let i = 0; i < 3; i++) {
    await mode('Durchblick');
    await rx();
    await lensToggle('Ohne Glas');
    await rx();
    await lensToggle('Mit Glas');
    await mode('Dickenkarte');
    await rx();
    await mode('Glas');
    await rx();
  }
  await mode('Durchblick');
  for (let i = 0; i < 2; i++) {
    await resize(NARROW);
    await rx();
    await resize(WIDE);
    await rx();
  }
  for (let i = 0; i < 2; i++) {
    await cmpStart();
    await material(i ? 'idx160' : 'idx174');
    await rx();
    await resize(NARROW);
    await cmpShow('a');
    await cmpShow('b');
    await resize(WIDE);
    await cmpEnd();
    await material('cr39');
  }
  await mode('Dickenkarte');
  await mode('Durchblick');
  await mode('Glas');

  const end = await snap(page);
  const contexts = await page.evaluate(() => window.__glContexts.length);
  testInfo.annotations.push({ type: 'after changes', description: JSON.stringify({ changes, end, contexts, log }) });
  console.log('item 16', JSON.stringify({ changes, base, end, contexts }));
  expect(changes).toBeGreaterThanOrEqual(50);
  expect({ geometries: end.geometries, textures: end.textures }).toEqual({ geometries: base.geometries, textures: base.textures });
  expect(end.programs, 'no material recompiles').toBe(base.programs);
  expect(contexts, 'exactly one WebGL context').toBe(1);
  expect(await page.evaluate(() => document.querySelectorAll('canvas#view-canvas').length)).toBe(1);
  expect(threeWarnings(), 'Three.js / WebGL console warnings').toEqual([]);
});
