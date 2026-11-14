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
// - Class mask: a cell whose four corners share class 1 (lens) or 5 (past the rim) is chart, class 3
//   the flat "kein Durchblick" fill, class 2 / 4 the flat rim colour. 04-09 (D-12 (f), T-04-36): a
//   cell whose corners differ is drawn from the engine quadtree leaves instead, one flat quad per
//   leaf with the class and the uv of its own centre ray (classes 1 / 5 textured, 2 / 4 rim, 3 the
//   fill), so no chart is ever interpolated across a class boundary and the rim sits exactly where
//   the engine classes put it. Never a chart where no ray passes (T-04-32).
// - "Kein Durchblick" zones (class 3) of at least 48 x 24 px get the pill view.ref.noView.
// - Reference ticks (04-09, UI-SPEC "Reference ticks"): svg#view-ref-ticks in #view-labels, one <g>
//   per panel, SVG presentation attributes only (CSP: no inline style attribute), built on a layout
//   change only, positions from ref-layout.js tickPositions (panel centre and pxPerTan); a panel's
//   ticks show while it shows a picture; N11 hides a tick whose sample point lies on the rim.
// - Bild toggle: 'off' writes the identity uv (object tan = eye tan of each grid point) and keeps
//   the class mask, so only the chart moves in the blink (N2).
// - Chart (D-08): one canvas texture in object-tan space over |tan| ≤ CHART_EXTENT_TAN; checker
//   square CHART_SQUARE_TAN with a square corner at (0, 0) (ref-layout.js checkerInk), the letter
//   band from +1 to +3 squares (backdrop.js drawLetterBand, the phase-3 drawing code).
// - Eye pills: projected HTML in #view-labels, bottom-centre of each panel, 8 px above its bottom.
//   04-11 (D-11a): one pill per panel id, so the A/B panels (both the compared eye) read
//   "Vorher (A)" / "Nachher (B)"; the centred status pill of a panel carries its own text (the
//   "nicht berechnet" pill, or the first-picture status while configuration A computes).
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
import { CHART_SQUARE_TAN, CHART_BAND_SQUARES, REF_DIVIDER_PX, gridTriangles, tickPositions, tickVisible, TICK_LEN_PX } from './ref-layout.js';
import { INK, PAPER, canvasOf, drawLetterBand } from './backdrop.js';
import { refChartPx } from './tiers.js';

/**
 * Chart texture extent in object tan: max class-1 |objTan| in the 39,2° disc over P0 G1 and G2 was
 * 1,5526, rounded up to 0,1 (04-P0-RESULTS.md, "Chart texture extent (input for 04-08)").
 */
export const CHART_EXTENT_TAN = 1.6;
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
/** The pill label of a panel: its variant in A/B (04-11), else its eye. */
const pillKeyOf = (p) => (p.id === 'A' ? 'view.ref.who.a' : p.id === 'B' ? 'view.ref.who.b' : PILL_KEY[p.eye]);
/** Tick strokes (UI-SPEC colour table). N4: the white under-stroke is 6 px, not 4: at device pixel ratio 1 the 1 px halo of a 4 px stroke was hard to see on the black squares (04-09 DPR check). */
const TICK_UNDER = Object.freeze({ color: '#ffffff', width: 6 });
const TICK_CORE = Object.freeze({ color: '#1a1a1a', width: 2 });
/** A class-3 zone gets the noView pill from this size (CSS px, UI-SPEC). */
const NO_VIEW_PILL_MIN = Object.freeze({ w: 48, h: 24 });
/** Initial leaf capacity per panel (grown by doubling, the old geometry is disposed). */
const LEAF_CAP0 = 2048;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** One flat quad per leaf: 4 vertices, two triangles sw-se-ne, sw-ne-nw (the CELL_DIAGONAL split). */
function makeLeafGeometry(cap) {
  const g = new BufferGeometry();
  const pos = new BufferAttribute(new Float32Array(12 * cap), 3);
  pos.setUsage(DynamicDrawUsage);
  const uv = new BufferAttribute(new Float32Array(8 * cap), 2);
  uv.setUsage(DynamicDrawUsage);
  const idx = new Uint32Array(6 * cap);
  for (let q = 0; q < cap; q++) {
    const b = 4 * q;
    idx.set([b, b + 1, b + 3, b, b + 3, b + 2], 6 * q);
  }
  g.setAttribute('position', pos);
  g.setAttribute('uv', uv);
  g.setIndex(new BufferAttribute(idx, 1));
  g.setDrawRange(0, 0);
  return g;
}

/** An SVG element with presentation attributes. */
function svgEl(name, attrs) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

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
 * @param {{ renderer: import('three').WebGLRenderer, labelsEl: HTMLElement, startTier: 'fein' | 'mittel' | 'grob' }} o
 *   startTier: the device's Durchblick grid start tier (ref-mode.js deviceStartTier); it sets the
 *   chart texture side (tiers.js refChartPx, 04-16).
 */
export function createRefraction({ renderer, labelsEl, startTier }) {
  const scene = new Scene();
  scene.background = new Color(BACKGROUND_HEX);
  const camera = new OrthographicCamera(0, 1, 1, 0, -1, 1);

  const size = refChartPx(startTier, renderer.capabilities.maxTextureSize);
  // 04-16: the source canvas is kept on purpose. three.js r187 holds the only CPU copy in
  // texture.image, and after webglcontextrestored it re-uploads every texture from that image
  // (WebGLTextures.setTexture2D warns "no image data found" and draws nothing when it is null);
  // reupload() below relies on the same image.
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

  // The pills per panel id ('L', 'R', 'A', 'B'), created on first use.
  /** @type {Record<string, HTMLElement>} */
  const pills = {};
  const pillOf = (p) => {
    if (pills[p.id]) return pills[p.id];
    const el = document.createElement('span');
    el.className = 'view-label ref-pill';
    el.classList.toggle('ref-pill--one', !split);
    el.textContent = t(pillKeyOf(p));
    el.hidden = true;
    labelsEl.append(el);
    return (pills[p.id] = el);
  };
  // 04-09 (UI-SPEC States "One eye blocked"): the centred pill on the fill of a blocked eye's panel,
  // created on first use (no hidden extra nodes for users who never block an eye).
  /** @type {Record<string, HTMLElement>} */
  const blockedPills = {};
  const blockedPill = (id) => {
    if (blockedPills[id]) return blockedPills[id];
    const el = document.createElement('span');
    el.className = 'view-label ref-pill ref-pill--blocked';
    el.classList.toggle('ref-pill--one', !split);
    el.hidden = true;
    labelsEl.append(el);
    return (blockedPills[id] = el);
  };
  /** @type {Map<string, string>} panel id → the text of its centred pill (drawn as the plain fill) */
  const blocked = new Map();
  /** 04-09: "hier kein Durchblick" pills, pooled. */
  /** @type {HTMLElement[]} */
  const noViewPills = [];
  const noViewPill = (i) => {
    if (noViewPills[i]) return noViewPills[i];
    const el = document.createElement('span');
    el.className = 'view-label ref-pill ref-pill--noview';
    el.textContent = t('view.ref.noView');
    el.hidden = true;
    labelsEl.append(el);
    return (noViewPills[i] = el);
  };
  // 04-09: the reference ticks, under every pill (first child of #view-labels).
  const ticksSvg = svgEl('svg', { id: 'view-ref-ticks', display: 'none', focusable: 'false' });
  labelsEl.prepend(ticksSvg);

  function freePanel(s) {
    scene.remove(s.group);
    for (const g of s.geos) g.dispose();
    s.leaf.mesh.geometry.dispose();
  }

  /** The panel's ticks (built on a layout change only; hidden until the panel shows a picture). */
  function makeTicks(p) {
    const g = svgEl('g', { 'data-panel': p.id, display: 'none' });
    const list = [];
    const L = TICK_LEN_PX;
    for (const tk of tickPositions(p)) {
      const [x1, y1, x2, y2] =
        tk.edge === 'top'
          ? [tk.x, tk.y, tk.x, tk.y + L]
          : tk.edge === 'bottom'
            ? [tk.x, tk.y, tk.x, tk.y - L]
            : tk.edge === 'left'
              ? [tk.x, tk.y, tk.x + L, tk.y]
              : [tk.x, tk.y, tk.x - L, tk.y];
      const el = svgEl('g', { class: 'ref-tick', 'data-edge': tk.edge, 'data-n': tk.n });
      for (const st of [TICK_UNDER, TICK_CORE]) {
        el.append(svgEl('line', { x1, y1, x2, y2, stroke: st.color, 'stroke-width': st.width, 'stroke-linecap': 'butt' }));
      }
      g.append(el);
      list.push({ tick: tk, el });
    }
    ticksSvg.append(g);
    return { g, list };
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
    // 04-09: the leaves of the mixed cells, one geometry with three groups (chart, rim, noView).
    const leafMesh = new Mesh(makeLeafGeometry(LEAF_CAP0), [chartMat, rimMat, noViewMat]);
    leafMesh.frustumCulled = false;
    group.add(leafMesh);
    group.visible = false;
    scene.add(group);
    const leaf = { mesh: leafMesh, cap: LEAF_CAP0, n: 0, nChart: 0, objUv: new Float32Array(2 * LEAF_CAP0), eyeUv: new Float32Array(2 * LEAF_CAP0) };
    return {
      p,
      nx,
      ny,
      stride,
      nv,
      tri: gridTriangles(nx, ny),
      eyeUv,
      uvAttr,
      chart,
      rim,
      noView,
      geos: [chart, rim, noView],
      group,
      obj: null,
      leaf,
      ticks: makeTicks(p),
      zones: [],
    };
  }

  /** Leaf uv for the Bild toggle: object tan of the leaf's centre ray, or its eye tan ('off'). */
  function writeLeafUv(s) {
    const { leaf } = s;
    const uv = /** @type {BufferAttribute} */ (leaf.mesh.geometry.getAttribute('uv'));
    const out = uv.array;
    const src = lens === 'off' ? leaf.eyeUv : leaf.objUv;
    const R = CHART_EXTENT_TAN;
    for (let q = 0; q < leaf.nChart; q++) {
      const u = (src[2 * q] + R) / (2 * R);
      const v = (src[2 * q + 1] + R) / (2 * R);
      for (let k = 0; k < 4; k++) {
        out[8 * q + 2 * k] = u;
        out[8 * q + 2 * k + 1] = v;
      }
    }
    uv.needsUpdate = true;
  }

  /**
   * The quadtree leaves of one reply (warp.js warpGrid: [x0, y0, size, cls, u, v] in panel px, leaf
   * height = size * cellY / cellX). Grouped by drawing class; each quad is flat in class and uv.
   */
  function writeLeaves(s, item) {
    const L = item.leafCount;
    const lv = item.leaves;
    const { leaf, p } = s;
    if (L > leaf.cap) {
      const cap = Math.max(L, 2 * leaf.cap);
      leaf.mesh.geometry.dispose();
      leaf.mesh.geometry = makeLeafGeometry(cap);
      leaf.cap = cap;
      leaf.objUv = new Float32Array(2 * cap);
      leaf.eyeUv = new Float32Array(2 * cap);
    }
    const isChart = (c) => c === REF_CLASS.LENS || c === REF_CLASS.PAST_RIM;
    const isRim = (c) => c === REF_CLASS.EDGE_BAND || c === REF_CLASS.RIM_FACE;
    let nChart = 0;
    let nRim = 0;
    for (let l = 0; l < L; l++) {
      const c = lv[6 * l + 3];
      if (isChart(c)) nChart++;
      else if (isRim(c)) nRim++;
    }
    const next = [0, nChart, nChart + nRim];
    const geo = leaf.mesh.geometry;
    const posAttr = /** @type {BufferAttribute} */ (geo.getAttribute('position'));
    const pos = posAttr.array;
    const aspect = item.cellY / item.cellX;
    const yBase = stage.H - p.y - p.h;
    const P = p.pxPerTan;
    for (let l = 0; l < L; l++) {
      const o = 6 * l;
      const x0 = lv[o];
      const y0 = lv[o + 1];
      const w = lv[o + 2];
      const h = w * aspect;
      const c = lv[o + 3];
      const gi = isChart(c) ? 0 : isRim(c) ? 1 : 2;
      const q = next[gi]++;
      const X0 = p.x + x0;
      const Y0 = yBase + y0;
      pos.set([X0, Y0, 0, X0 + w, Y0, 0, X0, Y0 + h, 0, X0 + w, Y0 + h, 0], 12 * q);
      if (gi === 0) {
        leaf.objUv[2 * q] = lv[o + 4];
        leaf.objUv[2 * q + 1] = lv[o + 5];
        leaf.eyeUv[2 * q] = (x0 + w / 2 - p.w / 2) / P;
        leaf.eyeUv[2 * q + 1] = (y0 + h / 2 - p.h / 2) / P;
      }
    }
    geo.clearGroups();
    geo.addGroup(0, 6 * nChart, 0);
    geo.addGroup(6 * nChart, 6 * nRim, 1);
    geo.addGroup(6 * (nChart + nRim), 6 * (L - nChart - nRim), 2);
    geo.setDrawRange(0, 6 * L);
    posAttr.needsUpdate = true;
    leaf.n = L;
    leaf.nChart = nChart;
    writeLeafUv(s);
  }

  /** Class-3 zones (4-connected grid points) of at least NO_VIEW_PILL_MIN: their centres (stage px, y down). */
  function noViewZones(s, item) {
    const { nx, ny, stride, p } = s;
    const cls = item.cls;
    const seen = new Uint8Array(cls.length);
    const out = [];
    const steps = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (let k0 = 0; k0 < cls.length; k0++) {
      if (seen[k0] || cls[k0] !== REF_CLASS.NO_VIEW) continue;
      let iMin = Infinity;
      let iMax = -Infinity;
      let jMin = Infinity;
      let jMax = -Infinity;
      const stack = [k0];
      seen[k0] = 1;
      while (stack.length) {
        const k = /** @type {number} */ (stack.pop());
        const i = k % stride;
        const j = (k - i) / stride;
        iMin = Math.min(iMin, i);
        iMax = Math.max(iMax, i);
        jMin = Math.min(jMin, j);
        jMax = Math.max(jMax, j);
        for (const [di, dj] of steps) {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || a > nx || b < 0 || b > ny) continue;
          const kk = b * stride + a;
          if (!seen[kk] && cls[kk] === REF_CLASS.NO_VIEW) {
            seen[kk] = 1;
            stack.push(kk);
          }
        }
      }
      const w = (iMax - iMin) * item.cellX;
      const h = (jMax - jMin) * item.cellY;
      if (w >= NO_VIEW_PILL_MIN.w && h >= NO_VIEW_PILL_MIN.h) {
        out.push({ x: p.x + ((iMin + iMax) / 2) * item.cellX, y: p.y + p.h - ((jMin + jMax) / 2) * item.cellY });
      }
    }
    return out;
  }

  /** N11: per tick, hidden when its sample point lies on the rim face or edge band of this warp. */
  function showTicks(s, item) {
    for (const { tick, el } of s.ticks.list) {
      if (tickVisible(item, s.p, tick)) el.removeAttribute('display');
      else el.setAttribute('display', 'none');
    }
    s.ticks.g.removeAttribute('display');
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
      ticksSvg.replaceChildren();
      stage = { W: stageSize.W, H: stageSize.H };
      ticksSvg.setAttribute('width', String(stage.W));
      ticksSvg.setAttribute('height', String(stage.H));
      ticksSvg.removeAttribute('display');
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
      if (!(Number.isInteger(item.leafCount) && item.leafCount >= 0)) return false;
      if (!(item.leaves instanceof Float32Array) || item.leaves.length !== 6 * item.leafCount) return false;
      const cls = item.cls;
      const lists = { chart: s.chart.index.array, rim: s.rim.index.array, noView: s.noView.index.array };
      const n = { chart: 0, rim: 0, noView: 0 };
      const { stride, tri } = s;
      for (let j = 0; j < s.ny; j++) {
        for (let i = 0; i < s.nx; i++) {
          const k = j * stride + i;
          const c0 = cls[k];
          // A mixed cell is drawn from its leaves (writeLeaves), never from the grid interpolant.
          if (cls[k + 1] !== c0 || cls[k + stride] !== c0 || cls[k + stride + 1] !== c0) continue;
          const to = c0 === REF_CLASS.LENS || c0 === REF_CLASS.PAST_RIM ? 'chart' : c0 === REF_CLASS.NO_VIEW ? 'noView' : 'rim';
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
      writeLeaves(s, item);
      s.zones = noViewZones(s, item);
      showTicks(s, item);
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
      s.zones = [];
      s.ticks.g.setAttribute('display', 'none');
      if (pills[id]) pills[id].hidden = true;
      showDivider();
    },
    clear() {
      for (const id of panels.keys()) this.clearPanel(id);
      blocked.clear();
    },
    /**
     * 04-09: a panel whose eye is not computed: the plain fill with the centred "nicht berechnet"
     * pill. 04-11: `text` = that pill's text (default: the panel's own "nicht berechnet").
     * @param {string} id @param {boolean} on @param {string} [text]
     */
    setBlocked(id, on, text) {
      const s = panels.get(id);
      if (!s) return;
      if (on) {
        this.clearPanel(id);
        blocked.set(id, text ?? t('view.ref.pill.blocked', { who: t(pillKeyOf(s.p)) }));
      } else blocked.delete(id);
    },
    /** 04-11: the panel shows a drawn picture (kept while configuration A recomputes). */
    hasPicture: (id) => Boolean(panels.get(id)?.group.visible),
    /** Bild toggle (D-02): 'off' = identity mapping on the same scale, same class mask. */
    setLens(next) {
      lens = next;
      for (const s of panels.values()) {
        if (s.obj === null) continue;
        writeUv(s);
        writeLeafUv(s);
      }
    },
    renderPass() {
      renderer.render(scene, camera);
    },
    /** After a render: the eye pills of the drawn panels, bottom-centre (CSSOM transform, no style attribute). */
    layoutPills() {
      for (const s of panels.values()) {
        const el = pillOf(s.p);
        const show = s.group.visible;
        if (el.hidden === show) el.hidden = !show;
        if (!show) continue;
        const x = s.p.x + (s.p.w - el.offsetWidth) / 2;
        const y = s.p.y + s.p.h - PILL_GAP_PX - el.offsetHeight;
        const tf = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        if (el.style.transform !== tf) el.style.transform = tf;
      }
      const shownBlocked = new Set();
      for (const [id, text] of blocked) {
        const s = panels.get(id);
        if (!s) continue;
        const el = blockedPill(id);
        if (el.textContent !== text) el.textContent = text;
        shownBlocked.add(el);
        if (el.hidden) el.hidden = false;
        const x = s.p.x + (s.p.w - el.offsetWidth) / 2;
        const y = s.p.y + (s.p.h - el.offsetHeight) / 2;
        const tf = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        if (el.style.transform !== tf) el.style.transform = tf;
      }
      for (const el of Object.values(blockedPills)) if (!shownBlocked.has(el) && !el.hidden) el.hidden = true;
      let z = 0;
      for (const s of panels.values()) {
        if (!s.group.visible) continue;
        for (const zone of s.zones) {
          const el = noViewPill(z++);
          if (el.hidden) el.hidden = false;
          const tf = `translate(${(zone.x - el.offsetWidth / 2).toFixed(1)}px, ${(zone.y - el.offsetHeight / 2).toFixed(1)}px)`;
          if (el.style.transform !== tf) el.style.transform = tf;
        }
      }
      for (let i = z; i < noViewPills.length; i++) if (!noViewPills[i].hidden) noViewPills[i].hidden = true;
    },
    hidePills() {
      for (const el of [...Object.values(pills), ...Object.values(blockedPills), ...noViewPills]) el.hidden = true;
      blocked.clear();
      ticksSvg.setAttribute('display', 'none');
    },
    /** Test handle (04-16): the chart canvas size and the device limit. */
    chartInfo: () => ({ w: chartTex.image.width, h: chartTex.image.height, maxTextureSize: renderer.capabilities.maxTextureSize }),
    /** Context restore (Pitfall 7): re-upload the chart canvas and the grid buffers. */
    reupload() {
      chartTex.needsUpdate = true;
      for (const s of panels.values()) {
        s.uvAttr.needsUpdate = true;
        for (const g of [...s.geos, s.leaf.mesh.geometry]) {
          g.index.needsUpdate = true;
          g.getAttribute('position').needsUpdate = true;
          g.getAttribute('uv').needsUpdate = true;
        }
      }
    },
    dispose() {
      for (const s of panels.values()) freePanel(s);
      panels.clear();
      divider.geometry.dispose();
      for (const m of [chartMat, rimMat, noViewMat, dividerMat]) m.dispose();
      chartTex.dispose();
      for (const el of [...Object.values(pills), ...Object.values(blockedPills), ...noViewPills]) el.remove();
      ticksSvg.remove();
    },
  };
}
