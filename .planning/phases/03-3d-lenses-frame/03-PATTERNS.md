# Phase 3: 3D Lenses & Frame - Pattern Map

**Mapped:** 2026-11-08
**Files analyzed:** 34 (new and modified)
**Analogs found:** 28 / 34. The 6 without an analog are the Three.js view internals; nothing in the repo imports `three` yet.

## Read this first (things most likely to bite)

1. **`thickest()` lives in the state layer.** `thickest(m)` and `thinnest(m)` are in `src/state/compare.js:16,30`. The engine lint block bans `**/state/**` imports (`eslint.config.js:66-69`). So `src/engine/mesh/heat.js` cannot import them. Either compute `Math.max(m.ct, m.etMax.value)` inline in the engine helper, or put the shared heat scale in `src/state/`. The UI-SPEC says "scaleMax = the maximum of the thickest point (thickest(m))", so the result has to equal `thickest`, and a test should assert that.
2. **Changing the handler's return shape breaks two callers.** RESEARCH Pattern 4 wants the handler to return `{ msg, transfer }`. Today `createHandler()` returns the message itself, and two callers rely on that:
   - `src/worker/engine.worker.js:7`: `self.postMessage(handle(e.data))`
   - the sync fallback at `src/ui/pipeline.js:196-200`: `client.receive(handle(msg))`

   Both need to change together, or the handler keeps returning `msg` and a separate `transferOf(msg)` helper is added. The second option is smaller (surgical rule). `e2e/helpers.js` `slowWorker`/`holdWorker` already forward `...rest`, so a transfer list passes through them unchanged (lines 67-68, 88).
3. **The `frame.rim.*` texts and `rim.test.js` change meaning.** `paintRim()` at `src/ui/frame-input.js:67-83` uses `edgeBeyondRim`. Under bevel rule '1:2' it must switch to `bevelSplit` (RESEARCH Pattern 2). `e2e/frame.spec.js` / `expert.spec.js` expectations on "passt"/"steht vor" may move too. The plan must state this for lens-critic.
4. **Coverage gate.** `vite.config.js:40-45` puts `src/engine/**/*.js` under 95 % lines / 90 % branches. Anything in `src/engine/mesh/` inherits it, including defensive branches such as `finite: false`, so each branch needs a test.
5. **The `three` lint boundary does not exist for `src/ui/**` yet.** The UI block (`eslint.config.js:23-39`) has no `no-restricted-imports`. One has to be added, with `src/ui/view/**` exempt, plus probes in `boundary.test.js`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/engine/mesh/topology.js` (new) | utility (constants + static index arrays) | transform | `src/engine/frame/outline.js` | role-match |
| `src/engine/mesh/lens.js` (new) | engine builder | transform (surfaces → typed arrays) | `src/engine/profile.js` `meridianProfile` | exact |
| `src/engine/mesh/frame.js` (new) | engine builder | transform | `src/engine/profile.js` + `frame/outline.js` | role-match |
| `src/engine/mesh/heat.js` (new) | engine helper | transform | `src/engine/profile.js` + `metrics.js extremeIndices` | role-match |
| `src/engine/rim.js` (mod: `bevelSplit`, `BEVEL_RULE`) | engine helper | transform | itself (`edgeBeyondRim`) | exact |
| `src/engine/mesh/lens.test.js`, `tessellation.test.js`, `frame.test.js`, `heat.test.js` (new) | test (unit + fast-check) | — | `src/engine/profile.test.js`, `frame/outline.test.js` | exact |
| `src/engine/rim.test.js` (mod) | test | — | itself | exact |
| `eslint.config.js` (mod) | config | — | its own worker/engine blocks | exact |
| `src/engine/boundary.test.js` (mod) | test | — | itself | exact |
| `src/state/compute-protocol.js` (mod: `mesh` type) | service (worker handler) | request-response | its own `profile` branch, lines 62-66 | exact |
| `src/state/compute-client.js` (mod: mesh lane) | service (client queue) | request-response, latest-wins | its own profile lane | exact |
| `src/worker/engine.worker.js` (mod: transfer) | worker glue | request-response | itself | exact |
| `src/state/compute-protocol.test.js`, `compute-client.test.js` (mod) | test | — | their `profile (02-13)` describes | exact |
| `src/ui/pipeline.js` (mod: request mesh after paint) | controller | event-driven | `updateXsec` / `onProfile` / `paintXsec`, lines 560-675 | exact |
| `src/ui/main.js` (mod: lazy mount hook) | controller | event-driven | `init()`, lines 216-278 | exact |
| `src/ui/frame-input.js` (mod: `paintRim` → `bevelSplit`) | component | request-response | itself, lines 61-83 | exact |
| `src/ui/summary-bar.js` (mod: thumbnail slot) | component | event-driven | itself | exact |
| `src/ui/icons.js` (mod: `rotate` icon) | utility | — | its `SHAPES` table | exact |
| `src/i18n/de-AT.js` (mod: `view.*`, `tech.view.*`) | config (dictionary) | — | `frame.rim.*` / `xs.*` blocks | exact |
| `src/ui/style.css` (mod) | config (styles) | — | `.segmented`, `#summary-bar`, `.visually-hidden` | exact |
| `index.html` (mod: `#view-slot` reserved box, if static) | markup | — | `section#xsec`, lines 661-683 | exact |
| `package.json` (mod: `three@0.187.0` in `dependencies`) | config | — | existing exact pins + `test/ci/pins.test.js:60-65` | exact |
| `src/ui/view/index.js` (new, lazy entry) | provider / controller | event-driven | `pipeline.js` `onFallback` dynamic import (196-203) + `startWorker` try/catch (222-238) | role-match |
| `src/ui/view/legend.js` (new) | component (SVG + table) | transform | `src/ui/cross-section.js` | exact |
| `src/ui/view/labels.js` (new) | component (projected HTML) | transform | `cross-section.js` `htmlEl` + `dom.js setText` | partial |
| `src/ui/view/controls.js` (new) | component (input handling) | event-driven | `summary-bar.js` (matchMedia, IntersectionObserver, reduced motion) | partial |
| `src/ui/view/scene.js` (new) | provider (renderer) | event-driven (render on demand) | none | **no analog** |
| `src/ui/view/lenses.js` (new) | store (GPU slots, double buffers) | event-driven | none | **no analog** |
| `e2e/helpers.js` (mod: `settledView`, `?nowebgl`) | test helper | — | `settledXsec`, lines 37-41 | exact |
| `e2e/view.spec.js`, `view-heat.spec.js`, `view-compare.spec.js`, `view-memory.spec.js` (new) | test (e2e) | — | `e2e/xsec.spec.js`, `e2e/a11y.spec.js` | exact |
| `e2e/a11y.spec.js`, `e2e/worker.spec.js`, `e2e/perf-throttled.spec.js` (mod) | test | — | themselves | exact |
| GLSL heat `ShaderMaterial` (inside `src/ui/view/`) | shader | transform | none | **no analog** |
| Canvas chart / shadow textures (inside `src/ui/view/`) | utility | file-less texture | none | **no analog** |
| Debug handle `window.__eyeglassView` | utility | — | `window.__msgMs` probe, `pipeline.js:227` | partial |

## Pattern Assignments

### `src/engine/mesh/lens.js` (engine builder, transform)

**Analog:** `src/engine/profile.js`. It is the existing engine function that samples `frontSagAt`/`backSagAt`/`thicknessAt` into typed arrays and reports non-finite values without throwing.

**Header + imports pattern** (profile.js lines 1-10). Pure, relative imports from the engine only, and the header comment cites the requirement and the conventions:
```javascript
// ANA-01 (02-13): meridian profile (cross-section) of a computed lens. Pure: plain numbers in,
// plain data out, no throw. Lens-local coordinates relative to the boxing centre
// (conventions.js); ...
import { thicknessAt } from './metrics.js';
import { frontSagAt, backSagAt } from './design.js';
import { locationLabel, nasalSign } from './conventions.js';
import { frameOutline } from './frame/outline.js';
```
From `src/engine/mesh/` the paths become `'../design.js'`, `'../metrics.js'`, `'../frame/outline.js'`.

**Core sampling pattern: z convention** (profile.js lines 103-109). The mesh must use exactly the same signs:
```javascript
for (let i = 0; i < m; i++) {
  const x = ox + s[i] * c;
  const y = oy + s[i] * sn;
  zFront[i] = -frontSagAt(sf, x, y);
  zBack[i] = -sf.ct - backSagAt(sf, x, y);
  t[i] = thicknessAt(sf, x, y);
}
```

**Finite guard / no-throw result** (profile.js lines 62-65, 116-119). Use it for `finite: false` (RESEARCH Pitfall 10):
```javascript
const NO_CHORD = Object.freeze({ ok: false, code: 'NO_CHORD' });
const noChord = () => ({ ...NO_CHORD });
const finiteArray = (a) => a.every(Number.isFinite);
...
if (![s, zFront, zBack, t].every(finiteArray) || ...) return noChord();
return { ok: true, thetaDeg, s, zFront, zBack, t, ends, ct: sf.ct };
```
The builder writes into caller-owned `Float32Array`s (D-26). `.every` on a 46 081-element array per buffer is O(n). It is cheaper to fold `Number.isFinite` into the write loop and keep one `finite` flag.

**Surface API to call (no copies)** (design.js lines 35-73): `frontSagAt(s, x, y)`, `backSagAt(s, x, y)`, `frontSagGradAt(s, x, y) → [gx, gy]`, `backSagGradAt(s, x, y) → [gx, gy]`. The surfaces are OC-relative inside the functions; callers pass lens-local (boxing-centre) x, y. `thicknessAt` is in `metrics.js:10-12` (`s.ct - frontSagAt + backSagAt`).

**Outline input** (outline.js lines 1-2, 76). `frameOutline(shape, A, B, eye, n = 720)` returns a CCW `Float64Array [x0,y0,…]`, lens-local, with the first point at angle 0 and memoised. Never pass `n`: the fixed topology needs 720 (RESEARCH Pitfall 1).

**JSDoc style** (profile.js lines 67-79). Document the `surfaces` shape inline as `{ n, ct, c1, k1, ca, cb, axisRad, oc }`.

---

### `src/engine/mesh/topology.js` (utility, constants)

**Analog:** `src/engine/frame/outline.js` (argument guard, typed-array construction) and `src/engine/rim.js` (exported constant with a source comment).

**Guard pattern** (outline.js lines 6-10):
```javascript
function assertN(name, n) {
  if (!Number.isInteger(n) || n <= 0 || n % 4 !== 0) {
    throw new Error(`${name}: n must be a positive multiple of 4, got ${n}`);
  }
}
```
**Constant-with-provenance pattern** (rim.js lines 4-5):
```javascript
// [ASSUMED, RESEARCH A2] design constant, no citable value; shown as 'angenommener Wert'.
export const RIM_DEPTH_DEFAULT_MM = 3.0;
```
For `RINGS = 64`, `SPOKES = 720` and the grading exponent 2,5, cite "measured, 03-RESEARCH Pattern 1 table" instead of `[ASSUMED]`.

---

### `src/engine/mesh/frame.js` (engine builder, transform)

**Analog:** `profile.js` (builder shape) plus `outline.js` (CCW polygon handling). For the outward offset normal on a CCW outline, use the edge-vector convention from `profile.js` `hitEdge` (lines 24-35): `ex = outline[2k] − outline[2i]`. The outward normal of a CCW polygon is `(ey, −ex)`.

**Polygon-test helpers to reuse in `frame.test.js`.** Do not re-derive them. The `signedArea` and `rayCrossings` helpers in `src/engine/frame/outline.test.js` back the "star-shaped, CCW" assertion (lines 59-72):
```javascript
expect(signedArea(o)).toBeGreaterThan(0);
for (let k = 0; k < 3600; k++) {
  const c = rayCrossings(o, (2 * Math.PI * (k + 0.5)) / 3600);
  if (c !== 1) expect({ k, c }).toEqual({ k, c: 1 });
}
```
Use the same assertion for "the rim offset polygon is simple and CCW" (RESEARCH Pitfall 9).

**Eye placement.** `nasalSign(eye)` in conventions.js line 32 gives `'OD' → +1`, `'OS' → −1`. Use it for the bridge side, never a mirror of the OD arrays (D-04(d)).

---

### `src/engine/mesh/heat.js` (engine helper: callouts, iso step, scale)

**Analog:** `profile.js` `meridianProfile(lens, thetaDeg)` (lines 80-120). It returns `ends[0]` (direction θ) and `ends[1]` (θ + 180°), each `{ s, t, x, y, location }`, or `{ ok: false, code: 'NO_CHORD' }`. RESEARCH Pattern 7 requires the four edge callouts to be exactly `meridianProfile(lens, 0).ends` and `meridianProfile(lens, 90).ends`. Call it; do not write a new intersection.

The input shape is `{ surfaces, frame: { shape, A, B }, eye }`, the same items the worker profile lane sends (`compute-protocol.js:64`).

**Location words:** `locationLabel(x, y, eye)` in conventions.js line 52 and `meridianEndLabels(eye, thetaDeg)` in profile.js lines 148-153.

**Scale:** see "Read this first" item 1. `thickest(m)` (state/compare.js:16) cannot be imported here.

---

### `src/engine/rim.js` (modify: add `bevelSplit`, `BEVEL_RULE`)

**Analog:** the file itself (17 lines). Keep the style: a module comment saying "Pure, imports nothing", an `[ASSUMED …]` tag on the design choice, and a JSDoc block with `@param`/`@returns` and the "≥ 0" contract:
```javascript
/**
 * How far the thickest edge point (etMax, never the centre) exceeds the rim depth, mm: ...
 * @param {{ etMax: { value: number } }} metrics LensResult.metrics
 * @param {number} rimDepthMm
 * @returns {number} ≥ 0; 0 = the edge fits
 */
export function edgeBeyondRim(metrics, rimDepthMm) {
  return Math.max(0, metrics.etMax.value - rimDepthMm);
}
```
Update the module comment on lines 7-10, "The front/back split needs a bevel model (phase 3, VIZ-03)", once it is implemented. Cite US 8 388 133 in the comment (RESEARCH Pattern 2).

**Test analog:** `rim.test.js` (13 lines). Use `toBeCloseTo(x, 12)` for exact arithmetic and `toBe(0)` for the clamp:
```javascript
expect(edgeBeyondRim({ etMax: { value: 4.6 } }, 3.0)).toBeCloseTo(1.6, 12);
expect(edgeBeyondRim({ etMax: { value: 4.6 } }, 5)).toBe(0);
```

---

### `src/engine/mesh/*.test.js` (unit + fast-check)

**Analog:** `src/engine/profile.test.js`.

**Imports + fixture builder** (lines 1-28). Copy the `lens(o)` spec factory and the `quarter` arbitrary:
```javascript
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { evaluateLens } from './evaluate.js';
import { thicknessAt } from './metrics.js';
import { frameOutline } from './frame/outline.js';
...
const lens = (o = {}) => ({
  eye: 'OD', sph: -2.75, cyl: -0.5, axisDeg: 0, materialId: 'cr39',
  frame: { shape: 'rechteckig', A: 52, B: 38, DBL: 18 },
  monoPD: 32, fittingHeight: null, baseCurve: null, minCT: null, minET: null, ...o,
});
const quarter = (min, max) => fc.integer({ min: min * 4, max: max * 4 }).map((k) => k / 4 + 0);
const SHAPES4 = ['rund', 'rechteckig', 'panto', 'pilot'];
```
**Property header** (lines 47-60): `fc.assert(fc.property(fc.record({ sph, cyl, axisDeg, shape, monoPD, eye }), …))` with a `checked` counter and "(≥ 100 cases)" in the test name.

**Fuzz domain for extremes:** `src/engine/diagnostics.test.js:239-248` (`sph` ±12, `cyl` −6…0, `A` 40-62, `B` 28-55, `DBL` 14-24, `monoPD` 25-40, every `materialId`). Reuse it for the finiteness / fixed-length test.

**Describe naming:** requirement ID first, as in `describe('ENG-06 metrics', …)` and `describe('meridianProfile (ANA-01)', …)`. Use `describe('VIZ-01 lens mesh', …)` so `-t "VIZ-01"` in the RESEARCH test map works.

**Tolerance rule:** the 0,001 mm checks use `Math.abs(a − b) < 1e-3`, not index equality (RESEARCH Pitfall 2; `TIE_TOL_MM` at `metrics.js:112`).

**Timeout:** `testTimeout: 30_000` is already set (`vite.config.js:53`). The tessellation probe (about 60 lenses × 0,1-0,2 s) fits.

---

### `eslint.config.js` + `src/engine/boundary.test.js` (modify)

**Analog:** the worker block (`eslint.config.js:41-55`). `src/ui/view/**` is the only place allowed to import `three`:
```javascript
{
  files: ['src/worker/**/*.js'],
  languageOptions: { globals: { ...globals.worker } },
  rules: {
    'no-restricted-imports': ['error', { patterns: [
      { group: ['three', 'three/*'], message: 'The worker must not import Three.js.' },
      { group: ['**/ui/**'], message: 'The worker must not depend on the UI layer.' },
    ] }],
  },
},
```
New block: `files: ['src/ui/**/*.js'], ignores: ['src/ui/view/**']` with the `three` pattern. The existing UI block (lines 23-39) must stay intact, because it carries the innerHTML ban that also covers `src/ui/view/`. Flat config merges `rules` per key, so a second block with `no-restricted-imports` does not drop `no-restricted-syntax`. Confirm this with the boundary probe.

`src/engine/mesh/**` is already covered by `files: ['src/engine/**/*.js']` (line 58). No change is needed there, only a probe.

**Probe pattern** (boundary.test.js lines 19-41). It lints a virtual file path with the real config, plus a positive control:
```javascript
test.each([
  ["import * as T from 'three'; export const x = T;", 'no-restricted-imports'],
  ...
])('rejects %s (%s)', async (code, rule) => {
  expect(await ruleIds(code, 'src/engine/__probe__.js')).toContain(rule);
});
test('positive control: a pure function lints clean', async () => { ... });
```
Add probes for `src/engine/mesh/__probe__.js` (rejects `three`, `document`), `src/ui/__probe__.js` (rejects `three`) and `src/state/__probe__.js` (rejects `three`). Add a positive control `src/ui/view/__probe__.js` where `import * as T from 'three'` lints clean but `el.innerHTML = s` is still rejected.

---

### `src/state/compute-protocol.js` (modify: `mesh` message)

**Analog:** the `profile` branch (lines 62-66) and the header message table (lines 4-18):
```javascript
if (msg?.type === 'profile') {
  const t0 = now();
  const items = (msg.items ?? []).map(({ surfaces, frame, eye, thetaDeg }) => profileFn({ surfaces, frame, eye }, thetaDeg));
  return { type: 'profile', id, items, computeMs: now() - t0 };
}
```
- **Injected dependency** (lines 35-40): add `meshFn = buildLensMesh` (and a frame builder) to the `createHandler({...})` deps, like `profileFn = meridianProfile`. The unit test can then inject a throwing builder.
- **Error branch** (lines 82-86): a `mesh` error must name no eyes, the same as compare and profile:
  ```javascript
  const eyes = msg?.type === 'compute' ? EYES.filter((e) => msg.eyes?.[e]) : [];
  return { type: 'error', id, eyes, message: String(err?.message ?? err) };
  ```
- **Header comment:** add both `mesh` lines to the message table, and rewrite the "No transferables" paragraph (lines 16-18), because the mesh reply transfers.
- **Input validation (ASVS V5, RESEARCH Security):** check that the slot is known, the outline is 720 points and the numbers are finite. Return `finite: false` instead of throwing.

**Test analog:** `compute-protocol.test.js` `describe('profile (02-13)')` (lines 124-157). It covers: same id and the per-item builder output in order (`toEqual` against a direct engine call), the `structuredClone(res)` round trip (line 141), and the injected-fn and throwing-fn error shape `{ type: 'error', id, eyes: [], message: 'boom' }` (lines 145-156). For transfer, assert that the transfer list holds exactly the `ArrayBuffer`s of the returned arrays.

---

### `src/state/compute-client.js` (modify: mesh lane)

**Analog:** the profile lane in the same file. Copy each piece:

| Piece | Lines | What to copy |
|---|---|---|
| Header doc | 25-27 | Add a "Mesh jobs (03-xx, VIZ-06)" paragraph: lane order, generation drop, one queued, sync rule |
| Callback param | 53-54, 68 | `onMesh = () => {}` with JSDoc `(d: { gen, key, items \| null, error?: true })` |
| `inFlight` union type | 94-98 | add `{ id, kind: 'mesh', gen, key, items }` |
| Queue | 109-112 | `const meshQueue = []` (length ≤ 1). Skip the LRU cache unless needed (simplicity); buffers are transferred and cannot be cached |
| `fallback()` re-queue | 189-191 | `if (inFlight?.kind === 'mesh' && inFlight.gen === generation) meshQueue.unshift(...)` |
| `pump()` order | 201-235 | RESEARCH: main → **mesh** → compare → profile → bench. Insert the mesh block **before** the compare block at line 215 |
| Generation drop on change | 307-311 | add `meshQueue.length = 0` next to `profileQueue.length = 0` |
| Drop helper | 276-279 | `dropMesh(job)` like `dropProfile` |
| Answer handler | 383-393 | `onMeshMsg`: id check → `inFlight = null` → `disarm()` → `if (job.gen === generation) onMesh(...)` → `pump()` |
| Error / workerError routing | 395-405, 498-506 | add `else if (job.kind === 'mesh') dropMesh(job)` in **both** places |
| `receive` switch | 466-490 | `case 'mesh': onMeshMsg(msg); return;` |
| Public request | 445-457 | `requestMesh(items)` replaces the queued job and returns `generation` |

**Double buffering stays out of this module.** The client is pure and transport-agnostic (header lines 1-2). The spare buffers travel inside `items`. The `send` callback in `pipeline.js:207` must pass a transfer list: `(msg, transfer) => worker.postMessage(msg, transfer)`. That signature change ripples into `dispatch()` (lines 196-199).

**Test analog:** `compute-client.test.js` `describe('profile jobs in the compare lane (02-13)')` (lines 635-739). It uses the `setup()` harness (lines 46-83) with `fakeTimers()` (lines 6-43; injected, no `vi.useFakeTimers`). Mirror its tests one for one: dispatch order, replacement of the queued job, "a main input waits for at most one … job", generation drop, error for the current generation only (never `onFailed`), and sync mode plus timeout re-queue.

---

### `src/worker/engine.worker.js` (modify)

**Analog:** the file itself (8 lines):
```javascript
const handle = createHandler();
self.onmessage = (e) => self.postMessage(handle(e.data));
self.postMessage(READY);
```
The change is one line. With a `transferOf(msg)` helper it becomes `const r = handle(e.data); self.postMessage(r, transferOf(r));`. Keep the header comment style (01-15 reference, Vite worker URL citation).

---

### `src/ui/pipeline.js` (modify: request the mesh after the result paint)

**Analog:** the Querschnitt flow in the same file, a 3-step latest-wins render.

1. **Request** (`updateXsec`, lines 589-648):
   - gate (`if (!isExpert() …) return`);
   - "main result of this input not painted yet → return; the next paint calls again" (`shown[eye]?.key !== requestedKeys[eye]`, line 597);
   - `key = JSON.stringify(items)`;
   - skip if `key === painted`, or if the same key is already in flight (`client.isCompareCurrent(gen)`);
   - sync-mode branch (lines 632-639);
   - `writeXsecPending(true)` → `client.requestProfiles(items)`.
2. **Receive** (`onProfile`, lines 650-654):
   ```javascript
   function onProfile(d) {
     if (!client.isCompareCurrent(d.gen) || d.key !== xsec.key) return;
     xsec.delivery = d;
     xsec.frame ??= requestAnimationFrame(paintXsec);
   }
   ```
3. **Paint frame with the second check** (`paintXsec`, lines 657-675): re-check gen and key (T-02-37), render, set `painted = key`, clear pending.

**Pending signal** (lines 576-580). Add `#view[data-pending]` the same way:
```javascript
function writeXsecPending(on) {
  const el = $('xsec');
  const value = on ? 'profile' : '';
  if (el.dataset.pending !== value) el.dataset.pending = value;
}
```
**Hook point:** `paintDeliveries()` (lines 136-169) is where the cards are painted. It already defers follow-up work with `scheduleComparePaint()` (line 168). Hook the mesh request at the same place, or from `paintCompare` next to `updateXsec()` (line 551), so it never runs in the card frame (RESEARCH Pitfall 12).

**Sync fallback** (lines 190-204): the dynamic `import('../state/compute-protocol.js').then(..., (err) => console.warn(...))` must keep working with the new return shape (see "Read this first" item 2).

**Debug probe precedent** (line 227): `location.search.includes('msgprobe') ? (window.__msgMs = []) : null`. Use the same `location.search` test-flag style for `?nowebgl`.

---

### `src/ui/main.js` (modify: lazy 3D mount)

**Analog:** `init()` (lines 216-278). Each init call has a one-line comment with its plan number, and the worker starts last (`startWorker(); scheduleFirst();`, lines 274-275). Mount the view **after** the first result paint (D-16), not in `init()` directly. Trigger it from the pipeline's first paint, or from a one-shot callback passed through `initPipeline(hooks)` (lines 238-250 show the hooks object).

The Expert toggle callback (lines 223-233) is where `updateXsec()` is re-requested on switch. Add the view-mode reset there (Expert off → Glas).

---

### `src/ui/view/index.js` (lazy entry; role-match)

**Analog A: the dynamic import with an error path** (pipeline.js lines 196-203):
```javascript
import('../state/compute-protocol.js').then(
  ({ createHandler }) => { ... },
  (err) => console.warn('compute fallback could not load', err),
);
```
The view uses `import('./view/index.js')` from the pipeline or main, and the rejection shows `view.loadFailed` with the "Erneut versuchen" button (UI-SPEC States).

**Analog B: try/catch around a constructor that can throw** (pipeline.js lines 222-228):
```javascript
try {
  worker = new Worker(new URL('../worker/engine.worker.js', import.meta.url), { type: 'module' });
} catch {
  client.workerError();
  return;
}
```
Same shape for `new WebGLRenderer(...)` → `view.noWebgl` (RESEARCH "WebGL2 check without a second context").

---

### `src/ui/view/legend.js` (SVG legend + heat table; exact)

**Analog:** `src/ui/cross-section.js`.

**Header comment on CSP** (lines 1-6): "no style attribute and no style element; colours via classes (style.css) or presentation attributes. Elements are made with createElementNS / createElement and filled with textContent only."

**Imports** (lines 7-11):
```javascript
import { $ } from './dom.js';            // from view/: '../dom.js'
import { t } from '../i18n/t.js';        // from view/: '../../i18n/t.js'
import { fmtMm, fmtDiopter } from '../i18n/format.js';
```
**Element factories** (lines 31-43). Copy them, or move both into `dom.js` if two modules need them:
```javascript
function svgEl(name, attrs = {}, text) {
  const el = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
}
```
**Accessible SVG** (lines 177-189):
```javascript
const svg = svgEl('svg', { viewBox: ..., role: 'img', 'aria-labelledby': 'xsec-svg-title xsec-svg-desc', class: 'xs-svg' });
svg.append(svgEl('title', { id: 'xsec-svg-title' }, t('xs.svgTitle', { eye: eyeName, angle })));
svg.append(svgEl('desc', { id: 'xsec-svg-desc' }, desc));
```
The legend `<linearGradient>` stops use `stop-color` as a **presentation attribute** through `svgEl`, which is CSP-safe.

**Text-equivalent table** (`renderTable`, lines 249-269). It is the model for `#view-heat-table`: `th scope=row`, `td` with `data-row` / `data-col` / `class: 'num'`, values via `fmtMm`, empty cells while pending, and `tBodies[0].replaceChildren(...)`. The `data-row`/`data-col` attributes are what the e2e tests select on (`xsec.spec.js:13`).

**Pending / empty states** (lines 122-134): `renderCrossSectionPending` / `renderCrossSectionEmpty`. Mirror them for the heat table ("–" rows on `NO_CHORD`, RESEARCH open question 3; `xs.noChord` precedent at lines 147-150).

---

### `src/ui/view/labels.js` (projected HTML labels; partial)

**Analog:** `cross-section.js` `htmlEl` (lines 38-43) and `dom.js` `setText` (lines 8-11, "write text only when it changes"). Labels are `textContent` only. The innerHTML lint rule applies to `src/ui/view/**`. Positioning uses `el.style.transform = …` (a CSSOM property write, allowed by the CSP per RESEARCH Security), never `setAttribute('style', …)`.

---

### `src/ui/view/controls.js` (pointer / touch / keyboard; partial)

**Analog:** `src/ui/summary-bar.js` (lines 12-36), which has all three browser primitives the controls need:
```javascript
const NARROW = '(max-width: 899.98px)';
narrow = matchMedia(NARROW);
narrow.addEventListener('change', updateVisibility);
new IntersectionObserver((entries) => {
  for (const e of entries) resultInView = e.isIntersecting;
  updateVisibility();
}).observe($('result'));
...
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
```
Use `matchMedia('(pointer: coarse)')` for the touch path, an `IntersectionObserver` with `threshold: 0.5` for auto-off, and the reduced-motion query for the tween cut. The OrbitControls `connect`/`disconnect` and focus-gated `enableZoom` code is in RESEARCH "Touch toggle = connect/disconnect".

**Segmented toggle with a check icon** (pipeline.js lines 71-74, expert.js lines 106-112). Use it for `#view-mode` and `#view-heat-eye`:
```javascript
for (const radio of document.querySelectorAll('#xsec-eye input')) {
  radio.after(icon('check'));
  radio.addEventListener('change', updateXsec);
}
```

---

### `src/ui/frame-input.js` (modify `paintRim`)

**Analog:** itself, lines 61-83. Only line 76 (`const excess = edgeBeyondRim(m, depth)`) and the text choice on line 79 change. The import on line 12 gains `bevelSplit`. Keep the 0,05 mm display threshold (`excess >= 0.05`), which matches UI-SPEC "bündig = ≤ 0,05 mm".

---

### `src/ui/summary-bar.js` (modify: thumbnail)

**Analog:** itself. The module contract (lines 1-7) says it "only repeats the strings the cards were painted with". The thumbnail canvas is drawn by the view in the render task (RESEARCH Pattern 9). The bar code only un-hides `#bar-view-slot` (index.html:711) and adds the CSS grid modifier. `#summary-bar` is `display: flex; flex-direction: column` at style.css lines 123-137; the UI-SPEC changes it to a `48px 1fr` grid only when the thumbnail exists.

---

### `src/ui/icons.js` (modify: `rotate`)

**Analog:** the `SHAPES` table (lines 7-28). Add one `rotate: [['path', { d: '…', 'stroke-linejoin': 'round' }]]` entry, a 16×16 viewBox drawn with stroke `currentColor`.

---

### `src/i18n/de-AT.js` (modify)

**Analog:** the `frame.rim.*` block (lines 180-186). Each key group has a comment naming the plan, requirement and UI-SPEC section, and says which params are formatted by `format.js`:
```javascript
// 02-11 (FRAME-02, UI-SPEC "Randtiefe"): display only, never in the LensSpec.
'frame.rim.label': 'Randtiefe der Fassung (mm)',
// {glass} = result.glass.*, {excess} = fmtMm(edgeBeyondRim): uses etMax, never the centre.
```
`dictionary.test.js:52-53` enforces the "Stärke" ban over every value automatically. Number formatting uses `fmtMm` (`format.js:37`).

---

### `index.html` / `src/ui/style.css` (modify)

**Markup analog:** `section#xsec` (index.html lines 661-683): `aria-labelledby`, `data-pending=""`, `fieldset.segmented` with `legend data-i18n` and radio labels with `span data-i18n`, and a `table.cmp-table` with `caption data-i18n`. `applyDictionary()` (`dom.js:19-29`) fills `data-i18n`, `data-i18n-title` and `data-i18n-aria-label` at startup, so static `#view` markup needs no extra JS for strings.

**Style analogs:** `.segmented` (style.css 1387-1420), `.visually-hidden` (line 295), `#summary-bar` (123-145), and the phone breakpoint `@media (max-width: 899.98px)` (line 113).

---

### `package.json` (modify)

Add `"dependencies": { "three": "0.187.0" }`. `test/ci/pins.test.js:60-65` already merges `dependencies` and `devDependencies` and requires `^\d+\.\d+\.\d+$`, so the exact pin is enforced with no test change.

---

### `e2e/helpers.js` (modify: `settledView`)

**Analog:** `settledXsec` (lines 37-41), a chained wait on `data-pending` plus one frame:
```javascript
export async function settledXsec(page, { timeout = 10_000 } = {}) {
  await settledCompare(page, { timeout });
  await expect(page.locator('#xsec')).toHaveAttribute('data-pending', '', { timeout });
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0))));
}
```
The worker patch helpers `slowWorker(page, ms, { types: ['mesh'] })` (lines 65-74) already support delaying the new message type.

---

### `e2e/view*.spec.js` (new)

**Analog:** `e2e/xsec.spec.js` (lines 1-50) for the structure, and `e2e/a11y.spec.js` (lines 1-60) for the axe and overflow helpers.

**Header + guard + helpers** (xsec.spec.js lines 1-19):
```javascript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settledCompare, settledXsec, plain, guardPage } from './helpers.js';
/* global document */
guardPage(test);
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const text = async (loc) => plain(await loc.textContent());
```
`guardPage` (helpers.js 118-144) fails a test on any 4xx, a foreign request or a CSP console message. That automatically covers "no CSP violations with 3D".

**Engine number equals displayed number:** xsec.spec.js lines 28-31 compare SVG text with table cells. The heat spec compares callout pills, table cells and result-card values the same way.

**axe + overflow:** copy `expectAxeClean` and `expectNoHorizontalScroll` from a11y.spec.js lines 19-36, and `comparisonOn` from lines 43-50 for A/B.

**Projects:** `playwright.config.js:20-34` already has `desktop` 1280×800 and `mobile` 360×780 with `hasTouch`. Use `test.skip(({ isMobile }) => …)` for the touch-only checks.

**WebGL2 in CI:** headless Chromium gives WebGL2 on SwiftShader (RESEARCH Environment). No config change is needed.

---

### `e2e/perf-throttled.spec.js` (modify)

**Analog:** itself (lines 1-45). It only runs under `PERF=1`, is informational, uses CDP `Emulation.setCPUThrottlingRate`, writes JSON to `test-results/`, and has an optional trace categories list. Add a "3D-Neuaufbau" measurement, recorded separately from ENG-09 (a) (RESEARCH Pitfall 12).

---

## Shared Patterns

### Engine purity and "every number is an engine number"
**Source:** `src/engine/profile.js:1-5` (header), `src/ui/cross-section.js:1-3`
**Apply to:** everything in `src/engine/mesh/`, `src/ui/view/legend.js`, `labels.js`, and the aria-label builder.
Comment convention: state in the file header that every displayed number comes from the engine function X. Labels format engine values with `format.js` and never read the mesh or pixels (D-04(e)).

### Latest-wins + generation + second check in the paint frame
**Source:** `src/state/compute-client.js:103-112, 306-311, 383-393`; `src/ui/pipeline.js:650-675`
**Apply to:** the mesh lane and the view's attach step. Before swapping attribute arrays, check `client.isCompareCurrent(gen)` (or a mesh equivalent) **and** the key, the T-02-16 / T-02-37 pattern.

### No HTML sinks; CSP-safe styling
**Source:** `eslint.config.js:23-39`, `src/ui/cross-section.js:1-6, 31-43`, `src/ui/icons.js:1-3`
**Apply to:** all `src/ui/view/*`. Use `textContent`, `createElement(NS)`, presentation attributes and CSSOM property writes only. Never `setAttribute('style')`, never `<style>`.

### Settled signal via `data-pending`
**Source:** `src/ui/pipeline.js:78-89, 576-580`; `e2e/helpers.js:12-41`
**Apply to:** `#view[data-pending]` (mesh in flight, delivered but not rendered) and `settledView()`.

### Test-only query flags and read-only debug handles
**Source:** `src/ui/pipeline.js:227` (`?msgprobe` → `window.__msgMs`)
**Apply to:** `?nowebgl` (forces the D-17 catch path) and `window.__eyeglassView = Object.freeze({ memory, tier })` (UI-SPEC Verification Contract).

### Dependency injection for Node-testable state modules
**Source:** `src/state/compute-client.js:59-75` (`now`, `setTimer`, `clearTimer`, `isHidden`), `src/state/frame-scheduler.js:10` (`requestFrame` injected), `src/state/compute-protocol.js:35-40` (`profileFn`)
**Apply to:** any new state-side scheduling for re-mesh, and the `meshFn` dependency in the protocol.

### Provenance tags on design constants
**Source:** `src/engine/rim.js:4-5` (`[ASSUMED, RESEARCH A2]` + "angenommener Wert")
**Apply to:** `BEVEL_RULE` ('1:2', cited US 8 388 133 but the choice is assumed), rim face width 4 mm, temple default 140 mm, earpiece bend 30°/35 mm, and chart distance 200 mm.

## No Analog Found

| File | Role | Data Flow | Reason / Use instead |
|---|---|---|---|
| `src/ui/view/scene.js` | provider (WebGLRenderer, PMREM/RoomEnvironment, tiers, context loss) | render on demand | No Three.js in the repo yet. Use RESEARCH Pattern 5 and "Render on demand with damping" (the official r187 example) |
| `src/ui/view/lenses.js` | store (geometry slots, double-buffered attribute swap) | event-driven | Use RESEARCH Pattern 4 and "In-place attribute swap". Fixed byteLength (Pitfall 1); never transfer the attached arrays (Pitfall 7) |
| Heat `ShaderMaterial` (in `src/ui/view/`) | shader | transform of an engine scalar | Use RESEARCH Pattern 7 (cividis LUT from UI-SPEC, `fwidth` iso-lines, no colorspace/tonemapping chunks) |
| Canvas chart and contact-shadow textures | utility | runtime-drawn texture | Use UI-SPEC "Background chart" and "Contact shadow". The closest repo code is the SVG drawing in `cross-section.js` (own drawing, no assets) |
| A/B scissor viewports | render path | — | Use RESEARCH Pattern 8 |
| Phone thumbnail `drawImage` | utility | same-task copy | Use RESEARCH Pattern 9. No `await` between `render()` and `drawImage` |

## Metadata

**Analog search scope:** `src/engine/**`, `src/state/**`, `src/worker/**`, `src/ui/**`, `src/i18n/**`, `e2e/**`, `test/ci/**`, `eslint.config.js`, `vite.config.js`, `playwright.config.js`, `package.json`, `index.html`
**Files scanned:** 34 read or grepped (out of 101 tracked source/test files)
**Pattern extraction date:** 2026-11-08
