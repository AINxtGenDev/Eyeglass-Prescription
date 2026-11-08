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
import {
  WebGLRenderer,
  Scene,
  Color,
  PerspectiveCamera,
  PMREMGenerator,
  SRGBColorSpace,
  NeutralToneMapping,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { pickTier, TIER_SETTINGS } from './tiers.js';

/** Vertical field of view in degrees (UI-SPEC Camera: 20° in every view). */
export const FOV_DEG = 20;
/** Default 3/4 view: azimuth toward the wearer's right (−x) and elevation (UI-SPEC Camera table). */
const AZIMUTH_DEG = 35;
const ELEVATION_DEG = 15;
/** Margin around the fitted bounding sphere. */
const FIT_MARGIN = 1.08;
const RAD = Math.PI / 180;
/** Context loss: 'gone' when no restore follows within this time (UI-SPEC States). */
const RESTORE_WAIT_MS = 5000;

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
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} stage observed for size changes
 * @returns {null | {
 *   renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera,
 *   requestRender: () => void, render: () => void, afterRender: (fn: () => void) => void,
 *   fit: (r: number) => void, tier: () => 'hoch' | 'mittel' | 'sparsam',
 *   applyTier: (tier: 'hoch' | 'mittel' | 'sparsam') => void,
 *   onTier: (fn: (tier: string, settings: typeof TIER_SETTINGS.hoch) => void) => void,
 *   onContext: (fn: (state: 'lost' | 'gone' | 'restored') => void) => void,
 *   project: (x: number, y: number, z: number) => [number, number],
 * }}
 */
export function createScene(canvas, stage) {
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

  const camera = new PerspectiveCamera(FOV_DEG, 16 / 10, 10, 6000);
  const target = new Vector3(0, 0, 0);
  const dir = new Vector3(
    -Math.sin(AZIMUTH_DEG * RAD) * Math.cos(ELEVATION_DEG * RAD),
    Math.sin(ELEVATION_DEG * RAD),
    Math.cos(AZIMUTH_DEG * RAD) * Math.cos(ELEVATION_DEG * RAD),
  );
  camera.position.copy(dir).multiplyScalar(500);
  camera.lookAt(target);

  const hooks = [];
  const tierHooks = [];
  const contextHooks = [];
  let frame = null;

  function render() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    renderer.render(scene, camera);
    for (const fn of hooks) fn();
  }

  function requestRender() {
    if (frame === null) frame = requestAnimationFrame(render);
  }

  // Resize: coalesced to one rAF; render in the same frame (no stretched frame).
  let sizeFrame = null;
  function resize() {
    sizeFrame = null;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  }
  new ResizeObserver(() => {
    if (sizeFrame === null) sizeFrame = requestAnimationFrame(resize);
  }).observe(stage);
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

  return {
    renderer,
    scene,
    camera,
    render,
    requestRender,
    afterRender: (fn) => hooks.push(fn),
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
    /**
     * Default 3/4 view about the target (0, 0, 0) (the bridge centre in the frame front plane),
     * framing a sphere of radius r about it: distance = r · 1,08 / sin(FOV / 2).
     */
    fit(r) {
      const d = (r * FIT_MARGIN) / Math.sin((FOV_DEG / 2) * RAD);
      camera.position.copy(dir).multiplyScalar(d).add(target);
      camera.lookAt(target);
      requestRender();
    },
  };
}
