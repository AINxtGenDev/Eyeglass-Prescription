// P0 feasibility trace (04-03 Task 3, UI-SPEC "Planner prerequisite P0"). One-off Node script
// on the PRODUCTION engine only (trace.js traceFromEye through warp.js classifyDirection; no
// scratch copy of the optics). Writes .planning/phases/04-refraction-view-offline/04-P0-RESULTS.md
// and prints progress to stderr. Exit code 1 on STOP (field or tier rule cannot be met).
//
//   node scripts/p0-feasibility.mjs > /dev/null
//
// The measurement helpers (drawn interpolant, boundary error, edge-midpoint shift, tick offset)
// repeat the definitions in src/engine/warp.test.js on purpose: this script is a one-off whose
// output is committed; the CI subset in warp.test.js is what keeps the numbers enforced.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { evaluateLens } from '../src/engine/evaluate.js';
import { traceFromEye, TRACE_STATUS } from '../src/engine/trace.js';
import { REF_CLASS, REF_GRID_TIERS, prepareWarp, classifyDirection, warpGrid } from '../src/engine/warp.js';
import { EYE_POINT_MM } from '../src/engine/magnification.js';
import { MATERIALS } from '../src/engine/materials.js';
import { SHAPES } from '../src/engine/frame/shapes.js';
import { NORMAL_PAIR, GRENZFALL_PAIR, medianOf, tailOf } from '../src/state/bench-cases.js';

const OUT = fileURLToPath(new URL('../.planning/phases/04-refraction-view-offline/04-P0-RESULTS.md', import.meta.url));
const T_START = performance.now();
const log = (...a) => console.error(...a);
const lines = [];
const w = (s = '') => lines.push(s);
const de = (v, d = 2) => v.toFixed(d).replace('.', ',').replace('-', '−');

// --- Step 0 input: measured #view-stage content boxes (scripts/measure-stages.mjs, production
// preview of commit 4dd2dfd, 2026-11-13; table pasted into the results file below).
const MEASURED = [
  { vp: '412 × 915', where: 'in page', stage: [380, 285], panel: [189, 285], two: true },
  { vp: '412 × 915', where: 'fullscreen', stage: [412, 915], panel: [205, 915], two: true },
  { vp: '320 × 640', where: 'in page', stage: [288, 216], panel: [288, 216], two: false },
  { vp: '320 × 640', where: 'fullscreen', stage: [320, 640], panel: [320, 640], two: false },
  { vp: '1164 × 593', where: 'in page', stage: [398, 248.75], panel: [198, 248.75], two: true },
  { vp: '1164 × 593', where: 'fullscreen', stage: [1164, 593], panel: [581, 593], two: true },
  { vp: '1280 × 800', where: 'in page', stage: [542, 338.75], panel: [270, 338.75], two: true },
  { vp: '1280 × 800', where: 'fullscreen', stage: [1280, 800], panel: [639, 800], two: true },
  { vp: '1024 × 768', where: 'in page (400 px column)', stage: [398, 248.75], panel: [198, 248.75], two: true },
  { vp: '1024 × 768', where: 'fullscreen', stage: [1024, 768], panel: [511, 768], two: true },
];

const SQ_TAN = Math.tan((6 * Math.PI) / 180);
const tanOf = (deg) => Math.tan((deg * Math.PI) / 180);
const panelOf = ([wPx, hPx], half = 30) => ({ wPx, hPx, pxPerTan: Math.max(wPx, hPx) / (2 * tanOf(half)) });

// --- the grids (UI-SPEC P0) ---------------------------------------------------------------------
const MATS = Object.keys(MATERIALS);
const SHAPE_IDS = Object.keys(SHAPES);
const BASE_CURVES = [null, 0, 10];
const DEFAULT_FRAME = { shape: 'rechteckig', A: 52, B: 38, DBL: 18 };
const specOf = (o) => ({
  eye: 'OD',
  sph: 0,
  cyl: 0,
  axisDeg: 0,
  materialId: 'cr39',
  frame: DEFAULT_FRAME,
  monoPD: 32,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
  ...o,
});

function* g1() {
  for (let sph = -12; sph <= 12; sph++) {
    for (let cyl = 0; cyl >= -6; cyl--) {
      for (const axisDeg of cyl === 0 ? [0] : [0, 30, 90, 135]) {
        for (const materialId of MATS) {
          for (const baseCurve of BASE_CURVES) {
            for (const eye of ['OD', 'OS']) yield specOf({ sph, cyl, axisDeg, materialId, baseCurve, eye });
          }
        }
      }
    }
  }
}

const G2_CYL = [
  [0, 0],
  [-3, 30],
  [-3, 135],
  [-6, 0],
  [-6, 90],
];
const G2_BOX = [
  [40, 28],
  [52, 38],
  [62, 55],
];
function* g2() {
  for (const sph of [-12, -8, -4, 0, 4, 8, 12]) {
    for (const [cyl, axisDeg] of G2_CYL) {
      for (const materialId of MATS) {
        for (const baseCurve of BASE_CURVES) {
          for (const shape of SHAPE_IDS) {
            for (const [A, B] of G2_BOX) {
              for (const DBL of [14, 24]) {
                for (const monoPD of [25, 32, 40]) {
                  for (const eye of ['OD', 'OS']) {
                    yield specOf({ sph, cyl, axisDeg, materialId, baseCurve, frame: { shape, A, B, DBL }, monoPD, eye });
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

const sgn = (v) => (v > 0 ? `+${de(v)}` : v === 0 ? '0,00' : de(v));
const label = (s) =>
  `${s.frame.shape} ${s.frame.A}×${s.frame.B}/${s.frame.DBL} PD ${s.monoPD}, ${s.materialId}, ` +
  `BC ${s.baseCurve ?? 'auto'}, ${sgn(s.sph)}${s.cyl ? ` / ${de(s.cyl)} × ${s.axisDeg}` : ''}, ${s.eye}`;

/** Polar direction grid within tan radius r: centre + rings × spokes. */
function directions(rings, spokes, r) {
  const d = [[0, 0]];
  for (let k = 1; k <= rings; k++) {
    for (let s = 0; s < spokes; s++) {
      const a = (2 * Math.PI * s) / spokes;
      d.push([((r * k) / rings) * Math.cos(a), ((r * k) / rings) * Math.sin(a)]);
    }
  }
  return d;
}

/** M = J⁻¹ of classifyDirection at (x, y); null unless all four samples are class 1. */
function localM(ctx, x, y, e = 1e-4) {
  const s = [
    [x + e, y],
    [x - e, y],
    [x, y + e],
    [x, y - e],
  ].map(([a, b]) => classifyDirection(ctx, a, b));
  if (!s.every((r) => r.cls === REF_CLASS.LENS)) return null;
  const j11 = (s[0].objTan[0] - s[1].objTan[0]) / (2 * e);
  const j21 = (s[0].objTan[1] - s[1].objTan[1]) / (2 * e);
  const j12 = (s[2].objTan[0] - s[3].objTan[0]) / (2 * e);
  const j22 = (s[2].objTan[1] - s[3].objTan[1]) / (2 * e);
  const det = j11 * j22 - j12 * j21;
  return [
    [j22 / det, -j12 / det],
    [-j21 / det, j11 / det],
  ];
}

const eigSym = (M) => {
  const a = M[0][0];
  const d = M[1][1];
  const b = (M[0][1] + M[1][0]) / 2;
  const h = (a + d) / 2;
  const disc = Math.sqrt(Math.max(0, ((a - d) / 2) ** 2 + b * b));
  return [h - disc, h + disc];
};

/** Run one grid at the given disc radius; returns the summary. */
function runGrid(name, gen, rings, spokes, rDisc) {
  const dirs = directions(rings, spokes, rDisc);
  const t30 = tanOf(30);
  const az = Array.from({ length: 8 }, (_, k) => (k * Math.PI) / 4);
  const sum = {
    name,
    rings,
    spokes,
    rDisc,
    cases: 0,
    accepted: 0,
    rejected: 0,
    rejectedCodes: {},
    rays: 0,
    crit1: [],
    crit2: [],
    crit4Max: 0,
    crit4Worst: null,
    crit4Fail: [],
    crit4NA: 0,
    rim: [],
    rimEdge: 0,
    rimFace: 0,
    rimPast: 0,
    maxObjTan: 0,
    maxObjTanCase: null,
    ls: { radMin: [Infinity, null], radMax: [-Infinity, null], tanMin: [Infinity, null], tanMax: [-Infinity, null] },
    lsNA: 0,
  };
  for (const s of gen()) {
    sum.cases++;
    if (sum.cases % 10000 === 0) log(`${name}: ${sum.cases} cases`);
    const lens = evaluateLens(s);
    if (!lens.ok) {
      sum.rejected++;
      const code = lens.diagnostics[0]?.code ?? '?';
      sum.rejectedCodes[code] = (sum.rejectedCodes[code] ?? 0) + 1;
      continue;
    }
    sum.accepted++;
    const ctx = prepareWarp({ surfaces: lens.surfaces, frame: s.frame, eye: s.eye, hMm: EYE_POINT_MM });
    let c1 = 0;
    let c2 = 0;
    const seen = new Set();
    for (const [x, y] of dirs) {
      sum.rays++;
      const r = classifyDirection(ctx, x, y);
      seen.add(r.cls);
      if (r.cls === REF_CLASS.NO_VIEW) {
        const t = traceFromEye(lens.surfaces, EYE_POINT_MM, -x, y);
        if (t.status !== TRACE_STATUS.OK) c1++;
        else c2++;
      } else if (r.cls === REF_CLASS.LENS) {
        const m = Math.hypot(r.objTan[0], r.objTan[1]);
        if (m > sum.maxObjTan) {
          sum.maxObjTan = m;
          sum.maxObjTanCase = label(s);
        }
      }
    }
    if (c1) sum.crit1.push(`${label(s)}: ${c1} rays`);
    if (c2) sum.crit2.push(`${label(s)}: ${c2} rays`);
    const rimHere = seen.has(2) || seen.has(4) || seen.has(5);
    if (rimHere) {
      sum.rim.push(label(s));
      if (seen.has(2)) sum.rimEdge++;
      if (seen.has(4)) sum.rimFace++;
      if (seen.has(5)) sum.rimPast++;
    }
    // criterion 4: paraxial eigenvalues vs LensResult.magnification, both principal meridians
    sum.rays += 4;
    const M0 = localM(ctx, 0, 0);
    if (M0 === null) sum.crit4NA++;
    else {
      const eig = eigSym(M0);
      const sm = lens.magnification.meridians.map((m) => m.sm).sort((a, b) => a - b);
      if (sm.length === 1) sm.push(sm[0]);
      const dev = Math.max(Math.abs(eig[0] - sm[0]), Math.abs(eig[1] - sm[1]));
      if (dev > sum.crit4Max) {
        sum.crit4Max = dev;
        sum.crit4Worst = label(s);
      }
      if (dev > 0.0005) sum.crit4Fail.push(`${label(s)}: ${de(dev * 100, 4)} pp`);
    }
    // criterion 3: local size change at 30° (radial, tangential), 8 azimuths
    for (const a of az) {
      sum.rays += 4;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const M = localM(ctx, t30 * ux, t30 * uy);
      if (M === null) {
        sum.lsNA++;
        continue;
      }
      const rad = ux * (M[0][0] * ux + M[0][1] * uy) + uy * (M[1][0] * ux + M[1][1] * uy) - 1;
      const tng = -uy * (M[0][0] * -uy + M[0][1] * ux) + ux * (M[1][0] * -uy + M[1][1] * ux) - 1;
      const L = label(s);
      if (rad < sum.ls.radMin[0]) sum.ls.radMin = [rad, L];
      if (rad > sum.ls.radMax[0]) sum.ls.radMax = [rad, L];
      if (tng < sum.ls.tanMin[0]) sum.ls.tanMin = [tng, L];
      if (tng > sum.ls.tanMax[0]) sum.ls.tanMax = [tng, L];
    }
  }
  return sum;
}

// --- measurement helpers (same definitions as warp.test.js) ------------------------------------
const tanAt = (panel, x, y) => [(x - panel.wPx / 2) / panel.pxPerTan, (y - panel.hPx / 2) / panel.pxPerTan];

function drawnInterp(g, x, y) {
  const i = Math.min(Math.floor(x / g.cellX), g.nx - 1);
  const j = Math.min(Math.floor(y / g.cellY), g.ny - 1);
  const fx = x / g.cellX - i;
  const fy = y / g.cellY - j;
  const at = (a, b, c) => g.uv[2 * ((j + b) * (g.nx + 1) + i + a) + c];
  const out = [0, 0];
  for (let c = 0; c < 2; c++) {
    const sw = at(0, 0, c);
    const se = at(1, 0, c);
    const ne = at(1, 1, c);
    const nw = at(0, 1, c);
    out[c] = fx >= fy ? sw + fx * (se - sw) + fy * (ne - se) : sw + fy * (nw - sw) + fx * (ne - nw);
  }
  return out;
}

function edgeInterpErrorPx(ctx, panel, g) {
  let worst = 0;
  const cells = new Set();
  for (let i = 0; i < g.nx; i++) cells.add(`${i},0`).add(`${i},${g.ny - 1}`);
  for (let j = 0; j < g.ny; j++) cells.add(`0,${j}`).add(`${g.nx - 1},${j}`);
  for (const key of cells) {
    const [i, j] = key.split(',').map(Number);
    const corners = [0, 1, g.nx + 1, g.nx + 2].map((d) => g.cls[j * (g.nx + 1) + i + d]);
    if (!corners.every((c) => c === REF_CLASS.LENS)) continue;
    for (const [fx, fy] of [
      [2 / 3, 1 / 3],
      [1 / 3, 2 / 3],
      [0.5, 0.5],
    ]) {
      const x = (i + fx) * g.cellX;
      const y = (j + fy) * g.cellY;
      const exact = classifyDirection(ctx, ...tanAt(panel, x, y));
      if (exact.cls !== REF_CLASS.LENS) continue;
      const d = drawnInterp(g, x, y);
      worst = Math.max(worst, Math.hypot(d[0] - exact.objTan[0], d[1] - exact.objTan[1]) * panel.pxPerTan);
    }
  }
  return worst;
}

function drawnClassOnCentreLine(g, panel, x) {
  const y = panel.hPx / 2;
  const i = Math.min(Math.floor(x / g.cellX), g.nx - 1);
  const j = Math.min(Math.floor(y / g.cellY), g.ny - 1);
  const k = j * (g.nx + 1) + i;
  const corners = [g.cls[k], g.cls[k + 1], g.cls[k + g.nx + 1], g.cls[k + g.nx + 2]];
  if (corners.every((c) => c === corners[0])) return corners[0];
  const hRatio = g.cellY / g.cellX;
  for (let l = 0; l < g.leafCount; l++) {
    const x0 = g.leaves[6 * l];
    const y0 = g.leaves[6 * l + 1];
    const s = g.leaves[6 * l + 2];
    if (x >= x0 && x < x0 + s && y >= y0 && y < y0 + s * hRatio) return g.leaves[6 * l + 3];
  }
  throw new Error(`no leaf covers (${x}, ${y})`);
}

function transitions(classAt, wPx, step) {
  const out = [];
  let prev = classAt(step / 2);
  for (let x = step / 2 + step; x < wPx; x += step) {
    const c = classAt(x);
    if (c !== prev) out.push({ x: x - step / 2, from: prev, to: c });
    prev = c;
  }
  return out;
}

function trueBoundaries(ctx, panel) {
  const cls = (x) => classifyDirection(ctx, ...tanAt(panel, x, panel.hPx / 2)).cls;
  return transitions(cls, panel.wPx, 0.25).map(({ x, from, to }) => {
    let a = x - 0.125;
    let b = x + 0.125;
    while (b - a > 1e-6) {
      const m = (a + b) / 2;
      if (cls(m) === from) a = m;
      else b = m;
    }
    return { x: (a + b) / 2, from, to };
  });
}

function boundaryErrorPx(ctx, panel, g) {
  const truth = trueBoundaries(ctx, panel).map((t) => t.x);
  const drawn = transitions((x) => drawnClassOnCentreLine(g, panel, x), panel.wPx, 0.05).map((t) => t.x);
  if (drawn.length !== truth.length) return Infinity;
  return Math.max(0, ...truth.map((t, k) => Math.abs(t - drawn[k])));
}

function edgeMidShiftPx(ctx, panel, side) {
  const vertical = (panel.hPx >= panel.wPx) === (side === 'long');
  const half = (vertical ? panel.hPx : panel.wPx) / 2 / panel.pxPerTan;
  let worst = 0;
  for (const s of [-1, 1]) {
    const e = vertical ? [0, s * half] : [s * half, 0];
    const r = classifyDirection(ctx, ...e);
    if (r.cls !== REF_CLASS.LENS) return NaN;
    worst = Math.max(worst, Math.hypot(r.objTan[0] - e[0], r.objTan[1] - e[1]) * panel.pxPerTan);
  }
  return worst;
}

function tickOffsetPx(ctx, panel, side) {
  const P = panel.pxPerTan;
  const alongVertical = (panel.hPx >= panel.wPx) === (side === 'long');
  const alongHalf = (alongVertical ? panel.hPx : panel.wPx) / 2;
  const across = (alongVertical ? panel.wPx : panel.hPx) / 2 - 14;
  const nMax = Math.floor(alongHalf / (SQ_TAN * P));
  let worst = 0;
  for (const s of [-1, 1]) {
    for (const n of [-nMax, nMax]) {
      const target = n * SQ_TAN;
      const chartAlong = (c) => {
        const dir = alongVertical ? [(s * across) / P, c] : [c, (s * across) / P];
        const r = classifyDirection(ctx, ...dir);
        return r.cls === REF_CLASS.LENS ? (alongVertical ? r.objTan[1] : r.objTan[0]) : NaN;
      };
      let a = 0;
      let b = (Math.sign(n) * alongHalf * 1.5) / P;
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2;
        if ((chartAlong(m) - target) * Math.sign(n) < 0) a = m;
        else b = m;
      }
      worst = Math.max(worst, Math.abs((a + b) / 2 - target) * P);
    }
  }
  return worst;
}

const lensCtx = (o) => {
  const s = specOf(o);
  const lens = evaluateLens(s);
  if (!lens.ok) throw new Error(`not accepted: ${JSON.stringify(o)}`);
  return { lens, ctx: prepareWarp({ surfaces: lens.surfaces, frame: s.frame, eye: s.eye }) };
};
const ITEM12 = { shape: 'rechteckig', A: 40, B: 28, DBL: 14 };
const item12 = (sph, eye = 'OD') => lensCtx({ sph, eye, frame: ITEM12, monoPD: 40 });

// =================================================================================================
// 1. Field: G1 and G2 at 30°, step down to 25° / 20° if criterion 1 or 2 fails
// =================================================================================================
let field = null;
let grids = null;
for (const half of [30, 25, 20]) {
  const rDisc = Math.SQRT2 * tanOf(half);
  log(`field ${half}°: disc tan ${rDisc.toFixed(4)}`);
  const a = runGrid('G1', g1, 16, 72, rDisc);
  const b = runGrid('G2', g2, 8, 36, rDisc);
  const ok = [a, b].every((s) => s.crit1.length === 0 && s.crit2.length === 0);
  grids = [a, b];
  if (ok) {
    field = half;
    break;
  }
  log(`field ${half}° fails criterion 1 or 2`);
}

const P_LAYOUT = {
  p412: panelOf([189, 285], field ?? 30),
  p320: panelOf([288, 216], field ?? 30),
  p400: panelOf([198, 248.75], field ?? 30),
  p1280: panelOf([270, 338.75], field ?? 30),
  largest: panelOf([639, 800], field ?? 30),
};

w('# Phase 4 — P0 feasibility results (04-03 Task 3)');
w();
w(`Generated by \`node scripts/p0-feasibility.mjs\` on ${new Date().toISOString().slice(0, 10)} with the production engine`);
w('(`src/engine/trace.js` traceFromEye through `src/engine/warp.js` classifyDirection), h = 15 mm (EYE_POINT_MM).');
w(`Host: ${os.cpus()[0].model}, ${os.cpus().length} logical CPUs, Node ${process.version}; load average at start ${os.loadavg().map((v) => v.toFixed(2)).join(' / ')} (three executors in parallel).`);
w();
w('## 0. Measured stage sizes (lens-critic MINOR 2)');
w();
w('`scripts/measure-stages.mjs` against `npm run preview` (production build, `GITHUB_SHA=$(git rev-parse HEAD) npm run build`).');
w('Server checks, pasted from the run: before start `curl -s -o /dev/null -w \'%{http_code}\' http://localhost:4173/` → `000`;');
w('after start the served `<meta name="app-commit" content="4dd2dfd">` equals `git rev-parse HEAD | cut -c1-7` = `4dd2dfd`;');
w('the script read `#app-commit` = `4dd2dfd` = `EXPECT_COMMIT` and printed `served #app-commit: 4dd2dfd`.');
w('Panels: two panels with a 2 px divider from a 360 px stage width, one panel below (UI-SPEC "Narrow stage fallback").');
w(`Scale: pxPerTan = long side / (2 · tan ${field ?? 30}°).`);
w();
w('| Viewport | Stage | #view-stage content box (px) | Panels | Panel (px) | px per tan | UI-SPEC assumption |');
w('|---|---|---|---|---|---|---|');
const SPEC_ASSUMED = {
  '412 × 915|in page': '189 × 285 at 246,8 (same)',
  '320 × 640|in page': '288 × 216 at 249,4 (same)',
  '1024 × 768|in page (400 px column)': '199 × 250 at 216,5 (measured 198 × 248,75 at 215,42)',
  '1164 × 593|in page': '— (in-page tablet uses the 400 px column: 198 × 248,75)',
  '1164 × 593|fullscreen': '581 × 593 (lens-critic scratch; same)',
};
for (const m of MEASURED) {
  const p = panelOf(m.panel, field ?? 30);
  w(
    `| ${m.vp} | ${m.where} | ${de(m.stage[0])} × ${de(m.stage[1])} | ${m.two ? 'two' : 'one'} | ${de(m.panel[0])} × ${de(m.panel[1])} | ${de(p.pxPerTan)} | ${SPEC_ASSUMED[`${m.vp}|${m.where}`] ?? '—'} |`,
  );
}
w();
w('Differences from the UI-SPEC sizes: the 400 px desktop column is 398 × 248,75 content box (1 px border on each side, 16 : 10), so its panels are 198 × 248,75 at 215,42 px per tan, not 199 × 250 at 216,5. The 412 px and 320 px phone stages match the UI-SPEC exactly. The 1164 × 593 tablet in landscape uses the 400 px column in the page (900–1199 px band); its 581 × 593 panels exist only in fullscreen. **Largest measured panel: 639 × 800 (1280 × 800 fullscreen)**; smallest scale: 215,42 px per tan (400 px column).');
w();

// =================================================================================================
w('## 1. Field half-angle and pass criteria (G1, G2)');
w();
w(`**Fixed field half-angle: ${field ?? 'NONE'}°**${field === 30 ? ' (unchanged from the UI-SPEC; the step-down to 25° / 20° was not needed)' : ''}.`);
w(`Direction disc: tan ≤ √2 · tan ${field ?? 20}° = ${de(Math.SQRT2 * tanOf(field ?? 20), 4)}.`);
w();
w('| Grid | Directions | Cases | Accepted | Rejected by the engine | Rays traced | C1 no miss / TIR | C2 class-1 \\|tan\\| ≤ 3 | C4 paraxial ≤ 0,05 pp | C5 rim cases |');
w('|---|---|---|---|---|---|---|---|---|---|');
for (const s of grids) {
  w(
    `| ${s.name} | ${s.rings} rings × ${s.spokes} spokes + centre | ${s.cases} | ${s.accepted} | ${s.rejected} | ${s.rays} | ${s.crit1.length === 0 ? 'PASS' : `FAIL (${s.crit1.length} cases)`} | ${s.crit2.length === 0 ? 'PASS' : `FAIL (${s.crit2.length} cases)`} | ${s.crit4Fail.length === 0 ? 'PASS' : `FAIL (${s.crit4Fail.length})`} (max ${de(s.crit4Max * 100, 5)} pp; ${s.crit4NA} cases with no lens at the centre) | ${s.rim.length} |`,
  );
}
w();
for (const s of grids) {
  w(`- ${s.name} rejected by diagnostic code: ${Object.entries(s.rejectedCodes).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`);
  w(`- ${s.name} C4 worst case: ${s.crit4Worst}.`);
  for (const c of [...s.crit1, ...s.crit2, ...s.crit4Fail].slice(0, 20)) w(`  - failing: ${c}`);
}
w();
w('### Criterion 3: local size change at 30° (radial and tangential, 8 azimuths, finite differences)');
w();
w('Extremes over all accepted cases (local M = J⁻¹ of the traced mapping, minus 1; directions not on the lens are skipped):');
w();
w('| Grid | radial min | radial max | tangential min | tangential max | skipped samples |');
w('|---|---|---|---|---|---|');
for (const s of grids) {
  const f = ([v, L]) => `${de(v * 100, 1)} % (${L})`;
  w(`| ${s.name} | ${f(s.ls.radMin)} | ${f(s.ls.radMax)} | ${f(s.ls.tanMin)} | ${f(s.ls.tanMax)} | ${s.lsNA} |`);
}
{
  const { lens, ctx } = lensCtx({ sph: -4 });
  const rads = [];
  const tans = [];
  for (const [ux, uy] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ]) {
    const M = localM(ctx, tanOf(30) * ux, tanOf(30) * uy);
    rads.push(ux * (M[0][0] * ux + M[0][1] * uy) + uy * (M[1][0] * ux + M[1][1] * uy) - 1);
    tans.push(-uy * (M[0][0] * -uy + M[0][1] * ux) + ux * (M[1][0] * -uy + M[1][1] * ux) - 1);
  }
  w();
  w(
    `Reference (UI-SPEC: −4,00 CR-39 centre −5,6 %, radial at 30° −15,7 %, tangential −9,0 %): production centre ${de((lens.magnification.meridians[0].sm - 1) * 100, 2)} %, radial at 30° ${rads.map((v) => de(v * 100, 1)).join(' / ')} %, tangential ${tans.map((v) => de(v * 100, 1)).join(' / ')} % (temporal / up / nasal / down, default frame OD). The edge value exceeds the centre value, so \`view.ref.edge\` stays as written.`,
  );
}
w();
w('### Criterion 5: accepted cases with a rim (class 2, 4 or 5) inside the disc');
w();
const ITEM12_LABELS = ['OD', 'OS'].map((eye) => label(specOf({ sph: -4, frame: { ...ITEM12 }, monoPD: 40, eye })));
for (const s of grids) {
  w(`- ${s.name}: ${s.rim.length} cases (edge band ${s.rimEdge}, rim face ${s.rimFace}, past the rim ${s.rimPast}).`);
}
const g2s = grids[1];
w(`- Item-12 case in the G2 list: ${ITEM12_LABELS.map((L) => `${L} → ${g2s.rim.includes(L) ? 'listed' : 'NOT LISTED'}`).join('; ')}.`);
w('- First 25 G2 rim cases (generation order):');
for (const L of g2s.rim.slice(0, 25)) w(`  - ${L}`);
w(`- G1 rim cases (default frame): ${grids[0].rim.length === 0 ? 'none' : grids[0].rim.slice(0, 10).join('; ')}.`);
w();
w('### Chart texture extent (input for 04-08)');
w();
for (const s of grids) w(`- ${s.name}: max class-1 |objTan| in the disc = ${de(s.maxObjTan, 4)} (${s.maxObjTanCase}).`);
const maxObj = Math.max(...grids.map((s) => s.maxObjTan));
w(`- **R = ${de(Math.ceil(maxObj * 10) / 10, 1)}** (max over G1 and G2, rounded up to 0,1). Over the panel rectangles of the measured layouts the extent is smaller (the panel corner is at most the disc radius).`);
w();

// =================================================================================================
// 2. Interpolation constant k and the tiers
// =================================================================================================
log('k fit and tier sweep');
const N10 = [
  { name: '−12,00 CR-39', o: { sph: -12 } },
  { name: '−10,00 / −4,00 × 30 CR-39', o: { sph: -10, cyl: -4, axisDeg: 30 } },
  { name: '−10,00 / −4,00 × 120 CR-39', o: { sph: -10, cyl: -4, axisDeg: 120 } },
  { name: '+12,00 CR-39', o: { sph: 12 } },
  { name: '+8,00 / −6,00 × 135 1,74', o: { sph: 8, cyl: -6, axisDeg: 135, materialId: 'idx174' } },
].map((c) => ({ ...c, ...lensCtx(c.o) }));

const worstEdge = (panel, cellPx) => {
  let worst = 0;
  let which = '';
  for (const c of N10) {
    const g = warpGrid(c.ctx, panel, cellPx, { leafPx: cellPx });
    const e = edgeInterpErrorPx(c.ctx, panel, g);
    if (e > worst) {
      worst = e;
      which = c.name;
    }
  }
  return { worst, which };
};

w('## 2. Interpolation constant k (drawn sw-ne triangle interpolant)');
w();
w('Max edge error over the N10 worst-case set (default frame, OD; outermost cells along every panel edge; centroids of both triangles and the diagonal midpoint vs a direct trace), err_px ≈ k · c² / P:');
w();
const CELLS = [4, 6, 8, 9, 10, 11, 12];
const KP = [
  ['400 px column 198 × 248,75', P_LAYOUT.p400],
  ['412 two-panel 189 × 285', P_LAYOUT.p412],
  ['1280 in page 270 × 338,75', P_LAYOUT.p1280],
];
w(`| cell c (px) | ${KP.map(([n, p]) => `${n} (P ${de(p.pxPerTan)})`).join(' | ')} | k = err·P/c² (max) |`);
w(`|---|${KP.map(() => '---').join('|')}|---|`);
let kMax = 0;
const edgeAtMin = {};
for (const c of CELLS) {
  const cols = [];
  let kc = 0;
  for (const [, p] of KP) {
    const { worst, which } = worstEdge(p, c);
    if (p === P_LAYOUT.p400) edgeAtMin[c] = { worst, which };
    kc = Math.max(kc, (worst * p.pxPerTan) / (c * c));
    cols.push(`${de(worst, 4)} (${which})`);
  }
  kMax = Math.max(kMax, kc);
  w(`| ${c} | ${cols.join(' | ')} | ${de(kc, 3)} |`);
}
const cMaxFit = Math.sqrt((0.45 * P_LAYOUT.p400.pxPerTan) / kMax);
const cMaxMeasured = Math.max(...CELLS.filter((c) => edgeAtMin[c].worst <= 0.45));
w();
w(`**k = ${de(kMax, 3)} tan·px** (largest over the table). From the fit, 0,45 px at the smallest measured scale P = ${de(P_LAYOUT.p400.pxPerTan)} allows c ≤ ${de(cMaxFit, 2)} px; measured directly, the largest listed cell with a worst-case drawn error ≤ 0,45 px is **${cMaxMeasured} px**.`);
w();

// --- tier sweep ----------------------------------------------------------------------------------
const RIM_CASES = [
  { name: 'item-12 −4,00 at 320 one-panel', ctx: item12(-4).ctx, panel: P_LAYOUT.p320 },
  { name: 'item-12 +4,00 at 320 one-panel', ctx: item12(4).ctx, panel: P_LAYOUT.p320 },
  { name: 'item-12 −4,00 at largest 639 × 800', ctx: item12(-4).ctx, panel: P_LAYOUT.largest },
  { name: 'item-12 +4,00 at largest 639 × 800', ctx: item12(4).ctx, panel: P_LAYOUT.largest },
];
const eff = (cellPx, leafPx) => cellPx / 2 ** Math.ceil(Math.log2(cellPx / leafPx));
function measureTier(cellPx, leafPx) {
  const rims = RIM_CASES.map((rc) => {
    const g = warpGrid(rc.ctx, rc.panel, cellPx, { leafPx });
    return { name: rc.name, rays: g.rays, boundary: boundaryErrorPx(rc.ctx, rc.panel, g) };
  });
  return { cellPx, leafPx, eff: eff(cellPx, leafPx), edge: worstEdge(P_LAYOUT.p400, cellPx).worst, rims };
}

const fein = measureTier(REF_GRID_TIERS.fein.cellPx, REF_GRID_TIERS.fein.leafPx);
const mittel = measureTier(REF_GRID_TIERS.mittel.cellPx, REF_GRID_TIERS.mittel.leafPx);
const sweep = [];
for (const c of [8, 9, 10, 11, 12]) {
  for (let d = 0; d <= 4; d++) {
    const e = c / 2 ** d;
    if (e < mittel.eff - 1e-12 || e > 2 * Math.SQRT2 + 1e-12) continue;
    // any leafPx in [e, 2e) gives depth d; take the integer ceil(e) (< 2e because e ≥ 2)
    sweep.push(measureTier(c, Math.ceil(e)));
  }
}
const accepts = (g) => {
  const why = [];
  if (!(fein.eff <= mittel.eff && mittel.eff <= g.eff)) why.push('effective leaf not non-decreasing');
  for (const [k, r] of g.rims.entries()) {
    const rf = fein.rims[k].rays;
    const rm = mittel.rims[k].rays;
    if (!(r.rays <= rm && rm <= rf)) why.push(`rays not monotonic (${r.name})`);
    if (!(r.rays <= 0.5 * rf)) why.push(`rays(grob) > 0,5 · rays(fein) (${r.name})`);
  }
  for (const t of [fein, mittel, g]) {
    if (t.edge > 0.45) why.push(`edge error ${de(t.edge, 4)} > 0,45 at cell ${t.cellPx}`);
    for (const r of t.rims) if (!(r.boundary <= 2)) why.push(`boundary ${de(r.boundary, 3)} > 2 px at cell ${t.cellPx} (${r.name})`);
  }
  return why;
};
let grob = null;
for (const g of [...sweep].sort((a, b) => b.cellPx - a.cellPx || a.eff - b.eff)) {
  g.why = accepts(g);
  if (g.why.length === 0 && grob === null) grob = g;
}

w('## 3. Grid tiers (lens-critic M2, round-2 NEW-2, NEW-4)');
w();
w('Rules: rays(grob) ≤ rays(mittel) ≤ rays(fein) and rays(grob) ≤ 0,5 · rays(fein) for the item-12 frame (−4,00 and +4,00) at the measured 320 one-panel panel AND at the largest measured panel; effectiveLeafPx non-decreasing fein → mittel → grob and ≤ 2·√2; every tier: drawn edge error ≤ 0,45 px at P = 215,42 (smallest measured scale) and class-boundary error ≤ 2 px on the horizontal centre line.');
w();
w('Leaf sweep for grob (cells 8–12, every real leaf in [effectiveLeafPx(mittel), 2,83 px]):');
w();
w('| cell | leafPx | effectiveLeafPx | edge error at P 215,42 (px) | rays per rim case | boundary error per rim case (px) | verdict |');
w('|---|---|---|---|---|---|---|');
for (const g of sweep) {
  w(
    `| ${g.cellPx} | ${de(g.leafPx)} | ${de(g.eff)} | ${de(g.edge, 4)} | ${g.rims.map((r) => r.rays).join(' / ')} | ${g.rims.map((r) => de(r.boundary, 3)).join(' / ')} | ${g === grob ? '**chosen**' : g.why.length ? g.why[0] : 'valid (smaller cell)'} |`,
  );
}
w();
w(`Rim cases in column order: ${RIM_CASES.map((r) => r.name).join('; ')}.`);
w();
let stop = false;
if (field === null) stop = true;
if (grob === null) {
  stop = true;
  w('**STOP: no grob setting satisfies the monotonic ray rule, the 0,45 px edge error and the 2 px class boundary. Finding for lens-critic; N10 and the rule are not loosened.**');
} else {
  w('**Fixed tiers:**');
  w();
  w('| tier | cellPx | leafPx | effectiveLeafPx | worst drawn edge error (px, ≤ 0,45) | boundary error (px, ≤ 2) per rim case | rays per rim case |');
  w('|---|---|---|---|---|---|---|');
  for (const [n, t] of [
    ['fein', fein],
    ['mittel', mittel],
    ['grob', grob],
  ]) {
    w(`| ${n} | ${t.cellPx} | ${de(t.leafPx)} | ${de(t.eff)} | ${de(t.edge, 4)} | ${t.rims.map((r) => de(r.boundary, 3)).join(' / ')} | ${t.rims.map((r) => r.rays).join(' / ')} |`);
  }
  w();
  const ratio = grob.rims.map((r, k) => `${de(r.rays / fein.rims[k].rays, 3)}`);
  const ratioM = grob.rims.map((r, k) => `${de(r.rays / mittel.rims[k].rays, 3)}`);
  w(`rays(grob)/rays(fein) per rim case: ${ratio.join(' / ')} (≤ 0,5); rays(grob)/rays(mittel): ${ratioM.join(' / ')}. Monotonic rule: PASS. Edge headroom (NEW-4): PASS. Boundary ≤ 2 px: PASS.`);
}
w();

// --- timing and ray table --------------------------------------------------------------------------
log('timing');
const TIERS_FIXED = grob ? { fein, mittel, grob } : { fein, mittel };
function timeGrid(ctx, panel, cellPx, leafPx) {
  for (let i = 0; i < 10; i++) warpGrid(ctx, panel, cellPx, { leafPx });
  const t = [];
  let rays = 0;
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    rays = warpGrid(ctx, panel, cellPx, { leafPx }).rays;
    t.push(performance.now() - t0);
  }
  t.sort((a, b) => a - b);
  return { rays, median: medianOf(t), p95: tailOf(t, 95) };
}
const ctxOfSpec = (s) => {
  const l = evaluateLens(s);
  return prepareWarp({ surfaces: l.surfaces, frame: s.frame, eye: s.eye });
};
const TIMING_CASES = [
  ['NORMAL_PAIR OD (−4,00 / −2,00 × 30), 412 two-panel 189 × 285', ctxOfSpec(NORMAL_PAIR.OD), P_LAYOUT.p412],
  ['NORMAL_PAIR OS, 412 two-panel', ctxOfSpec(NORMAL_PAIR.OS), P_LAYOUT.p412],
  ['GRENZFALL_PAIR OD (+10,75 / −1,00 × 89, 1,67), 412 two-panel', ctxOfSpec(GRENZFALL_PAIR.OD), P_LAYOUT.p412],
  ['GRENZFALL_PAIR OS, 412 two-panel', ctxOfSpec(GRENZFALL_PAIR.OS), P_LAYOUT.p412],
  ...RIM_CASES.map((r) => [r.name, r.ctx, r.panel]),
];
w('## 4. Timing and ray table (one panel\'s warpGrid, Node, informational)');
w();
w(`Host CPU: ${os.cpus()[0].model}; load average before timing ${os.loadavg().map((v) => v.toFixed(2)).join(' / ')} (8 cores, parallel executors: timings are noisy; the ray counts are host-independent and are the gate).`);
w('10 warm-up runs, 20 timed runs, node:perf_hooks.');
w();
w(`| case | ${Object.keys(TIERS_FIXED).map((t) => `${t}: rays / median / p95 (ms)`).join(' | ')} |`);
w(`|---|${Object.keys(TIERS_FIXED).map(() => '---').join('|')}|`);
for (const [name, ctx, panel] of TIMING_CASES) {
  const cols = Object.values(TIERS_FIXED).map((t) => {
    const r = timeGrid(ctx, panel, t.cellPx, t.leafPx);
    return `${r.rays} / ${de(r.median, 2)} / ${de(r.p95, 2)}`;
  });
  w(`| ${name} | ${cols.join(' | ')} |`);
}
w();
w(`Load average after timing: ${os.loadavg().map((v) => v.toFixed(2)).join(' / ')}.`);
w();

// =================================================================================================
// 5. Visibility at the measured geometries
// =================================================================================================
log('visibility');
w('## 5. How visible the effect is (production trace, measured geometries)');
w();
w('CR-39, default frame 52 × 38 / DBL 18 / PD 32, automatic base curve, OD, h = 15 mm. Definitions as in the UI-SPEC (edge midpoint: shift of the chart point at the middle of a panel edge between "Mit Glas" and "Ohne Glas"; tick offset: along the edge, outermost tick vs where its chart line crosses the line 14 px inside the edge). Long side = vertical for the 412 two-panel and the 400 column, horizontal for the 320 one-panel. Square edge tan 6°.');
w();
const VIS = [
  ['−0,50', { sph: -0.5 }],
  ['−0,75', { sph: -0.75 }],
  ['−1,00', { sph: -1 }],
  ['+0,75', { sph: 0.75 }],
  ['+1,00', { sph: 1 }],
  ['0,00 / −1,00 × 180', { sph: 0, cyl: -1, axisDeg: 180 }],
  ['0,00 / −1,00 × 90', { sph: 0, cyl: -1, axisDeg: 90 }],
  ['−1,00 / −1,00 × 90', { sph: -1, cyl: -1, axisDeg: 90 }],
  ['−4,00', { sph: -4 }],
];
const vis = {};
w('| Rx | 412 two-panel (189 × 285), edge midpoint long / short | 412 tick offset long / short | 320 one-panel (288 × 216), edge midpoint long / short | 320 tick offset long / short | 400 column (198 × 248,75), edge midpoint long / short | 400 tick offset long / short |');
w('|---|---|---|---|---|---|---|');
for (const [name, o] of VIS) {
  const { ctx } = lensCtx(o);
  const row = {};
  const cells = [];
  for (const [key, p] of [
    ['p412', P_LAYOUT.p412],
    ['p320', P_LAYOUT.p320],
    ['p400', P_LAYOUT.p400],
  ]) {
    const v = {
      midLong: edgeMidShiftPx(ctx, p, 'long'),
      midShort: edgeMidShiftPx(ctx, p, 'short'),
      tickLong: tickOffsetPx(ctx, p, 'long'),
      tickShort: tickOffsetPx(ctx, p, 'short'),
    };
    row[key] = v;
    cells.push(`${de(v.midLong, 4)} / ${de(v.midShort, 4)}`, `${de(v.tickLong, 4)} / ${de(v.tickShort, 4)}`);
  }
  vis[name] = row;
  w(`| ${name} | ${cells.join(' | ')} |`);
}
w();
// minimum long side for −1,00 ≥ 3,0 px
const m1 = lensCtx({ sph: -1 }).ctx;
let minLong = null;
for (let L = 200; L <= 400; L += 2) {
  const p = { wPx: Math.round(L * 0.66), hPx: L, pxPerTan: L / (2 * tanOf(field ?? 30)) };
  if (edgeMidShiftPx(m1, p, 'long') >= 3.0) {
    minLong = L;
    break;
  }
}
w(`**Minimum panel long side at which −1,00 CR-39 reaches a 3,0 px long-side edge-midpoint shift: ${minLong} px** (2 px scan; the shift depends on the long side only, because the long-edge midpoint is always at tan ${field ?? 30}°).`);
w();
w('Findings for lens-critic (measured in-page panels with a long side below that value):');
const findings = [];
for (const m of MEASURED) {
  const L = Math.max(...m.panel);
  if (L < minLong) findings.push(`−1,00 shows < 3 px with no weak note at layout ${m.vp} ${m.where} (panel ${de(m.panel[0])} × ${de(m.panel[1])}, long side ${de(L)} px, edge-midpoint shift ${de(edgeMidShiftPx(m1, panelOf(m.panel, field ?? 30), 'long'), 4)} px)`);
}
w(findings.length ? findings.map((f) => `- ${f}`).join('\n') : '- none');
w();

// --- item-12 band widths ----------------------------------------------------------------------------
w('## 6. Item-12 rim widths (A 40 / B 28 / DBL 14 / PD 40, rechteckig, CR-39, 320 one-panel, P = 249,42)');
w();
w('Boundaries on the horizontal centre line, distance from the panel centre toward temporal (OD = screen right, OS = screen left), from a 0,25 px scan and bisection; panel half-width 144 px. Beyond the panel edge the scan continues on a virtual wider panel at the same scale.');
w();
w('| Rx | eye | lens ends (1 \\| 2) | back outline (2 \\| 4) | edge band | rim face outer edge (4 \\| 5) |');
w('|---|---|---|---|---|---|');
const band = {};
for (const sph of [-4, 4]) {
  for (const eye of ['OD', 'OS']) {
    const { ctx } = item12(sph, eye);
    const wide = { wPx: 720, hPx: 216, pxPerTan: P_LAYOUT.p320.pxPerTan };
    const bs = trueBoundaries(ctx, wide).map((b) => ({ ...b, d: (b.x - 360) * (eye === 'OD' ? 1 : -1) })).filter((b) => b.d > 0);
    const at = (from, to) => bs.find((b) => (b.from === from && b.to === to) || (b.from === to && b.to === from))?.d;
    const v = { e12: at(1, 2), e24: at(2, 4), e45: at(4, 5) };
    band[`${sph}|${eye}`] = v;
    w(`| ${sgn(sph)} | ${eye} | ${de(v.e12, 1)} px (tan ${de(v.e12 / wide.pxPerTan, 3)}) | ${de(v.e24, 1)} px (tan ${de(v.e24 / wide.pxPerTan, 3)}) | ${de(v.e24 - v.e12, 1)} px | ${v.e45 === undefined ? '—' : `${de(v.e45, 1)} px (tan ${de(v.e45 / wide.pxPerTan, 3)})`} |`);
  }
}
w();

// --- P0 CI subset candidates --------------------------------------------------------------------------
w('## 7. Fixed CI subset (warp.test.js "REF-01 P0 CI subset")');
w();
w('Item-12 case (−4,00 and +4,00), default frame at −10,00 and +12,00, and three G2 corner cases, each on the 8 × 36 grid with criteria 1, 2 and 4:');
w();
w('Three G2 corner cases taken from the extremes in section 1 (criterion 3 and the texture extent):');
w(`- G2 corner 1 (largest class-1 |objTan|, most negative radial size change): ${grids[1].maxObjTanCase}`);
w(`- G2 corner 2 (largest radial size change): ${grids[1].ls.radMax[1]}`);
w(`- G2 corner 3 (largest tangential size change): ${grids[1].ls.tanMax[1]}`);
w();
w('## 8. Ray counts recorded for the CI gate (warp.test.js "REF-02 ray-count gate (M2)")');
w();
if (grob) {
  w('| rim case | fein | mittel | grob |');
  w('|---|---|---|---|');
  for (const [k, r] of RIM_CASES.entries()) w(`| ${r.name} | ${fein.rims[k].rays} | ${mittel.rims[k].rays} | ${grob.rims[k].rays} |`);
}
w();
const totalRays = grids.reduce((a, s) => a + s.rays, 0);
const runtime = (performance.now() - T_START) / 1000;
w('## Run');
w();
w(`Runtime ${de(runtime, 1)} s; ${totalRays} rays traced in G1 + G2 (plus the tier, k and visibility runs). Overall: ${stop ? '**STOP**' : '**PASS**'}.`);
w();
w('JSON summary for the docs commit:');
w();
w('```json');
w(JSON.stringify({ field, tiers: grob ? { fein: [fein.cellPx, fein.leafPx], mittel: [mittel.cellPx, mittel.leafPx], grob: [grob.cellPx, grob.leafPx] } : null, k: kMax, minLong, maxObj, vis, band }, null, 1));
w('```');

writeFileSync(OUT, lines.join('\n') + '\n');
log(`wrote ${OUT}; runtime ${runtime.toFixed(1)} s; rays ${totalRays}; ${stop ? 'STOP' : 'PASS'}`);
console.log(`runtime ${runtime.toFixed(1)} s, rays ${totalRays}`);
process.exit(stop ? 1 : 0);
