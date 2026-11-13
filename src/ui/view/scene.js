// 3D scene (03-05, VIZ-01, VIZ-04; UI-SPEC "3D Scene Contract"). The only place that creates the
// WebGLRenderer. CSP (style-src 'self'): the renderer gets the existing canvas and setSize(…,
// false), so three.js writes no style attribute; CSS owns the displayed size.
//
// - new WebGLRenderer throws 'Error creating WebGL context.' without WebGL2 (RESEARCH Pattern 5):
//   createScene catches it and returns null. Test flag ?nowebgl throws inside the same try.
// - One PerspectiveCamera for the life of the view: the transmission render target is kept per
//   camera.id (RESEARCH Pitfall 6).
// - Render on demand only (D-20): requestRender() → one rAF → render() → afterRender hooks in the
//   same task (labels from 03-06, the thumbnail later).
// 03-08 (D-12, UI-SPEC "Quality tiers", States):
// - The start tier comes from pickTier with the PRIMARY pointer, `(pointer: coarse)`, on purpose:
//   the tier is about the device class (a phone). The touch-scroll path (03-10) uses
//   `(any-pointer: coarse)` instead, because there any touch input matters (lens-critic MINOR 8).
// - applyTier(tier) sets the pixel ratio cap and transmissionResolutionScale and runs the onTier
//   hooks (chart texture size, dispersion, Technische Angaben). Geometry is never touched. 03-09
//   calls it for the runtime step-down.
// - Context loss (Pitfall 7): three.js prevents the default and re-inits its GL state on restore;
//   the PMREM environment is a render target, so it is lost and regenerated here; canvas textures
//   re-upload from their canvas (onContext 'restored' hooks). No restore within 5 s → 'gone'.
// 03-14 (RES-03): setPass(fn) replaces the single renderer.render(scene, camera) of render() by
// compare3d.js's pass (two scissor halves with the same camera); hooks run once around it.
// 03-15 (UX-03, D-14, R1-8, lens-critic MINOR 5 / 11, round 2 MINOR 1): the phone bar thumbnail.
// setThumb({ canvas, source, onCopy }) + requestThumb(): the next render whose source() returns a
// spec (view.js: phone width, not while the camera moves, a frame-front box exists) is a thumbnail
// frame: thumbnail pose → pass → copy → restore → pass, all in one task with no await, so it costs
// exactly 2 passes (round 2 MINOR 1; the old main → thumbnail → main order cost 3). The copy is
// a 2D drawImage of the WebGL canvas right after the pass (RESEARCH Pattern 9: the drawing
// buffer still holds the pixels in the same task, so the renderer keeps its default drawing
// buffer that is cleared after compositing). The canvas is
// composited after the task, so the user only ever sees pass 2. The thumbnail pass uses the screen
// layout unchanged (the same viewports as the main pass; split A/B is cropped by the source
// rectangle), so the per-camera transmission target, which r187 sizes from the active viewport
// (WebGLRenderer.js lines 2056-2057, setSize per render), is never resized by the thumbnail.
// A4 (03-16, orchestrator amendment): the objects in thumb.hide (view.js: the eye chart and the
// contact shadow) are hidden
// for the thumbnail pass only (.visible, restored before pass 2), so the 48×36 px picture shows the
// glasses on the plain #f3f4f6 scene background instead of a busy checker. No new geometry,
// texture, material or program; still exactly 2 passes.
// 03-09 (VIZ-03): the camera poses live in camera-math.js and controls.js (fit() is gone).
// - beforeRender hooks run before each render (controls.update / preset tween, chart fade);
//   onResize hooks run after a stage resize, before its render (limits and preset refit).
// - Runtime step-down (UI-SPEC Quality tiers, sparsam row): while setInteracting(true), the time
//   between consecutive renders feeds createFrameMonitor; a median over the last 30 frames above
//   20 ms steps the tier down once (hoch → mittel → sparsam), never back up. Gaps above
//   IDLE_GAP_MS are idle time (the user held still), not frame time, and are not counted.
import {
  WebGLRenderer,
  Scene,
  Color,
  PerspectiveCamera,
  PMREMGenerator,
  SRGBColorSpace,
  NeutralToneMapping,
  Vector3,
  Quaternion,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { pickTier, stepDown, TIER_SETTINGS } from './tiers.js';
import { FOV_DEG, CAMERA_NEAR_MM, CAMERA_FAR_MM, DEFAULT_AZ_DEG, DEFAULT_EL_DEG, createFrameMonitor } from './camera-math.js';

const RAD = Math.PI / 180;
/** Render gaps above this are idle time, not interaction frame time (ms) [BP]. */
const IDLE_GAP_MS = 250;
/** Context loss: 'gone' when no restore follows within this time (UI-SPEC States). */
const RESTORE_WAIT_MS = 5000;
/** Thumbnail letterbox fill = the studio background #f3f4f6 (UI-SPEC Color). */
const THUMB_BG = '#f3f4f6';

/** Environment map for the glass reflections, from the built-in RoomEnvironment. */
function makeEnvironment(renderer) {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const texture = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  room.dispose();
  return texture;
}

/**
 * @param {HTMLCanvasElement} canvas observed for size changes (it fills the stage's picture area)
 * @returns {null | {
 *   renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera,
 *   requestRender: () => void, render: () => void, afterRender: (fn: () => void) => void,
 *   beforeRender: (fn: () => void) => void, onResize: (fn: () => void) => void,
 *   setInteracting: (on: boolean) => void, tier: () => 'hoch' | 'mittel' | 'sparsam',
 *   applyTier: (tier: 'hoch' | 'mittel' | 'sparsam') => void,
 *   onTier: (fn: (tier: string, settings: typeof TIER_SETTINGS.hoch) => void) => void,
 *   onContext: (fn: (state: 'lost' | 'gone' | 'restored') => void) => void,
 *   project: (x: number, y: number, z: number) => [number, number],
 * }}
 */
export function createScene(canvas) {
  let renderer;
  try {
    if (location.search.includes('nowebgl')) throw new Error('Error creating WebGL context.');
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('3D view: no WebGL2', err);
    return null;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  // Primary pointer on purpose (device class), see the header; 03-10 uses any-pointer.
  let tier = pickTier({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    minScreen: Math.min(window.screen.width, window.screen.height),
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIER_SETTINGS[tier].pixelRatioMax));
  renderer.transmissionResolutionScale = TIER_SETTINGS[tier].transmissionScale;

  const scene = new Scene();
  scene.background = new Color('#f3f4f6');
  scene.environment = makeEnvironment(renderer);

  const camera = new PerspectiveCamera(FOV_DEG, 16 / 10, CAMERA_NEAR_MM, CAMERA_FAR_MM);
  // Placeholder pose until controls.js places the default preset on the first frame attach.
  camera.position.set(
    -Math.sin(DEFAULT_AZ_DEG * RAD) * Math.cos(DEFAULT_EL_DEG * RAD),
    Math.sin(DEFAULT_EL_DEG * RAD),
    Math.cos(DEFAULT_AZ_DEG * RAD) * Math.cos(DEFAULT_EL_DEG * RAD),
  ).multiplyScalar(500);
  camera.lookAt(0, 0, 0);

  const hooks = [];
  const preHooks = [];
  const resizeHooks = [];
  const tierHooks = [];
  const contextHooks = [];
  let frame = null;
  const monitor = createFrameMonitor();
  let interacting = false;
  let lastRenderAt = null;
  let stepPending = false;
  let pass = () => renderer.render(scene, camera);
  /** 03-15 test-only: scene passes (a split pass with its two viewports counts as one). */
  let passes = 0;
  const runPass = () => {
    passes++;
    pass();
  };
  /** @type {null | { canvas: HTMLCanvasElement, source: () => any, onCopy: (spec: any, ms: number) => void, hide?: import('three').Object3D[], pass?: () => void }} */
  let thumb = null;
  let thumbWanted = false;
  const thumbStats = { copies: 0, passesPerThumbFrame: 0 };
  const savedPos = new Vector3();
  const savedQuat = new Quaternion();

  /** Copy the source rectangle (device px) of the drawing buffer into the thumb, letterboxed. */
  function copyThumb(src) {
    const c = thumb.canvas;
    const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    g.fillStyle = THUMB_BG;
    g.fillRect(0, 0, c.width, c.height);
    const k = Math.min(c.width / src.w, c.height / src.h);
    const dw = src.w * k;
    const dh = src.h * k;
    g.drawImage(renderer.domElement, src.x, src.y, src.w, src.h, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    thumbStats.copies++;
  }

  /**
   * One frame that carries the thumbnail: 2 passes, no await in between (see the header).
   * @param {{ position: {x:number,y:number,z:number}, target: {x:number,y:number,z:number}, src: {x:number,y:number,w:number,h:number} }} spec
   */
  function thumbFrame(spec) {
    const p0 = passes;
    // 03-LC (MINOR 3): wall time of the thumbnail pass + copy (drawImage of the WebGL canvas waits
    // for the GPU), handed to onCopy for view.js's self-timing guard.
    const t0 = performance.now();
    savedPos.copy(camera.position);
    savedQuat.copy(camera.quaternion);
    camera.position.set(spec.position.x, spec.position.y, spec.position.z);
    camera.lookAt(spec.target.x, spec.target.y, spec.target.z);
    camera.updateMatrixWorld();
    const hide = thumb.hide ?? [];
    const wasVisible = hide.map((o) => o.visible);
    // B-WR-01: a throwing pass or copy must not leave the camera at the thumbnail pose (the next
    // controls.update() would adopt it) or the contact shadow hidden for good.
    try {
      try {
        for (const o of hide) o.visible = false;
        // 04-09: the thumbnail may have its own pass (the glasses while the main pass is the Durchblick).
        if (thumb.pass) {
          passes++;
          thumb.pass();
        } else runPass();
      } finally {
        hide.forEach((o, i) => (o.visible = wasVisible[i]));
      }
      copyThumb(spec.src);
    } finally {
      camera.position.copy(savedPos);
      camera.quaternion.copy(savedQuat);
      camera.updateMatrixWorld();
    }
    thumb.onCopy(spec, performance.now() - t0);
    runPass();
    thumbStats.passesPerThumbFrame = passes - p0;
  }

  /** Interaction frame time → monitor; one step down when the median is too slow. */
  function sample() {
    const now = performance.now();
    if (interacting && lastRenderAt !== null && now - lastRenderAt < IDLE_GAP_MS) monitor.push(now - lastRenderAt);
    lastRenderAt = interacting ? now : null;
    if (!stepPending && tier !== 'sparsam' && monitor.shouldStepDown()) {
      stepPending = true;
      monitor.reset();
      // Outside this render: applyTier resizes and renders.
      setTimeout(() => {
        stepPending = false;
        api.applyTier(stepDown(tier));
      }, 0);
    }
  }

  function render() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    for (const fn of preHooks) fn();
    // A wanted thumbnail waits while source() says 'not now' (null), e.g. during an orbit.
    const spec = thumbWanted && thumb ? thumb.source() : null;
    if (spec) {
      thumbWanted = false;
      thumbFrame(spec);
    } else runPass();
    sample();
    for (const fn of hooks) fn();
  }

  function requestRender() {
    if (frame === null) frame = requestAnimationFrame(render);
  }

  // Resize: coalesced to one rAF; render in the same frame (no stretched frame).
  let sizeFrame = null;
  function resize() {
    sizeFrame = null;
    // 04-12 (F-02): the canvas box, not the stage: in fullscreen the stage is a two-row grid and the
    // canvas fills only the picture row (elsewhere the canvas fills the stage, so both are equal).
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const fn of resizeHooks) fn();
    render();
  }
  new ResizeObserver(() => {
    if (sizeFrame === null) sizeFrame = requestAnimationFrame(resize);
  }).observe(canvas);
  resize();

  /** @param {'lost' | 'gone' | 'restored'} state */
  const contextState = (state) => {
    for (const fn of contextHooks) fn(state);
  };
  let goneTimer = null;
  canvas.addEventListener('webglcontextlost', () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    contextState('lost');
    if (goneTimer !== null) clearTimeout(goneTimer);
    goneTimer = setTimeout(() => {
      goneTimer = null;
      contextState('gone');
    }, RESTORE_WAIT_MS);
  });
  // Registered after three.js's own listener (WebGLRenderer constructor), so its GL state is
  // re-initialised before the environment is rebuilt here.
  canvas.addEventListener('webglcontextrestored', () => {
    if (goneTimer !== null) clearTimeout(goneTimer);
    goneTimer = null;
    const old = scene.environment;
    scene.environment = makeEnvironment(renderer);
    old?.dispose();
    contextState('restored');
    render();
  });

  const api = {
    renderer,
    scene,
    camera,
    render,
    requestRender,
    afterRender: (fn) => hooks.push(fn),
    /** 03-14: the draw step of render() (default: one renderer.render with the one camera). */
    setPass: (fn) => {
      pass = fn;
    },
    /** 03-15: the bar thumbnail target and its spec source (view.js). */
    setThumb: (t) => {
      thumb = t;
    },
    /**
     * 03-15: copy a thumbnail with the next render that allows it.
     * @param {boolean} [inRender] the caller runs inside a render's hooks or right before a render
     *   (paintMesh, resize): that render carries it, no extra frame is requested
     */
    requestThumb(inRender = false) {
      thumbWanted = true;
      if (!inRender) requestRender();
    },
    /** 03-15 test-only: thumbnail copies, passes of the last thumbnail frame, total passes. */
    thumbStats: () => ({ ...thumbStats, passes }),
    beforeRender: (fn) => preHooks.push(fn),
    onResize: (fn) => resizeHooks.push(fn),
    /** 03-09: true while the user drags or damping still moves (frame-time monitor). */
    setInteracting(on) {
      if (!on) lastRenderAt = null;
      interacting = on;
    },
    tier: () => tier,
    onTier: (fn) => tierHooks.push(fn),
    onContext: (fn) => contextHooks.push(fn),
    /** Pixel ratio, transmission scale and the onTier hooks for a tier; never the geometry. */
    applyTier(next) {
      tier = next;
      const s = TIER_SETTINGS[tier];
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, s.pixelRatioMax));
      renderer.transmissionResolutionScale = s.transmissionScale;
      for (const fn of tierHooks) fn(tier, s);
      resize();
    },
    /** World point (mm) → canvas CSS px [x, y] (test handle, 03-09 presets). */
    project(x, y, z) {
      const v = new Vector3(x, y, z).project(camera);
      return [((v.x + 1) / 2) * canvas.clientWidth, ((1 - v.y) / 2) * canvas.clientHeight];
    },
  };
  return api;
}
