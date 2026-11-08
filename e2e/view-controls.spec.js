// VIZ-03 camera controls, slice 7 (03-09; UI-SPEC "Camera and Controls" with R1-3, R1-4 and the
// execution amendments A1, A2): presets, the eye-fitted Seite (lens-critic MAJOR 2), keyboard,
// focus-gated wheel, the chart grazing fade, the A1 default fit and the A2 chart cover.
// Touch ('3D drehen') is 03-10; the wheel/drag tests run on the desktop project only (the mobile
// project has a coarse pointer, so the controls are not connected there).
import { test, expect } from '@playwright/test';
import { boxingCentreX } from '../src/engine/mesh/frame.js';
import { settled, settledView, guardPage, noThreeWarnings, isChartish } from './helpers.js';
/* global window, document, requestAnimationFrame */

let threeWarnings;
test.beforeEach(({ page }) => {
  threeWarnings = noThreeWarnings(page);
});
guardPage(test, { view: true });
test.afterEach(() => {
  expect(threeWarnings(), 'Three.js / WebGL console warnings').toEqual([]);
});

const RAD = Math.PI / 180;
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const cam = (page) => ev(page, () => window.__eyeglassView.camera());
const viewName = (page) => ev(page, () => window.__eyeglassView.viewName());
const preset = (page, name) => page.locator(`#view-tools [data-preset=${name}]`);
const dirOf = (c) => {
  const d = c.distance;
  return { x: (c.position.x - c.target.x) / d, y: (c.position.y - c.target.y) / d, z: (c.position.z - c.target.z) / d };
};
const expectDir = (c, want, eps = 1e-3) => {
  const d = dirOf(c);
  for (const k of ['x', 'y', 'z']) expect(Math.abs(d[k] - want[k]), `dir.${k} ${JSON.stringify(d)}`).toBeLessThanOrEqual(eps);
};
const DEFAULT_DIR = { x: -Math.sin(35 * RAD) * Math.cos(15 * RAD), y: Math.sin(15 * RAD), z: Math.cos(35 * RAD) * Math.cos(15 * RAD) };
const TOP_DIR = { x: 0, y: Math.sin(85 * RAD), z: Math.cos(85 * RAD) };
const FRONT_DIR = { x: 0, y: 0, z: 1 };

/**
 * Click a preset and wait until its tween has ended. The plan's 600 ms budget (450 ms tween + a
 * frame) is not reachable here: headless Chromium renders with SwiftShader at ≈ 0,9–1,2 s per
 * frame for this scene alone (measured 2026-11-08, the same before 03-09) and several seconds with
 * parallel workers, so the tween's last frame can land seconds after the click. Only 'VIZ-03
 * presets' runs the animated tween; the other tests use reduced motion (an instant cut, tested
 * itself in 'VIZ-03 reduced motion'), so they do not wait for frames.
 */
async function go(page, name, want = name === 'reset' ? 'default' : name) {
  await preset(page, name).click();
  await page.waitForFunction((n) => window.__eyeglassView.viewName() === n, want, { timeout: 30_000 });
}
const frameRender = (page) => ev(page, () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));

test('VIZ-03 presets', async ({ page }) => {
  test.setTimeout(300_000);
  await settledView(page);
  for (const b of ['front', 'side', 'top', 'reset']) await expect(preset(page, b)).toBeEnabled();
  await expect(page.getByRole('group', { name: 'Blickrichtung' })).toBeVisible();
  for (const [b, text] of [
    ['front', 'Vorne'],
    ['side', 'Seite'],
    ['top', 'Oben'],
    ['reset', 'Ansicht zurücksetzen'],
  ]) {
    await expect(page.getByRole('button', { name: text, exact: true })).toHaveAttribute('data-preset', b);
  }
  expectDir(await cam(page), DEFAULT_DIR);
  const before = await ev(page, () => window.__eyeglassView.memory());
  for (let round = 0; round < 2; round++) {
    await go(page, 'front');
    expectDir(await cam(page), FRONT_DIR);
    await go(page, 'top');
    expectDir(await cam(page), TOP_DIR);
    await go(page, 'side');
    const eye = await ev(page, () => window.__eyeglassView.sideEye());
    expectDir(await cam(page), { x: eye === 'OD' ? -1 : 1, y: 0, z: 0 });
    await expect(page.locator('#view-side-note')).toBeVisible();
    await expect(page.locator('#view-side-note')).toHaveText(`Seite: Blick auf den äußeren Rand des ${eye === 'OD' ? 'rechten' : 'linken'} Glases.`);
    await go(page, 'reset');
    expectDir(await cam(page), DEFAULT_DIR);
    await expect(page.locator('#view-side-note')).toBeHidden();
  }
  // Pitfall 6: one camera, so cycling presets creates no render targets or programs.
  await frameRender(page);
  const after = await ev(page, () => window.__eyeglassView.memory());
  expect(after.textures).toBe(before.textures);
  expect(after.programs).toBe(before.programs);
  // Focus stays on the button after a preset.
  await preset(page, 'front').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__eyeglassView.viewName() === 'front', null, { timeout: 30_000 });
  expect(await ev(page, () => document.activeElement?.getAttribute('data-preset'))).toBe('front');
});

test.describe('VIZ-03 Seite shows the edge close up (MAJOR 2)', () => {
  test.use({ viewport: { width: 320, height: 640 }, reducedMotion: 'reduce' });

  async function sideCheck(page) {
    await go(page, 'side');
    const c = await cam(page);
    const info = await ev(page, () => window.__eyeglassView.frameInfo());
    const eye = await ev(page, () => window.__eyeglassView.sideEye());
    const st = info.sideTarget[eye];
    // the tween target is not clamped by maxTargetRadius
    expect(Math.hypot(c.target.x - st.x, c.target.y - st.y, c.target.z - st.z)).toBeLessThanOrEqual(0.5);
    return c;
  }

  test('scale ≥ 3 px/mm at 320 × 640, close-up beyond Seite, 62□24 target', async ({ page }) => {
    test.setTimeout(90_000);
    await settledView(page);
    const size = await page.locator('#view-canvas').evaluate((el) => [el.clientWidth, el.clientHeight]);
    expect(size).toEqual([288, 216]);
    const c = await sideCheck(page);
    const t = c.target;
    const [a, b] = await ev(page, (p) => [window.__eyeglassView.project(p.x, p.y, p.z), window.__eyeglassView.project(p.x, p.y + 10, p.z)], t);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1]), '10 mm at the side target').toBeGreaterThanOrEqual(30);
    // 8 × '+' on the focused stage: closer than 0,6 × the Seite distance
    await page.locator('#view-stage').focus();
    for (let i = 0; i < 8; i++) await page.keyboard.press('+');
    const near = await cam(page);
    expect(near.distance).toBeLessThan(0.6 * c.distance);
    expect(near.distance).toBeGreaterThanOrEqual((await ev(page, () => window.__eyeglassView.limits())).minDistance - 1e-6);
    // a wide frame puts the Seite target at 78 mm from the origin (the old fixed 60 mm clamped it)
    await page.locator('#frame-a').fill('62');
    await page.locator('#frame-dbl').fill('24');
    await settledView(page);
    const wide = await sideCheck(page);
    expect(Math.hypot(wide.target.x, wide.target.y, wide.target.z)).toBeGreaterThan(70);
    expect((await ev(page, () => window.__eyeglassView.limits())).maxTargetRadius).toBeGreaterThanOrEqual(98);
  });
});

test.describe('VIZ-03 reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('presets cut instantly', async ({ page }) => {
    await settledView(page);
    await preset(page, 'front').click();
    // the cut happens in the click handler: the pose is final before the next frame
    expectDir(await cam(page), FRONT_DIR, 1e-6);
    expect(await viewName(page)).toBe('front');
    await preset(page, 'top').click();
    expectDir(await cam(page), TOP_DIR, 1e-6);
  });
});

test.describe('VIZ-03 keyboard', () => {
  test.use({ reducedMotion: 'reduce' });
  test('arrows, zoom, pan, Pos1 and the Tab order', async ({ page }) => {
    test.setTimeout(90_000);
    await settledView(page);
    const stage = page.locator('#view-stage');
    await stage.focus();
    await expect(page.locator('#view-keys')).toHaveText(
      'Tastatur: Pfeiltasten drehen, Umschalt + Pfeiltasten verschieben, Plus und Minus zoomen, Pos1 setzt die Ansicht zurück.',
    );
    await expect(stage).toHaveAttribute('aria-describedby', 'view-keys');
    const c0 = await cam(page);
    await page.keyboard.press('ArrowRight');
    const c1 = await cam(page);
    expect(Math.abs(Math.abs(c1.azimuthDeg - c0.azimuthDeg) - 15)).toBeLessThanOrEqual(0.5);
    expect(await viewName(page)).toBe('free');
    await page.keyboard.press('ArrowUp');
    const c2 = await cam(page);
    expect(Math.abs(c2.elevationDeg - c1.elevationDeg - 10)).toBeLessThanOrEqual(0.5);
    await page.keyboard.press('+');
    const c3 = await cam(page);
    expect(c3.distance).toBeCloseTo(c2.distance / 1.25, 3);
    await page.keyboard.press('-');
    expect((await cam(page)).distance).toBeCloseTo(c2.distance, 3);
    await page.keyboard.press('Shift+ArrowLeft');
    const c4 = await cam(page);
    const moved = Math.hypot(c4.target.x - c2.target.x, c4.target.y - c2.target.y, c4.target.z - c2.target.z);
    expect(moved).toBeCloseTo(5, 3);
    await page.keyboard.press('Home');
    await page.waitForFunction(() => window.__eyeglassView.viewName() === 'default', null, { timeout: 30_000 });
    const back = await cam(page);
    expectDir(back, DEFAULT_DIR);
    expect(back.distance).toBeCloseTo(c0.distance, 3);
    // Tab order: stage → Vorne → Seite → Oben → Ansicht zurücksetzen
    await stage.focus();
    for (const b of ['front', 'side', 'top', 'reset']) {
      await page.keyboard.press('Tab');
      expect(await ev(page, () => document.activeElement?.getAttribute('data-preset'))).toBe(b);
    }
  });
});

test('VIZ-03 wheel only zooms while the stage has focus (D-15)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'pointer path: no coarse pointer');
  test.setTimeout(90_000);
  await settledView(page);
  await expect(page.locator('#view-hint')).toHaveText(
    'Ziehen dreht die Brille · Umschalt + Ziehen verschiebt · Mausrad zoomt, nachdem Sie in die Ansicht geklickt haben.',
  );
  const scrollSum = () =>
    ev(page, () => {
      let s = window.scrollY;
      for (let el = document.getElementById('view-stage'); el; el = el.parentElement) s += el.scrollTop;
      return s;
    });
  const stage = page.locator('#view-stage');
  await stage.scrollIntoViewIfNeeded();
  const box = await stage.boundingBox();
  const d0 = (await cam(page)).distance;
  const s0 = await scrollSum();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 200);
  await expect.poll(scrollSum).not.toBe(s0);
  expect((await cam(page)).distance).toBe(d0);
  // click the stage (focus; Playwright scrolls it clear of the sticky header), then the wheel
  // zooms and the page does not scroll
  await stage.click();
  expect(await ev(page, () => document.activeElement?.id)).toBe('view-stage');
  const box2 = await stage.boundingBox();
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  const s1 = await scrollSum();
  const d1 = (await cam(page)).distance;
  await page.mouse.wheel(0, 200);
  await expect.poll(async () => (await cam(page)).distance).not.toBe(d1);
  expect(await scrollSum()).toBe(s1);
});

test('VIZ-03 mouse drag rotates and marks the view free', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'pointer path: no coarse pointer');
  test.setTimeout(90_000);
  await settledView(page);
  const box = await page.locator('#view-stage').boundingBox();
  const c0 = await cam(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 2 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await cam(page)).azimuthDeg - c0.azimuthDeg)).toBeGreaterThan(5);
  expect(await viewName(page)).toBe('free');
});

test.describe('VIZ-03 chart fade', () => {
  test.use({ reducedMotion: 'reduce' });
  test('hidden in Seite and Oben, shown in Vorne', async ({ page }) => {
    test.setTimeout(90_000);
    await settledView(page);
    const visible = () => ev(page, () => window.__eyeglassView.sceneInfo().chartVisible);
    await go(page, 'side');
    await frameRender(page);
    expect(await visible()).toBe(false);
    await go(page, 'top');
    await frameRender(page);
    expect(await visible()).toBe(false);
    await go(page, 'front');
    await frameRender(page);
    expect(await visible()).toBe(true);
  });
});

// ---- A1 (2026-11-08): the default pose fits the projected frame + temples ----
test.describe('A1 default fit at 412 × 915', () => {
  test.use({ viewport: { width: 412, height: 915 } });
  test('lenses large enough to judge, frame and temples inside the stage', async ({ page }) => {
    await settledView(page);
    const [w, h] = await page.locator('#view-canvas').evaluate((el) => [el.clientWidth, el.clientHeight]);
    const info = await ev(page, () => window.__eyeglassView.frameInfo());
    const z = info.lensGroupZ;
    const [od, os] = await ev(
      page,
      (p) => [window.__eyeglassView.project(p.od, 0, p.zOD), window.__eyeglassView.project(p.os, 0, p.zOS)],
      { od: boxingCentreX('OD', 52, 18), os: boxingCentreX('OS', 52, 18), zOD: z.OD, zOS: z.OS },
    );
    const rl = Math.hypot(od[0] - os[0], od[1] - os[1]);
    // 42,6 px before A1 (sphere fit about the origin); ≥ 1,8 ×
    expect(rl, `R–L ${rl.toFixed(1)} px`).toBeGreaterThanOrEqual(77);
    const b = info.boundingBox;
    const corners = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const zz of [b.min.z, b.max.z]) corners.push([x, y, zz]);
    const px = await ev(page, (cs) => cs.map((c) => window.__eyeglassView.project(...c)), corners);
    for (const [x, y] of px) {
      expect(x, `corner x ${x}`).toBeGreaterThanOrEqual(0);
      expect(x, `corner x ${x}`).toBeLessThanOrEqual(w);
      expect(y, `corner y ${y}`).toBeGreaterThanOrEqual(0);
      expect(y, `corner y ${y}`).toBeLessThanOrEqual(h);
    }
    test.info().annotations.push({ type: 'A1', description: `R–L ${rl.toFixed(1)} px on ${w} × ${h}` });
  });
});

// ---- A2 (2026-11-08): the chart fills the whole stage behind the glasses ----
async function cornersAreChart(page, label) {
  const [w, h] = await page.locator('#view-canvas').evaluate((el) => [el.clientWidth, el.clientHeight]);
  const at = [
    [2, 2],
    [w - 3, 2],
    [w - 3, h - 3],
    [2, h - 3],
  ];
  const px = await ev(page, (p) => window.__eyeglassView.pixels(p), at);
  at.forEach(([x, y], i) => expect(isChartish(px[i]), `${label}: chart pixel at (${x}, ${y}): ${px[i]}`).toBe(true));
}

for (const vp of [
  { width: 1280, height: 800 },
  { width: 412, height: 915 },
  { width: 880, height: 400 },
]) {
  test.describe(`A2 chart cover at ${vp.width} × ${vp.height}`, () => {
    test.use({ viewport: vp, reducedMotion: 'reduce' });
    test('stage corners show the chart in default and Vorne, also zoomed out to maxDistance', async ({ page }) => {
      test.setTimeout(120_000);
      await settledView(page);
      await cornersAreChart(page, 'default');
      const stage = page.locator('#view-stage');
      await stage.focus();
      for (let i = 0; i < 12; i++) await page.keyboard.press('-');
      expect((await cam(page)).distance).toBeCloseTo((await ev(page, () => window.__eyeglassView.limits())).maxDistance, 3);
      await cornersAreChart(page, 'default at maxDistance');
      await go(page, 'front');
      await cornersAreChart(page, 'Vorne');
      await stage.focus();
      for (let i = 0; i < 12; i++) await page.keyboard.press('-');
      await cornersAreChart(page, 'Vorne at maxDistance');
      await settled(page);
    });
  });
}
