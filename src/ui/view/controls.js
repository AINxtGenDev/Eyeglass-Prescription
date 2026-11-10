// VIZ-03 camera controls (03-09; UI-SPEC "Camera and Controls" with R1-3, R1-4, R1-6 and the
// execution amendments A1, A2). One PerspectiveCamera for the life of the view: presets, keys and
// OrbitControls all move the same camera (Pitfall 6: the transmission target is kept per camera).
//
// - Pointer path (D-15, lens-critic MINOR 8): OrbitControls connect to the stage at once only when
//   no coarse pointer exists at all, `!matchMedia('(any-pointer: coarse)')`. A hybrid laptop with a
//   touch screen reports a fine PRIMARY pointer, but its touch screen must still scroll the page, so
//   every device with any touch input takes the 03-10 '3D drehen' path instead.
// - Touch path (03-10, D-15, R1-6): static at rest (class view-stage--static: touch-action pan-y
//   pinch-zoom; controls not connected), so one-finger page scrolling passes through. The
//   #view-rotate toggle (aria-pressed) connects OrbitControls (r187 connect() sets touch-action none
//   on the stage only; one finger rotates, two fingers dolly + pan, so enableZoom follows the toggle)
//   and disconnect() restores ''. It turns off on a second tap or when less than 50 % of the stage
//   is in the viewport (IntersectionObserver threshold 0.5), and it does not turn on while less
//   than 50 % is visible (code review B-WR-07), so the canvas never traps scrolling. A tap there
//   scrolls the stage into view (block 'nearest', instant under reduced motion) and switches on
//   once the observer sees ≥ 50 % (03-LC MINOR 4), instead of refusing silently.
//   On a hybrid laptop the mouse also rotates only after '3D drehen'.
// - Wheel (D-15 as amended): enableZoom is true only while #view-stage has focus. r187's wheel
//   handler returns before preventDefault when enableZoom is false, so the page scrolls. A
//   pointerdown focuses the stage first (preventScroll), so a click then a wheel zooms.
// - Keyboard (D-20 as amended): own keydown handler on the stage (keyStep), not the OrbitControls key listener;
//   it works on every device, connected or not. Handled keys preventDefault; Tab leaves normally.
// - Presets: 450 ms ease-in-out (cubic) of the target (linear) and the offset in spherical
//   coordinates (shortest azimuth, polar, distance), or an instant cut under reduced motion (damping
//   off too). The tween runs inside the scene's render (beforeRender), so rendering stays on demand.
// - Limits (R1-4): derived from the preset poses on every frame attach and resize (controlLimits).
// - Render on demand with damping: render() calls controls.update() first; while damping still
//   moves, update() dispatches 'change', which requests the next frame (official r187 pattern).
import { Spherical, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { t } from '../../i18n/t.js';
import { $, setText } from '../dom.js';
import { icon } from '../icons.js';
import { presetPose, presetPoses, controlLimits, keyStep, easeInOutCubic, basisOf, TWEEN_MS, POLAR_MIN, POLAR_MAX } from './camera-math.js';

const DAMPING = 0.08;
const RAD = Math.PI / 180;
/** MINOR 4: how long a tap below half visibility waits for its scroll to bring the stage in [BP]:
 * longer than a browser smooth scroll (a few hundred ms), short enough that a later manual scroll
 * does not switch on by surprise. */
const SCROLL_ON_MS = 2000;

/**
 * @param {{ camera: import('three').PerspectiveCamera, stage: HTMLElement,
 *   scene: { requestRender: () => void, beforeRender: (fn: () => void) => void,
 *     setInteracting: (on: boolean) => void },
 *   getContext: () => ReturnType<typeof import('./camera-math.js').cameraContext>,
 *   onPose?: (name: string) => void }} o
 *   onPose: called with the view name after it changes (view.js: side note)
 * @param {(inRender: boolean) => void} [o.onSettle] 03-13 (round 2 MINOR 5): the camera came to rest
 *   after a user or preset move: OrbitControls 'end' (with damping: once update() reports no more
 *   motion after it), a preset tween's last step, a cut, a keyboard step. inRender = called from
 *   inside a render (beforeRender), so that render's afterRender sees it; never called per frame.
 *   The r187 OrbitControls key listener is not used (own keydown handler below), so the key path
 *   calls onSettle itself: its step is applied at once (flush, then place), no damping follows.
 */
export function createControls({ camera, stage, scene, getContext, onPose = () => {}, onSettle = () => {} }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controls = new OrbitControls(camera);
  controls.enableDamping = !reduced.matches;
  controls.dampingFactor = DAMPING;
  controls.minPolarAngle = POLAR_MIN;
  controls.maxPolarAngle = POLAR_MAX;
  controls.enableZoom = false;
  // B-WR-08: no user input before the first mesh attach (enable(), view.js, with the preset
  // buttons). A key or drag on the placeholder pose made the view 'free', so the first attach
  // skipped the A1 default fit (and Pos1 with no frame data put the camera at the origin).
  controls.enabled = false;
  let inputEnabled = false;
  reduced.addEventListener('change', () => {
    controls.enableDamping = !reduced.matches;
  });

  let name = 'default';
  let eyeArg = 'OD';
  /** @type {null | { from: any, to: any, t0: number, name: string }} */
  let tween = null;
  let dragging = false;
  let dragFrom = null;
  /** 03-13: an 'end' arrived with damping on; settle once update() stops moving. */
  let settleAfterDamp = false;
  let limits = { minDistance: 0, maxDistance: Infinity, maxTargetRadius: Infinity };

  // 03-12: the Dickenkarte pose is a front view (UI-SPEC: 'Entering Dickenkarte animates the camera
  // to Vorne'), so its view name is 'front'; `name` keeps 'heat' so a refresh re-fits the heat eye.
  const shownName = (n) => (n === 'heat' ? 'front' : n);
  const setName = (n) => {
    if (n === name) return;
    const before = shownName(name);
    name = n;
    if (shownName(n) !== before) onPose(shownName(n));
  };

  /** Drop any damping residue (one undamped update applies and zeroes it). */
  function flush() {
    const d = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = d;
  }

  /** Spherical state of the camera about the target. */
  function sphericalNow() {
    const off = new Vector3().subVectors(camera.position, controls.target);
    return new Spherical().setFromVector3(off);
  }

  function place(target, s) {
    controls.target.set(target.x, target.y, target.z);
    camera.position.setFromSpherical(s).add(controls.target);
    controls.update();
  }

  const poseSpherical = (p) => new Spherical().setFromVector3(new Vector3(p.dir.x, p.dir.y, p.dir.z).multiplyScalar(p.distance));

  function applyLimits() {
    limits = controlLimits(Object.values(presetPoses(getContext())));
    controls.minDistance = limits.minDistance;
    controls.maxDistance = limits.maxDistance;
    controls.maxTargetRadius = limits.maxTargetRadius;
  }

  /**
   * Go to a preset: tween, or a cut under reduced motion (or with { cut: true }).
   * @param {'default' | 'front' | 'side' | 'top' | 'heat'} next
   * @param {'OD' | 'OS'} [eye] heat eye (03-12)
   */
  function goTo(next, eye = 'OD', { cut = false } = {}) {
    flush();
    eyeArg = eye;
    const pose = presetPose(next, getContext(), eye);
    const to = { target: pose.target, s: poseSpherical(pose) };
    if (cut || reduced.matches) {
      tween = null;
      place(to.target, to.s);
      setName(next);
      scene.requestRender();
      onSettle(false);
      return;
    }
    const s = sphericalNow();
    const t = controls.target;
    tween = { from: { target: { x: t.x, y: t.y, z: t.z }, s }, to, t0: performance.now(), name: next };
    scene.requestRender();
  }

  /** One tween step at time now; returns true while the tween still runs. */
  function stepTween(now) {
    const { from, to } = tween;
    const k = Math.min(1, (now - tween.t0) / TWEEN_MS);
    const e = easeInOutCubic(k);
    const lerp = (a, b) => a + (b - a) * e;
    let dTheta = to.s.theta - from.s.theta;
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta)); // shortest way round
    const s = new Spherical(lerp(from.s.radius, to.s.radius), lerp(from.s.phi, to.s.phi), from.s.theta + dTheta * e);
    const target = { x: lerp(from.target.x, to.target.x), y: lerp(from.target.y, to.target.y), z: lerp(from.target.z, to.target.z) };
    if (k >= 1) {
      place(to.target, to.s);
      const done = tween.name;
      tween = null;
      setName(done);
      onSettle(true);
      return false;
    }
    place(target, s);
    return true;
  }

  scene.beforeRender(() => {
    let moving;
    if (tween) {
      moving = stepTween(performance.now());
      if (moving) scene.requestRender();
    } else {
      moving = controls.update(); // dispatches 'change' (→ next frame) while damping moves
      if (settleAfterDamp && !moving && !dragging) {
        settleAfterDamp = false;
        onSettle(true);
      }
    }
    scene.setInteracting(dragging || (moving && !tween && name === 'free'));
  });

  controls.addEventListener('change', () => scene.requestRender());
  controls.addEventListener('start', () => {
    // B-WR-05: a gesture that interrupts a tween after it moved the camera leaves it between two
    // presets; without this a click (no movement) kept the old preset name and the next refresh
    // cut back to it.
    if (tween) {
      const { target, s } = tween.from;
      const from = new Vector3().setFromSpherical(s).add(new Vector3(target.x, target.y, target.z));
      if (from.distanceToSquared(camera.position) > 1e-8) setName('free');
    }
    tween = null;
    settleAfterDamp = false;
    dragging = true;
    dragFrom = { p: camera.position.clone(), t: controls.target.clone() };
    scene.setInteracting(true);
  });
  controls.addEventListener('end', () => {
    dragging = false;
    if (dragFrom && (dragFrom.p.distanceToSquared(camera.position) > 1e-8 || dragFrom.t.distanceToSquared(controls.target) > 1e-8)) {
      setName('free');
    }
    dragFrom = null;
    if (controls.enableDamping) {
      settleAfterDamp = true;
      scene.requestRender(); // one update() at least, which reports whether damping still moves
    } else onSettle(false);
  });

  // Pointer path only without any coarse pointer (MINOR 8, see the header).
  const pointer = !window.matchMedia('(any-pointer: coarse)').matches;
  if (pointer) {
    controls.connect(stage);
    stage.addEventListener('pointerdown', () => {
      if (document.activeElement !== stage) stage.focus({ preventScroll: true });
    });
  }
  let active = false;
  /** Fullscreen on/off (touch only: the page cannot scroll there, so one finger turns the view). */
  /** @type {(on: boolean) => void} */
  let fsHook = () => {};
  const syncZoom = () => {
    controls.enableZoom = pointer ? document.activeElement === stage : active;
  };
  if (!pointer) {
    const button = $('view-rotate');
    // UI-SPEC accent item 9: the pressed state shows the check icon instead of rotate.
    const setIcon = () => {
      button.querySelector('svg')?.remove();
      button.prepend(icon(active ? 'check' : 'rotate'));
    };
    /**
     * B-WR-07: the stage's last intersectionRatio (null before the first callback). The observer
     * fires only on a 0,5 crossing, so this tells the side of 0,5 at any time.
     */
    let ratio = null;
    const setActive = (on) => {
      if (on === active) return;
      // Refused below half visibility: from there no crossing would ever switch it off again.
      if (on && ratio !== null && ratio < 0.5) return;
      active = on;
      if (on) {
        controls.connect(stage);
        stage.classList.remove('view-stage--static');
      } else {
        controls.disconnect();
        stage.classList.add('view-stage--static');
        // A disconnect in the middle of a gesture never sends 'end'.
        if (dragging) {
          dragging = false;
          dragFrom = null;
          scene.setInteracting(false);
          onSettle(false);
        }
      }
      syncZoom();
      button.setAttribute('aria-pressed', String(on));
      setIcon();
      setText('view-hint', t(on ? 'view.hint.touchOn' : 'view.hint.touchOff'));
    };
    let activeBeforeFs = false;
    fsHook = (on) => {
      if (on) {
        activeBeforeFs = active;
        ratio = 1; // the stage fills the screen; the observer confirms with its next callback
        setActive(true);
      } else setActive(activeBeforeFs);
    };
    stage.classList.add('view-stage--static');
    button.hidden = false;
    setIcon();
    setText('view-hint', t('view.hint.touchOff'));
    /**
     * 03-LC (lens-critic MINOR 4): a tap below half visibility scrolls the stage into view first
     * and switches on at the observer's next 0,5 crossing, if that comes before this deadline
     * (performance.now() ms; 0 = none). Any other observer callback cancels it.
     */
    let onAfterScrollUntil = 0;
    button.addEventListener('click', () => {
      if (!active && ratio !== null && ratio < 0.5) {
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        onAfterScrollUntil = performance.now() + SCROLL_ON_MS;
        stage.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
        return;
      }
      setActive(!active);
    });
    new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          ratio = e.intersectionRatio;
          const wanted = onAfterScrollUntil > performance.now();
          onAfterScrollUntil = 0;
          if (active && ratio < 0.5) setActive(false);
          else if (!active && wanted && ratio >= 0.5) setActive(true);
        }
      },
      { threshold: [0.5] },
    ).observe(stage);
  }
  stage.addEventListener('focus', syncZoom);
  stage.addEventListener('blur', syncZoom);

  stage.addEventListener('keydown', (e) => {
    if (!inputEnabled || e.altKey || e.ctrlKey || e.metaKey) return;
    const s = sphericalNow();
    const step = keyStep(e.key, { azimuth: s.theta, polar: s.phi, distance: s.radius, ...limits }, { shift: e.shiftKey });
    if (step === null) return;
    e.preventDefault();
    if (step === 'reset') {
      goTo('default');
      return;
    }
    tween = null;
    flush();
    const dir = new Vector3().setFromSpherical(new Spherical(1, s.phi, s.theta));
    const { right, up } = basisOf({ x: dir.x, y: dir.y, z: dir.z });
    const t = controls.target;
    const target = {
      x: t.x + right.x * step.pan.x + up.x * step.pan.y,
      y: t.y + right.y * step.pan.x + up.y * step.pan.y,
      z: t.z + right.z * step.pan.x + up.z * step.pan.y,
    };
    place(target, new Spherical(step.distance, step.polar, step.azimuth));
    setName('free');
    scene.requestRender();
    onSettle(false);
  });

  return {
    goTo,
    /** Fullscreen entered or left (fullscreen.js through view.js). */
    setFullscreen: (/** @type {boolean} */ on) => fsHook(on),
    /** B-WR-08: accept keys and drags (view.js calls it on the first mesh attach). */
    enable() {
      inputEnabled = true;
      controls.enabled = true;
    },
    /** Frame attach or resize: new limits; a preset view (not 'free') follows its new pose. */
    refresh() {
      applyLimits();
      if (tween) {
        // A running preset tween keeps going, toward the new pose of its preset.
        const pose = presetPose(tween.name, getContext(), eyeArg);
        tween.to = { target: pose.target, s: poseSpherical(pose) };
      } else if (name !== 'free' && !dragging) goTo(name, eyeArg, { cut: true });
    },
    viewName: () => shownName(name),
    /** 03-15: the camera moves (drag, preset tween, damping after a drag): no thumbnail now. */
    busy: () => dragging || tween !== null || settleAfterDamp,
    /** 03-12: the preset the camera is on ('heat' for the Dickenkarte pose, 'free' after a drag). */
    preset: () => name,
    /** 03-12: the eye of the last heat pose. */
    presetEye: () => eyeArg,
    limits: () => ({ ...limits }),
    pointer,
    /** Touch path: '3D drehen' is on (OrbitControls connected). Always false on the pointer path. */
    rotateActive: () => active,
    /** Test handle: the camera state. */
    state() {
      const t = controls.target;
      const off = new Vector3().subVectors(camera.position, t);
      const distance = off.length();
      return {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: t.x, y: t.y, z: t.z },
        azimuthDeg: Math.atan2(off.x, off.z) / RAD,
        elevationDeg: Math.asin(off.y / distance) / RAD,
        distance,
      };
    },
  };
}
