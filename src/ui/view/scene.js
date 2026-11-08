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

/** Vertical field of view in degrees (UI-SPEC Camera: 20° in every view). */
export const FOV_DEG = 20;
/** Default 3/4 view: azimuth toward the wearer's right (−x) and elevation (UI-SPEC Camera table). */
const AZIMUTH_DEG = 35;
const ELEVATION_DEG = 15;
/** Margin around the fitted bounding sphere. */
const FIT_MARGIN = 1.08;
const RAD = Math.PI / 180;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} stage observed for size changes
 * @returns {null | {
 *   renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera,
 *   requestRender: () => void, render: () => void, afterRender: (fn: () => void) => void,
 *   fit: (r: number) => void,
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // 03-08 replaces this with tiers

  const scene = new Scene();
  scene.background = new Color('#f3f4f6');
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  room.dispose();

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

  return {
    renderer,
    scene,
    camera,
    render,
    requestRender,
    afterRender: (fn) => hooks.push(fn),
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
