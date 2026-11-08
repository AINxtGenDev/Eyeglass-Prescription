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
import { settledView, settledCompare, settledXsec, guardPage, noThreeWarnings } from './helpers.js';
/* global window */

const EXPECTED = { geometries: 21, textures: 6 };

let threeWarnings;
test.beforeEach(({ page }) => {
  threeWarnings = noThreeWarnings(page);
});
// Reduced motion: preset changes are cuts, so each change settles in one or two renders.
test.use({ reducedMotion: 'reduce' });
guardPage(test, { view: true });

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
  const radio = (name, value) => page.locator(`input[name=${name}][value=${value}]`);
  const fill = async (sel, v) => {
    await page.locator(sel).fill(v);
    await settledView(page);
    changes++;
  };
  const check = async (loc) => {
    await loc.check();
    await settledView(page);
    changes++;
  };
  const mode = async (name) => {
    await page.locator('#view-mode label', { hasText: name }).click();
    await page.waitForFunction((heat) => window.__eyeglassView.mode() === (heat ? 'heat' : 'glass'), name === 'Dickenkarte');
    await settledView(page);
    changes++;
  };
  const preset = async (p) => {
    await page.locator(`#view-tools [data-preset=${p}]`).click();
    await settledView(page);
    changes++;
  };
  const compare = async () => {
    await page.locator('#cmp-start').click();
    await settledCompare(page);
    await settledView(page);
    await page.waitForFunction(() => {
      const c = window.__eyeglassView.compareInfo();
      return c.active && c.aReady;
    });
    changes++;
    await page.locator('#cmp-end').click();
    await page.waitForFunction(() => !window.__eyeglassView.compareInfo().active);
    await settledView(page);
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
  for (const [cyl, axis] of [['-1,00', '90'], ['-2,00', '45'], ['-0,75', '180'], ['-1,50', '10']]) {
    await page.locator('#rx-od-axis').fill(axis);
    await fill('#rx-od-cyl', cyl);
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
