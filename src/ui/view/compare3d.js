// A/B comparison in 3D (03-14, RES-03; D-24 as amended, D-25; UI-SPEC "A/B in 3D").
//
// While 'Variante vergleichen' is active the view shows the compared eye only: A (Vorher) = the
// 'A' lens slot + the frameA rim of that eye, B (Nachher) = the main lens slot of that eye + its
// rim. Both are recentred on their own boxing centre (lens-local x = 0; the z of each lens is its
// own rim-plane lensZ) and drawn with the ONE camera, so both halves show the same angle at the
// same mm-per-pixel scale: the vertical FOV and the stage height are the same for both halves,
// and the distance comes from one compareContext fit over A ∪ B (camera-math.js).
//
// - Stage ≥ SPLIT_MIN_PX wide: two scissor viewports side by side (A left, B right), each half
//   rendered with camera.aspect = the half aspect (restored after). Both halves get the same width
//   (floor(W / 2)), so the transmission render target (kept per camera.id, RESEARCH Pitfall 6) is
//   sized once for the half and reused by the second half; the 2 px divider covers the odd column.
// - Below that: one viewport that shows the configuration #cmp-show selects; the camera is kept.
// - The pass toggles visible / position only on existing objects and restores every value it
//   changed before returning, so nothing outside the pass (labels, debug handle, the "drawn"
//   state in lenses.js / frame.js) ever sees the per-half state. No geometry, material, texture or
//   render target is created or released here (T-03-39).
// - warmUp(): the first render after the first mesh attach also draws the A slot and both frameA
//   rims with their initial all-zero buffers (degenerate, nothing visible), so their GPU buffers
//   are uploaded once at the start. Starting or ending a comparison later only toggles visibility.
// - Captions 'Vorher (A)' / 'Nachher (B)': HTML pills in #view-labels at the top centre of each
//   half (pushed below the badge when they would touch it); a 2 px --line divider between the
//   halves while split. Both are aria-hidden: #view-caption and the canvas aria-label carry the
//   comparison in words.
import { Vector2, Vector3 } from 'three';
import { t } from '../../i18n/t.js';

/** Stage width (CSS px) from which A and B are side by side: each half ≥ 180 px (UI-SPEC) [BP]. */
export const SPLIT_MIN_PX = 360;
/** Caption offset from the stage top (= --space-2) and below the badge [BP]. */
const CAPTION_TOP_PX = 8;
const CAPTION_GAP_PX = 4;

const HALVES = /** @type {const} */ (['A', 'B']);
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * @param {{ renderer: import('three').WebGLRenderer, scene: import('three').Scene,
 *   camera: import('three').PerspectiveCamera,
 *   lenses: ReturnType<typeof import('./lenses.js').createLensSlots>,
 *   frame: ReturnType<typeof import('./frame.js').createFrame>,
 *   frameA: ReturnType<typeof import('./frame.js').createFrame>,
 *   shadow: { mesh: import('three').Object3D }, labelsEl: HTMLElement, stageEl: HTMLElement }} o
 */
export function createCompare3d({ renderer, scene, camera, lenses, frame, frameA, shadow, labelsEl, stageEl }) {
  /** aEye = the eye the attached A lens and frameA rim were built for (null: none yet). */
  const state = { active: false, eye: /** @type {'OD' | 'OS'} */ ('OD'), split: false, shown: /** @type {'A' | 'B'} */ ('B'), aEye: null };
  let warm = false;

  const caption = (half) => {
    const el = document.createElement('span');
    el.className = 'view-label view-label--caption';
    el.dataset.half = half;
    el.textContent = t(half === 'A' ? 'view.ab.a' : 'view.ab.b');
    el.hidden = true;
    labelsEl.append(el);
    return el;
  };
  const captions = { A: caption('A'), B: caption('B') };
  const divider = document.createElement('div');
  divider.className = 'view-divider';
  divider.setAttribute('aria-hidden', 'true');
  divider.hidden = true;
  stageEl.append(divider);
  /** @type {Map<HTMLElement, { w: number, h: number }>} */
  const capSize = new Map();
  const sizeOf = (el) => {
    const c = capSize.get(el);
    if (c && c.w > 0) return c;
    const was = el.hidden;
    el.hidden = false;
    const s = { w: el.offsetWidth, h: el.offsetHeight };
    el.hidden = was;
    capSize.set(el, s);
    return s;
  };

  const sz = new Vector2();
  /** Drawing size in CSS px (renderer.setSize(w, h, false) in scene.js). */
  const stageSize = () => {
    renderer.getSize(sz);
    return { W: sz.x, H: sz.y };
  };
  const split = () => state.active && state.split;
  /** A half's box in stage CSS px (both halves the same width). */
  function halfBox(half) {
    const { W, H } = stageSize();
    if (!split()) return { x: 0, w: W, h: H };
    const w = Math.floor(W / 2);
    return { x: half === 'A' ? 0 : W - w, w, h: H };
  }

  /** Run fn with the camera projection of one half (split only), then restore it. */
  function withHalf(half, fn) {
    if (!split()) return fn();
    const b = halfBox(half);
    const aspect = camera.aspect;
    camera.aspect = b.w / b.h;
    camera.updateProjectionMatrix();
    try {
      return fn();
    } finally {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
  }

  /** Changed values, restored in reverse order after the pass. */
  const saved = [];
  const set = (obj, key, value) => {
    saved.push([obj, key, obj[key]]);
    obj[key] = value;
  };
  const restore = () => {
    for (let i = saved.length - 1; i >= 0; i--) {
      const [obj, key, value] = saved[i];
      obj[key] = value;
    }
    saved.length = 0;
  };

  function renderPass() {
    const LA = lenses.group('A');
    const fA = frameA.compareParts(state.eye);
    if (!state.active) {
      if (warm) {
        // Warm-up: upload the A slot and both frameA rims once (all-zero buffers, nothing visible).
        warm = false;
        set(LA, 'visible', true);
        set(fA.root, 'visible', true);
        for (const m of fA.nonRim) set(m, 'visible', false);
      } else {
        set(LA, 'visible', false);
        set(fA.root, 'visible', false);
      }
      renderer.render(scene, camera);
      restore();
      return;
    }
    const eye = state.eye;
    const other = eye === 'OD' ? 'OS' : 'OD';
    const LB = lenses.group(eye);
    const fB = frame.compareParts(eye);
    const aReady = state.aEye === eye;
    const drawn = {
      A: [aReady && LA.visible, aReady && fA.root.visible],
      B: [LB.visible, fB.root.visible],
    };
    set(lenses.group(other), 'visible', false);
    set(shadow.mesh, 'visible', false);
    for (const m of [...fB.others, ...fA.others]) set(m, 'visible', false);
    set(LB.position, 'x', 0);
    set(fB.rim.position, 'x', 0);
    set(LA.position, 'x', 0);
    set(LA.position, 'z', frameA.lensZ()[eye]);
    set(fA.rim.position, 'x', 0);
    const show = (half) => {
      const a = half === 'A';
      set(LA, 'visible', a && drawn.A[0]);
      set(fA.root, 'visible', a && drawn.A[1]);
      set(LB, 'visible', !a && drawn.B[0]);
      set(fB.root, 'visible', !a && drawn.B[1]);
    };
    if (state.split) {
      const { W, H } = stageSize();
      renderer.clear();
      renderer.setScissorTest(true);
      for (const half of HALVES) {
        const b = halfBox(half);
        renderer.setViewport(b.x, 0, b.w, b.h);
        renderer.setScissor(b.x, 0, b.w, b.h);
        show(half);
        withHalf(half, () => renderer.render(scene, camera));
      }
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, W, H);
    } else {
      show(state.shown);
      renderer.render(scene, camera);
    }
    restore();
  }

  /**
   * Captions and divider for the current state (afterRender). Returns the caption boxes in stage
   * px, so the Dickenkarte labels avoid them.
   * @param {{ x: number, y: number, w: number, h: number } | null} badge the badge box, or null
   */
  function layoutCaptions(badge) {
    const on = (el, x, y) => {
      const tf = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (el.style.transform !== tf) el.style.transform = tf;
      if (el.hidden) el.hidden = false;
    };
    const off = (el) => {
      if (!el.hidden) el.hidden = true;
    };
    if (divider.hidden === split()) divider.hidden = !split();
    if (!state.active) {
      for (const half of HALVES) off(captions[half]);
      return [];
    }
    const halves = split() ? HALVES : [state.shown];
    const boxes = halves.map((half) => {
      const b = halfBox(half);
      const { w, h } = sizeOf(captions[half]);
      return { half, x: b.x + Math.max(0, (b.w - w) / 2), y: CAPTION_TOP_PX, w, h };
    });
    if (badge && boxes.some((q) => hit(q, badge))) for (const q of boxes) q.y = badge.y + badge.h + CAPTION_GAP_PX;
    for (const half of HALVES) if (!halves.includes(half)) off(captions[half]);
    for (const q of boxes) on(captions[q.half], q.x, q.y);
    return boxes.map(({ x, y, w, h }) => ({ x, y, w, h }));
  }

  const pv = new Vector3();
  return {
    renderPass,
    withHalf,
    halfBox,
    layoutCaptions,
    /** Upload the A slot and the frameA rims with the next (normal) render. */
    warmUp() {
      warm = true;
    },
    /**
     * @param {{ active: boolean, eye?: 'OD' | 'OS', stageWidth?: number, shown?: 'A' | 'B', aEye?: 'OD' | 'OS' | null }} next
     * @returns {boolean} whether anything changed
     */
    setState(next) {
      const s = {
        active: next.active,
        eye: next.eye ?? state.eye,
        split: next.active && (next.stageWidth ?? 0) >= SPLIT_MIN_PX,
        shown: next.shown ?? 'B',
        aEye: next.aEye === undefined ? state.aEye : next.aEye,
      };
      const changed = Object.keys(s).some((k) => s[k] !== state[k]);
      Object.assign(state, s);
      return changed;
    },
    state: () => ({ ...state }),
    /** Camera aspect the poses are fitted for: the half aspect while split. */
    aspect() {
      const b = halfBox('A');
      return b.w / b.h;
    },
    /**
     * Test-only: projected width (CSS px) of a lens-local outline at depth z in one half.
     * @param {'A' | 'B'} half
     * @param {ArrayLike<number>} outline [x0, y0, x1, y1, …] lens-local mm
     * @param {number} z
     */
    widthPx(half, outline, z) {
      const b = halfBox(half);
      return withHalf(half, () => {
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < outline.length; i += 2) {
          pv.set(outline[i], outline[i + 1], z).project(camera);
          const x = ((pv.x + 1) / 2) * b.w;
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
        return hi - lo;
      });
    },
  };
}
