---
phase: 03-3d-lenses-frame
reviewed: 2026-11-08
depth: standard
base: 3aba0ef
findings:
  critical: 1
  warning: 11
  info: 14
  total: 26
status: issues_found
---

# Phase 3 Code Review

Two reviewers in parallel: part A (engine, state, worker, page code) and part B (src/ui/view/**). IDs are prefixed A- and B-. Note: A-WR-02 and B-WR-09 describe the same retry/remount defect.

# Part A

phase: 03-3d-lenses-frame
part: A
reviewed: 2026-11-08T22:09:26Z
depth: standard
diff_base: 3aba0ef
files_reviewed: 22
files_reviewed_list:
  - src/engine/rim.js
  - src/engine/mesh/frame.js
  - src/engine/mesh/heat.js
  - src/engine/mesh/lens.js
  - src/engine/mesh/topology.js
  - src/state/mesh-client.js
  - src/state/mesh-protocol.js
  - src/state/transfer.js
  - src/worker/mesh.worker.js
  - src/i18n/de-AT.js
  - src/i18n/format.js
  - src/ui/frame-input.js
  - src/ui/icons.js
  - src/ui/main.js
  - src/ui/pipeline.js
  - src/ui/results.js
  - src/ui/summary-bar.js
  - src/ui/view-place.js
  - src/ui/style.css
  - index.html
  - eslint.config.js
  - playwright.config.js
findings:
  critical: 0
  warning: 2
  info: 7
  total: 9
status: issues_found
---

# Phase 3: Code Review Report (part A)

**Reviewed:** 2026-11-08T22:09:26Z
**Depth:** standard (diff `3aba0ef..HEAD`)
**Files Reviewed:** 22
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I traced the engine mesh code (topology, lens, frame, heat, rim) for winding, normals, units and
degenerate cases. I traced the mesh client, protocol, transfer and worker for latest-wins
behaviour, buffer detachment, stale painting and the watchdog. I also checked the UI glue (pipeline
3D hooks, frame-input rim lines, summary-bar thumbnail, view placement) and the index.html and
style.css additions.

The geometry holds up:
- Both eyes' outlines are CCW, because `mirrorOutlineX` reverses the order. So the winding and the
  outward band and rim normals are correct for OS too.
- The front and back normals match `z = −sF` and `z = −CT − sB`.
- `bevelSplit` and `frontLeadMm` agree with the rim placement in `buildRim`.
- All Uint16 indices fit.

The mesh client's latest-wins, stale-stop and lost-buffer paths are sound and well tested. No new
`innerHTML`, inline style or other CSP sink was added. I found no Critical issue.

The two Warnings are robustness gaps in failure paths:
1. A synchronous `postMessage` failure wedges the mesh client for 10 s. The worker-side "detached
   buffer" handling cannot be reached.
2. The view-load `catch` mixes up "chunk did not load" with "mount or update threw". A retry can
   then mount a second view with a second worker.

## Warnings

### A-WR-01: `send()` throwing inside `pump()` wedges the client; worker-side detached-buffer handling is unreachable

**File:** `src/state/mesh-client.js:101-106`, `src/state/transfer.js:383-385`, `src/state/mesh-protocol.js:210-212,269-285`

**Issue:** `pump()` sets `inFlight = job` and calls `arm()` before `send(...)`, and nothing catches
an exception from `send`.
- `transferOf` puts every view's `ArrayBuffer` into the transfer list, including detached ones.
- `postMessage` with a detached `ArrayBuffer` in the transfer list throws `DataCloneError`
  synchronously. Verified locally:
  `structuredClone({b:a},{transfer:[a.buffer]})` on an already-transferred `a` →
  `DataCloneError: Cannot transfer object of unsupported type`.
- Because of that, the protocol's documented "detached buffer is re-allocated and flagged" path
  (tested in `mesh-protocol.test.js:82,253`) can never trigger in worker mode. The page's
  `postMessage` throws before the worker sees the message.

**Failure scenario:** A buffer set that was already transferred reaches `requestMesh`, or
`postMessage` throws for any other reason. Then:
- `requestMesh` throws into `view.update`.
- The queued job has already been moved to `inFlight`, so its items are consumed.
- No reply ever comes. For 10 s the 3D view shows the old mesh and every new request just sits in
  `queued`.
- Then the watchdog fires `fallback('timeout')` and the client drops to sync mode for good, which
  is the slow main-thread path, all because of one bad message.

The view's pool (`lenses.js` `usableFor`) currently rejects length-0 sets, so this is
defence-in-depth rather than a reproduced bug. No test covers a throwing `send`.

**Fix:** Drop detached buffers from the transfer list, and treat a throwing send as a worker error:
```js
// transfer.js
if (ArrayBuffer.isView(v) && v.buffer.byteLength > 0) set.add(v.buffer);

// mesh-client.js pump()
if (mode === 'worker') {
  arm();
  try {
    send({ type: 'mesh', id: job.id, items: job.items });
  } catch {
    fallback('error'); // reports job as lost (items null), re-runs the queue in sync
  }
}
```
Add a mesh-client test where `send` throws.

### A-WR-02: View-load `catch` also catches `mountView`/`update` errors; retry can double-mount the view

**File:** `src/ui/pipeline.js:252-264` (`loadView`), `src/ui/pipeline.js:267-294` (`showLoadFailed`)

**Issue:** One `.catch` covers three things: the dynamic `import()`, `mountView(...)` and the first
`view.update(...)`. Each failure case goes wrong in its own way:
- **`view.update` throws:** `view` is already assigned, yet the user sees
  "Die 3D-Ansicht konnte nicht geladen werden" with a retry button. Every later `refreshView()`
  takes the `if (view)` branch and keeps calling the broken view while the failure box is shown.
  Clicking retry runs `mountView` again on the same `#view-slot`. That creates a second mesh worker
  (`view.js:452`), a second `visibilitychange` listener (`view.js:459`) and a second set of
  stage/preset listeners. The first view and its worker are never released.
- **`mountView` throws part-way, after it has created the worker:** every retry leaks one worker
  and one document listener.
- **Any of these cases:** `#tech-view-unavailable` reports "Laden fehlgeschlagen", which is the
  wrong reason.

**Fix:** Handle the import failure on its own, and keep mount and update errors out of the retry
path:
```js
function loadView() {
  import('./view/view.js').then(
    ({ mountView }) => {
      if (view) return;           // never mount twice
      view = mountView({ slot: $('view-slot') });
      view.update(viewInputs());  // let a throw surface as an error, not as "load failed"
    },
    (err) => {
      console.warn('3D view could not load', err);
      viewFailed = true;
      $('view').dataset.pending = '';
      showLoadFailed();
    },
  );
}
```
Optionally wrap `mountView` in its own try/catch that shows a different reason and offers no
retry.

## Info

### A-IN-01: The 3D chunk loads from non-result triggers, not only from "the first painted result"

**File:** `src/ui/pipeline.js:230-250`, `src/ui/main.js:233,259`, `src/ui/frame-input.js:297,448-451`

**Issue:** The header comment (lines 23-25, D-16) says the first painted result lazy-loads the
chunk. In practice, these callers start the import and call `placeViewSlot()` even before any
result is painted:
- the Expert toggle (`refreshView` in main.js)
- every stamp keystroke and rim-depth keystroke (`onDisplayChange`)
- the `cmp-show` change
- `startConfigCompare` and `endConfigCompare`

`requestMain` already guards its call with `(view || viewLoading)`, but the other callers do not.

**Fix:** Have `refreshView` return early when `!view && !viewLoading` unless the caller is
`paintDeliveries` or `onFailed`. For example, add a `{ load: true }` flag that only those two pass.

### A-IN-02: Invalid items return the raw (possibly missing) buffers with `reallocated: false`

**File:** `src/state/mesh-protocol.js:313,341`

**Issue:** The header says a missing or wrong-length buffer is re-allocated and flagged
`reallocated: true`. An item that fails validation instead returns `item.buffers` as they came in,
which can be `undefined` or a wrong length, and says `reallocated: false`.
- The view pool silently rejects such sets.
- The 03-15 realloc counter (`workerReallocs`) does not count them.

This is harmless today but contradicts the documented contract.

**Fix:** Either document that invalid items echo their input buffers unchanged, or normalise them
too.

### A-IN-03: The bevel-rule sentence hard-codes "ein Drittel" while the rule is a constant

**File:** `src/i18n/de-AT.js:189`, `src/engine/rim.js:22`

**Issue:** `frame.rim.bevel` says "Facette bei einem Drittel der Randdicke von vorne". That is only
true while `BEVEL_RULE === '1:2'`. If the constant changes (the research left it to the lab's
choice), the UI text will state a rule that is no longer the computed one, and no test ties them
together.

**Fix:** Add a dictionary test asserting `BEVEL_RULES[BEVEL_RULE] === 1/3` next to this key, or
choose the string by rule key.

### A-IN-04: `DBL = 0` passes the protocol, and the bridge then degenerates to NaN

**File:** `src/state/mesh-protocol.js:260`, `src/engine/mesh/frame.js:411-423,210-218`

**Issue:** With `DBL = 0`, the bridge tangent becomes vertical, and at `u = 0.5` it is zero, so
`writeRing` normalises a zero vector. Why:
- `P0.x === P1.x` (both nasal extremes sit at x = ∓DBL/2).
- `P1.z === P0.z` for a symmetric frame.

The frame comes back `finite: false` and is not drawn, with no stated reason. The UI range
(`FRAME_RANGES.DBL` 14…24) makes this unreachable today.

**Fix:** Reject `f.DBL <= 0` in `invalidFrame`, or guard `L === 0` in `writeRing`.

### A-IN-05: After a load failure, dead controls stay exposed

**File:** `index.html:400-412`, `src/ui/pipeline.js:267-294`

**Issue:** On chunk-load failure, the four disabled preset buttons stay visible, and
`#view-canvas role="img"` keeps the accessible name "3D-Ansicht…" although nothing is drawn. Screen
reader users meet an image and four dimmed buttons next to the error message.

**Fix:** In `showLoadFailed`, hide `#view-tools` and set `#view-canvas` to `aria-hidden="true"`.
Undo both on retry.

### A-IN-06: Retry after a failed dynamic import is verified only in Chromium

**File:** `src/ui/pipeline.js:252`, `e2e/view.spec.js:117-143`, `playwright.config.js`

**Issue:** Retry re-imports the same specifier. From memory and unverified: browsers have differed
on whether a failed module fetch stays cached in the module map, so a retry would reject at once
without a network request (whatwg/html discussion of failed-import caching). The e2e test runs only
the Chromium projects, so Safari/iOS, a main lay-user platform, is unverified.

**Fix:** Run the retry spec in a WebKit project once, or make the retry button reload the page as a
fallback when the second import rejects.

### A-IN-07: The stacked heat table uses `display: block` on table elements

**File:** `src/ui/style.css` (`@container viewheat (width < 480px)` block)

**Issue:** From memory and unverified: WebKit has historically dropped table semantics when table
elements get `display: block`/`grid`. The visible `.cell-label`s keep the content readable, but
VoiceOver may no longer announce it as a table.

**Fix:** Add explicit `role="table"`, `role="row"`, `role="cell"` and `role="columnheader"` where
the view builds the table, or check it in VoiceOver on iOS.

## Checked and found sound (no finding)

- **Winding:** `topology.js` and `lens.js` winding and normals are correct for both eyes, because
  `mirrorOutlineX` keeps CCW. The ring-RINGS offset `3·(1+(RINGS−1)·SPOKES)` is correct. All index
  values are below 65 536.
- **Frame geometry:** In `frame.js`, the rim face normal (radial × tangent, oriented +z), the
  temple miter scaling on U, the bridge W ≈ +z depth, and the `templeDrawnMm` clamp with protocol
  validation of `templeMm > 0` are all correct.
- **`heat.js`:**
  - `isoLevels` counts multiples strictly inside (min, max) correctly at exact multiples.
  - The `angleDiff` wrap is correct.
  - The `isoLabelPoints` bisection keeps the sign bracket.
- **Mesh client:**
  - A replaced queued job returns as `dropped`.
  - A stale reply is delivered with `current: false`.
  - A lost in-flight job is reported before `onFallback`, and the re-request runs in sync, because
    `mode` is already `'sync'`.
  - Sync stale-stop returns the unbuilt items with their buffers.
  - The hidden-tab and late-timer re-arm both work.
- **Listeners:**
  - `view-place.js` and `summary-bar.js` add each listener once; there are no listener leaks.
  - `fitThumb` measures with the grid layout applied: `grid-column` is explicit, so a hidden slot
    does not shift columns.
- **CSP:** No `innerHTML`, `insertAdjacentHTML`, `style=` attribute or `cssText` was added. The
  retry UI uses `textContent` and `createElement`.

---

_Reviewed: 2026-11-08T22:09:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_


# Part B

phase: 03-3d-lenses-frame
part: B (src/ui/view/*)
reviewed: 2026-11-08T00:00:00Z
depth: standard
diff_base: 3aba0ef
files_reviewed: 15
files_reviewed_list:
  - src/ui/view/backdrop.js
  - src/ui/view/camera-math.js
  - src/ui/view/cividis.js
  - src/ui/view/compare3d.js
  - src/ui/view/controls.js
  - src/ui/view/frame.js
  - src/ui/view/heat.js
  - src/ui/view/label-layout.js
  - src/ui/view/labels.js
  - src/ui/view/legend.js
  - src/ui/view/lenses.js
  - src/ui/view/scene.js
  - src/ui/view/text.js
  - src/ui/view/tiers.js
  - src/ui/view/view.js
findings:
  critical: 1
  warning: 9
  info: 7
  total: 17
status: issues_found
---

# Phase 3: Code Review Report, Part B (3D view modules)

**Reviewed:** 2026-11-08
**Depth:** standard. I read every file in scope in full. I also read the engine `isoLevels`/`heatScale`/`eyeBox` code and the `pipeline.js` mount site to check call contracts.
**Files Reviewed:** 15
**Status:** issues_found

## Summary

**Safe as written:**
- **XSS:** every string goes through `textContent` or `setAttribute`. There is no `innerHTML` or `insertAdjacentHTML` anywhere in scope.
- **GPU resources:** none are created per update. Arrays are swapped in place, the chart textures are disposed on a tier change, and the PMREM texture is disposed on context restore.
- **Numbers:** `isoLevels` guarantees `scaleMax > scaleMin`, so the legend and shader divisions are safe. `eyeBox` always has both eyes.

**Main risks:**
1. One reachable uncaught exception (`writeAria` with a null heat scale). It leaves a stale accessible name that still announces old thickness numbers.
2. No exception safety in the two passes that temporarily change shared renderer, camera and scene state (`thumbFrame`, `renderPass`).
3. Several state-machine gaps in the preset/mode logic:
   - Glas keeps the Dickenkarte pose after leaving it.
   - A cancelled tween keeps the old preset name.
   - Keyboard input before the first attach suppresses the default fit.
4. The "no thumbnail copy on a keystroke frame" design is silently defeated by `refresh() → goTo(cut) → onSettle`.

There are no teardown paths at all. That is acceptable for a mount-once view, but the load-failure retry can mount the view twice.

## Critical Issues

### B-CR-01: `writeAria` crashes in Dickenkarte when no eye is drawn, and the accessible name stays stale

**File:** `src/ui/view/view.js:697-698` (state set at `:924` and `:978`)

**Issue:**
- `paintHeat()` stores `heatState = { key, scale: null, … }` when no eye is drawable (line 924). `paintHeatCompare()` does the same when there are no metrics (line 978).
- `writeAria()` only checks `mode === 'heat' && heatState`, then reads `heatState.scale.min`.

**Scenario:**
1. Expert → Dickenkarte.
2. The user clears both SPH fields, or makes both eyes uncomputable.
3. `update()` calls `scheduleAria()` (line 1166). The frame re-mesh then runs `paintMesh → paintHeat`, which sets `scale: null`.
4. 500 ms later `writeAria` throws `TypeError: Cannot read properties of null (reading 'min')` inside a timer.

**Result:**
- The canvas `aria-label` keeps the previous text: "Dickenkarte … Dünnste Stelle X mm …" for lenses that are no longer shown.
- So a screen-reader user hears thickness numbers that no longer exist (core-value accuracy).
- No e2e test covers Dickenkarte with both eyes blocked.

**Fix:**
```js
if (mode === 'heat' && heatState) {
  const label = heatState.scale
    ? t('view.aria.heat', { viewName: viewNameText(), min: fmtMm(heatState.scale.min), max: fmtMm(heatState.scale.max) })
    : t('view.empty'); // or a dedicated 'view.aria.heatEmpty' key
  if (canvasEl.getAttribute('aria-label') !== label) canvasEl.setAttribute('aria-label', label);
  return;
}
```
Also add an e2e test: Dickenkarte on, clear both SPH, then assert no page error and an updated `aria-label`.

## Warnings

### B-WR-01: The thumbnail frame does not restore camera or visibility when a pass throws

**File:** `src/ui/view/scene.js:168-187`

**Issue:** `thumbFrame` moves the camera to the thumbnail pose and hides `thumb.hide` (chart and shadow). It then calls `runPass()` and `copyThumb()` with no `try/finally`. If the pass throws (compare3d pass, a three.js error) or `copyThumb` throws (for example `getContext('2d')` returns null):
- The camera stays at the thumbnail pose. The next `controls.update()` adopts it as the user's camera.
- `shadow.mesh.visible` stays `false` permanently. Nothing but `fit()` sets it again. The next thumbnail frame even captures `false` as the value to restore.
- `chart.mesh` recovers, because `beforeRender` rewrites it every frame. The shadow does not.

The hooks after the pass also never run (labels, settle note).

**Fix:**
```js
const wasVisible = hide.map((o) => o.visible);
try {
  for (const o of hide) o.visible = false;
  runPass();
} finally {
  hide.forEach((o, i) => (o.visible = wasVisible[i]));
}
try { copyThumb(spec.src); } finally {
  camera.position.copy(savedPos); camera.quaternion.copy(savedQuat); camera.updateMatrixWorld();
}
```

### B-WR-02: The compare render pass leaves the scissor test, viewport, visibility, positions and drawRange changed on an exception

**File:** `src/ui/view/compare3d.js:140-212`

**Issue:** `renderPass` changes shared state through `set()` and calls `restore()` only on the normal path (lines 164 and 211). The changed state includes `visible`, `position.x/z` and `geometry.drawRange.count = 0` for the warm-up, plus `setScissorTest(true)` and per-half viewports.

If `renderer.render` throws mid-split:
- The scissor test stays on and the viewport stays at the B half. Every later non-split pass then draws only into that half.
- The `saved` stack keeps stale entries.
- If the throw happens during the warm-up, the A slot keeps `drawRange.count = 0` until the next `restore()`.

**Fix:** Wrap the body after the first `set()` in `try { … } finally { renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); restore(); }`. Do the same for the non-active branch.

### B-WR-03: The keystroke-frame thumbnail gating is dead code; every attach copies a thumbnail

**File:** `src/ui/view/view.js:545, 554-557`, together with `controls.js:278-285, 122-128` and `view.js:726-730`

**Issue:** `paintMesh` tries to skip the thumbnail while a newer job is in flight (`if (outstanding === null) requestThumb(true); else thumbDirty = true`). But the chain is:
1. `refresh()` (line 545) runs first and calls `controls.refresh()`.
2. On any preset (including the initial `'default'`) that calls `goTo(name, eyeArg, { cut: true })`.
3. `goTo` calls `onSettle(false)`.
4. `onSettle` calls `requestThumb(false)`, which sets `thumbWanted = true`.

So on a phone below 900 px every attach during typing pays the 2-pass thumbnail frame plus a `drawImage`. That contradicts the 03-15 design comment ("no keystroke frame pays the copy"). No test asserts this; the `view.spec.js` thumbnail tests cover only drags.

**Fix:**
- Option 1: pass a flag from `controls.refresh()` so its internal cut does not call `onSettle`, for example `goTo(name, eyeArg, { cut: true, silent: true })`.
- Option 2: in view's `onSettle`, skip `requestThumb` while `outstanding !== null`.
- Either way, add an e2e test that types 3 keystrokes and asserts that `thumbInfo().copies` grows by at most 1.

### B-WR-04: Leaving Dickenkarte (or turning Expert off) keeps the single-lens 'heat' pose in Glas and Simple

**File:** `src/ui/view/view.js:1007-1030`, `controls.js:75, 278-285`

**Issue:**
- `setMode('glass')` never moves the camera, so `controls.preset()` stays `'heat'`.
- After that, every `refresh()` (each attach and each resize) re-fits the heat pose of `eyeArg`. That pose is one lens with `HEAT_FIT_MARGIN`. So Glas, and Simple after Expert is turned off, stays locked on a one-lens close-up.
- `viewName()` maps `'heat'` to `'front'`, so the canvas `aria-label` and the view name say "von vorne", although this is not the Vorne preset.
- The Seite side-note and the thumbnail logic then work from a pose that is out of context.

**Fix:** In `setMode`, when leaving heat while `controls.preset() === 'heat'`, call `controls.goTo('front', 'OD')`. UI-SPEC says entering Dickenkarte "goes to Vorne", so Vorne is the symmetric return. `'default'` would also work. Either choice should be written into UI-SPEC.

### B-WR-05: Interrupting a preset tween with a click (no movement) leaves a stale preset name

**File:** `src/ui/view/controls.js:174-191`

**Issue:**
- `'start'` sets `tween = null` and records `dragFrom` at the current, mid-tween pose.
- On `'end'` with no movement, `name` is NOT set to `'free'`. It stays the preset from before the tween started, for example `'default'` while the camera is half-way to Seite.

**Results:**
- `viewName()`, the aria label and the side note are wrong.
- `thumbSpec` treats the camera as being on a preset.
- The next `refresh()` cuts back to the old preset, so the user's chosen Seite is silently lost.

**Fix:** In the `'start'` handler, if a tween was running, set `name` to `'free'` (`if (tween) setName('free')`). Alternatively finish the tween with `place(to)` and `setName(tween.name)` before nulling it.

### B-WR-06: A mesh job that fails twice leaves the stage in "wird geladen" (or a stale "aktualisiert") forever, with no error

**File:** `src/ui/view/view.js:465-482`

**Issue:** After the one retry, the `d.current && !retryLeft` branch only clears the badge timer and sets `data-pending=''`.
- **Before the first attach:** `#view-status` keeps `view.loading` ("3D-Ansicht wird geladen …") permanently. Tests waiting on `data-pending` consider this settled.
- **After an attach:** the old mesh for a different Rx stays drawn under the normal mode badge if the failure arrived within 100 ms. If the 100 ms timer had already fired, the badge stays on "wird aktualisiert" for good.

Either way no message says that the 3D view is out of date.

**Fix:** In the final-failure branch:
- `setText('view-status', t('view.meshFailed'))`, a new de-AT key.
- `showUnavailable('tech.view.reason.meshFailed')`.
- Keep the stale mesh but set the badge to the failure text.
- Clear all of it on the next successful `paintMesh`.

### B-WR-07: '3D drehen' can stay active while less than 50 % of the stage is visible, which traps touch scrolling

**File:** `src/ui/view/controls.js:238-244`

**Issue:** The IntersectionObserver callback only runs when the ratio crosses 0.5, and it only deactivates on such a crossing. `#view-rotate` sits outside the stage (`index.html:415`). So a user can scroll until only about 40 % of the stage is visible and then tap the button:
- No crossing happens, so the toggle stays on.
- The stage keeps `touch-action: none`.
- Scrolling further away (0.4 → 0) never crosses 0.5 either.

This breaks the UI-SPEC promise that the canvas "can never trap scrolling".

**Fix:** Store the last `intersectionRatio`. In `setActive(true)`, refuse to activate, or immediately deactivate, when that ratio is below 0.5. Alternatively use thresholds `[0, 0.5]` and check `ratio < 0.5` on every callback.

### B-WR-08: Keyboard input on the stage before the first mesh attach suppresses the A1 default fit

**File:** `src/ui/view/controls.js:249-273`, `view.js:546, 627-634`

**Issue:**
- The preset buttons are disabled until the first attach. But `#view-stage` is `tabindex=0` and its keydown handler is live at once.
- An arrow key before the first mesh arrives orbits the 500 mm placeholder pose and sets `name = 'free'`.
- On the first attach, `refresh()` then skips `goTo(name)` because the camera is "turned freely". OrbitControls clamps the distance to the new `maxDistance`.

So a keyboard user's first view is a zoomed-out placeholder instead of the fitted default. `Home` before the attach calls `goTo('default')` with `full.r = 0`, which gives distance 0 and puts the camera at the origin. That is harmless only because the next refresh re-fits.

**Fix:** Ignore keydown until the first attach, for example with a `controls.setEnabled(false/true)` that view.js toggles in `paintMesh` next to the preset buttons. Alternatively, in `refresh()` force `goTo('default')` on the first call.

### B-WR-09: A load-failure retry can mount the view twice, and there is no teardown

**File:** `src/ui/view/view.js:191-1428` (mount), `scene.js:236-266`

**Issue:** `pipeline.js` retries with `loadView()`, which calls `mountView()` again, whenever `mountView()` or the first `view.update()` throws. None of the first mount's resources are released:
- WebGLRenderer on the same canvas (getContext returns the same context, so two three.js state trackers share it)
- mesh Worker
- ResizeObservers (scene and legend)
- MutationObserver, matchMedia and `visibilitychange` listeners
- the `#expert` change listener, stage focus and blur listeners, OrbitControls
- the A/B captions and divider appended to the DOM, and the label pools appended in `initHeatLabels`

A second mount duplicates all of it. The second `initHeatLabels` also replaces the module-level `heat` singleton while the first mount's hooks still run.

**Fix:**
- Either guard `mountView` with a module-level "mounted" check (return the existing API),
- or return a `destroy()` that terminates the worker, disconnects the observers, removes the listeners, calls `renderer.dispose()` and removes the appended nodes, and call it before a retry.
- Do every step that can throw (DOM lookups) before `createScene`.

## Info

### B-IN-01: The thumbnail pass inherits the near-temple fade of the main camera

**File:** `src/ui/view/scene.js:205-214`, `view.js:1032-1038`

`beforeRender` sets `frame.setFade(nearTempleFade(dir))` from the main camera before `thumbFrame` switches to the front pose. In Seite (a preset, so thumbnails are allowed) the 48×36 thumbnail shows one temple and its hinge at 25 % opacity.

**Fix:** Pass a pre-hook such as `frame.setFade(null)` through `thumb.hide`, or restore the fade around the thumbnail pass.

### B-IN-02: `chartRect` can throw inside `refresh()` with nothing to catch it

**File:** `src/ui/view/camera-math.js:396`, `view.js:632`

The default-pose corner ray stops reaching the chart plane at stage aspect ≈ 7.5. That is unrealistic today, but the throw would abort `paintMesh` half-way: `setPending` would never be cleared and the buttons would stay disabled.

**Fix:** Catch the error in `refresh()` and keep the previous rectangle.

### B-IN-03: Label and caption size caches are never invalidated on text zoom or late font load

**File:** `src/ui/view/labels.js:86-98`, `compare3d.js:81-91`

The sizes are re-measured only when the text changes. After a browser text-zoom or a late web-font swap, collision boxes are wrong, so callouts can overlap or be dropped.

**Fix:** Clear both caches in the `onResize` hook.

### B-IN-04: The A slot dispersion follows OD (B) while A is recomputing

**File:** `src/ui/view/view.js:1245`

While a comparison keeps the old A lens shown (`c.A === null`), `nextAbbe.A` falls back to `nextAbbe.OD`. The A half then gets B's material dispersion. If one material has νe and the other does not, this switches `USE_DISPERSION`, which rebuilds the program. That contradicts "starting or ending a comparison creates no GPU resource".

**Fix:** Keep `abbe.A` unchanged while `c.A === null && wasCmp`.

### B-IN-05: Heat callouts, legend and table outlive an eye that was just hidden, and eye labels lead the mesh on a DBL change

**File:** `src/ui/view/view.js:1178, 1242`

`update()` hides a newly blocked eye at once, but `paintHeat` runs only at the next attach. Until then the callouts float over the empty spot and the table still lists the eye. `updateLabels` also moves the eye-label anchors to the new DBL before the frame re-mesh places the lenses. Both are short-lived and are fixed on attach.

**Fix:** Call `paintHeat()` or `clearHeatLabels()` when `update()` hides the heat eye. Compute the anchors from the attached placement.

### B-IN-06: `window.__eyeglassView` ships in production

**File:** `src/ui/view/view.js:1291-1425`

The handle is frozen and returns no Rx values, but `pixels()` and `pixel()` force a synchronous render and do a GPU readback on demand from any script on the shared `github.io` origin.

**Fix:** Gate it behind `import.meta.env.DEV` or a `?testhandle` flag, as `?perfmarks` is.

### B-IN-07: A heat-eye radio can be disabled while it holds focus

**File:** `src/ui/view/view.js:886-889`

`r.disabled = !heatState.table[r.value]` can disable the focused radio, so keyboard focus drops to `<body>`.

**Fix:** Move focus to the checked radio before disabling.

---

_Reviewed: 2026-11-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
