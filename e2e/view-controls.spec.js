// VIZ-03 camera controls, slice 7 (03-09; UI-SPEC "Camera and Controls" with R1-3, R1-4 and the
// execution amendments A1, A2): presets, the eye-fitted Seite (lens-critic MAJOR 2), keyboard,
// focus-gated wheel, the chart grazing fade, the A1 default fit and the A2 chart cover.
// Touch ('3D drehen', 03-10, D-15, R1-6) runs on the mobile project only; the wheel/drag tests run
// on the desktop project only (the mobile project has a coarse pointer, so the controls are not
// connected there at rest).
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
    // Tab order: stage → Vorne → Seite → Oben → Ansicht zurücksetzen [→ touch: 3D drehen]
    await stage.focus();
    for (const b of ['front', 'side', 'top', 'reset']) {
      await page.keyboard.press('Tab');
      expect(await ev(page, () => document.activeElement?.getAttribute('data-preset'))).toBe(b);
    }
    if (await ev(page, () => window.matchMedia('(any-pointer: coarse)').matches)) {
      await page.keyboard.press('Tab');
      expect(await ev(page, () => document.activeElement?.id)).toBe('view-rotate');
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

// ---- 03-10 touch path (mobile project: 360 × 780, isMobile, hasTouch) ----
//
// any-pointer: coarse is NOT emulated here: Playwright's hasTouch already makes Chromium report a
// coarse pointer (it enables CDP Emulation.setTouchEmulationEnabled for the context), and the
// first assertion of every test checks matchMedia('(any-pointer: coarse)').matches === true, so a
// change in that behaviour fails loudly instead of silently testing the pointer path.
// Gestures go through CDP Input.dispatchTouchEvent (real touch input, so the browser applies
// touch-action) for one-finger drags and pinches; the same drag must scroll the page at rest and
// must not scroll it while '3D drehen' is on.
test.describe('VIZ-03 touch path (03-10)', () => {
  test.use({ reducedMotion: 'reduce' });
  test.skip(({ isMobile }) => !isMobile, 'touch path: mobile project only');

  const rotate = (page) => page.locator('#view-rotate');
  const touchAction = (page) => ev(page, () => window.getComputedStyle(document.getElementById('view-stage')).touchAction);
  const scrollSum = (page) =>
    ev(page, () => {
      let s = window.scrollY;
      for (let el = document.getElementById('view-stage'); el; el = el.parentElement) s += el.scrollTop;
      return s;
    });
  const camKey = (c) => [c.position.x, c.position.y, c.position.z, c.target.x, c.target.y, c.target.z].map((v) => v.toFixed(6)).join();

  /** Stage centre in viewport CSS px, after putting the stage fully on screen. */
  async function stageCentre(page) {
    await ev(page, () => document.getElementById('view-stage').scrollIntoView({ block: 'center' }));
    const box = await page.locator('#view-stage').boundingBox();
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), box };
  }

  /** One-finger CDP touch drag in `steps` moves. */
  async function touchDrag(cdp, from, dx, dy, steps = 8) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps, id: 1 }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  test.beforeEach(async ({ page }) => {
    expect(await ev(page, () => window.matchMedia('(any-pointer: coarse)').matches), 'mobile project reports any-pointer: coarse').toBe(true);
  });

  test('VIZ-03 touch at rest scrolls the page', async ({ page }) => {
    test.setTimeout(90_000);
    await settledView(page);
    await expect(rotate(page)).toBeVisible();
    await expect(rotate(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#view-hint')).toHaveText('Tippen Sie auf „3D drehen“, um die Brille mit dem Finger zu drehen.');
    expect(await touchAction(page)).toContain('pan-y');
    expect(await ev(page, () => window.__eyeglassView.rotateActive())).toBe(false);
    const { x, y } = await stageCentre(page);
    const c0 = camKey(await cam(page));
    const s0 = await scrollSum(page);
    const cdp = await page.context().newCDPSession(page);
    // A one-finger upward drag on the stage centre scrolls the page, not the camera. (CDP
    // Input.synthesizeScrollGesture with gestureSourceType 'touch' was tried first, as the plan
    // suggests: in this headless Chromium it scrolls nothing anywhere on the page, measured
    // 2026-11-08, while 'default'/'mouse' scroll by wheel and would not exercise touch-action.)
    await touchDrag(cdp, { x, y: y + 60 }, 0, -150, 10);
    await expect.poll(() => scrollSum(page)).toBeGreaterThan(s0 + 50);
    await frameRender(page);
    expect(camKey(await cam(page)), 'camera unchanged by touch at rest').toBe(c0);
  });

  test('VIZ-03 3D drehen', async ({ page }) => {
    test.setTimeout(120_000);
    await settledView(page);
    const cdp = await page.context().newCDPSession(page);
    await rotate(page).tap();
    await expect(rotate(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await ev(page, () => window.__eyeglassView.rotateActive())).toBe(true);
    expect(await touchAction(page)).toBe('none');
    await expect(page.locator('#view-hint')).toHaveText(
      'Ein Finger dreht, zwei Finger zoomen und verschieben. Zum Weiterblättern wieder auf „3D drehen“ tippen.',
    );
    // UI-SPEC accent item 9: accent fill, white text
    const look = await ev(page, () => {
      const cs = window.getComputedStyle(document.getElementById('view-rotate'));
      return { bg: cs.backgroundColor, fg: cs.color };
    });
    expect(look).toEqual({ bg: 'rgb(11, 87, 208)', fg: 'rgb(255, 255, 255)' });
    // one finger: horizontal drag rotates the azimuth, the page does not scroll
    let p = await stageCentre(page);
    const c0 = await cam(page);
    const s0 = await scrollSum(page);
    await touchDrag(cdp, { x: p.x - 60, y: p.y }, 120, 0);
    await expect.poll(async () => Math.abs((await cam(page)).azimuthDeg - c0.azimuthDeg)).toBeGreaterThan(5);
    // a vertical drag changes the elevation and still does not scroll the page
    const c1 = await cam(page);
    await touchDrag(cdp, { x: p.x, y: p.y - 40 }, 0, 80);
    await expect.poll(async () => Math.abs((await cam(page)).elevationDeg - c1.elevationDeg)).toBeGreaterThan(3);
    expect(await scrollSum(page), 'page did not scroll while 3D drehen is on').toBe(s0);
    expect(await viewName(page)).toBe('free');
    // two fingers: pinch apart dollies in
    p = await stageCentre(page);
    const d0 = (await cam(page)).distance;
    const pts = (k) => [
      { x: p.x - 20 - k, y: p.y, id: 1 },
      { x: p.x + 20 + k, y: p.y, id: 2 },
    ];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(0) });
    for (let k = 10; k <= 60; k += 10) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(k) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await cam(page)).distance).toBeLessThan(d0 - 1);
    // second tap: off again
    await rotate(page).tap();
    await expect(rotate(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await touchAction(page)).toContain('pan-y');
    await expect(page.locator('#view-hint')).toHaveText('Tippen Sie auf „3D drehen“, um die Brille mit dem Finger zu drehen.');
  });

  test('VIZ-03 auto-off', async ({ page }) => {
    test.setTimeout(90_000);
    await settledView(page);
    await stageCentre(page);
    await rotate(page).tap();
    await expect(rotate(page)).toHaveAttribute('aria-pressed', 'true');
    // scroll so that the stage is fully above the viewport
    await ev(page, () => {
      const r = document.getElementById('view-stage').getBoundingClientRect();
      window.scrollTo(0, window.scrollY + r.bottom + 50);
    });
    expect(await ev(page, () => document.getElementById('view-stage').getBoundingClientRect().bottom)).toBeLessThan(0);
    await expect(rotate(page)).toHaveAttribute('aria-pressed', 'false', { timeout: 1000 });
    expect(await ev(page, () => window.__eyeglassView.rotateActive())).toBe(false);
    expect(await touchAction(page)).toContain('pan-y');
  });

  test('VIZ-03 presets at rest', async ({ page }) => {
    test.setTimeout(90_000);
    await settledView(page);
    await preset(page, 'side').tap();
    await page.waitForFunction(() => window.__eyeglassView.viewName() === 'side', null, { timeout: 30_000 });
    expect(await ev(page, () => window.__eyeglassView.rotateActive())).toBe(false);
    await expect(rotate(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await touchAction(page)).toContain('pan-y');
  });
});

for (const vp of [
  { width: 412, height: 915 },
  { width: 320, height: 640 },
]) {
  test.describe(`VIZ-03 toolbar with 3D drehen at ${vp.width} × ${vp.height}`, () => {
    test.use({ viewport: vp, screen: vp, reducedMotion: 'reduce' });
    test.skip(({ isMobile }) => !isMobile, 'touch path: mobile project only');
    test('wraps without horizontal scroll, targets ≥ 44 px', async ({ page }) => {
      test.setTimeout(90_000);
      await settledView(page);
      for (const pressed of [false, true]) {
        if (pressed) await page.locator('#view-rotate').tap();
        await expect(page.locator('#view-rotate')).toHaveAttribute('aria-pressed', String(pressed));
        const m = await ev(page, () => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          tools: document.getElementById('view-tools').getBoundingClientRect().toJSON(),
          buttons: [...document.querySelectorAll('#view-tools button')].map((b) => b.getBoundingClientRect().toJSON()),
        }));
        expect(m.scrollWidth, 'no horizontal scroll').toBe(m.innerWidth);
        expect(m.buttons).toHaveLength(5);
        for (const b of m.buttons) {
          expect(b.width).toBeGreaterThanOrEqual(44);
          expect(b.height).toBeGreaterThanOrEqual(44);
          expect(b.right).toBeLessThanOrEqual(m.tools.right + 0.5);
        }
      }
    });
  });
}

test('VIZ-03 3D drehen is hidden on the pointer path', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'pointer path: no coarse pointer');
  await settledView(page);
  expect(await ev(page, () => window.matchMedia('(any-pointer: coarse)').matches)).toBe(false);
  await expect(page.locator('#view-rotate')).toBeHidden();
  expect(await ev(page, () => document.getElementById('view-stage').classList.contains('view-stage--static'))).toBe(false);
});

// ---- 03-11 (D-19, D-29): protrusion as text, the Seite note and fade, the canvas aria summary ----
const NBSP = ' ';
const plainText = async (page, sel) => (await page.locator(sel).textContent()).replaceAll(NBSP, ' ');
const mmOf = (s) => s.match(/(\d+,\d) mm/)?.[1] ?? null;

test.describe('VIZ-03 protrusion as text (03-11)', () => {
  test.use({ reducedMotion: 'reduce' });
  test('edge and lead lines equal the Expert rim rule', async ({ page }) => {
    test.setTimeout(120_000);
    await settledView(page);
    const block = page.locator('#view-protrusion');
    await expect(block).toBeVisible();
    await expect(block.locator('.view-protrusion-title')).toHaveText('Überstand am dicksten Glasrand');
    // Example etMax 4,597 mm (03-01): back 1,565 → 1,6 mm, front 0,032 → bündig; lead OD 0,515 → 0,5 mm.
    await expect(page.locator('#view-protrusion-od')).toHaveText(`Rechts: Glasrand hinten 1,6${NBSP}mm aus der Fassung, vorne bündig`);
    await expect(page.locator('#view-protrusion-lead-od')).toHaveText(`Rechts: Vorderfläche bis zu 0,5${NBSP}mm vor der Fassung`);
    await expect(page.locator('#view-protrusion-os')).toHaveText(`Links: Glasrand hinten 1,6${NBSP}mm aus der Fassung, vorne bündig`);
    await expect(page.locator('#view-protrusion-lead-os')).toHaveText(`Links: Vorderfläche bis zu 0,5${NBSP}mm vor der Fassung`);
    await expect(page.locator('#view-protrusion-assumed')).toContainText('in der Experten-Ansicht änderbar');
    await expect(page.locator('#view-protrusion-assumed')).toContainText(`Randtiefe 3,0${NBSP}mm`);
    await expect(page.locator('#view-protrusion-bevel')).toHaveText('Die Aufteilung nach vorne und hinten ist angenommen.');
    // Expert on: same numbers as the Expert rim lines (one helper, one rim depth).
    await page.locator('#expert').check();
    await expect(page.locator('#frame-rim-lead-od')).not.toHaveText('');
    for (const eye of ['od', 'os']) {
      expect(mmOf(await plainText(page, `#view-protrusion-lead-${eye}`))).toBe(mmOf(await plainText(page, `#frame-rim-lead-${eye}`)));
      expect(mmOf(await plainText(page, `#view-protrusion-${eye}`))).toBe(mmOf(await plainText(page, `#frame-rim-result-${eye}`)));
    }
    // An own rim depth: 10 mm → the edge fits, no lead, no 'angenommener Wert' sentence.
    await page.locator('#frame-rim').fill('10');
    await expect(page.locator('#frame-rim-result-od')).toContainText('passt');
    await expect(page.locator('#view-protrusion-od')).toHaveText('Rechts: Glasrand passt ganz in die Fassung');
    await expect(page.locator('#view-protrusion-lead-od')).toHaveText('Rechts: Vorderfläche nicht vor der Fassung');
    await expect(page.locator('#view-protrusion-assumed')).toBeHidden();
    // 5 mm: back 3,065 − 2,5 = 0,565 → 0,6 mm, as the Expert line.
    await page.locator('#frame-rim').fill('5');
    await expect(page.locator('#frame-rim-result-od')).toContainText(`hinten 0,6${NBSP}mm`);
    await expect(page.locator('#view-protrusion-od')).toHaveText(`Rechts: Glasrand hinten 0,6${NBSP}mm aus der Fassung, vorne bündig`);
  });
});

test.describe('VIZ-03 Seite note and fade (03-11)', () => {
  test.use({ reducedMotion: 'reduce' });
  test('side note names the eye, near temple faded, no new program', async ({ page }) => {
    test.setTimeout(120_000);
    await settledView(page);
    await frameRender(page);
    const info = () => ev(page, () => window.__eyeglassView.frameInfo().fadedSide);
    expect(await info()).toBeNull();
    const before = await ev(page, () => window.__eyeglassView.memory());
    await go(page, 'side');
    await frameRender(page);
    // Example: equal total edge protrusion (both 4,597 mm) → the right eye (MINOR 13).
    await expect(page.locator('#view-side-note')).toBeVisible();
    await expect(page.locator('#view-side-note')).toContainText('rechten');
    expect(await info()).toBe('OD');
    // From the side the two eye labels overlap: only the near eye's label stays (no 'L' over 'R').
    await expect(page.locator('#view-labels .view-label:visible')).toHaveText(['R']);
    const after = await ev(page, () => window.__eyeglassView.memory());
    // MINOR 1 rebuttal: the faded materials were compiled while hidden.
    expect(after.programs).toBe(before.programs);
    await go(page, 'front');
    await frameRender(page);
    await expect(page.locator('#view-side-note')).toBeHidden();
    expect(await info()).toBeNull();
    await expect(page.locator('#view-labels .view-label:visible')).toHaveText(['R', 'L']);
  });
});

test.describe('D-29 aria summary (03-11)', () => {
  test.use({ reducedMotion: 'reduce' });
  test('canvas label from the card strings, follows the view, blocked eye', async ({ page }) => {
    test.setTimeout(120_000);
    await settledView(page);
    await page.waitForTimeout(600);
    const label = async () => ((await page.locator('#view-canvas').getAttribute('aria-label')) ?? '').replaceAll(NBSP, ' ');
    const thick = await plainText(page, '#result-od-thick');
    const ct = await plainText(page, '#result-od-ct');
    await expect.poll(label).toContain('3D-Ansicht der Brille, schräg von vorne.');
    const l0 = await label();
    expect(l0).toContain(`Rechtes Glas: dickste Stelle ${thick} `);
    expect(l0).toContain(`Mitte ${ct}.`);
    expect(l0).toContain('Fassung Rechteckig 52□18, Material 1,50 · Standard.');
    await go(page, 'front');
    await expect.poll(label).toContain('3D-Ansicht der Brille, von vorne.');
    await go(page, 'side');
    await expect.poll(label).toContain('von der Seite (rechtes Glas).');
    // Zyl set and Achse empty: the left eye has a field error, so it is not computed.
    await page.locator('#rx-os-cyl').fill('-1,00');
    await page.locator('#rx-os-axis').fill('');
    await page.locator('#rx-os-axis').blur();
    await settledView(page);
    await expect.poll(label).toContain('Linkes Glas: nicht berechnet.');
    expect(await label()).toContain(`Rechtes Glas: dickste Stelle ${thick} `);
    // the blocked eye has no protrusion lines
    await expect(page.locator('#view-protrusion-os')).toBeHidden();
    await expect(page.locator('#view-protrusion-od')).toBeVisible();
  });
});
