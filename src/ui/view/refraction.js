// Durchblick draw pass (04-08, REF-01, D-12, D-14; UI-SPEC "Correctness", "Layout of the picture",
// "Bild toggle"). Every chart pixel inside the lens comes from the engine warp grid (warp.js via the
// warp worker): the grid's traced object directions are written into the `uv` attribute of a
// fixed-topology grid mesh and the GPU only interpolates them and looks up the chart texture. No
// optics in a shader (MeshBasicMaterial only). Drawn through the existing renderer (scene.js
// setPass), into an own Scene with an OrthographicCamera in stage CSS px: one WebGL context.
//
// - Grid: per panel (nx + 1)·(ny + 1) vertices at the warp grid points (panel px, y up), index
//   from ref-layout.js gridTriangles, split along warp.js CELL_DIAGONAL, the interpolant the N10
//   engine test bounds (lens-critic MINOR 1). Allocated in setLayout only; setWarp writes in place.
// - Class mask: a cell whose four corners are all class 1 (lens) or all class 5 (past the rim) is
//   chart; all class 3 is the flat "kein Durchblick" fill; every other cell, including every cell
//   whose corners differ in class, is the flat rim colour (conservative until 04-09 draws the
//   quadtree leaves): never a chart where no ray passes (T-04-32).
// - Bild toggle: 'off' writes the identity uv (object tan = eye tan of each grid point) and keeps
//   the class mask, so only the chart moves in the blink (N2).
// - Chart (D-08): one canvas texture in object-tan space over |tan| ≤ CHART_EXTENT_TAN; checker
//   square CHART_SQUARE_TAN with a square corner at (0, 0) (ref-layout.js checkerInk), the letter
//   band from +1 to +3 squares (backdrop.js drawLetterBand, the phase-3 drawing code).
// - Eye pills: projected HTML in #view-labels, bottom-centre of each panel, 8 px above its bottom.
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
} from 'three';
import { t } from '../../i18n/t.js';
import { REF_CLASS } from '../../engine/warp.js';
import { CHART_SQUARE_TAN, CHART_BAND_SQUARES, REF_DIVIDER_PX, gridTriangles } from './ref-layout.js';
import { INK, PAPER, canvasOf, drawLetterBand } from './backdrop.js';

/**
 * Chart texture extent in object tan: max class-1 |objTan| in the 39,2° disc over P0 G1 and G2 was
 * 1,5526, rounded up to 0,1 (04-P0-RESULTS.md, "Chart texture extent (input for 04-08)").
 */
export const CHART_EXTENT_TAN = 1.6;
/** Chart texture side (px), capped by the device limit (04-08 plan). */
const TEX_MAX_PX = 4096;
/** Letter pitch in squares: the phase-3 ratio 20 mm pitch / 12 mm cap height. */
const PITCH_SQUARES = 20 / 12;
/** UI-SPEC "Durchblick picture colours". */
const RIM_HEX = '#221e1c';
const NO_VIEW_HEX = '#f3f4f6';
const DIVIDER_HEX = '#6b6b6b';
const BACKGROUND_HEX = '#f3f4f6';
/** Eye pill gap above the panel bottom (CSS px, UI-SPEC). */
const PILL_GAP_PX = 8;
const PILL_KEY = { OD: 'view.ref.pill.od', OS: 'view.ref.pill.os' };

/** The chart canvas: paper, ink squares where i + j is even (ref-layout.js checkerInk), the letter band. */
function drawChart(size) {
  const { canvas, g } = canvasOf(size, size);
  const R = CHART_EXTENT_TAN;
  const S = CHART_SQUARE_TAN;
  const k = size / (2 * R);
  g.fillStyle = PAPER;
  g.fillRect(0, 0, size, size);
  g.fillStyle = INK;
  const n = Math.ceil(R / S);
  for (let i = -n; i < n; i++) {
    for (let j = -n; j < n; j++) {
      if (((i + j) & 1) !== 0) continue;
      // canvas y runs down from object tan +R
      const x0 = (i * S + R) * k;
      const y0 = (R - (j + 1) * S) * k;
      g.fillRect(x0, y0, S * k, S * k);
    }
  }
  const top = (R - CHART_BAND_SQUARES.to * S) * k;
  const bottom = (R - CHART_BAND_SQUARES.from * S) * k;
  drawLetterBand(g, { x: 0, y: top, w: size, h: bottom - top }, CHART_BAND_SQUARES.cap * S * k, PITCH_SQUARES * S * k);
  return canvas;
}

/**
 * @param {{ renderer: import('three').WebGLRenderer, labelsEl: HTMLElement }} o
 */
export function createRefraction({ renderer, labelsEl }) {
  const scene = new Scene();
  scene.background = new Color(BACKGROUND_HEX);
  const camera = new OrthographicCamera(0, 1, 1, 0, -1, 1);

  const size = Math.min(TEX_MAX_PX, renderer.capabilities.maxTextureSize);
  const chartTex = new CanvasTexture(drawChart(size));
  chartTex.colorSpace = SRGBColorSpace;
  chartTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const chartMat = new MeshBasicMaterial({ map: chartTex, toneMapped: false });
  const rimMat = new MeshBasicMaterial({ color: RIM_HEX, toneMapped: false });
  const noViewMat = new MeshBasicMaterial({ color: NO_VIEW_HEX, toneMapped: false });
  const dividerMat = new MeshBasicMaterial({ color: DIVIDER_HEX, toneMapped: false });
  const divider = new Mesh(new PlaneGeometry(1, 1), dividerMat);
  divider.visible = false;
  scene.add(divider);

  /** @type {Map<string, any>} panel id → grid state */
  const panels = new Map();
  let stage = { W: 0, H: 0 };
  let split = false;
  /** 'on' | 'off' */
  let lens = 'on';

  const pill = (eye) => {
    const el = document.createElement('span');
    el.className = 'view-label ref-pill';
    el.textContent = t(PILL_KEY[eye]);
    el.hidden = true;
    labelsEl.append(el);
    return el;
  };
  const pills = { OD: pill('OD'), OS: pill('OS') };
  // 04-09 (UI-SPEC States "One eye blocked"): the centred pill on the fill of a blocked eye's panel,
  // created on first use (no hidden extra nodes for users who never block an eye).
  /** @type {Record<string, HTMLElement>} */
  const blockedPills = {};
  const blockedPill = (eye) => {
    if (blockedPills[eye]) return blockedPills[eye];
    const el = document.createElement('span');
    el.className = 'view-label ref-pill ref-pill--blocked';
    el.classList.toggle('ref-pill--one', !split);
    el.textContent = t('view.ref.pill.blocked', { who: t(PILL_KEY[eye]) });
    el.hidden = true;
    labelsEl.append(el);
    return (blockedPills[eye] = el);
  };
  /** @type {Set<string>} panel ids drawn as the blocked fill */
  const blocked = new Set();

  function freePanel(s) {
    scene.remove(s.group);
    for (const g of s.geos) g.dispose();
  }

  /** Grid geometry of one panel, sized for the tier's cell (the warp grid has the same nx, ny). */
  function makePanel(p, cellPx) {
    const nx = Math.ceil(p.w / cellPx);
    const ny = Math.ceil(p.h / cellPx);
    const cellX = p.w / nx;
    const cellY = p.h / ny;
    const stride = nx + 1;
    const nv = stride * (ny + 1);
    const pos = new Float32Array(3 * nv);
    const eyeUv = new Float32Array(2 * nv);
    const R = CHART_EXTENT_TAN;
    const yBase = stage.H - p.y - p.h; // panel bottom in y-up stage px
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const v = j * stride + i;
        pos[3 * v] = p.x + i * cellX;
        pos[3 * v + 1] = yBase + j * cellY;
        // identity: object tan = eye tan of the grid point (warp.js warpGrid sample positions)
        eyeUv[2 * v] = ((i * cellX - p.w / 2) / p.pxPerTan + R) / (2 * R);
        eyeUv[2 * v + 1] = ((j * cellY - p.h / 2) / p.pxPerTan + R) / (2 * R);
      }
    }
    const posAttr = new BufferAttribute(pos, 3);
    const uvAttr = new BufferAttribute(new Float32Array(2 * nv), 2);
    uvAttr.setUsage(DynamicDrawUsage);
    const cells = nx * ny;
    const geo = () => {
      const g = new BufferGeometry();
      g.setAttribute('position', posAttr);
      g.setAttribute('uv', uvAttr);
      const index = new BufferAttribute(new Uint32Array(6 * cells), 1);
      index.setUsage(DynamicDrawUsage);
      g.setIndex(index);
      g.setDrawRange(0, 0);
      return g;
    };
    const chart = geo();
    const rim = geo();
    const noView = geo();
    const group = new Mesh(chart, chartMat);
    group.frustumCulled = false;
    for (const [g, m] of [
      [rim, rimMat],
      [noView, noViewMat],
    ]) {
      const mesh = new Mesh(g, m);
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    group.visible = false;
    scene.add(group);
    return { p, nx, ny, stride, nv, tri: gridTriangles(nx, ny), eyeUv, uvAttr, chart, rim, noView, geos: [chart, rim, noView], group, obj: null };
  }

  /** Write the uv attribute for the Bild toggle state (texture coords of object tan). */
  function writeUv(s) {
    const out = s.uvAttr.array;
    if (lens === 'off' || s.obj === null) out.set(s.eyeUv);
    else {
      const R = CHART_EXTENT_TAN;
      for (let i = 0; i < out.length; i++) out[i] = (s.obj[i] + R) / (2 * R);
    }
    s.uvAttr.needsUpdate = true;
  }

  const showDivider = () => {
    divider.visible = split && [...panels.values()].some((s) => s.group.visible);
  };

  return {
    /**
     * New stage size or panel layout (allocates the grids; drops every drawn picture).
     * @param {{ panels: Array<{ id: string, eye: 'OD'|'OS', x: number, y: number, w: number, h: number, pxPerTan: number }>, split: boolean }} layout
     * @param {{ W: number, H: number }} stageSize stage content box, CSS px
     * @param {number} cellPx the tier's cell (warp.js REF_GRID_TIERS)
     */
    setLayout(layout, stageSize, cellPx) {
      for (const s of panels.values()) freePanel(s);
      panels.clear();
      stage = { W: stageSize.W, H: stageSize.H };
      split = layout.split;
      camera.left = 0;
      camera.right = stage.W;
      camera.top = stage.H;
      camera.bottom = 0;
      camera.updateProjectionMatrix();
      for (const p of layout.panels) panels.set(p.id, makePanel(p, cellPx));
      if (split && layout.panels.length === 2) {
        const left = layout.panels[0];
        divider.scale.set(REF_DIVIDER_PX, stage.H, 1);
        divider.position.set(left.x + left.w + REF_DIVIDER_PX / 2, stage.H / 2, 0);
      }
      for (const el of [...Object.values(pills), ...Object.values(blockedPills)]) {
        el.classList.toggle('ref-pill--one', !split);
        el.hidden = true;
      }
      blocked.clear();
      showDivider();
    },
    /**
     * One panel's warp reply (T-04-31: the grid size and the array lengths must match the grid
     * allocated for this layout, else nothing is written).
     * @returns {boolean} drawn
     */
    setWarp(id, item) {
      const s = panels.get(id);
      if (!s || !item?.ok || item.nx !== s.nx || item.ny !== s.ny) return false;
      if (!(item.uv instanceof Float32Array) || item.uv.length !== 2 * s.nv) return false;
      if (!(item.cls instanceof Uint8Array) || item.cls.length !== s.nv) return false;
      const cls = item.cls;
      const lists = { chart: s.chart.index.array, rim: s.rim.index.array, noView: s.noView.index.array };
      const n = { chart: 0, rim: 0, noView: 0 };
      const { stride, tri } = s;
      for (let j = 0; j < s.ny; j++) {
        for (let i = 0; i < s.nx; i++) {
          const k = j * stride + i;
          const c0 = cls[k];
          const same = cls[k + 1] === c0 && cls[k + stride] === c0 && cls[k + stride + 1] === c0;
          const to = same && (c0 === REF_CLASS.LENS || c0 === REF_CLASS.PAST_RIM) ? 'chart' : same && c0 === REF_CLASS.NO_VIEW ? 'noView' : 'rim';
          const c = 6 * (j * s.nx + i);
          lists[to].set(tri.subarray(c, c + 6), n[to]);
          n[to] += 6;
        }
      }
      for (const key of /** @type {const} */ (['chart', 'rim', 'noView'])) {
        const g = s[key];
        g.index.needsUpdate = true;
        g.setDrawRange(0, n[key]);
      }
      s.obj = item.uv;
      writeUv(s);
      blocked.delete(id);
      s.group.visible = true;
      showDivider();
      return true;
    },
    /** A panel without a picture (no item, a failed item, leaving the Durchblick). */
    clearPanel(id) {
      const s = panels.get(id);
      if (!s) return;
      s.obj = null;
      s.group.visible = false;
      pills[s.p.eye].hidden = true;
      showDivider();
    },
    clear() {
      for (const id of panels.keys()) this.clearPanel(id);
      blocked.clear();
    },
    /** 04-09: a panel whose eye is not computed: the plain fill with the centred "nicht berechnet" pill. */
    setBlocked(id, on) {
      const s = panels.get(id);
      if (!s) return;
      if (on) {
        this.clearPanel(id);
        blocked.add(id);
      } else blocked.delete(id);
    },
    /** Bild toggle (D-02): 'off' = identity mapping on the same scale, same class mask. */
    setLens(next) {
      lens = next;
      for (const s of panels.values()) if (s.obj !== null) writeUv(s);
    },
    renderPass() {
      renderer.render(scene, camera);
    },
    /** After a render: the eye pills of the drawn panels, bottom-centre (CSSOM transform, no style attribute). */
    layoutPills() {
      for (const s of panels.values()) {
        const el = pills[s.p.eye];
        const show = s.group.visible;
        if (el.hidden === show) el.hidden = !show;
        if (!show) continue;
        const x = s.p.x + (s.p.w - el.offsetWidth) / 2;
        const y = s.p.y + s.p.h - PILL_GAP_PX - el.offsetHeight;
        const tf = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        if (el.style.transform !== tf) el.style.transform = tf;
      }
      const shownBlocked = new Set();
      for (const id of blocked) {
        const s = panels.get(id);
        if (!s) continue;
        const el = blockedPill(s.p.eye);
        shownBlocked.add(el);
        if (el.hidden) el.hidden = false;
        const x = s.p.x + (s.p.w - el.offsetWidth) / 2;
        const y = s.p.y + (s.p.h - el.offsetHeight) / 2;
        const tf = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        if (el.style.transform !== tf) el.style.transform = tf;
      }
      for (const el of Object.values(blockedPills)) if (!shownBlocked.has(el) && !el.hidden) el.hidden = true;
    },
    hidePills() {
      for (const el of [...Object.values(pills), ...Object.values(blockedPills)]) el.hidden = true;
      blocked.clear();
    },
    /** Context restore (Pitfall 7): re-upload the chart canvas and the grid buffers. */
    reupload() {
      chartTex.needsUpdate = true;
      for (const s of panels.values()) {
        s.uvAttr.needsUpdate = true;
        for (const g of s.geos) {
          g.index.needsUpdate = true;
          g.getAttribute('position').needsUpdate = true;
        }
      }
    },
    dispose() {
      for (const s of panels.values()) freePanel(s);
      panels.clear();
      divider.geometry.dispose();
      for (const m of [chartMat, rimMat, noViewMat, dividerMat]) m.dispose();
      chartTex.dispose();
      for (const el of [...Object.values(pills), ...Object.values(blockedPills)]) el.remove();
    },
  };
}
