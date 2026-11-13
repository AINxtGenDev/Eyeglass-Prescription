# Phase 4: Refraction View & Offline - Pattern Map

**Mapped:** 2026-11-13
**Files analyzed:** 43 (new and modified)
**Analogs found:** 37 / 43. The 6 without a close analog are the PWA pieces (plugin config, update banner wiring, handover storage, switch server, icons) and the P0 script; nothing in the repo uses a service worker or browser storage yet.

## Read this first (things most likely to bite)

1. **`intersect` and `refract` throw, and the ENG-08 tests rely on that.** `src/engine/trace.js:38` throws `'traceRay: surface intersection did not converge'` and `:55` throws `'traceRay: total internal reflection'`. RESEARCH Pattern 1 needs null-returning variants. The smallest safe change: add `intersectOrNull` / `refractOrNull` as the core, and make the existing `intersect` / `refract` call them and throw on null with **the same messages**. `traceRay` / `traceBVP` (lines 65-120) stay byte-for-byte. Re-run `src/engine/trace.test.js` unchanged (Pitfall 2).
2. **The engine may not call `performance`.** `eslint.config.js:96-108` bans `performance` in `src/engine/**`. `computeMs` must be measured in the protocol handler through an injected `now` (`src/state/mesh-protocol.js:98`, `now = () => globalThis.performance.now()`). State-layer globals ban list (`eslint.config.js:126-137`) does **not** include `performance`, so this is allowed there.
3. **Point-in-polygon already exists twice.** `src/engine/evaluate.js:117-128` (`insideOutline`) and `src/engine/profile.js:49-60` (`inside`) are identical private copies. The warp needs a third use. Put one exported helper in a new `src/engine/outline-geom.js` (with the r_min/r_max fast paths and a signed distance) and use it from `warp.js`. Do not refactor the two existing copies in this phase (surgical rule); mention them in the plan.
4. **T-02-39 bans `sessionStorage` in every `src/` file today.** `src/engine/boundary.test.js:114-141` scans all non-test `.js` files with `/\b(localStorage|sessionStorage|indexedDB)\b|document\.cookie/`. Creating `src/ui/handover.js` fails this test until the allow-list amendment (UI-SPEC "Boundary test amendment") lands **in the same plan**.
5. **`virtual:pwa-register` does not resolve under Vitest `node`.** `src/ui/update.js` cannot be imported by a unit test as long as it imports the virtual module at top level. Keep the testable logic (offline-line state priority, `reloadWithHandover` idempotency, `hadController` gating, the 10 s failure timer) in functions that receive `registerSW`, `navigator`-like and `location`-like objects as parameters, and keep the `import { registerSW } from 'virtual:pwa-register'` in a thin entry. Same injection style as `createMeshClient` (`src/state/mesh-client.js:39-49`).
6. **`window.__eyeglassView` is used 144 times in `e2e/`.** It is created unconditionally at `src/ui/view/view.js:1412`. F-04 gating (Pitfall 9) changes the build that e2e runs against. `test/ci/workflow-structure.test.js:66-82` asserts the exact lines `run: npm run build$` and `run: npm run test:e2e$` in order. Any e2e-build split must update that test in the same plan, or CI fails before deploy.
7. **No Playwright project blocks service workers today.** `playwright.config.js:21-44` has `desktop`, `mobile`, and `perf` (only with `PERF=1`). Once the SW registers after the first paint, every existing spec precaches the app (Pitfall 5). Add `serviceWorkers: 'block'` to `desktop` and `mobile` in the **same** plan that first registers the SW.
8. **The CSP string exists twice.** `vite.config.js:25-27` and `e2e/worker.spec.js:24`. With `injectRegister: false` it must not change. Assert it again with the SW active.
9. **`view.js` is 1 551 lines, and `mode` is typed `'glass' | 'heat'`.** `mode === 'heat'` appears in about 15 places (lines 290, 322, 400, 417, 425, 448, 800, 945, 1032, 1226, 1263-1273). Add `'ref'` as a third value. Put the Durchblick drawing in `src/ui/view/refraction.js`. In `view.js`, only wire `setMode('ref')` (line 1123), the radio handler (936-942) and the Expert-off rule (944-949, which must **not** leave Durchblick, UI-SPEC "Mode switch").
10. **Tier names collide.** The quality tiers in `src/ui/view/tiers.js:19-23` are `hoch / mittel / sparsam`. The Durchblick grid tiers are `fein / mittel / grob`. Both have a "mittel". Keep the grid tiers in their own frozen table (new constant, same file or `refraction.js`), and never pass a grid tier to `stepDown` (tiers.js:38).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/engine/trace.js` (mod: `traceFromEye`, null variants) | engine utility | transform (ray → status + objTan) | itself, `traceRay` lines 65-78 | exact |
| `src/engine/magnification.js` (new) | engine formula | transform (surfaces + Rx → SM per meridian) | `src/engine/power.js` (cited closed forms) + `rim.js` (constant with provenance) | role-match |
| `src/engine/warp.js` (new) | engine builder | batch transform (grid → typed arrays) | `src/engine/profile.js` `meridianProfile` + `src/engine/mesh/lens.js` | role-match |
| `src/engine/outline-geom.js` (new) | engine utility | transform | `evaluate.js:117-128` `insideOutline` | exact (lift) |
| `src/engine/evaluate.js` (mod: add SM to `LensResult`) | engine entry | request-response | itself, return block lines 268-284 | exact |
| `src/engine/warp.test.js`, `magnification.test.js` (new); `trace.test.js` (mod) | test (unit + fast-check) | — | `src/engine/trace.test.js` | exact |
| `src/engine/warp.bench.js` (new) | bench | — | `test/bench/recompute.test.js` | role-match |
| `src/state/warp-protocol.js` (new) | service (worker handler) | request-response | `src/state/mesh-protocol.js` | exact |
| `src/state/warp-client.js` (new) | service (client queue) | latest-wins | `src/state/mesh-client.js` | exact |
| `src/state/guard.js` (new, F-06) | utility (pure reducer) | transform | thumbnail guard `view.js:907-916` | role-match |
| `src/state/warp-*.test.js`, `guard.test.js` (new) | test | — | `src/state/mesh-client.test.js` (injected fake timers) | exact |
| `src/worker/warp.worker.js` (new) | worker glue | request-response | `src/worker/mesh.worker.js` | exact |
| `src/ui/view/refraction.js` (new) | component (ortho draw pass) | event-driven | `compare3d.js` `renderPass` + `backdrop.js` `createChart` | role-match |
| `src/ui/view/view.js` (mod: third mode, warp client, F-04 gate) | controller | event-driven | itself (`setMode`, mesh-client wiring) | exact |
| `src/ui/view/scene.js` (mod, if any: restore pass) | provider | event-driven | itself `setPass` lines 286-289 | exact |
| `src/ui/view/tiers.js` (mod: grid tiers) | config | — | itself | exact |
| `src/ui/view/fullscreen.js` (mod, F-02) | component | event-driven | itself + `src/ui/view-place.js` (DOM move) | exact |
| `src/ui/view/text.js` (mod: size block, ref aria) | utility (pure strings) | transform | itself (`protrusionLines`, `ariaGlass`) | exact |
| `src/ui/update.js` (new) | controller (SW wiring + banner) | event-driven | `src/ui/summary-bar.js` (observers, fixed bar) | partial |
| `src/ui/handover.js` (new) | utility (storage) | file-I/O-like (sessionStorage) | `src/ui/presets.js` `applyRx` (writes fields + dispatches `input`) | partial |
| `src/ui/pipeline.js` / `src/ui/main.js` (mod: SW start after first paint, handover read) | controller | event-driven | `paintDeliveries` lines 142-177, `init()` lines 217-280 | exact |
| `src/i18n/de-AT.js` (mod: `view.*.ref`, `update.*`, `tech.offline.*`, `tech.ref.*`) | config (dictionary) | — | `view.*` block lines 647-749 | exact |
| `src/i18n/format.js` (mod: percent) | utility | transform | `fmtMm`, `oneDecimalNf` lines 13-47 | exact |
| `src/ui/style.css` (mod) | config | — | `.segmented`, `#summary-bar`, `.view-stage--fs` | exact |
| `index.html` (mod) | markup | — | `#view-mode` lines 395-399, `#tech` 746-766 | exact |
| `vite.config.js` (mod: VitePWA, `APP_VERSION_OVERRIDE`, e2e mode) | config | — | its `appMeta` / `cspMeta` plugins | exact |
| `playwright.config.js` (mod: `pwa` project, SW block) | config | — | its `perf` project | exact |
| `package.json` / `package-lock.json` (mod: 3 dev pins) | config | — | existing exact pins | exact |
| `version.js` (mod: dev-1.8) | config | — | itself | exact |
| `.github/workflows/deploy.yml` (mod) | config (CI) | — | itself | exact |
| `test/ci/workflow-structure.test.js`, `pins.test.js` (mod) | test | — | themselves | exact |
| `test/ci/pwa-build.test.js` (new) | test (reads `dist/`) | file-I/O | `test/ci/pins.test.js` (reads repo files) | role-match |
| `src/engine/boundary.test.js` (mod: storage allow-list) | test | — | itself lines 114-141 | exact |
| `eslint.config.js` (mod, only if `scripts/` or `e2e/support/` need globals) | config | — | its Node-globals block lines 17-20 | exact |
| `e2e/view-ref.spec.js` (new) | test (e2e) | — | `e2e/view-heat.spec.js` | exact |
| `e2e/pwa.spec.js` (new) | test (e2e, SW) | — | `e2e/worker.spec.js` CSP test lines 400-423 | partial |
| `e2e/view-memory.spec.js`, `a11y.spec.js`, `worker.spec.js`, `perf-throttled.spec.js`, `smoke.spec.js` (mod) | test | — | themselves | exact |
| `e2e/helpers.js` (mod: `settledRef`) | test helper | — | `settledView` line 59 | exact |
| `e2e/support/switch-server.mjs` (new) | test infra (static server) | request-response | none | **no analog** |
| `public/favicon.svg`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (new) | asset | — | none (`public/` does not exist) | **no analog** |
| `scripts/p0-feasibility.mjs` (new) | one-off script | batch | `test/bench/recompute.test.js` (timing loop) | partial |
| VitePWA config block | config | — | none | **no analog** |

## Pattern Assignments

### `src/engine/trace.js` (modify: `traceFromEye`, non-throwing core)

**Analog:** itself.

**Imports to reuse, no copies** (line 16):
```javascript
import { frontSagAt, backSagAt, frontSagGradAt, backSagGradAt } from './design.js';
```

**Newton core to wrap** (lines 22-39). The null variant is this loop with `return null` instead of the final `throw`:
```javascript
function intersect(p, d, zOff, sag, grad, s) {
  let t = (-zOff - p[2]) / d[2]; // seed: the vertex plane
  for (let i = 1; i <= MAX_NEWTON; i++) {
    ...
    const dt = h / dh;
    if (!Number.isFinite(dt)) break;
    t -= dt;
    if (Math.abs(dt) < NEWTON_TOL) { ... return { q, normal: [gx, gy, 1], iterations: i }; }
  }
  throw new Error('traceRay: surface intersection did not converge');
}
```
**Snell** (lines 42-58): `if (k < 0) throw new Error('traceRay: total internal reflection');` is the TIR exit that becomes `return null`.

**Header style** (lines 1-14): the module already says "Production module: reused by the phase-4 warp grid". Extend the header with the reverse-trace frame (eye at `(oc.x, oc.y, −ct − h)`, direction `+z`, back first with η = 1/n, then front with η = n), as in RESEARCH Pattern 1. The new function takes **engine-frame** tan. The wearer mirror (`wx = −x`) happens once, in `warp.js` (Pitfall 1).

**Status codes:** export a frozen table (`OK`, `MISS_BACK`, `TIR_BACK`, `MISS_FRONT`, `TIR_FRONT`), same style as `NO_CHORD` in `profile.js:62-63`:
```javascript
const NO_CHORD = Object.freeze({ ok: false, code: 'NO_CHORD' });
const noChord = () => ({ ...NO_CHORD });
```

---

### `src/engine/magnification.js` (new, closed-form SM per meridian)

**Analog:** `src/engine/power.js` (formula module with citation block in the header) and `src/engine/rim.js` (constants with provenance).

**Header citation pattern** (power.js lines 1-11): formula in the comment, then `[CITED, MEDIUM: …]` with the sources. Use it for M = 1/[(1 − (t/n)·F1)·(1 − h·Fv)] with the ABCD derivation and the Le Grand & El Hage 3,04 mm computation (RESEARCH Pattern 2).

**Constant-with-provenance pattern** (rim.js lines 9-10):
```javascript
// [ASSUMED, RESEARCH A2] design constant, no citable value; shown as 'angenommener Wert'.
export const RIM_DEPTH_DEFAULT_MM = 3.0;
```
Apply to `HSA_ASSUMED_MM = 12` ([ASSUMED]) and `ENTRANCE_PUPIL_MM = 3.0` ([CITED], with the 3,04 derivation in the comment).

**Units helper** (conventions.js line 29): `export const K = (n) => 1000 * (n - 1);`. D1 = K(n)·c1, with CT in mm → m. Import `K` from `./conventions.js`, as `power.js` does (line 26).

**Principal meridians:** the per-meridian power is Sph along the axis and Sph + Cyl across it (`design.js` line 9, cited in RESEARCH). Report the two directions in the **wearer** frame (180° − θ) next to the engine θ, so the UI never mirrors anything (D-07).

---

### `src/engine/evaluate.js` (modify: SM in the result)

**Analog:** itself. The contract allows additions only (line 2: "Later plans may add values/branches, never rename or remove fields").

**Where to add** (lines 235-257): compute next to `intermediates`, so the existing `allFinite` guard covers it:
```javascript
  if (!allFinite(metrics) || !allFinite(intermediates)) {
    return fail(eye, [diag('NON_FINITE_RESULT', {})]);
  }
```
Update the `LensResult` JSDoc typedef (lines 27-55) in the same edit. `fail()` (line 75) returns `metrics: null` etc. Add the new field as `null` there too, so callers can rely on the key.

---

### `src/engine/outline-geom.js` (new)

**Analog:** `src/engine/evaluate.js:116-128`, lifted unchanged and exported:
```javascript
/** Even-odd ray test: is (px, py) inside the closed outline polygon? */
function insideOutline(outline, px, py) {
  let inside = false;
  const n = outline.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = outline[2 * i];
    const yi = outline[2 * i + 1];
    const xj = outline[2 * j];
    const yj = outline[2 * j + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
```
Add a signed distance and the precomputed r_min/r_max fast path (RESEARCH Pattern 3). The outline comes from `frameOutline(shape, A, B, eye)` (`src/engine/frame/outline.js`; 720 points, CCW, lens-local, memoised). Do not pass `n`.

---

### `src/engine/warp.js` (new, grid + classes + quadtree)

**Analog:** `src/engine/profile.js` (samples surfaces into typed arrays, no throw) and `src/engine/mesh/lens.js` (writes into caller-sized typed arrays, one `finite` flag).

**Imports pattern** (profile.js style, relative, engine only):
```javascript
import { traceFromEye, TRACE_STATUS } from './trace.js';
import { insideOutline, signedDistance } from './outline-geom.js';
import { frameOutline } from './frame/outline.js';
import { FRAME_FACE_MM } from './mesh/frame.js';
```
`FRAME_FACE_MM` is already exported from `src/engine/mesh/frame.js` (imported by `view.js:81`). Reuse it for the class 4/5 band. Do not add a second constant.

**No-throw result** (profile.js lines 62-65, 116-119): return a frozen failure object, never NaN. Fold `Number.isFinite` into the write loop (03-PATTERNS note: cheaper than `.every` on large arrays).

**Output convention:** typed arrays only (`Float32Array uv`, `Uint8Array cls`, leaf list), so `transferOf` (`src/state/transfer.js`) can move them. Name fields in the wearer frame (`wTanX`), per RESEARCH Pattern 1.

---

### Engine tests: `warp.test.js`, `magnification.test.js`, `trace.test.js` (mod)

**Analog:** `src/engine/trace.test.js` lines 1-45.

**Imports and helpers** (lines 1-21):
```javascript
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { traceRay, traceBVP } from './trace.js';
import { design, backSagAt } from './design.js';
import { rxToMatrix, matrixToRx, vogelBaseCurve, sphericalEquivalent } from './power.js';
import { evaluateLens } from './evaluate.js';

const q4 = (lo, hi) => fc.integer({ min: lo * 4, max: hi * 4 }).map((k) => k / 4);
const axisError = (a, b) => { const d = Math.abs(a - b) % 180; return Math.min(d, 180 - d); };
```
`q4` generates quarter-dioptre steps for the D-12 (b) sign property. `axisError` is the right comparison for the D-07 golden test (φ = 180° − θ). **Case-table style** (lines 22-37): one `it` per `{ sph, cyl, axisDeg, n }` row, with the tolerance in the test name. Use the measured RESEARCH values (−5,6037 %, +7,7669 %, −2,8543 / −5,6037 %, eigvec engine 30° → screen 150°).

**Coverage gate:** `vite.config.js:46-51` holds `src/engine/**/*.js` to 95 % lines and 90 % branches. Every status branch of `traceFromEye` and every class 1-5 needs a test.

---

### `src/engine/warp.bench.js` (new) and `scripts/p0-feasibility.mjs` (new)

**Analog:** `test/bench/recompute.test.js` lines 1-40. It asserts correctness only and prints timings ("CI timing never gates"):
```javascript
import { performance } from 'node:perf_hooks';
...
function bench(pairFor) {
  for (let i = 0; i < 10; i++) evaluatePair(pairFor());
  const times = [];
  ...
  times.sort((a, b) => a - b);
  const median = (times[BENCH_RUNS / 2 - 1] + times[BENCH_RUNS / 2]) / 2;
  const p95 = times[Math.ceil(0.95 * times.length) - 1];
```
Reuse `NORMAL_PAIR` / `GRENZFALL_PAIR` from `src/state/bench-cases.js` (UI-SPEC: "median of the default and the Grenzfall Rx"). `scripts/` does not exist and is not covered by an ESLint globals block (`eslint.config.js:17-20` lists `*.config.js`, `test/**`, `src/**/*.test.js`, `e2e/**`). Add `scripts/**/*.mjs` there or the script will not lint.

---

### `src/state/warp-protocol.js` (new)

**Analog:** `src/state/mesh-protocol.js` (whole file, 172 lines).

**Header with message table** (lines 1-23): copy the format and list `warp` request/reply fields.

**Validation** (lines 36-52). Reuse the exact surface check:
```javascript
const SURFACE_KEYS = ['n', 'ct', 'c1', 'k1', 'ca', 'cb', 'axisRad'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
function invalidSurfaces(s) {
  if (!s || typeof s !== 'object') return 'surfaces';
  for (const k of SURFACE_KEYS) if (!isNum(s[k])) return `surfaces.${k}`;
  if (!s.oc || !isNum(s.oc.x) || !isNum(s.oc.y)) return 'surfaces.oc';
  return null;
}
```
`invalidShapeSize` (lines 41-45) for the frame and `SHAPES` from `../engine/frame/shapes.js`.

**Handler factory with injected clock, never throws** (lines 98, 159-171):
```javascript
export function createMeshHandler({ meshFn = buildLensMesh, frameFn = buildFrameMesh, now = () => globalThis.performance.now() } = {}) {
  ...
  return (msg) => {
    const id = msg?.id ?? null;
    try {
      if (msg?.type === 'mesh') {
        const t0 = now();
        const items = (msg.items ?? []).map(buildItem);
        return { type: 'mesh', id, items, computeMs: now() - t0 };
      }
    } catch { /* fall through */ }
    return { type: 'error', id, message: 'mesh worker: unknown message' };
  };
}
```
Per-item `try/catch` with a `fail(...)` object (lines 99-106, 146-157). `export const READY = Object.freeze({ type: 'ready' });` (line 30). The client sync fallback calls `createWarpHandler` by name.

---

### `src/state/warp-client.js` (new)

**Analog:** `src/state/mesh-client.js` (whole file, 200 lines). Copy the contract, do not generalise the mesh client (RESEARCH Pattern 5; it hard-codes `type: 'mesh'` at lines 107, 151, 182).

Pieces to carry over unchanged in shape:
- injected deps, lines 39-49 (`send`, `onMesh`→`onWarp`, `onFallback`, `loadSyncHandler`, `setTimeoutFn`, `clearTimeoutFn`, `watchdogMs`, `now`, `isHidden`);
- watchdog with hidden-tab and late re-arm, lines 68-79 (`LATE_MS = 1000`, `MESH_WATCHDOG_MS = 10_000`);
- `fallback()` reports lost buffers, lines 85-96;
- `pump()` with the `DataCloneError` path, lines 98-117;
- `requestMesh` latest-wins with `dropped`, lines 166-172;
- `receive()` id/type filter, lines 174-189;
- `resume()`, `workerError()`, `mode()`.

Add a `cancel()` for leaving Durchblick (UI-SPEC "Leaving Durchblick: the warp job is cancelled"). `requestMesh([])` is the existing way to make an outstanding job stale (view.js header lines 23-25); a `cancel` that bumps the generation and drops `queued` follows the same idea.

---

### `src/state/guard.js` (new, F-06)

**Analog:** the inline thumbnail guard in `src/ui/view/view.js:907-916` and its constants at `:143-154`:
```javascript
      onCopy(spec, ms) {
        thumbDirty = false;
        thumbGuard.frames++;
        thumbGuard.lastMs = ms;
        thumbGuard.slowRun = ms > THUMB_SLOW_MS ? thumbGuard.slowRun + 1 : 0;
        if (!THUMB_GUARD_OFF && thumbGuard.slowRun >= THUMB_SLOW_RUN) {
          thumbGuard.tripped = true;
          disableBarThumb();
          return;
        }
```
Write the pure `nextGuard(g, ms, opts)` from RESEARCH Pattern 6, then replace lines 911-912 with a call to it (`budgetMs: 50`, `need: 2`). The test handle field `guard: { ...thumbGuard, thresholdMs: THUMB_SLOW_MS, run: THUMB_SLOW_RUN, off: THUMB_GUARD_OFF }` (line 1494) is read by e2e specs. Keep its keys.

The constants' comment block (lines 143-151, citing W3C Long Tasks for 50 ms) is the citation style for the 200 ms budget (web.dev/inp).

---

### State tests: `warp-client.test.js`, `warp-protocol.test.js`, `guard.test.js`

**Analog:** `src/state/mesh-client.test.js` lines 1-60. Injected fake timers, no `vi.useFakeTimers`:
```javascript
import { describe, test, expect, vi } from 'vitest';
import { createMeshClient, MESH_WATCHDOG_MS } from './mesh-client.js';

// Fake timers, injected (no vi.useFakeTimers); the fakeTimers() shape of compute-client.test.js.
function fakeTimers() { ... setTimeoutFn, clearTimeoutFn, advance(t), runOneZero(), fireLateAt(t), now ... }
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
```
Copy `fakeTimers()` and `flush()` into the warp-client test (the existing tests each keep their own copy; do not extract a shared helper now). `mesh-protocol.test.js` is the analog for `warp-protocol.test.js`, covering malformed items, a missing `id`, and never throwing.

---

### `src/worker/warp.worker.js` (new)

**Analog:** `src/worker/mesh.worker.js` (14 lines), copied 1:1:
```javascript
import { createMeshHandler, READY } from '../state/mesh-protocol.js';
import { transferOf } from '../state/transfer.js';

const handle = createMeshHandler();
self.onmessage = (e) => {
  const r = handle(e.data);
  self.postMessage(r, transferOf(r));
};
self.postMessage(READY);
```
Created in the view chunk like the mesh worker (`view.js:520-527`):
```javascript
  try {
    worker = new Worker(new URL('../../worker/mesh.worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (e) => client.receive(e.data));
    worker.addEventListener('error', () => client.workerError());
    worker.addEventListener('messageerror', () => client.workerError());
  } catch {
    client.workerError();
  }
```
Client wiring with `loadSyncHandler: () => import('../../state/mesh-protocol.js')`, `isHidden: () => document.hidden` and the `visibilitychange` → `resume()` listener: `view.js:508-530`. Create the warp worker **lazily on first entry into Durchblick** (D-13: "computed only while the Durchblick mode is shown"), not at mount. That way Glas-only sessions and the D-27 memory baseline are unchanged. `e2e/helpers.js:107` has `MESH_WORKER_URL = /\/assets\/mesh\.worker[^/]*\.js$/`. Add a `WARP_WORKER_URL` next to it.

---

### `src/ui/view/refraction.js` (new, ortho draw pass)

**Analogs:** `src/ui/view/compare3d.js` (a pass that uses scissor/viewport and restores everything) and `src/ui/view/backdrop.js` (canvas-drawn chart texture).

**Pass swap hook** (scene.js lines 137, 286-289): the default pass is `() => renderer.render(scene, camera)`. `setPass(fn)` replaces it. view.js currently sets `view.setPass(compare3d.renderPass)` once (`view.js:380`). Durchblick must set its own pass on entry and put `compare3d.renderPass` back on exit.

**Scissor pattern with guaranteed restore** (compare3d.js lines 182-221):
```javascript
    const { W, H } = stageSize();
    try {
      ...
      if (state.split) {
        renderer.clear();
        renderer.setScissorTest(true);
        for (const half of HALVES) {
          const b = halfBox(half);
          renderer.setViewport(b.x, 0, b.w, b.h);
          renderer.setScissor(b.x, 0, b.w, b.h);
          viewports.push({ w: b.w, h: b.h });
          ...
          renderer.render(scene, camera);
        }
      } ...
    } finally {
      if (state.split) {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, W, H);
      }
      restore();
    }
```
Use one panel per eye (two-panel layout, wearer's view: right lens on the right, D-06).

**Canvas texture pattern** (backdrop.js lines 43-48, 106-111, 120-137):
```javascript
const canvasOf = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  return { canvas, g: /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')) };
};
  const texture = (canvas) => {
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = anisotropy;
    return map;
  };
```
`MeshBasicMaterial({ toneMapped: false })`, which keeps chart pixels exact for the `isChart` pixel helpers (`e2e/helpers.js:287`). The letter drawing (`drawBand`, lines 63-82, cap-height measurement) and `INK` / `PAPER` / `LETTERS` constants should be **reused** (export them from backdrop.js) rather than re-typed, so the "own procedural chart" stays one drawing (D-08). The `reupload()` contract (lines 152-154) is needed for `webglcontextrestored` (scene.js 269-277; UI-SPEC: "redrawn from the last warp result").

**Dispose on leave:** the D-27 counts in `e2e/view-memory.spec.js` lines 14-35 (G = 21, T = 6) must be unchanged after leaving Durchblick. Each ortho geometry/texture must be disposed on leave, or the spec gets a documented new EXPECTED derivation, written in the same style.

---

### `src/ui/view/view.js` (modify)

**Mode switch** (lines 936-949 and 1122-1150): extend the union and the radio cast. Note that `setMode` calls `controls.goTo('default', 'OD')` when it leaves Dickenkarte (1144-1146). UI-SPEC "Entering and leaving Durchblick" instead requires that the saved pose be **restored with a cut** when leaving Durchblick. Use `controls.state()` (test handle line 1504 reads it) to save, and `goTo(..., { cut: true })` (used at line 1268) to restore.

**Expert-off rule** (944-949): only `mode === 'heat'` returns to Glas. Leave it as is; Durchblick stays (UI-SPEC).

**Badge / caption** (322, 1226): `modeBadge()` and the caption ternary gain the `'ref'` keys.

**Tech lines** (`setText('tech-view-tier', t(...))` line 338; `tech-view-remesh` line 651): the pattern for `tech.ref.*` (active grid tier, compute ms, step log).

**F-04 gate** (line 1412): wrap `window.__eyeglassView = Object.freeze({...})` in a static `if (import.meta.env.MODE === 'e2e')` (or `DEV`). The read-once query flag precedent is `THUMB_GUARD_OFF = location.search.includes('thumbguardoff')` (line 154). A query flag is **not** a build gate: the UI-SPEC "Test hook" item needs the degraded-tier override to be absent from `dist/` too, so use the same build-time condition for both.

---

### `src/ui/view/fullscreen.js` (modify, F-02)

**Analog:** itself plus `src/ui/view-place.js` (DOM move, not clone):
```javascript
    if (mq.matches) {
      if (result.nextElementSibling !== slot) result.after(slot);
    } else {
      const col = /** @type {HTMLElement} */ (slot.closest('.col-results'));
      if (col.firstElementChild !== slot) col.prepend(slot);
    }
```
Hook point: `onChange(on)` is called from `set()` when the on/off state flips (fullscreen.js line 69). Move the listed blocks into `#view-fs-info` there, and move them back on exit (remember each node's original `parent` + `nextSibling`). The inert walk (`setInert`, lines 35-56) only inerts siblings outside the stage, so blocks moved **inside** the stage stay operable, as the UI-SPEC requires.

---

### `src/ui/view/text.js` (modify: size block and Durchblick aria)

**Analog:** itself. It is pure (imports engine helpers, `t()`, `format.js`) and every string is tested in Node (`text.test.js`). Copy the shape of `protrusionLines(eyes, display)` (lines 36-50): input = engine values per eye or `null` for blocked, output = `{ title, lines, ... }` strings. Format the percentages with a new `fmtPercent` in `format.js`, not inline (CLAUDE.md: numbers never inside translated strings). Use the `EYES` / per-eye key map style (lines 17-19).

---

### `src/i18n/format.js` (modify: percent)

**Analog:** the module's own `Intl.NumberFormat('de-AT', …)` constants (lines 7-28) and `typographicMinus` (line 30). Follow the "No toFixed: Intl handles rounding and -0" rule (line 2). UI-SPEC: "praktisch gleich groß" only when the **formatted** value is "0,0 %", so the text builder must compare the formatted string, not the number.

---

### `src/i18n/de-AT.js` (modify)

**Analog:** the `view.*` block lines 647-749 (`'view.badge.glass': 'Visueller Eindruck'`, `'view.mode.heat': 'Dickenkarte'`, `'view.caption.glass': …`). Add `view.mode.ref`, `view.badge.ref*`, `view.caption.ref`, `view.ref.*`, `update.*`, `tech.offline.*`, `tech.ref.*` with the UI-SPEC "Copywriting Contract" wording. `dictionary.test.js` enforces the "Stärke" ban and key parity. Update `view.caption.glass` (D-11).

---

### `index.html` (modify)

**Analog:** lines 395-399 (current Expert-only switch):
```html
<fieldset id="view-mode" class="segmented" data-expert hidden>
  <legend><span class="expert-tag" data-i18n="expert.tag"></span> <span data-i18n="view.mode.legend"></span></legend>
  <label><input type="radio" name="view-mode" value="glass" checked disabled><span data-i18n="view.mode.glass"></span></label>
  <label><input type="radio" name="view-mode" value="heat" disabled><span data-i18n="view.mode.heat"></span></label>
</fieldset>
```
Changes: drop `data-expert hidden` and the `.expert-tag` from the fieldset, put `data-expert` on the Dickenkarte `<label>`, and add `value="ref"`. View-mode removal without WebGL is `$('view-mode').remove()` at `view.js:297`. The UI-SPEC says that without WebGL Durchblick "is not offered" but the size block still shows, so the size block must live outside `#view-mode`. Other changes:
- `<link rel="icon" href="data:,">` (line 7) becomes the SVG favicon. Do not add a manifest `<link>` by hand: the plugin injects it.
- `#app-update` and `#app-update-live` go first in `<body>`, before `<header>` (line 12).
- `#view-ref` and its children go after `#view-heat` (line 430).
- `#view-fs-info` goes inside `#view-stage` (after line 405).
- `p#tech-offline` and the `tech-ref-*` lines go next to `tech-view-*` (lines 760-766).
- All static text uses `data-i18n` and no `style` attributes (CSP).

---

### `src/ui/update.js` (new)

**Closest analog:** `src/ui/summary-bar.js` (a fixed bottom element on phones, driven by observers and `matchMedia`, textContent only):
```javascript
import { $, setText } from './dom.js';
import { t } from '../i18n/t.js';
const NARROW = '(max-width: 899.98px)';
...
export function initSummaryBar() {
  narrow = matchMedia(NARROW);
  narrow.addEventListener('change', updateVisibility);
  new IntersectionObserver((entries) => { ... }).observe($('result'));
```
Reuse the same `NARROW` query string (it already appears in three files: summary-bar.js:14, view-place.js:14, view.js:156). The `--bar-h` custom property comes from a ResizeObserver on `#summary-bar` via `el.style.setProperty` (UI-SPEC; CSP-safe). The registration code is RESEARCH "Registration (bundled, after first result paint)". `hadController` and the `controllerchange` listener run at module evaluation (UI-SPEC "Order at module start"). See bite #5 for the testable split.

**Button creation pattern** (presets.js lines 16-22):
```javascript
function button(text, className) {
  const b = document.createElement('button');
  b.type = 'button';
  if (className) b.className = className;
  b.textContent = text;
  return b;
}
```
Or put the buttons in `index.html` with `data-i18n`. Static markup is simpler, and the UI-SPEC DOM block lists them.

---

### `src/ui/handover.js` (new)

**Closest analog:** `src/ui/presets.js` `applyRx` (lines 86-101). It writes field **text** and dispatches one `input`, so parse → validate → compute runs as for typing (T-02-25):
```javascript
function applyRx(p, onApplied) {
  const same = /** @type {HTMLInputElement} */ ($('rx-same'));
  if (same.checked) {
    same.checked = false;
    same.dispatchEvent(new Event('change', { bubbles: true }));
  }
  for (const eye of ['od', 'os']) {
    for (const f of RX_FIELDS) /** @type {HTMLInputElement} */ ($(`rx-${eye}-${f}`)).value = p[eye][f];
  }
  onApplied(p);
  $('rx-od-sph').dispatchEvent(new Event('input', { bubbles: true }));
}
```
This is exactly the UI-SPEC rule "validated through the normal parse/validate path, never trusted raw". Store the **raw field strings** and restore them the same way. Never store parsed numbers. Apply the size cap and `JSON.parse` inside `try`, and delete the key before applying (Pitfall 11). The frame restore analog is `applyFrame: applyFrameSizes` (passed into `initPresets` at `main.js:263`). The single key `eyeglass-rx:v1:handover` appears once as a string literal (boundary test).

---

### `src/ui/pipeline.js` / `src/ui/main.js` (modify)

**After-first-paint hook:** `paintDeliveries()` (pipeline.js lines 142-177) is where the first painted result lazy-loads the view (`refreshView()` line 176; header line 23 "the first painted result lazy-loads the 3D view chunk"). Start the SW registration from the same point, once, plus the `requestIdleCallback({ timeout: 3000 })` after `load` fallback (UI-SPEC "Registration timing"). The dynamic-import + error-handling style is `loadView()` (lines 263-286):
```javascript
function loadView() {
  import('./view/view.js').then(
    ({ mountView }) => { ... },
    (err) => { console.warn('3D view could not load', err); ... },
  );
}
```
A dynamic `import('./update.js')` keeps workbox-window out of the entry chunk.

**Handover read at start:** `init()` in `main.js` (217-280) ends with `startWorker(); scheduleFirst();`. Read the handover before `scheduleFirst()`, after `initPresets` / `initRxInput` have bound their listeners. Otherwise the dispatched `input` has no handler.

---

### `src/ui/view/tiers.js` (modify: grid tiers)

**Analog:** itself. Pure, no globals; caller passes `coarse` / `minScreen`:
```javascript
const freeze = (s) => Object.freeze({ ...s, chart: Object.freeze(s.chart) });
export const TIER_SETTINGS = Object.freeze({
  hoch: freeze({ ... }), mittel: freeze({ ... }), sparsam: freeze({ ... }),
});
export function pickTier({ coarse, minScreen }) { return coarse && minScreen < PHONE_MAX_SIDE ? 'mittel' : 'hoch'; }
```
Add `REF_GRID_TIERS = Object.freeze({ fein: { cellPx: 6 }, mittel: { cellPx: 8 }, grob: { cellPx: 11 } })` (values provisional until P0) and a start-tier function keyed off `pickTier`'s result (UI-SPEC: "fein" on hoch, "mittel" on mittel). `tiers.test.js` is the test analog. See bite #10.

---

### `vite.config.js` (modify)

**Analog:** its own plugin objects (lines 11-37) and `plugins: [appMeta, cspMeta]` (line 41). Add `VitePWA({...})` from RESEARCH Pattern 7 to the array, with `injectRegister: false`. Keep the CSP comment (lines 22-24) and the string unchanged. `APP_VERSION_OVERRIDE` for build B goes where `APP_VERSION` is consumed (line 17: `.replaceAll('%APP_VERSION%', APP_VERSION)`). Use `process.env.APP_VERSION_OVERRIDE ?? APP_VERSION`, the same idea as `process.env.GITHUB_SHA ?? 'dev'` (line 5). `smoke.spec.js:324` asserts `#app-version` equals `APP_VERSION` from `version.js`, so only the switch-server build B may set the override.

---

### `playwright.config.js` (modify)

**Analog:** the conditional `perf` project (lines 41-43) and the `webServer` block (lines 16-18):
```javascript
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npm run preview', url: LOCAL_URL, reuseExistingServer: !process.env.CI },
```
`webServer` can be an array. Add the switch server on its own port for the `pwa` project only. Add `serviceWorkers: 'block'` inside `use` of `desktop` and `mobile` (lines 25, 29-38), and `testIgnore` the `pwa` spec there, as `PERF_SPEC` is ignored (lines 5, 24, 39). F-01: `retries` (line 12) stays 1 on CI. The `retries: 0` for "never-happens" tests is set per test (`test.describe.configure({ retries: 0 })`) in `worker.spec.js` near line 331.

---

### `package.json` (modify) and `test/ci/pins.test.js`

**Analog:** existing devDependencies (lines 19-29). Every value must match `/^\d+\.\d+\.\d+$/` (pins.test.js line 65), and `.npmrc` has `save-exact=true`. Add `vite-plugin-pwa: "2.0.0"`, `workbox-build: "7.4.1"`, `workbox-window: "7.4.1"` in devDependencies. **Do not run slopcheck from the repo root** (RESEARCH incident: it runs a real `npm install`).

---

### `.github/workflows/deploy.yml` and `test/ci/workflow-structure.test.js` (modify)

**Analog:** themselves. The structure test pins:
- run-line order (lines 66-82);
- no `|` in build `run:` lines (lines 91-95), so the `$GITHUB_STEP_SUMMARY` flaky report (F-01) cannot be a piped shell line. Use a small Node script or the Playwright JSON reporter written to a file and then a `node` step;
- no `always()` / `failure()` / `|| true` / `continue-on-error` (lines 84-89). A summary step that should run even when e2e fails is therefore **not allowed**. Write the summary from a custom Playwright reporter inside the same `npm run test:e2e` step.

`verify-live` (deploy.yml lines 63-90) runs the full `npm run test:e2e` against the live URL. If the F-04 split happens, change it to the `@live` subset and update the test's expectations in the same plan.

---

### `test/ci/pwa-build.test.js` (new)

**Analog:** `test/ci/pins.test.js` lines 1-9 (Node file reads from the repo root):
```javascript
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(path.join(root, p), 'utf8');
```
It reads `dist/manifest.webmanifest`, `dist/sw.js` and `dist/assets/*`. **Ordering trap:** CI runs `npm run test:coverage` **before** `npm run build` (deploy.yml lines 36-38), and the unit project includes `test/**/*.test.js` (vite.config.js line 60). So in CI this test sees no `dist/` (or a stale one locally). Either skip with a clear message when `dist/` is absent and add a separate post-build step (for example `npx vitest run test/ci/pwa-build.test.js`, which must then be in the structure-test order list), or move it into a Playwright/Node step after the build. Decide in the plan.

---

### `src/engine/boundary.test.js` (modify: storage allow-list)

**Analog:** itself, lines 112-141. Keep `STORAGE` and the scan. Filter `src/ui/handover.js` out of the `hits` check, and add:
- a positive control that `handover.js` is in the scanned list and matches `sessionStorage`;
- an assertion that it contains exactly one `eyeglass-rx:v1:` key string and none of `localStorage|indexedDB|document\.cookie`.

---

### `e2e/view-ref.spec.js` (new)

**Analog:** `e2e/view-heat.spec.js` lines 1-50. Header comment with requirement IDs, `noThreeWarnings` before/after, `test.use({ reducedMotion: 'reduce' })`, `guardPage(test, { view: true })`, small `ev`/`mode`/`frames` helpers, and a mode-on helper:
```javascript
async function heatOn(page) {
  await page.locator('#view-mode label', { hasText: 'Dickenkarte' }).click();
  await page.waitForFunction(() => window.__eyeglassView.mode() === 'heat' && window.__eyeglassView.heatScale() !== null);
  await frames(page);
}
```
Pixel reads go through `__eyeglassView.pixels(points)` (view.js 1527-1537: render and `readPixels` in one task). Chart colour checks use `isChart` / `isChartish` (`e2e/helpers.js:287-292`).

### `e2e/pwa.spec.js` (new)

**Partial analog:** `e2e/worker.spec.js:400-423`. It collects `page.on('response')` asset paths under `/Eyeglass-Prescription/assets/`, checks `window.__csp`, console CSP messages and the exact CSP meta. Add `context.setOffline(true)` + `context.route('**/*', r => r.abort())` + `response.fromServiceWorker()` (Pitfall 10). This spec must not depend on `__eyeglassView` if it is also meant to run in the `@live` subset.

### `e2e/a11y.spec.js` (modify, F-03)

At line 215, `if (name.startsWith('3D ')) test.setTimeout(120_000);` covers only the `3D ` states. The 30 s failure is in a non-3D state under 4 workers. Either widen the condition or split the viewport loop (lines 214-222) into one test per viewport. Add the Durchblick states to `VIEW_STATES`.

## Shared Patterns

### Latest-wins worker lane
**Source:** `src/state/mesh-client.js` + `src/state/mesh-protocol.js` + `src/worker/mesh.worker.js`
**Apply to:** warp-client, warp-protocol, warp.worker. Same `READY` handshake, the same 10 s watchdog with hidden/late re-arm, the same sync fallback via dynamic import one item per macrotask, and the same `transferOf` buffer round trip.

### Pure engine, cited constants
**Source:** `src/engine/rim.js:9-20`, `src/engine/power.js:1-25`, `eslint.config.js:83-109`
**Apply to:** trace.js, magnification.js, warp.js, outline-geom.js. Mark constants `[ASSUMED]` or `[CITED]` in a comment. No `performance`, no DOM, no state/ui/i18n imports. Tests must cover every branch (95/90 gate).

### Strings and numbers
**Source:** `src/ui/view/text.js` (pure string builders), `src/i18n/format.js` (Intl de-AT), `src/ui/dom.js` `setText`
**Apply to:** size block, Durchblick aria-label, banner, tech lines. Use `textContent` only; ESLint bans `innerHTML` / `insertAdjacentHTML` in `src/ui/**` (`eslint.config.js:22-39`). No `style` attributes (CSP), except `style.setProperty` for `--bar-h`, which the UI-SPEC accepts.

### Test hook and query flags
**Source:** `view.js:152-154` (`?thumbguardoff`), `pipeline.js:51` (`?perfmarks`), `pipeline.js:230` (`window.__eyeglassNo3d`)
**Apply to:** the F-04 gate and the forced-degraded hook. Read-once query flags exist today. F-04 needs a **build-time** condition (`import.meta.env.MODE`) so the dist grep test can prove absence.

### Stale badge after 100 ms
**Source:** `view.js:127-128` (`BADGE_AFTER_MS = 100`) and `:1403-1409`
```javascript
      badgeTimer = setTimeout(() => {
        badgeTimer = null;
        if (viewEl.dataset.pending === 'mesh') setBadge('view.badge.updating');
      }, BADGE_AFTER_MS);
```
**Apply to:** "Durchblick wird berechnet …" (UI-SPEC "Scheduling and stale state"). Add a `data-pending` value (for example `'warp'`) so a new `settledRef` helper in `e2e/helpers.js` can wait for it like `settledView` (line 59).

### Pinned, gated CI
**Source:** `test/ci/pins.test.js`, `test/ci/workflow-structure.test.js`
**Apply to:** every package.json and deploy.yml change. These change together with their tests in one plan.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| VitePWA block in `vite.config.js` | config | — | No PWA yet. Use RESEARCH Pattern 7 (verified against the 2.0.0 tarball). |
| `src/ui/update.js` registration core | controller | event-driven | No service worker anywhere in `src/`. Use RESEARCH "Registration" + Pattern 8. Only the banner layout borrows from summary-bar.js. |
| `src/ui/handover.js` storage part | utility | storage | No storage user exists (T-02-39 forbade it). Only the restore half has an analog (presets.js applyRx). |
| `e2e/support/switch-server.mjs` | test infra | request-response | Playwright cannot route an updated SW script (#14711). A small `node:http` static server serving `dist-A` / `dist-B` under `/Eyeglass-Prescription/`. |
| `public/*.svg`, `public/*.png` | asset | — | `public/` does not exist. Icons drawn per UI-SPEC "Manifest and app icon". The PNGs need a one-off generation step; `@vite-pwa/assets-generator` must not be installed (RESEARCH). |
| `scripts/p0-feasibility.mjs` | script | batch | No `scripts/` directory. The timing loop borrows from `test/bench/recompute.test.js`. The ESLint globals block needs `scripts/**`. |

## Metadata

**Analog search scope:** `src/engine/**`, `src/state/**`, `src/worker/**`, `src/ui/**`, `src/i18n/**`, `e2e/**`, `test/**`, `index.html`, `vite.config.js`, `playwright.config.js`, `eslint.config.js`, `package.json`, `version.js`, `.github/workflows/deploy.yml`
**Files read:** 34 (trace.js, mesh-client.js, mesh-protocol.js, mesh.worker.js, view.js (targeted ranges), scene.js, compare3d.js, backdrop.js, tiers.js, fullscreen.js, view-place.js, summary-bar.js, pipeline.js (ranges), main.js (range), presets.js (range), evaluate.js (ranges), profile.js (range), rim.js, power.js (header), conventions.js (header), boundary.test.js, trace.test.js (header), mesh-client.test.js (header), view-heat.spec.js (header), view-memory.spec.js (header), worker.spec.js (range), a11y.spec.js (range), helpers.js (header), recompute.test.js, pins.test.js, workflow-structure.test.js, deploy.yml, vite.config.js, playwright.config.js, eslint.config.js, package.json, version.js, index.html (ranges), text.js (header))
**Pattern extraction date:** 2026-11-13
