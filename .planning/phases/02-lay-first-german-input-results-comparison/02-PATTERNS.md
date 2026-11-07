# Phase 2: Lay-First German Input, Results & Comparison - Pattern Map

**Mapped:** 2026-11-07
**Files analyzed:** 52 new or modified files (engine 8, state 13, i18n 5, ui 15, markup/css 2, e2e 10, test/bench 1)
**Analogs found:** 46 / 52. The 6 files without a close analog are UI widgets with no precedent in the repo: SVG builder, icons, toggletip, switch, sticky bar, inline confirm.

Line numbers refer to the files as they were read on 2026-11-07 (HEAD `a4c35d3`).

---

## Hard rules that every plan must respect (taken from the code)

| Rule | Where it is enforced | Consequence for phase 2 |
|---|---|---|
| Engine has no DOM, no `three`, and no import from `ui/`, `i18n/` or `state/` | `eslint.config.js:55-87`, `src/engine/boundary.test.js:18-38` | `profile.js` and `rim.js` may import only from `src/engine/**`. No German text and no `performance`. |
| `state/` and `i18n/` have no DOM and no `ui/` imports | `eslint.config.js:88-116` | `validate.js`, `compare.js` and `presets.js` return **codes plus numbers**. They never return German text. |
| UI has no `innerHTML`, `outerHTML` or `insertAdjacentHTML` | `eslint.config.js:23-39`, `boundary.test.js:40-56` | SVG must be built with `document.createElementNS` and `textContent`. |
| Frozen LensSpec → LensResult contract: add fields, never rename | `src/engine/evaluate.js:1-48` | `frontConic`, `customMaterial` and the `abbe: number\|null` widening are additive only. |
| Every diag code has data docs plus 3 dictionary keys | `src/i18n/dictionary.test.js:62-109` | `MANUAL_BACK_CONVEX` needs a `DIAG_DATA` entry and the keys `diag.MANUAL_BACK_CONVEX.{title,explain,suggest}`. |
| No "Stärke", "Linse" or "undefined" anywhere in the dictionary | `dictionary.test.js:36-38, 119-123` | This covers the new tip, validation and SVG strings automatically. |
| `#result[data-pending]` means "main result only" | `src/ui/main.js:310-321`, `e2e/helpers.js:12-15` | The comparison gets its own `#compare[data-pending]`. Never write compare tokens into `#result`. |
| CSP `style-src 'self'` (exact string asserted in `worker.spec.js`) | `vite.config.js` | No `style="…"`, no `setAttribute('style')` and no `<style>` in SVG. Use classes and presentation attributes. |

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/engine/evaluate.js` (M) | engine service | transform | itself (lines 60-84, 114-159) | exact |
| `src/engine/diagnostics.js` (M) | engine catalogue | config | itself (lines 6-18) | exact |
| `src/engine/profile.js` (N) | engine utility | transform | `src/engine/metrics.js` (`thicknessAt`, `hitEdge`, `extremeIndices`) | role-match |
| `src/engine/rim.js` (N) | engine utility | transform | `src/engine/diagnostics.js` (constant + pure fn) / `metrics.js` | role-match |
| `src/engine/profile.test.js` (N) | test (unit+property) | — | `src/engine/properties.test.js` + `metrics.test.js` | exact |
| `src/engine/rim.test.js` (N) | test | — | `src/engine/metrics.test.js` | exact |
| `src/engine/evaluate.test.js` / `properties.test.js` (M) | test | — | themselves (`spec()` / `lens()` factories) | exact |
| `src/state/parse.js` (M: parsePd, parseStamp, parseIndex/Density/Conic) | state utility | transform (text→value/code) | itself (`parseMm`, `parseDiopter`) | exact |
| `src/state/parse.test.js` (M) | test | — | itself | exact |
| `src/state/validate.js` (N) | state utility | transform (value→tier codes) | `src/state/transpose.js` (frozen CODES + pure fn) | role-match |
| `src/state/validate.test.js` (N) | test | — | `src/state/transpose.test.js` / `parse.test.js` | exact |
| `src/state/compare.js` (N) | state utility | transform (results→rounded diffs) | `src/state/transpose.js`; rounding via `src/i18n/format.js` Intl instances | role-match |
| `src/state/compare.test.js` (N) | test | — | `parse.test.js` (`test.each` tables) | exact |
| `src/state/presets.js` (N) | state data | config | `src/state/bench-cases.js` (frozen data + `specFor`) | exact |
| `src/state/bench-cases.js` (M, `specFor` new optional fields) | state factory | config | itself (lines 14-28) | exact |
| `src/state/compute-client.js` (M, compare lane) | state service | event-driven / request-response (latest-wins queue) | itself (`pump` 156-176, `bench` lane 170-175/268-284) | exact |
| `src/state/compute-client.test.js` (M) | test | — | itself (`setup()` 49-81, bench interleaving test line 322) | exact |
| `src/state/compute-protocol.js` (M, `compare` message) | worker handler | request-response | itself (`bench` branch 46-59) | exact |
| `src/state/compute-protocol.test.js` (M) | test | — | itself (structuredClone round trip 29-38) | exact |
| `src/i18n/de-AT.js` (M) | i18n dictionary | config | itself | exact |
| `src/i18n/format.js` (M, `fmtGramWhole`, signed diff) | i18n utility | transform | itself (`fmtGram` 41-44) | exact |
| `src/i18n/format.test.js` (M) | test | — | itself | exact |
| `src/i18n/dictionary.test.js` (M) | test | — | itself (`DIAG_DATA`, orphan-key test) | exact |
| `src/ui/main.js` (M → ≈100 lines composition) | ui entry | composition | itself (`init` 666-707) | exact |
| `src/ui/dom.js` (N) | ui utility | — | `main.js:32-35, 225-229` (`$`, `setText`, `para`) | exact (move) |
| `src/ui/pipeline.js` (N) | ui controller | event-driven | `main.js:310-530` (pending, onBusy, onResults, fallback, startWorker) | exact (move) |
| `src/ui/timing.js` (N) | ui controller | event-driven | `main.js:420-474, 552-653` | exact (move) |
| `src/ui/rx-input.js` (N) | ui component | request-response (field → parse → echo/msg) | `main.js:108-197` (`readField`, `showFieldOk/Error`, `readRx`) | exact |
| `src/ui/frame-input.js` (N) | ui component | request-response | `main.js:80-106` (`buildShapeOptions`, `prefillFrame`) | role-match (select → radio cards) |
| `src/ui/material-input.js` (N) | ui component | request-response | `main.js:37-69` (`buildMaterialOptions`, `renderMaterialLine`) | role-match |
| `src/ui/results.js` (N) | ui component | transform (result → DOM) | `main.js:199-308` (`renderEmpty`, `renderDiagnostics`, `renderResult`, `setStale`) | exact |
| `src/ui/compare-view.js` (N) | ui component | event-driven (compare deliveries) | `main.js:366-416` (`paintDeliveries`/`onResults`) + `renderResult` | role-match |
| `src/ui/expert.js` (N) | ui component | request-response | `main.js:263-278` (`baseCurveText`), `readField` | role-match |
| `src/ui/cross-section.js` (N) | ui component | transform (profile → SVG) | none (no SVG in repo); DOM-building style from `main.js:225-254` | **no analog** |
| `src/ui/toggletip.js` (N) | ui component | event-driven | none; `main.js:690-695` (`<details>` toggle listener) is the nearest | **no analog** |
| `src/ui/icons.js` (N, UI-SPEC) | ui utility | — | none | **no analog** |
| Summary bar / inline confirm / switch (inside results.js, rx-input.js, expert.js) | ui component | event-driven | none | **no analog** |
| `index.html` (M) | markup | — | itself (Rx cell pattern lines 40-46) | exact |
| `src/ui/style.css` (M) | style | — | itself (tokens 2-14, `.diag-*` 205-219, `[data-stale]` 230-234) | exact |
| `e2e/helpers.js` (M: `settledCompare`, U+00AD normaliser) | test helper | — | itself (`settled` 12-15) | exact |
| `e2e/rx.spec.js`, `presets.spec.js`, `compare.spec.js`, `expert.spec.js`, `layout.spec.js`, `a11y.spec.js` (N) | e2e test | — | `e2e/smoke.spec.js` (beforeEach/afterEach guard 12-35, axe 444-448) | exact |
| `e2e/smoke.spec.js`, `perf-throttled.spec.js`, `worker.spec.js` (M, selector updates) | e2e test | — | themselves | exact |
| `test/bench/compare.test.js` (N) | bench | batch | `test/bench/recompute.test.js` | exact |

---

## Pattern Assignments

### `src/engine/evaluate.js` (engine service, transform). Modify

**Analog:** the file itself. Every change is additive, as the header at lines 1-2 requires.

**Spec JSDoc to extend** (lines 4-17). Add these at the end:
```js
 * @property {number|null} minET mm, null = material default
 // ADD: @property {number|null} [frontConic] k of the front, null/0 = sphere (MAT-05)
 // ADD: @property {{ ne:number, density:number, ve:number|null }|null} [customMaterial] (MAT-06), requires materialId 'custom'
```

**Validation pattern to extend** (lines 60-84):
```js
const fin = Number.isFinite;
const optPositive = (v) => v == null || (fin(v) && v > 0);
...
  if (!Object.hasOwn(MATERIALS, spec.materialId)) return 'material';
  ...
  if (!optPositive(spec.baseCurve)) return 'base-curve';
```
- MAT-03: add `const optNonNeg = (v) => v == null || (fin(v) && v >= 0);` and use it for `baseCurve` only. `minCT`/`minET` stay `optPositive`.
- MAT-06: replace the `material` check with `spec.materialId === 'custom' ? customInvalid(spec.customMaterial) : !Object.hasOwn(MATERIALS, …)`. A custom material also requires non-null `minCT`/`minET`, because the engine does not invent defaults.
- MAT-05: `frontConic` must be null or finite and ≤ 0. The UI range is −5…−1 (cited; revised 2026-11-07), but the engine guards only that the value is finite and ≤ 0 and the UI enforces the range.
- Each new reason string follows the existing kebab style: `'custom-material'`, `'front-conic'`.

**Material lookup and conic insertion point** (lines 119-123, 134-148):
```js
  const m = MATERIALS[spec.materialId];
  const n = m.ne;
  const minCT = spec.minCT ?? m.minCT;
  ...
  const bc = baseCurveAuto(sphericalEquivalent(sph, cyl), { n, rhoMax, k1: 0 });
  const common = { sph, cyl, axisDeg, n, k1: 0, minCT, minET, outline, oc };
  ...
  if (spec.baseCurve != null) { D1 = spec.baseCurve; baseCurveRule = 'manual'; r = solveCT({ ...common, D1 }); }
  else { baseCurveRule = 'thinnest'; r = optimiseBaseCurve({ ...common, maxD1: bc.maxD1, seedD1: bc.vogelClampedD1 }); D1 = r.D1; ... }
```
- Keep `common.k1 = 0` for `optimiseBaseCurve` (RESEARCH Pitfall 1). When `frontConic` is not 0, add one extra `r = solveCT({ ...common, k1: frontConic, D1 })` after the search. In the manual branch, pass `k1: frontConic` directly.
- `m` for custom = `{ ...spec.customMaterial }`. `intermediates.abbe` (line 197) becomes `m.ve ?? null`, which only widens the type.

**Warn-diagnostic append pattern** (lines 202-207). Copy it for `MANUAL_BACK_CONVEX`:
```js
  const diagnostics = [diag(r.binding === 'minCT' ? 'CT_SET_BY_MIN_CT' : 'CT_SET_BY_MIN_ET', {})];
  // Warnings keep the numbers (D-01: computable but oversized is never an error).
  if (!insideOutline(outline, oc.x, oc.y)) diagnostics.push(diag('OC_OUTSIDE_OUTLINE', { x: oc.x, y: oc.y }));
```
→ `if (baseCurveRule === 'manual' && Math.max(s.D2a, s.D2b) > 0) diagnostics.push(diag('MANUAL_BACK_CONVEX', { D2max }))`.

**Test pattern:** `src/engine/evaluate.test.js:9-22`. Use the `spec(o)` factory with overrides. The golden "k = 0 equals today" test: compare `evaluateLens(spec({ frontConic: 0 }))` with `evaluateLens(spec())` using `toEqual`. The MAT-06 equivalence test: `customMaterial` built from the `MATERIALS.cr39` constants must give bitwise-equal metrics to `materialId: 'cr39'`.

---

### `src/engine/diagnostics.js` (catalogue). Modify

**Pattern** (lines 4-18):
```js
const entry = (severity) => Object.freeze({ severity });
export const DIAGNOSTICS = Object.freeze({
  ...
  OC_OUTSIDE_OUTLINE: entry('warn'),
  BLANK_EXCEEDS_STOCK: entry('warn'), // computable but oversized is a warning, never an error (D-01)
```
Add `MANUAL_BACK_CONVEX: entry('warn'), // manual base curve only (MAT-03)`. In the same commit, add `MANUAL_BACK_CONVEX: ['D2max']` to `DIAG_DATA` in `dictionary.test.js:62-74` and the three `diag.MANUAL_BACK_CONVEX.*` keys in `de-AT.js`. If you skip any of these, `dictionary.test.js:78-86` fails.

---

### `src/engine/profile.js` (engine utility, transform). New

**Analog:** `src/engine/metrics.js`. It has the same imports, the same thickness formula and the same outline intersection maths.

**Imports pattern** (metrics.js lines 3-5):
```js
import { frontSagAt, backSagAt } from './design.js';
import { locationLabel, nasalSign } from './conventions.js';
```
Also import `frameOutline` from `./frame/outline.js` (signature `frameOutline(shape, A, B, eye, n = 720)`, outline.js:76; it returns a copy, so mutation is safe).

**Thickness formula to reuse, never re-derive** (metrics.js 9-12):
```js
/** t = ct − sF + sB at lens-local (x, y). */
export function thicknessAt(s, x, y) {
  return s.ct - frontSagAt(s, x, y) + backSagAt(s, x, y);
}
```
z-values follow `conventions.js:20-22`: `zFront = −sF`, `zBack = −CT − sB`.

**Ray/outline intersection to adapt** (metrics.js 61-74). Here the ray starts at `surfaces.oc` in direction (cos θ, sin θ) and in direction −(cos θ, sin θ). Take the nearest hit on each side:
```js
function hitEdge(outline, n, i, c, s) {
  const k = i + 1 === n ? 0 : i + 1;
  const px = outline[2 * i]; const py = outline[2 * i + 1];
  const ex = outline[2 * k] - px; const ey = outline[2 * k + 1] - py;
  const den = c * ey - s * ex;
  if (den === 0) return -1;
  const t = (px * ey - py * ex) / den;
  const u = (px * s - py * c) / den;
  return t > 0 && u >= -1e-9 && u <= 1 + 1e-9 ? t : -1;
}
```
`hitEdge` is not exported, and its origin is (0, 0). Either export a generalised version from metrics.js, or subtract `oc` from px/py in profile.js. **Do not** reuse `outlineRadii`: it assumes rays from the boxing centre and a monotone march, which does not hold from the OC for panto/pilot.

**Location label for the chord ends:** `locationLabel(x, y, eye)` from conventions.js:51-54. The cross-section end labels "Nase/Schläfe" derive from it.

**Failure shape:** return plain codes like the engine does elsewhere, `{ ok: false, code: 'NO_CHORD' }`. Do not throw. Pattern: `evaluate.js:63-65 fail()`.

**Return type:** plain arrays or `Float64Array`. `compute-protocol.js:12-13` says no transferables are used, and structured clone copies typed arrays fine. Add a round-trip test like `compute-protocol.test.js:29-38`.

**Test analog:** `src/engine/properties.test.js:1-40` (imports `fc`, `lens()` factory, `outlineThicknesses()` helper using `thicknessAt` on every outline point). The profile invariants (t(0) = ct; ends equal `thicknessAt` at the outline hit points; θ and θ+180 give the reversed chord) follow the same `fc.assert(fc.property(...))` style, with `quarter(min, max)` (line 30) for Rx generation.

---

### `src/engine/rim.js` (engine utility, transform). New

**Analog:** the constant-plus-pure-function shape of `src/engine/diagnostics.js:20-21`:
```js
// Largest Zeiss stock blank diameter on the sheets read (RESEARCH A9), mm.
export const STOCK_BLANK_MAX_MM = 75;
```
→ `// [ASSUMED, RESEARCH A2] design constant, no citable value.` followed by `export const RIM_DEPTH_DEFAULT_MM = 3.0;` and `export function edgeBeyondRim(metrics, rimDepthMm) { return Math.max(0, metrics.etMax.value - rimDepthMm); }`. Use the documented-assumption comment style from `shapes.js:3-6` and `materials.js:7` (`assumed`).

**Test analog:** `metrics.test.js` (`describe`/`it`, `toBeCloseTo`). It must keep the engine coverage gate at lines 95 / branches 90 (vite.config.js `test.projects`).

---

### `src/state/parse.js` (state utility, text → value or code). Modify

**Analog:** the file itself. Copy its structure exactly.

**Codes and helpers** (lines 5-26):
```js
export const PARSE_CODES = Object.freeze({
  PARSE_EMPTY: 'PARSE_EMPTY',
  ...
});
const MINUS_FORMS = /[−‒–‐﹣－]/g;
const fail = (code) => ({ ok: false, code });
const okValue = (value) => ({ ok: true, value: value + 0 }); // + 0 turns -0 into +0
function normalise(raw) { return String(raw ?? '').trim().toLowerCase().replace(MINUS_FORMS, '-'); }
```
New codes (`PD_AMBIGUOUS`, `PD_DISTANCE_NEAR`, `STAMP_INVALID`, `STAMP_SWAPPED`, …) go into `PARSE_CODES`. **Each needs a `parse.<CODE>` dictionary key**: `dictionary.test.js:28-30` iterates `PARSE_CODES`, and `:95-96` rejects orphans. If the PD/stamp codes should live in their own frozen object (e.g. `PD_CODES`), add the matching `test.each` and orphan rule to `dictionary.test.js`, as is done for `RX_CODES` (lines 32-34, 97-98).

**Anchored regex plus compose, never parseFloat** (lines 77-86). This is the template for `parsePd` halves and `parseStamp` numbers:
```js
export function parseMm(raw) {
  let s = normalise(raw);
  if (s === '') return fail(PARSE_CODES.PARSE_EMPTY);
  s = s.replace(/\s*mm$/, '');
  if (s.includes('.') && s.includes(',')) return fail(PARSE_CODES.PARSE_MIXED_SEPARATORS);
  if (/^\d{1,3}[.,]\d{2,}$/.test(s)) return fail(PARSE_CODES.PARSE_TOO_MANY_DECIMALS);
  const m = /^(\d{1,3})(?:[.,](\d))?$/.exec(s);
  if (!m) return fail(PARSE_CODES.PARSE_NOT_A_NUMBER);
  return okValue(compose('', m[1], m[2]));
}
```
- `parsePd("32/33")`: split on `/` and run `parseMm` on each half. That reuses the validated path.
- `parseStamp`: first enforce the ReDoS length cap (`if (s.length > 32) return fail(...)`, RESEARCH Security). Then normalise the separators □ U+25A1, ▢ U+25A2, ◻ U+25FB, ☐ U+2610, `[]`, `-`, `/`, `x` and runs of whitespace to one space. Then match `^(\d{2})\s(\d{2})(?:\s(\d{2,3}))?$`.
- `parseIndex`, `parseDensity` and `parseConic` (signed, 1–2 decimals) clone `parseDiopter` (lines 43-53) with different digit counts.
- The success shape stays `{ ok: true, value }`. For multi-value results, use `{ ok: true, kind, OD, OS, total? }`, as RESEARCH Pattern 3 specifies.

**Test pattern** (parse.test.js 1-36):
```js
const ok = (value) => ({ ok: true, value });
const err = (code) => ({ ok: false, code });
describe('parseDiopter (RX-02)', () => {
  test.each([ ['-2,25', -2.25], ['−2.25', -2.25], ... ])('%j -> %d', (raw, value) => {
    expect(parseDiopter(raw)).toEqual(ok(value));
  });
```
Add a fast-check property for each new parser: a long random string must never throw and must return `ok:false` within the cap (ReDoS mitigation).

---

### `src/state/validate.js` (state utility, value → tier codes). New

**Analog:** `src/state/transpose.js` (frozen codes, one pure function, no text):
```js
export const RX_CODES = Object.freeze({
  CYL_TRANSPOSED: 'CYL_TRANSPOSED',
  AXIS_MISSING_FOR_CYL: 'AXIS_MISSING_FOR_CYL',
});
/** @typedef {{ sph: number, cyl: number, axisDeg: number }} Rx */
export function transpose({ sph, cyl, axisDeg }) { ... return { minus, plus, transposed }; }
```
- Return shape: `{ tier: 'error'|'hint'|'out-of-model', code, data, suggestion? }`. Text never goes in the return value. The dictionary key is `val.<CODE>`. Add a `VAL_CODES` `test.each` and an orphan check to `dictionary.test.js`, modelled on lines 32-34 and 97-98.
- Check the range on the **transposed** form (RESEARCH Pitfall 8). Call `transpose()` from this module instead of duplicating the formula.
- Range constants go at the top with a source comment, like `compute-client.js:17-22`. Each `export const` gets a one-line rationale: Sph ±12, Zyl −6…0 (minus form), PD 25–40, A 40–62, B 28–55, DBL 14–24, the custom ne/density/Abbe bands, the 0,25 step, and the PD bands 40–50 and 8–20 (HSA).
- `AXIS_MISSING_FOR_CYL` already exists in `RX_CODES`. Reuse that code and do not duplicate it.

**Test analog:** `src/state/transpose.test.js` / `parse.test.js` `test.each` tables.

---

### `src/state/compare.js` (state utility, results → rounded differences). New

**Analog for structure:** `transpose.js` (pure, codes only).
**Analog for rounding:** `src/i18n/format.js:13-17, 22`. These are the Intl instances whose rounding the display uses:
```js
const oneDecimalNf = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'negative' });
const intNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });
```
Differences must come from the **displayed** rounded values (RESEARCH Pitfall 10). Implement `roundMm = (v) => Math.round(v * 10) / 10` and `roundG = (v) => Math.round(v)` here as named display rules, and add a unit test that `fmtMm(roundMm(v)) === fmtMm(v)` over a sweep. Intl uses half-expand rounding, and `Math.round` differs from it for negative halves. The test catches that mismatch. `compare.js` sits in `state/`, so it must not import `format.js`'s formatters for text, but it may share the rounding rule.

The L/R callout thresholds (`LR_DIFF_MM = 1.0`, `LR_DIFF_G = 3`) are named constants with the measured rationale from RESEARCH Open Q5. Comment style: `compute-client.js:8-10` (RAIL citation inline).

Selected-row rule: "Ihre Auswahl" uses the main result, and custom material is never a row (D-17).

---

### `src/state/presets.js` (state data). New

**Analog:** `src/state/bench-cases.js:30-45`. It shows frozen Rx/frame data with a one-line description comment per case:
```js
// Canonical normal case: −4,00 / −2,00 × 30°, Rechteckig 52 × 38, DBL 18, PD 32, CR-39.
const NORMAL_RX = Object.freeze({ sph: -4, cyl: -2, axisDeg: 30 });
const NORMAL_FRAME = Object.freeze({ shape: 'rechteckig', A: 52, B: 38, DBL: 18 });
```
Preset values are **field text in paper form** (e.g. `'-2,75'`, `'-0,50'`, `'180'`, `'32'`), not engine numbers. That way, applying a preset goes through the same parse → transpose path as typing. Values come from the UI-SPEC "Preset data" table. Labels are dictionary keys (`preset.rx.<id>`), never German in this file.

---

### `src/state/bench-cases.js` `specFor` (factory). Modify

**Pattern** (lines 14-28). Every spec field is set explicitly:
```js
export function specFor(eye, rx, monoPD, materialId, frame, fittingHeight = null) {
  return { eye, sph: rx.sph, cyl: rx.cyl, axisDeg: rx.axisDeg, materialId, frame, monoPD, fittingHeight,
           baseCurve: null, minCT: null, minET: null };
}
```
Add an optional trailing `overrides = {}` object (`{ baseCurve, minCT, minET, frontConic, customMaterial }`), or create a sibling `specWith(...)`. **Key caution:** `compute-client.js:214-215` uses `JSON.stringify(spec)` as the cache key. If the new fields are added as `null` keys, the existing bench pairs (`NORMAL_PAIR` etc.) change their JSON but not their result. That is fine. Keep the property order stable so equal specs give equal keys.

---

### `src/state/compute-client.js` (state service, event-driven latest-wins queue). Modify: compare lane

**Analog:** the file itself. The `bench` lane is the exact template for a lower-priority lane.

**Priority order in `pump()`** (lines 156-176). The compare lane goes between compute and bench:
```js
  function pump() {
    if (!ready || !transport || inFlight) return;
    const eyes = {};
    for (const eye of EYES) { const w = wanted[eye]; if (w && !w.done && !w.sent) eyes[eye] = { seq: w.seq, spec: w.spec }; }
    const ids = Object.keys(eyes);
    if (ids.length > 0) { ...; dispatch({ type: 'compute', id: inFlight.id, eyes }); return; }
    // ← NEW: compareQueue.shift() → inFlight = { id, kind: 'compare', gen, key }; dispatch({ type: 'compare', ... }); return;
    if (bench) { ... dispatch({ type: 'bench', id: inFlight.id, caseId, k }); }
  }
```

**inFlight union type** (line 72). Extend the JSDoc with `| { id, kind: 'compare', gen, key }`.

**Response handler template** (lines 268-284, `onBenchMsg`):
```js
  function onBenchMsg(msg) {
    if (inFlight?.kind !== 'bench' || msg.id !== inFlight.id) return;
    inFlight = null;
    disarm();
    ...
    pump();
  }
```
→ `onCompareMsg`: the same id guard. The result is dropped when `job.gen !== generation`. The LRU store is keyed by `JSON.stringify(spec)`, with a size cap like the outline cache (`outline.js:89-91 CACHE_SIZE/CACHE.delete(CACHE.keys().next().value)`). The handler calls `onCompare(...)`, a new injected callback added to the constructor params at lines 40-54 and to the JSDoc at lines 26-39.

**Invalidation:** in `request()` (lines 205-233), add `generation++; compareQueue.length = 0;` **only when at least one eye's key changed**. An unchanged request already returns early at line 216. Do not cancel compare work on identical requests, or the comparison never settles while the user idles on focus/blur events.

**Error and fallback paths must know the new kind:**
- `onErrorMsg` (lines 286-294) and `workerError()` (lines 327-340) branch on `job.kind === 'bench'`. Add a `'compare'` branch that drops the job silently, or reports via `onCompare({ error })`. It must **never** call `failCurrent(job)`, because `job.eyes` is undefined for compare jobs.
- `fallback()` (lines 134-149) re-sends only compute. The compare queue stays and runs after `useTransport`. The page does not enqueue comparisons in sync mode (RESEARCH Pattern 1, "Vergleich berechnen" button). Expose `requestCompare(jobs)`, `cancelCompare()` and `isCompareCurrent(gen)`, modelled on `isCurrent` (line 352).

**Test analog:** `compute-client.test.js:49-81` (`setup()` with injected fake timers and an `answer(job)` helper). The bench-interleaving test at line 322 ("one run per job, compute goes first") is the template for the new "main before compare, at most one compare job ahead, new request clears queue, stale-gen result dropped" tests.

---

### `src/state/compute-protocol.js` (worker handler, request-response). Modify

**Analog:** the `bench` branch (lines 46-59) plus the header message catalogue (lines 4-10). The header comment must list the new message pair:
```js
//   main → worker  { type: 'compare', id, eyes: { OD?: spec, OS?: spec }, profile?: { surfaces, frame, eye, thetaDeg } }
//   worker → main  { type: 'compare', id, eyes: { OD?: result, OS?: result }, profile?: …, computeMs }
```
Branch pattern:
```js
      if (msg?.type === 'bench') {
        const pair = benchPair(msg.caseId, msg.k);
        const t0 = now();
        const r = evaluatePairFn(pair);
        ...
        return { type: 'bench', id, caseId: msg.caseId, ms, ok: ..., evaluations: [...] };
      }
```
Inject `meridianProfile` through `createHandler({ evaluate, evaluatePairFn, now, profileFn = meridianProfile })` (lines 29-33), so tests can stub it. The `catch` at lines 61-64 already returns `{ type: 'error', id, eyes }`. For compare jobs, `eyes` is `[]`, which the client error path must tolerate (see above).

**Test analog:** `compute-protocol.test.js:12-22` (result equals `evaluateLens` output) and `:29-38` (`structuredClone(res)` round trip).

**Worker glue** `src/worker/engine.worker.js` needs **no change**: it forwards every message to `handle()`.

---

### `src/i18n/format.js` (i18n utility). Modify

**Analog** (lines 36-44):
```js
/** 1 decimal: 1.84 → "1,8 mm", −0.04 → "0,0 mm". */
export function fmtMm(v) { return typographicMinus(oneDecimalNf.format(v)) + NBSP + 'mm'; }
/** 1 decimal: 12.34 → "12,3 g". */
export function fmtGram(v) { return typographicMinus(oneDecimalNf.format(v)) + NBSP + 'g'; }
```
- `fmtGramWhole(v)` uses `intNf` (line 22). For `v < 0.5`, it **returns `null` or a code** and the caller uses `t('result.weightUnder1')`. `format.js` holds no German words. Alternatively, pass the string in, so "unter 1 g" stays in the dictionary.
- Signed differences: a new `diffNf` with `signDisplay: 'exceptZero'`, like `diopterNf` (lines 7-11). The words dünner/dicker come from the dictionary based on the sign. Never use colour.
- Keep `fmtGram`. The Expert Zwischenwerte still show 0,1 g.

**Test analog:** `format.test.js:7-18` (`test.each([[v, \`…${NBSP}…\`]])`), with the NBSP and MINUS constants at lines 4-5.

---

### `src/i18n/de-AT.js` (dictionary). Modify

**Pattern** (lines 1-4, 15-47). It is one frozen flat object with namespaced keys, a short comment above each group naming the requirement, and `{param}` placeholders only:
```js
// German (de-AT) dictionary: the single source of every visible string.
export default Object.freeze({
  // Zyl/Achse (RX-03); tooltips per PITFALLS "German (de-AT) Pitfalls".
  'rx.cyl.abbr': 'Zyl',
  'rx.forms': '{eye}: Minuszylinder: {minus} · Pluszylinder: {plus}',
```
- New namespaces from RESEARCH and UI-SPEC: `tip.<term>.{name,text}`, `val.<CODE>`, `cmp.*`, `xs.*`, `preset.*`, `expert.*`, `bar.*`, `stamp.*`, `pd.*`.
- Soft hyphens must be written as `­` escapes (UI-SPEC Typography list). Use the escape, not the invisible literal, so they are reviewable.
- **Existing keys change wording:** `rx.od` "R – rechtes Auge" becomes "Rechtes Auge (R / OD)" (D-02). `loc.*` (lines 93-100) holds "nasal (zur Nase)" / "schläfenseitig (außen)" and must become the lay words "außen (zur Schläfe)" / "innen (zur Nase)" (D-23). `e2e/smoke.spec.js:90` asserts `'schläfenseitig'`, so update it in the same commit. `disclaimer.body` changes with MAT-05 (UI-SPEC line 513). `dictionary.test.js:41-59` asserts substrings of it ('Lernhilfe', '0,1 mm', '+0,50', '±0,3 mm', …), and those must all survive.
- Material lay names: the existing `material.<id>` keys (lines 64-69) are reused by `renderMaterialLine` and `caseLabel` (main.js:61-63, 425). Either rename them consistently or add `material.<id>.title` / `.sub` keys.

### `src/i18n/dictionary.test.js` (test). Modify

Extend these:
- the `DIAG_DATA` map (lines 62-74) with `MANUAL_BACK_CONVEX`;
- the code ↔ key `test.each` blocks (lines 28-34) for any new code objects (`VAL_CODES`, PD/stamp codes);
- the orphan-key test (lines 88-101) with new `^val\.` and `^tip\.` rules;
- the placeholder whitelist pattern (lines 111-117) for `cmp.*` / `xs.*` params.

Add a "every UX-01 term has `tip.<term>.name` and `tip.<term>.text`" test, listing the terms from UI-SPEC Toggletips. The "no Stärke" test (36-38) already covers UX-05.

---

### `src/ui/main.js` → split into `dom.js`, `pipeline.js`, `timing.js`, `rx-input.js`, `frame-input.js`, `material-input.js`, `results.js`, `compare-view.js`, `expert.js`, `cross-section.js`, `toggletip.js`

**Rule (RESEARCH Open Q12):** move the code verbatim first, one commit per module with e2e green after each. Change the markup second. The ENG-09 timing/pending code must stay byte-identical in behaviour.

#### `src/ui/dom.js` (utility). Move from main.js
```js
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));        // 32
const setText = (id, text) => { $(id).textContent = text; };                       // 33-35
const para = (text) => { const el = document.createElement('p'); el.textContent = text; return el; }; // 225-229
```
Plus `applyDictionary()` (lines 71-78). Extend it with a `data-i18n-aria-label` loop for the tip buttons (RESEARCH Pattern 4 markup). RESEARCH recommends making `setText` a no-op when the text is unchanged. That matters for `role=status` regions, following the MINOR-11 signature trick at lines 248-253.

#### `src/ui/pipeline.js` (controller, event-driven). Move from main.js:310-530
Contents: the `pending` token set and `writePending` (lines 313-321), `onBusy` (331-349), `onFailed` (351-364), `deliveries`/`paintDeliveries`/`onResults` (366-416), `onFallback` (483-496), `createComputeClient({...})` (498-510) and `startWorker` (512-530).
- **Compare deliveries copy the `paintDeliveries` pattern** (lines 374-405). They are buffered, painted in the next `requestAnimationFrame`, and re-checked with `client.isCompareCurrent(gen)` before painting (T-01-38, RESEARCH Security). They write a separate `pendingCompare` token set to `#compare[data-pending]` using the same `writePending` shape:
```js
function writePending() {
  const tokens = pending.input ? ['input'] : [];
  for (const eye of EYES) if (pending.open.has(eye) || pending.delivered.has(eye)) tokens.push(eye);
  const value = tokens.join(' ');
  const el = $('result');
  if (el.dataset.pending !== value) el.dataset.pending = value;
}
```
- The worker URL must stay `new URL('../worker/engine.worker.js', import.meta.url)` (line 514). `e2e/helpers.js:28 WORKER_URL` matches `/worker/` in the hashed name.
- The sync fallback (lines 488-495) uses a dynamic `import('../state/compute-protocol.js')` and must remain lazy.

#### `src/ui/timing.js` (controller). Move from main.js:420-474 and 552-653
Contents: `READOUTS`/`runBench`/`onBench`/`finishBench`, the `timings` rings, `runFrame`, `writeResultTiming`/`writeBusyTiming` and `startEventTiming`. `runFrame` (lines 604-630) calls `update(inputTs)`. Inject `update` so timing.js does not import the input modules.

#### `src/ui/rx-input.js` (component, field → parse → echo/message)
**Analog:** main.js:108-197. This is the core field pattern that every new field copies (stamp, A/B/DBL, base curve, min CT/ET, k, custom ne/density/Abbe, rim depth):
```js
function showFieldOk(id, echo) {
  setText(`${id}-echo`, echo);
  const err = $(`${id}-err`);
  err.textContent = '';
  err.hidden = true;
  $(id).removeAttribute('aria-invalid');
}
function showFieldError(id, message) {
  setText(`${id}-echo`, '');
  const err = $(`${id}-err`);
  err.textContent = message;
  err.hidden = false;
  $(id).setAttribute('aria-invalid', 'true');
}
function readField(id, parse, format) {
  const r = parse(/** @type {HTMLInputElement} */ ($(id)).value);
  if (r.ok) { showFieldOk(id, format(r.value)); return r.value; }
  showFieldError(id, t('parse.' + r.code));
  return null;
}
```
Phase-2 extension: `showFieldMessage(id, { tier, code, data, suggestion })` replaces `showFieldError`. It builds the tier label `<strong>`, the icon from `icons.js`, the text and the optional "{value} übernehmen" button with `createElement` + `textContent`, in the same style as `renderDiagnostics` (lines 232-254). It sets `aria-invalid` only for the `error` and `out-of-model` tiers. **Debounce only the display** (600 ms or blur, UI-SPEC Validation). `readField` still returns the value or null synchronously every frame, so `update()` and the compute request are never delayed (RESEARCH Pitfall 5).
- `readCyl` (blank → 0, lines 143-150) and `readAxis` (axis required when cyl ≠ 0, lines 153-164) stay as they are.
- `readRx` (lines 173-197) keeps calling `transpose()` and filling `#rx-{od,os}-forms`.
- Sign "±" button: on click, flip the sign, then `input.dispatchEvent(new Event('input', { bubbles: true }))`. That way the existing `onInput → schedule(e.timeStamp)` path (main.js:677) handles it. Note that `e.timeStamp` of a synthetic event is its creation time, which is fine for ENG-09.
- "Gleich für beide Augen": set `readonly` on the L fields, never `disabled` (RESEARCH Anti-Patterns).

#### `src/ui/frame-input.js` (component)
**Analog:** main.js:80-106:
```js
/** Options from SHAPES ids only; labels from the dictionary. */
function buildShapeOptions() {
  const select = shapeSelect();
  for (const id of Object.keys(SHAPES)) { const opt = document.createElement('option'); opt.value = id; opt.textContent = t('frame.shape.' + id); select.append(opt); }
  select.value = DEFAULT_SHAPE;
}
/** Selected id, guarded to a SHAPES key. */
function currentShape() { const id = shapeSelect().value; return Object.hasOwn(SHAPES, id) ? id : DEFAULT_SHAPE; }
function prefillFrame(shape) { const d = SHAPES[shape].defaults; for (const [k, v] of [['a', d.A], ['b', d.B], ['dbl', d.DBL]]) $(`frame-${k}`).value = String(v); }
```
- Radio cards: iterate `Object.keys(SHAPES)` the same way, so ids come from the engine only (T-01-21 guard). Read the selection with `document.querySelector('input[name=frame-shape]:checked')?.value` and the same `Object.hasOwn(SHAPES, id)` guard.
- Thumbnails: call `frameOutline(shape, A, B, 'OD', 72)` (n must be a multiple of 4, outline.js:6-10). Build the path `d` from the Float64Array. Build them **once at init** with the shape defaults, not per keystroke: the outline build costs ≈ 1,6 ms on desktop per outline.js:89-90.
- Stamp ↔ A/DBL sync: write A/DBL `.value`, then call `schedule()` once. Do not dispatch two `input` events.

#### `src/ui/material-input.js` (component)
**Analog:** main.js:37-69 (`buildMaterialOptions`, `currentMaterialId` guard, `renderMaterialLine` with `densityNf`/`abbeNf` at lines 23-27). Radio cards follow the same `Object.keys(MATERIALS)` loop. For the custom card, `currentMaterialId()` returns `'custom'` only when the Expert switch is on. Otherwise it falls back to the last listed id (UI-SPEC Material section).

#### `src/ui/results.js` (component, result → DOM)
**Analog:** main.js:199-308. Copy:
- `renderEmpty` (201-211) and `renderDiagnostics` (232-254, with the `dataset.sig` no-re-announce rule);
- `statusLabel` (257-261);
- `setStale` (281-287, `dataset.stale`; CSS `td[data-stale]` at style.css:232 must be widened to `[data-stale]` because the values are no longer `td`);
- `renderResult` (289-308).

Keep the value ids `#result-{od,os}-{ct,etmax,etmin,weight,status}` (e2e contract). `etmax` text changes from "2,8 mm – loc" to the number only, with the location in `#result-od-etmax-loc`. `e2e/helpers.js:21-25 etmaxOf` parses `^(\d+,\d)` and still works. `smoke.spec.js:109-110` (`/^3,2\smm – /`) must be updated.
- Decentration and base curve move to Expert Zwischenwerte with the same ids: `#result-od-dec`, `#result-od-basecurve` (UI-SPEC). `CELLS` (line 199) is used by `renderEmpty`, `setStale` and `onFailed`. Keep it as the single list of value ids and add the new ids there.
- Summary bar: read the same painted values; do not recompute. No analog exists. Use `IntersectionObserver` on `#result` to set `hidden` on the bar.

#### `src/ui/compare-view.js` (component, event-driven)
**Analog:** `paintDeliveries` (main.js:374-405) for rAF batching and the current-check. Table rows are built with `createElement('tr')` / `textContent`, following the `renderDiagnostics` DOM-building style (lines 232-254). All arithmetic comes from `state/compare.js`; this module only formats (`fmtMm`, `fmtGramWhole`) and `t()`s.

#### `src/ui/expert.js` (component)
**Analog:** `baseCurveText(m, im)` (main.js:263-278). It moves here verbatim and feeds the "Automatisch: …" line and `#result-od-basecurve`. `dictionary.test.js:111-117` restricts `basecurve.*` placeholders to `vogel`, `thickness` and `clamped`, so any new base-curve key needs a whitelist update. Expert fields use `readField` from rx-input.js (or dom.js if it is moved there).

#### `src/ui/toggletip.js`, `src/ui/cross-section.js`, `src/ui/icons.js`: see "No Analog Found"

---

### `index.html` (markup). Modify

**Cell pattern to replicate for every new field** (lines 40-46):
```html
<td>
  <label for="rx-od-sph" class="visually-hidden" data-i18n="rx.od.sph.label"></label>
  <input id="rx-od-sph" name="od-sph" type="text" inputmode="decimal" autocomplete="off"
    aria-describedby="rx-od-sph-echo rx-od-sph-err">
  <output id="rx-od-sph-echo" for="rx-od-sph"></output>
  <p id="rx-od-sph-err" class="error" aria-live="polite" hidden></p>
</td>
```
- In card mode the label must be visible (UI-SPEC). Swap `visually-hidden` for a class toggled by the container query, not by JS.
- The ids `#result`, `#calc-status`, `#diag-od`/`#diag-os`, `#result-*-material`, `#disclaimer`, `#tech` and all of its children (`#compute-mode`, `#timing*`, `#timing-rerun`, `#ua`) and `#app-commit` stay exactly as in lines 143-219.
- `<details id="tech">` (lines 202-215) is the analog for `<details id="rx-other">` (RX-08) and "Werte je Auge anzeigen".
- `<fieldset id="frame">` + `<legend>` (lines 112-113) is the analog for the `#frame-shape` and `#material` radio fieldsets. `#material` and `#frame-shape` change from `<select>` to `<fieldset>`, which breaks `smoke.spec.js:71-77, 87, 97` and `perf-throttled.spec.js:141-142` (`selectOption`). Change them in the same commit.
- Viewport meta (line 5) becomes `width=device-width, initial-scale=1, interactive-widget=resizes-content`.
- Static text uses `data-i18n` (and `data-i18n-title`, lines 23 and 27). Add `data-i18n-aria-label` for icon buttons and handle it in `applyDictionary`.

### `src/ui/style.css` (style). Modify

**Token block** (lines 2-14). Extend it with the UI-SPEC variables (`--surface`, `--accent` = `--focus` value, `--accent-tint`, `--error-tint`, `--hint`, `--hint-tint`, `--bar-bg`, `--bar-focus`, `--space-*`). Keep the existing names: `--focus` is used by `:focus-visible` (line 117-120).

**Text-label-first diagnostic box** (lines 205-219). This is the template for the three validation tiers and the L/R callout:
```css
/* Diagnostics: the text label ("Nicht herstellbar" / "Hinweis") carries the meaning, the border only supports it. */
.diag-error, .diag-warn { border-inline-start: 4px solid var(--line); padding-inline-start: 0.75rem; margin-block: 0.5rem 1rem; }
.diag-error { border-inline-start-color: var(--error); }
```
- `.error::before { content: '⚠ ' }` (lines 92-94) is replaced by the SVG icon (UI-SPEC).
- `body { max-width: 48rem; overflow-wrap: break-word }` (lines 16-22) becomes `overflow-wrap: anywhere` plus `-webkit-hyphens: auto`. The max width moves to the input column.
- Comment style: cite the support source inline, as `.calc-status` does at lines 221-228. Container queries need the same kind of citation.
- `.calc-status` keeps its 3-line reserved height (`min-height: 3lh`). ENG-09 layout stability depends on it (worker.spec.js `boxes()`/`expectSame`).

---

### `e2e/helpers.js` (test helper). Modify

**Analog** (lines 12-15):
```js
export async function settled(page, { timeout = 10_000 } = {}) {
  await expect(page.locator('#result')).toHaveAttribute('data-pending', '', { timeout });
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0))));
}
```
→ `settledCompare(page)` is the same function on `#compare` (and `#xsec`). Add `const plain = (s) => s.replaceAll('­', '')` for text assertions (RESEARCH Pitfall 6). `etmaxOf` (lines 21-25) still works if `#result-*-etmax` starts with the number.

### New e2e specs: `rx`, `presets`, `compare`, `expert`, `layout`, `a11y`

**Analog:** `e2e/smoke.spec.js`.

**Guard harness to copy into every new spec** (lines 9-35). It checks for 4xx responses, failed requests, foreign origins and CSP console messages, so CSP regressions from SVG/inline styles are caught everywhere:
```js
let seen;
test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  seen = { bad: [], failed: [], foreign: [], csp: [] };
  page.on('response', (r) => { if (r.status() >= 400) seen.bad.push(`${r.status()} ${r.url()}`); });
  ...
  page.on('console', (m) => { if (m.text().includes('Content Security Policy')) seen.csp.push(m.text()); });
  await page.goto('./');
});
test.afterEach(() => { expect(seen.csp, 'CSP violations').toEqual([]); /* … */ });
```
Consider moving this harness into `helpers.js` as `guardPage(test)` rather than copying it six times. That stays inside the "e2e helpers" scope.

**Axe pattern** (smoke.spec.js:444-448, today it checks serious/critical only):
```js
test('no serious or critical accessibility violations', async ({ page }) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const severe = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
```
`a11y.spec.js` tightens this to `.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])` with **zero** violations of any impact (RESEARCH Code Examples; UI-SPEC Accessibility). `worker.spec.js:203` shows the scoped variant `.include('#result')`.

**Viewport:** `playwright.config.js` has the projects `desktop` (1280×800) and `mobile` (360×780). The 320 px checks use `test.use({ viewport: { width: 320, height: 640 } })` inside the spec. New specs are picked up automatically by `testDir: 'e2e'` with no workflow change (RESEARCH Open Q11).

**Browser-global lint comment** (smoke.spec.js:7): `/* global document, window, MutationObserver -- page.evaluate bodies run in the browser */`. The e2e lint block has Node globals only (eslint.config.js:18-21).

### Existing e2e specs to update deliberately (same commit as the markup change)

| Spec:line | Current assertion | Phase-2 change |
|---|---|---|
| `smoke.spec.js:56` | `#result-od-basecurve` contains 'Vogel' | Moves to Expert. Toggle `#expert` first |
| `smoke.spec.js:71-77, 87, 97` | `#material`/`#frame-shape` `option` count, `selectOption` | Radio count, `.check()` |
| `smoke.spec.js:90` | etmax contains 'schläfenseitig' | Lay location words (D-23), now in `#result-od-etmax-loc` |
| `smoke.spec.js:92, 95` | `#result-od-dec` = "3,0 mm" / "7,0 mm" | Expert-only id. Toggle the switch |
| `smoke.spec.js:109-111, 188` | etmax `/^3,2\smm – /`; weight `/^7,0\sg$/` | etmax number only; weight in whole grams (`7 g`), RES-01 |
| `smoke.spec.js:88-89` | default A 52, PD 32, Sph −2,00 start value (main.js:682) | Example at load is now −2,75/−0,50×180 · PD 32 / 31,5 (UI-SPEC presets). **Every pinned default-value test must be rechecked** |
| `perf-throttled.spec.js:141-142` | `selectOption(material/shape)` | Radio `.check()` |
| `worker.spec.js:195-210` | `#result-od-status` 'rechnet …', `[data-stale]`, `#calc-status` | Ids kept; the `[data-stale]` count must exclude compare cells, or compare uses another attribute |

---

### `test/bench/compare.test.js` (bench, batch). New

**Analog:** `test/bench/recompute.test.js` (whole file, 47 lines). It uses the warm-up loop, `BENCH_RUNS`, median/p95 via `console.info`, and asserts correctness only ("CI timing never gates", line 1-2). Case: 6 materials × 2 eyes for `NORMAL_PAIR` and `GRENZFALL_PAIR`, built with `{ ...pair.OD, materialId: id }` over `Object.keys(MATERIALS)`.

---

## Shared Patterns

### Codes in state, text in the dictionary
**Source:** `src/state/transpose.js:5-8`, `src/state/parse.js:5-12`, `src/engine/diagnostics.js:1-2`
**Apply to:** `validate.js`, `compare.js`, the `parse.js` additions, `profile.js`, `rim.js`
```js
export const RX_CODES = Object.freeze({ CYL_TRANSPOSED: 'CYL_TRANSPOSED', ... });
```
Plus the paired dictionary completeness test (dictionary.test.js:28-34, 88-101), and `PARSE_CODES is frozen and keys equal values` (parse.test.js:86-89).

### All text through `t()` + `textContent`, DOM built with `createElement`
**Source:** `src/ui/main.js:232-254` (`renderDiagnostics`), `src/i18n/t.js:9-19`
**Apply to:** every `src/ui/*` module
```js
const strong = document.createElement('strong');
strong.textContent = t(eye === 'OD' ? 'rx.od' : 'rx.os') + ': ' + t(`diag.${d.code}.title`);
```
`t()` throws on a missing key in dev and tests (t.js:11-15), so a typo fails e2e loudly.

### Guarded id lookup from engine catalogues (T-01-21)
**Source:** `main.js:52-55, 95-98`
**Apply to:** shape cards, material cards, the meridian select, presets
```js
function currentMaterialId() { const id = materialSelect().value; return Object.hasOwn(MATERIALS, id) ? id : DEFAULT_MATERIAL; }
```

### Re-announce suppression for live regions (MINOR-11)
**Source:** `main.js:248-253`
**Apply to:** the `*-err` slots, `#lr-callout`, `#pd-note`, compare status, the summary bar label
```js
const sig = items.map((el) => el.className + '|' + el.textContent).join('\n');
if (sig === (box.dataset.sig ?? '')) return;
box.replaceChildren(...items);
box.dataset.sig = sig;
```

### Input → one frame → compute (ENG-09, never debounced)
**Source:** `main.js:655-664, 677`
**Apply to:** every new input, radio, sign button, preset and stamp handler
```js
const onInput = (e) => schedule(e.timeStamp);
function schedule(timeStamp) { if (!pending.input) { pending.input = true; writePending(); } scheduleFrame(timeStamp); }
```

### Paint deliveries in rAF with a currency re-check (T-01-38)
**Source:** `main.js:374-391`
**Apply to:** main results (unchanged), compare rows, A/B, cross-section profile
```js
if (client.isCurrent(eye, d.seq)) { renderResult(eye, d.result); painted++; }
```

### Injected dependencies for testable pure modules
**Source:** `compute-client.js:40-54` (`now`, `setTimer`, `clearTimer`, `isHidden`), `frame-scheduler.js:9`, `compute-protocol.js:29-33`
**Apply to:** the compare lane, the 600 ms message debounce (put a pure `createDebouncer(setTimer, clearTimer)` in `state/` so it can be unit-tested), and the profile function injection

### Documented design constants
**Source:** `compute-client.js:17-22`, `diagnostics.js:20-21`, `shapes.js:3-6`, `materials.js:7`
**Apply to:** `RIM_DEPTH_DEFAULT_MM`, `LR_DIFF_MM`/`LR_DIFF_G`, the PD default 32 and its bands, the 600 ms pause, k default −1 / range, the custom-material bands. Format: `export const NAME = value;` with a comment that gives either a citation or `[ASSUMED, RESEARCH Ax]`.

### Test style
**Source:** `parse.test.js` (`test.each` tables plus `ok`/`err` helpers), `evaluate.test.js:9-22` (`spec(o)` override factory), `properties.test.js:1-40` (fast-check), `compute-client.test.js:5-81` (fake timers injected, no `vi.useFakeTimers`)
**Apply to:** all new unit tests

---

## No Analog Found

The planner should use RESEARCH.md Patterns 4, 5 and 7 and the UI-SPEC component contract for these:

| File / feature | Role | Data Flow | Reason | Use instead |
|---|---|---|---|---|
| `src/ui/cross-section.js` | ui component | transform (profile → SVG) | The repo has no SVG at all (`grep createElementNS\|<svg` → none) | RESEARCH Pattern 2 (A/B overlay, 1:1 aspect), UI-SPEC Querschnitt. Use `document.createElementNS('http://www.w3.org/2000/svg', …)`, presentation attributes (`stroke`, `fill`, `stroke-dasharray="6 4"`) or classes only, and `<title>`/`<desc>` via `textContent` |
| `src/ui/icons.js` | ui utility | — | No icons exist; `.error::before` uses a text glyph | UI-SPEC Design System row "Icon library": six 16×16 SVGs, `stroke="currentColor"`, `aria-hidden="true"`, `focusable="false"` |
| `src/ui/toggletip.js` | ui component | event-driven | No `aria-expanded` widget exists; `<details id="tech">` (index.html:202, main.js:690-695) is the nearest disclosure | RESEARCH Pattern 4 (APG Disclosure; Esc returns focus; not linked via `aria-describedby`) |
| Expert switch (in `expert.js`) | ui component | event-driven | No `role="switch"` exists | RESEARCH Pattern 7; fallback to a plain checkbox if axe flags `aria-allowed-role` (A8) |
| Summary bar `#summary-bar` (in `results.js`) | ui component | event-driven | No fixed or sticky element and no `IntersectionObserver` exist | UI-SPEC "Phone and tablet" section; RESEARCH Pitfall 4 (`interactive-widget`, `scroll-padding-bottom: 72px`) |
| Inline preset confirm (in `rx-input.js`) | ui component | event-driven | No confirm UI exists | RESEARCH Pattern 5 (`role="group"` + `aria-labelledby`, focus on "Eingaben behalten", Esc cancels, focus returns to the chip) |

---

## Risks the planner should not miss

1. **`compute-client.js` error paths assume `job.eyes`.** `failCurrent(job)` (lines 178-190) iterates `job.eyes`. `onErrorMsg` and `workerError` route every non-bench job there. A compare job routed there throws or fails the main eyes. Add an explicit `kind === 'compare'` branch to both.
2. **Clearing the compare queue on identical requests** would starve the comparison. Bump the generation only when an eye's key changes (after line 216's early `continue`).
3. **The default page values change** (example −2,75/−2,50 instead of −2,00, plus a new PD 31,5). Several pinned e2e numbers in `smoke.spec.js` (105-112) and `worker.spec.js` (`etAt` baselines) depend on the old defaults. Recompute the pinned values in the engine and note them in the plan.
4. **`[data-stale]` CSS selector is `td[data-stale]`** (style.css:232). The new result cards are not `td`, so stale styling silently disappears unless the selector is widened. `worker.spec.js:209` counts `[data-stale]` globally, so compare cells must not reuse the attribute while main is settled.
5. **Dictionary key renames** (`rx.od`, `loc.*`, `material.*`) are also used by `caseLabel` in the Technische Angaben readouts (main.js:421-433) and by `renderMaterialLine`. Grep every `t('…')` user before renaming.

---

## Metadata

**Analog search scope:** `src/engine/**`, `src/state/**`, `src/i18n/**`, `src/ui/**`, `src/worker/**`, `e2e/**`, `test/**`, `index.html`, `eslint.config.js`, `playwright.config.js`
**Files read:** 30 (main.js, compute-client.js, compute-protocol.js, parse.js, transpose.js, bench-cases.js, frame-scheduler.js, engine.worker.js, evaluate.js, metrics.js, design.js, diagnostics.js, materials.js, conventions.js, outline.js (partial), shapes.js, format.js, t.js, de-AT.js (partial), dictionary.test.js, parse.test.js, compute-client.test.js (partial), compute-protocol.test.js (partial), evaluate.test.js (head), properties.test.js (head), metrics.test.js (head), boundary.test.js, recompute.test.js, helpers.js, smoke.spec.js (partial), worker.spec.js (partial), perf-throttled.spec.js (partial), index.html, style.css, eslint.config.js, playwright.config.js)
**Project skills:** none (`.claude/skills/` absent)
**Pattern extraction date:** 2026-11-07
