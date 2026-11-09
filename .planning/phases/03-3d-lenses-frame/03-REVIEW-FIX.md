---
phase: 03-3d-lenses-frame
fixed_at: 2026-11-08T23:19:55Z
review_path: .planning/phases/03-3d-lenses-frame/03-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-11-08T23:19:55Z
**Source review:** .planning/phases/03-3d-lenses-frame/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 12 (B-CR-01, A-WR-01, A-WR-02 = B-WR-09, B-WR-01 … B-WR-08). A-WR-02 and B-WR-09 are one defect with one fix, so there are 11 fix commits.
- Fixed: 12. Skipped: 0.
- Out of scope but fixed: A-IN-05, which came out of the A-WR-02 fix.
- Each finding was first checked against the code at `cca46c1`. Where a test was feasible, it was written first and seen failing before the fix.
- Logic and state-machine fixes (A-WR-01, B-WR-03, B-WR-04, B-WR-05, B-WR-07, B-WR-08) pass their new tests. A human should still confirm that the chosen behaviour is the wanted one; the judgement calls are listed per finding.

## Fixed Issues

### B-CR-01: `writeAria` crashes in Dickenkarte when no eye is drawn

**Files modified:** `src/ui/view/view.js`, `e2e/view-heat.spec.js`
**Commit:** a5c21ae
**Verified first:** reproduced. In Dickenkarte with both Sph fields cleared, the canvas `aria-label` kept "Dickenkarte, von vorne. Dünnste Stelle 1,8 mm, dickste Stelle 4,6 mm …".
**Applied fix:** `writeAria` uses the heat name only when `heatState.scale` exists. Otherwise it falls through to the Glas name, which uses the existing strings: "Rechtes Glas: nicht berechnet. Linkes Glas: nicht berechnet." No new string.
**Test:** e2e `B-CR-01 Dickenkarte with both eyes cleared`. It checks that no `pageerror` occurs, that the name no longer contains "Dünnste Stelle", and that both eyes read "nicht berechnet". It passes on desktop and mobile.

### A-WR-01: `send()` throwing inside `pump()` wedges the mesh client

**Files modified:** `src/state/mesh-client.js`, `src/state/mesh-client.test.js`
**Commit:** f0e3b52
**Applied fix:** A throwing `send` now triggers `fallback('error')` in a following task (`setTimeoutFn(…, 0)`). The job is reported lost and the queue re-runs in sync mode, without the 10 s wedge.
- The deferral is deliberate. Reporting the loss synchronously would re-enter `view.update` (the retry) before the outer `update` had recorded `outstanding` and `metaByGen`.
- **Not applied:** the `transfer.js` half of the suggestion (drop detached buffers from the transfer list). Structured serialisation throws `DataCloneError` for a detached `ArrayBuffer` even when it is not in the transfer list. Checked in Node 22: `structuredClone({ b: detached })` throws "An ArrayBuffer is detached and could not be cloned". So dropping it from the list would not make the worker-side re-allocation path reachable; the client-side catch is the real fix.

**Test:** unit test `A-WR-01: a throwing send → …`. It checks that `requestMesh` does not throw and that the loss is not reported re-entrantly. After one 0-ms task, the loss is reported (`items: null, error: true`), the mode is sync, the next request is built in sync, and `onFallback` was called once. The test failed before the fix.

### A-WR-02 (= B-WR-09): the view-load catch also catches mount and update errors; a retry can double-mount

**Files modified:** `src/ui/pipeline.js`, `src/ui/view/view.js`, `src/i18n/de-AT.js`, `src/ui/style.css`, `e2e/view.spec.js`
**Commit:** 324de3a
**Applied fix:**
- **`pipeline.js`:** Only a rejected `import()` shows the load-failure box with "Erneut versuchen". A `mountView` or first `update` error now:
  - shows the existing `view.contextGone` text ("… vorübergehend nicht verfügbar. Laden Sie die Seite neu …") with no button,
  - sets the reason `tech.view.reason.error`,
  - drops the view and clears `data-pending`.
- There is also a `if (view) return` guard.
- **`view.js`:** `mountView()` mounts only once. A second call returns the first view; there is no teardown.
- **New de-AT string:** `'tech.view.reason.error': 'Fehler beim Aufbau der Ansicht'`. No existing reason fitted: 'Laden fehlgeschlagen' is the wrong reason, which was the point of the finding, and 'Grafik vom Browser angehalten' is context loss. B-WR-06 reuses this key.

**Test:**
- New e2e `A-WR-02 mount or update error: no retry, no second mount`. The chunk is served as a module whose `update` throws. The test checks for no retry button, a reason other than 'Laden fehlgeschlagen', `window.__mounts === 1` after another input, and nothing pending. It failed before the fix: the retry box was shown.

### A-IN-05 (Info, out of scope, fixed as part of A-WR-02): dead controls after a load failure

**Files modified:** same commit as A-WR-02 (324de3a)
**Applied fix:** While a failure is shown, `#view-tools` is hidden and `#view-canvas` gets `aria-hidden="true"`. A retry restores both. This needed a `#view-tools[hidden] { display: none }` rule, because `display: flex` won over `[hidden]`; the first test run caught this.
**Test:** the D-16 load-failure test asserts both states, during the failure and after the retry.

### B-WR-01: the thumbnail frame does not restore camera or visibility when a pass throws

**Files modified:** `src/ui/view/scene.js`
**Commit:** a9a7242
**Applied fix:**
- Visibility of the `thumb.hide` objects is restored in a `finally` around the thumbnail pass.
- The camera position and quaternion are restored in a `finally` around pass + copy.
- The 2-pass structure is unchanged.

**Test:** none new. There is no fault-injection hook to make a WebGL pass throw. The normal path is covered by the UX-03 thumbnail e2e, including the "camera unchanged after a thumbnail frame" check, and those tests pass.

### B-WR-02: the compare render pass leaves scissor, viewport and visibility changed on an exception

**Files modified:** `src/ui/view/compare3d.js`
**Commit:** 03168e7
**Applied fix:** Both branches of `renderPass` restore in a `finally`. For the warm-up / inactive branch that is `restore()`. For the active branch it is `setScissorTest(false)` and the full viewport when split, then `restore()`.
**Test:** none new, for the same reason as B-WR-01. `view-compare.spec.js` and `view-memory.spec.js` pass, so the warm-up still uploads and creates no new resources.

### B-WR-03: the keystroke-frame thumbnail gating is dead code

**Files modified:** `src/ui/view/view.js`, `e2e/view.spec.js`
**Commit:** e080586
**Verified first:** the finding is real, and goes further than the review says. The `paintMesh` gate `outstanding === null` can never be false: a reply is attached only when it is current, and `outstanding` is cleared for that generation just before the gate. Every other `requestThumb` path also copied while a newer job was held: `onSettle` from the `refresh()` cut, resize, mode, tier, and the test handle.
**Applied fix** (orchestrator decision: make the rule hold, keep the 2-pass frame):
- `thumbSpec()` returns "not now" while a mesh job is outstanding.
- The wanted thumbnail waits in `scene.js` (`thumbWanted`), and the attach of that job carries it in its own render, still 2 passes.
- The dead `else` branch is removed.

**Test:** e2e `B-WR-03 no thumbnail copy while a mesh job is in flight` (mobile). The mesh worker is held, the user types, and a thumbnail is requested. A render runs but makes no copy. After the release there is exactly one copy and `passesPerThumbFrame === 2`. Before the fix, a copy happened while the job was held.

### B-WR-04: leaving Dickenkarte keeps the single-lens heat pose

**Files modified:** `src/ui/view/view.js`, `e2e/view-heat.spec.js`, `.planning/phases/03-3d-lenses-frame/03-UI-SPEC.md`
**Commit:** df823ce
**Applied fix** (orchestrator decision): leaving Dickenkarte, either to Glas or by turning Expert off, calls `controls.goTo('default', 'OD')`. That is the default pose with the default fit, as "Vergleich beenden" does: a tween, or a cut under reduced motion. The UI-SPEC "Camera and Controls" section now records the rule.
- The 03-14 rule "leaving compare while in Dickenkarte returns to the heat pose" does not conflict, so it is unchanged. The whole of `view-compare.spec.js` passes.

**Test:** e2e `B-WR-04 leaving Dickenkarte returns to the default view`. For both Glas and Expert off it checks the view name `'default'` and that the camera is at the default pose. Before the fix the view name stayed `'front'`, from the heat pose.

### B-WR-05: interrupting a preset tween with a click leaves a stale preset name

**Files modified:** `src/ui/view/controls.js`, `e2e/view-controls.spec.js`
**Commit:** 9187c86
**Applied fix:** On OrbitControls `'start'`, if a tween was running and had already moved the camera from its start pose, the name becomes `'free'`. A tween stopped before its first step leaves the camera exactly on the old preset, so that preset keeps its name.
**Test:** e2e `B-WR-05 a click that interrupts a preset tween marks the view free` (desktop).
- rAF is paused and the Seite tween is advanced by exactly one render.
- A real mouse down/up then gives the view name `'free'`, and the camera stays where the click stopped it.
- Before the fix the name was `'default'`.

### B-WR-06: a mesh job that fails twice leaves the stage in "wird aufgebaut" forever

**Files modified:** `src/ui/view/view.js`, `e2e/view.spec.js`
**Commit:** c69e377
**Applied fix** (orchestrator decision: existing UI-SPEC state):
- The final-loss branch shows the UI-SPEC load-failure text `view.loadFailed` in `#view-status`, in the Fehler tier (`view-failed`).
- It sets the reason `tech.view.reason.error` (added with A-WR-02) and resets the badge.
- An old mesh stays drawn.
- The next successful attach clears all of it. There is no retry button, because the next input builds again.
- No string was added beyond the one from A-WR-02.

**Test:** e2e `B-WR-06 mesh build failing twice shows the failure, the next input recovers`.
- The mesh worker and the sync fallback chunk are aborted, which gives the failure text and the reason.
- When the chunk is unblocked and the user types, the lens is built in sync mode and the message clears.
- Before the fix the status stayed "3D-Ansicht wird aufgebaut …".

### B-WR-07: '3D drehen' can stay on below 50 % stage visibility

**Files modified:** `src/ui/view/controls.js`, `e2e/view-controls.spec.js`
**Commit:** 5239471
**Applied fix** (choice recorded: **refuse to switch on**, the simpler option): the observer stores the last `intersectionRatio`. With threshold 0.5 alone, that value always tells which side of 0.5 the stage is on. `setActive(true)` returns while the ratio is below 0.5. The auto-off rule is unchanged.
**Test:** e2e `B-WR-07 3D drehen stays off while less than half of the stage is visible` (mobile). With about 40 % of the stage visible, a tap leaves `aria-pressed="false"` and `pan-y`. With the stage on screen, the toggle works. Before the fix the toggle switched on.

### B-WR-08: keyboard input before the first mesh attach suppresses the default fit

**Files modified:** `src/ui/view/controls.js`, `src/ui/view/view.js`, `e2e/view-controls.spec.js`
**Commit:** f4b55f1
**Verified first:** reproduced. Pos1 before the attach also put the camera at `0,0,0`, as the review said.
**Applied fix:** controls start with OrbitControls `enabled = false` and the keydown handler ignoring input. `controls.enable()` is called in `paintMesh`, next to enabling the preset buttons. This also covers a mouse drag before the attach on the pointer path.
**Test:** e2e `B-WR-08 keys before the first attach do not suppress the default fit`.
- Mesh replies are held from the start. The keys are dispatched in one task together with the "still pending" check, so no attach can come in between under load.
- The camera does not move and the view name stays `'default'`.
- After the release, the default fit applies and the keys work.
- The first version of this test failed once in a parallel run, from timing in the test itself (waiting across the 10 s watchdog). It was hardened before the commit.

## Gates (worktree, run one after the other)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0, no findings |
| `npm run test:coverage` | 46 files, 1 787 tests passed. All files 98,91 % statements / 96,87 % branches / 100 % functions / 99,48 % lines |
| `npm run build` | exit 0 (only the existing > 500 kB chunk warning for the view chunk) |
| `curl …:4173/Eyeglass-Prescription/` before the e2e run | `000` |
| `npm run test:e2e` | 555 passed, 33 skipped, **2 failed**, 16,4 min (see below) |

The two e2e failures did not reproduce:
- `a11y.spec.js:291` keyboard only. It hit the 30 s timeout inside `settledCompare`'s rAF wait. Alone it passed on both projects (17,9 s). It also passed with view-memory, a11y, view-controls and view-heat run together (106 passed, 0 failed).
- `view-memory.spec.js:58` D-27. In the full suite `allocPage` was 11 against 10 after the warm-up; geometries, textures and programs were unchanged. Alone it passed twice, and it passed under the 4-spec parallel load.
  - The spec's own comment says overlapping mesh jobs need extra buffer sets by design. The extra set is consistent with two jobs overlapping under full-suite CPU load, not with a leak.
  - I did not run the baseline full suite to prove it is pre-existing. That remains open.

**D-27 numbers (view-memory alone, desktop):**
- After the warm-up: geometries 21, textures 6, programs 11, allocPage 10, allocWorker 0.
- After 56 changes: identical. This is unchanged from before the fixes.

**Time to view ready at 412 × 915** (goto → `#view[data-pending]=''`, median of 5, scratch script, baseline `cca46c1` and the fixed build measured alternately on the same machine):

| Build | Run 1 | Run 2 |
|---|---|---|
| baseline `cca46c1` | 3,35 s | 3,41 s |
| fixed | 3,35 s | 3,33 s |

---

_Fixed: 2026-11-08T23:19:55Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Orchestrator follow-up (03-17 Task 1 finding)

| ID | Outcome | Commit | Test |
|---|---|---|---|
| A-IN-05 (no-WebGL path) | Fixed: without WebGL the preset toolbar and keyboard hint are hidden, the stage loses its tab stop and aria-describedby, and the canvas is aria-hidden; the no-WebGL note stays. Confirmed before the fix in the chrome-devtools MCP at 320×640 (`?nowebgl`: 4 disabled presets visible, canvas role=img without aria-hidden). | see git log | e2e/view.spec.js D-17 test extended; view.spec + a11y.spec 82 passed / 6 skipped |
