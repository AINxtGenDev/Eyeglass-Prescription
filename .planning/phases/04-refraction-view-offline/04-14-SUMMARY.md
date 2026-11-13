---
phase: 04-refraction-view-offline
plan: 14
subsystem: offline-runtime
tags: [OFF-01, D-20, D-21, M1, N8, MINOR 9, update-banner, handover, kill-switch, service-worker]
requires:
  - "04-06: sw-core.js wireRegistration, update.js start(), switch server, pwa project"
  - "04-07: createUpdateController, installControllerChange, handover.js, main.js handoverKind"
  - "04-04: sw-kill-switch.js, SW_KILL → selfDestroying + __SW_KILL__, test/dist/sw-shape.js"
provides:
  - "#app-update banner + #app-update-live; confirmation done / done.other / lost with Schließen"
  - "update.js: reloadWithHandover as the only reload path; no registerSW while __SW_KILL__"
  - "build:b (dist-b, label dev-b), build:kill (dist-kill), switch server /__switch/a|b|kill"
  - "pwa.spec.js 'switch server only': items 19–24, 20b, 320 px layout, 04-07 carry-overs, kill rehearsal"
  - "pwa.spec.js top-level 'kill switch active @live'"
  - "vite.config.js: sibling Cache Storage result next to BLAST RADIUS"
affects: [04-12 banner axe states, 04-13 lens-critic input and the kill-switch notes]
tech-stack:
  added: []
  patterns:
    - "registerSW options wrapped in update.js: onNeedRefresh = offline line + controller.show, onNeedReload = controller.onNeedReload"
    - "CSS custom properties from ResizeObserver via CSSOM (--bar-h, --update-h), CSP-safe"
    - "test builds built lazily in a describe beforeAll by an mtime rule, never in the webServer command"
key-files:
  created:
    - .planning/phases/04-refraction-view-offline/04-14-SUMMARY.md
  modified:
    - src/ui/update.js
    - src/ui/main.js
    - index.html
    - src/i18n/de-AT.js
    - src/ui/style.css
    - vite.config.js
    - package.json
    - .gitignore
    - playwright.config.js
    - e2e/support/switch-server.js
    - e2e/pwa.spec.js
    - eslint.config.js
decisions:
  - "An estimated lens height B is left out of the handover; the restored A gives the same estimate, so B keeps its 'geschätzt' note"
  - "Restoring a comparison keeps the 04-07 behaviour: focus moves to #cmp-diff, as on a click; tested"
  - "The busy 'Aktualisieren' uses aria-disabled, not disabled, so keyboard focus is not dropped to <body>; the controller ignores a second click"
  - "A second onNeedRefresh while the banner is shown is ignored (the plugin reports one waiting worker twice)"
  - "'Später' / 'Schließen' move focus to the first h2/h3 of <main> (tabindex -1 added at runtime, preventScroll) only if focus was in the box"
metrics:
  duration: "~85 min"
  completed: 2026-11-13
  tasks: 3
  files: 12
---

# Phase 4 Plan 14: Update banner, handover wiring and kill-switch rehearsal Summary

When a new version is waiting, a non-modal banner offers "Aktualisieren", which keeps the typed inputs in every open tab. Every failure path is tested on the production build with a real second build (dev-b). The kill switch was rehearsed in both directions on the switch server. The full gate also ran with `SW_SELF_DESTROY = true` in the working tree; that change was never committed.

## Worth knowing first

- **A kill deploy probably shows "update.done.other" once (unverified).** The destroyer's activation fires `controllerchange` in tabs that still run the old build. The 04-07 rule then reloads them with a handover. After that reload, the kill build confirms with „… weil sie in einem anderen Fenster gestartet wurde“. The inputs survive, but the stated reason is wrong for a kill. The rehearsal did not assert this text. The item is in deferred-items for 04-13.
- **The BLAST RADIUS sentence in vite.config.js over-counts.** It says "five Pages projects", but the check found four Pages sites. Of the four siblings: interior-design runs on its own origin (custom domain), and workflow does not exist (gh api returns 404). The plan allowed only the result lines to change, so that sentence was kept. It is noted in deferred-items.
- **Kill gate, first pass:** `npm run test:e2e` reported 628 passed, 1 failed, 66 skipped at load average 22–24. The failure was `view-ref.spec.js:1147` item 25: the guard stepped down to „Durchblick · vereinfacht“. This is the known 04-10 load item, and the spec belongs to 04-11. Run alone straight afterwards, still with the flag on, it passed. The remaining chain was then run and every step exited 0. So the chain did not exit 0 on the first attempt. Details are under "Kill gate" below.
- **A real bug found by item 23:** the plugin calls `onNeedRefresh` twice for one waiting worker, once from 'installed' (external) and once from 'waiting'. The second call reset "Aktualisieren" while the first click was still in flight, so the button looked enabled but did nothing. `ui.show` now ignores a second call while the banner is shown. This was fixed in 005b571.
- **ESLint failed on the new test builds** (dist-b/, dist-kill/). The kill gate's first `npm run lint` showed this. `eslint.config.js` was outside the plan's file list. It now ignores both directories (ab91d35).
- The chrome-devtools MCP pass (Task 2 step 6) was **not** done here. The orchestrator runs it after the merge. The visual checks below come from Playwright screenshots.

## Task 1: banner, plugin wiring, confirmation (29dadc6, fix in 005b571)

- `update.js` installs `installControllerChange(navigator, …)` when the module is evaluated. `start({ handoverKind, formState })` builds the 04-07 controller. It injects probe, writeHandover and snapshotForm from handover.js, and `location.reload` as reload. It then calls `wireRegistration` with a wrapped `registerSW`: `onNeedRefresh` updates the offline line and calls `controller.show()`, and `onNeedReload` is `controller.onNeedReload`. With `__SW_KILL__` set, it does not register and writes `tech.offline.failed`.
- From the 04-07 carry-overs, `main.js` passes `formState = { valid: formValid(), compareA: currentCompareConfig(), bEstimated: readFrame().bEstimated }`. update.js drops `text['frame-b']` from the snapshot when B is estimated. No storage word appears in update.js or main.js (grep = 0).
- `index.html`: `div#app-update` (role region, data-i18n-aria-label update.region, hidden) and `p#app-update-live.visually-hidden role=status` are the first children of `<body>`. No style attribute was added (grep `style=` = 0).
- `style.css`:
  - At ≥ 900 px the banner is fixed at right/bottom 24 px, width `min(400px, 100vw − 48px)`.
  - Below 900 px it is inset 8 px, at `bottom: calc(max(var(--bar-h), env(safe-area-inset-bottom)) + 8px)`.
  - z-index 20, `--bg` fill, 1 px `--line` border, 4 px `--fg` inline-start border, 4 px radius, the box shadow from the spec, no animation.
  - Hidden under `html.view-fs-open`, and hidden on phones while `.app-update--field` is set.
  - While the banner is open, `scroll-padding-bottom` rises by `--update-h`.

## Task 2: build B and the update e2e (005b571, 044702d)

- `APP_VERSION_OVERRIDE` is read only in vite.config.js (count 1). `build:b` writes dist-b. The switch server has `/__switch/a` (always dist) and `/__switch/b`, and returns 404 for unknown names.
- In pwa.spec.js, a file-level `beforeAll` resets to build A (NEW-6). `describe('switch server only')` has `test.skip(LIVE, …)`, `test.skip(KILL, 'kill switch on')` and `describe.configure({ timeout: 180 s })`. Its `beforeAll` returns at once on LIVE or KILL; otherwise it runs `buildLazily('build:b', 'dist-b')` (mtime rule, execFileSync, 180 s). Its `beforeEach` runs `/__switch/a`.
- Tests:
  - item 19 at 412×915 (focus unchanged, first tabbable = Aktualisieren, Shift+Tab route, region name, live text, no overlap with the bar, handover restored, key null, update.done, hidden on the first edit)
  - item 20 (four pages, outcome assertions only, N8)
  - item 20b
  - item 21
  - item 22
  - item 23
  - item 24a and item 24b
  - 320×640 layout
  - "handover keeps a comparison and the B estimate" (`#cmp-diff` focused after the reload, `#frame-b-echo` text identical, „geschätzt“)
  - "handover of a half-typed invalid input is not reported as lost" (Zyl `abc` restored, update.done)
- During the pwa run, `npm run build:b` ran lazily ("precache 16 entries" in the pwa log). The desktop smoke run did not build B.

### Playwright screenshots (what they show)

| File (scratchpad `04-14-shots/…`) | Shows |
|---|---|
| `04-14-banner-412x915.png` | The banner (info icon, „Neue Version verfügbar“, body, filled „Aktualisieren“ with the focus ring, outlined „Später“) sits above the dark summary bar ("R 5,1 mm · 7 g \| L 4,9 mm · 7 g") with a visible gap. No overlap, and text is not clipped. |
| `04-14-banner-320x640.png` | The same banner at 320 px, inset 8 px each side. Both buttons fit on one row, and the body wraps on 5 lines. It sits above the bar, with no horizontal overflow (asserted). |
| `04-14-typing-412x915.png` | Sph rechts is focused (selected text). No banner is visible, and only the summary bar shows at the bottom. |
| `04-14-confirmation-412x915.png` | After „Aktualisieren“: „Neue Version dev-b geladen. Ihre Eingaben wurden übernommen.“ with one outlined „Schließen“ and no title line. The fields show the typed −3,25. The box sits above the bar. |

## Task 3: kill rehearsal and sibling check (cf93dd8)

- `build:kill` writes dist-kill (`SW_KILL_REHEARSAL=1`). The switch server has `/__switch/kill`.
- The rehearsal test asserts `checkDestroyerSw('dist-kill')` = [].
- The top-level `kill switch active @live` runs only with KILL. Its comment contains "does NOT prove removal for returning visitors".

### Kill rehearsal outcome (flag off, two runs)

| | Run 1 (cf93dd8 check) | Run 2 (final chain) |
|---|---|---|
| caches before | `["eyeglass-rx-precache-v2-http://localhost:4175/Eyeglass-Prescription/","sibling-probe"]` | same |
| controller null within 5 s of reload 1 | no (logged "still controlled") | no |
| navigations, /__switch/kill → reload 2 | 2 (reload 2 was aborted once by a page/worker navigation and retried) | 3 |
| registrations after the kill, and after one more reload + 3 s | 0, 0 | 0, 0 |
| `caches.keys()` after | `[]`: sibling-probe gone too (blast radius demonstrated) | `[]` |
| #tech-offline in dist-kill | tech.offline.failed (no-registration branch) | same |
| re-enable (/__switch/a) | registers, scope `/Eyeglass-Prescription/`, eyeglass-rx precache again, offline reload `fromServiceWorker() = true` | same |

The first attempt failed on `page.reload: Not attached to an active page`: a navigation started by the worker or the page was in flight. The fix was `reloadTolerant()` (retry after the interrupting load) and a controller poll that tolerates navigations. No assertion was changed.

### Sibling check (read-only GETs, 2026-11-13, files in scratchpad `04-14-siblings/`, nothing executed)

| Project | URL (status) | Service worker | Cache Storage | Evidence |
|---|---|---|---|---|
| simplify_llm | https://ainxtgendev.github.io/simplify_llm/ (200) | no | none found | index.html and its only script `assets/index-DHSxdNom.js` (620 792 B): 0 matches for serviceWorker, caches.open/keys, CacheStorage, workbox; sw.js, service-worker.js, manifest.webmanifest, manifest.json, registerSW.js all 404 |
| testing | https://ainxtgendev.github.io/testing/ (200) | no | none found | index.html (incl. inline script) and `power_calc.js`: 0 matches; sw.js etc. 404 |
| interior-design | https://ainxtgendev.github.io/interior-design/ → 301 → its custom domain (Pages cname) | no | none found; **different origin**, outside the blast radius | HTML links `/manifest.webmanifest` (200), but sw.js 404; 0 matches in the HTML and the 10 referenced `_next` chunks |
| workflow | https://ainxtgendev.github.io/workflow/ (404) | n/a | n/a | `gh api repos/AINxtGenDev/workflow` 404; not in the has_pages repo list |

Result: today a kill deploy deletes only our own caches on ainxtgendev.github.io. This is recorded in vite.config.js with the advice to re-check before a real kill deploy.

### Kill gate (step 6a), SW_SELF_DESTROY = true in the working tree only

Rollback first: `git diff --quiet sw-kill-switch.js` exited 0, and the revert was `git checkout -- sw-kill-switch.js`. `grep` confirmed `export const SW_SELF_DESTROY = true;` at the start of each script.

| Command | Result |
|---|---|
| `npm run lint` | first pass exit 1 (dist-b/ bundles linted, Rule 3 fix ab91d35); then exit 0 |
| `npm run test:coverage` | exit 0: 59 files, 2134 passed; all files lines 99.63 %, branches 97.73 % |
| `npm run build`, `npm run build:e2e` | exit 0 |
| `npm run test:e2e` | **exit 1**: 628 passed, 1 failed, 66 skipped (21.0 min, load 22–24). The failure was view-ref item 25 (a)–(d), badge „vereinfacht“, the known load-dependent guard (deferred). In this run, the pwa project lines: `✓ scope and manifest (D-18) @live`, `✓ kill switch active @live (9.6s)`, and every other pwa test `-` skipped |
| rerun `npx playwright test --project=desktop e2e/view-ref.spec.js -g "item 25 \(a\)"` | exit 0, 1 passed (load 8.7) |
| `npm run test:e2e:live` | exit 0: 323 passed, 1 skipped |
| `npm run test:dist` | exit 0: 19 passed, 1 skipped. `✓ service worker, kill switch on: destroyer worker (D-24) > destroyer worker: no precache, deletes caches, unregisters`; `↓ … kill switch off: normal worker` skipped |
| `npm run test:pwa:live` (local switch server, kill build) | exit 0: `✓ scope and manifest (D-18) @live`, `✓ kill switch active @live (4.8s)`, 2 skipped |
| `npx playwright test --project=pwa` | exit 0: 2 passed, 15 skipped |

Skip reasons (JSON reporter, the same flag-on tree, 2 expected / 15 skipped / 0 unexpected):

- `kill switch on`: offline item 17, item 18, N12, CSP with the worker, and all 11 tests of 'switch server only' (items 19, 20, 20b, 21, 22, 23, 24a, 24b, both carry-overs and the rehearsal; the 320 px layout test was added after the gate)
- `scope and manifest (D-18) @live`: passed, with the annotation "scope assertion: kill switch on". Its manifest part ran (round-4 MINOR H).
- `kill switch active @live`: passed.

This matches the list in the KILL SWITCH comment. The banner axe states will come with 04-12.

Afterwards `git checkout -- sw-kill-switch.js` ran, `git diff --quiet sw-kill-switch.js` exited 0, and the file reads `export const SW_SELF_DESTROY = false;`. The final chain below rebuilt dist and dist-e2e with the flag off. Before every commit, `git diff --cached | grep -n SW_SELF_DESTROY` matched only an unchanged comment line, or nothing.

## Verification (flag off, final chain, one flock'd run)

| Command | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run test:coverage` | exit 0: 59 files, 2134 passed; lines 99.63 %, branches 97.73 % |
| `npm run build` | exit 0: precache 16 entries (959.92 KiB) |
| `npm run build:e2e` | exit 0: precache 16 entries (962.95 KiB) |
| `npm run test:dist` | exit 0: 19 passed, 1 skipped (precache 1 002 614 B) |
| `npx playwright test --project=pwa` | exit 0: 17 passed, 1 skipped ('kill switch active @live': kill switch off) |
| `npm run test:pwa:live` | exit 0: 3 passed, 1 skipped |
| `npx playwright test e2e/a11y.spec.js e2e/layout.spec.js` | exit 0: 74 passed |
| `npx playwright test --project=desktop e2e/smoke.spec.js` | exit 0: 26 passed (version label unchanged) |
| `npm run test:e2e:live` | exit 0: 323 passed, 1 skipped |
| Unit subset `sw-core`, `handover`, `boundary`, `dictionary` (Task 1) | 250 passed |

All plan acceptance greps match. Results: onNeedReload 2, `installControllerChange(` 1, `__SW_KILL__` 3, sw-kill-switch 0, autoUpdate 0, `style=` 0, APP_VERSION_OVERRIDE 1, build:b in package.json 1 and in playwright.config.js 0, `test.skip(LIVE` 2, build:kill 1, dist-kill in .gitignore 1, "Siblings checked" 1, "kill switch active @live" 1, `test.skip(KILL, 'kill switch on')` 6, `/__switch/a` 4. `#app-update` is at index.html line 14, before `<header` at line 24.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A repeated onNeedRefresh reset an "Aktualisieren" in flight**
- Found during: Task 2 (item 23 failed: the button was enabled again after about 3 s, and the body was update.body, not update.failed)
- Fix: `ui.show` returns while the banner is already shown in update mode
- Files: src/ui/update.js. Commit: 005b571

**2. [Rule 3 - Blocking] ESLint linted the dist-b / dist-kill bundles**
- Found during: Task 3 kill gate (`npm run lint` exit 1)
- Fix: both directories are added to the ESLint ignores
- Files: eslint.config.js (not in files_modified). Commit: ab91d35

**3. [Rule 1 - Test robustness] The rehearsal's reload raced a worker- or page-initiated navigation**
- Fix: `reloadTolerant()` and `uncontrolledWithin()`; no assertion relaxed
- Commit: cf93dd8

**4. [Rule 2 - Correctness] 04-07 carry-overs wired, as the orchestrator asked**
- formValid and currentCompareConfig go into the snapshot, and the B estimate is kept
- Two e2e tests cover them, plus the `#cmp-diff` focus assertion
- Commits: 29dadc6, 005b571

**5. [Addition] 320×640 banner layout test** (orchestrator visual check), 044702d.

**6. [Disabled state] `aria-disabled` instead of `disabled`** on the busy button
- `disabled` would drop the keyboard focus to `<body>`
- Playwright's toBeDisabled/toBeEnabled honour aria-disabled
- Commit: 29dadc6

Not done: the D-30 MCP step of Task 2 step 6 (by instruction, the orchestrator does it after the merge).

## Known Stubs

None. `handoverKind` in main.js is now read, and its eslint-disable was removed.

## Threat Flags

None beyond the register:

- T-04-28: there is no autoUpdate, and SKIP_WAITING is sent only from apply(). Covered by items 20 and 20b.
- T-04-29: the 10 s timer, nothing written before the reload, and the probe. Covered by items 23 and 24.
- T-04-52: the rehearsal both ways, the probe cache, and the sibling table.
- T-04-53: the fetched files are only grepped; nothing was executed.

## Commits

- 29dadc6 feat(04-14): update banner, plugin wiring and confirmation (D-20, D-21)
- 005b571 test(04-14): build B on the switch server and the update e2e (items 19-24)
- cf93dd8 test(04-14): kill-switch rehearsal both ways and the sibling Cache Storage check (M1)
- ab91d35 fix(04-14): ESLint ignores the dist-b and dist-kill test builds
- 044702d test(04-14): banner layout at 320 x 640 (one button row, 44 px, no overflow, above the bar)

STATE.md and ROADMAP.md were not touched (the orchestrator owns them), and version.js was not touched. Nothing was pushed.

## Self-Check: PASSED

The five commits are in `git log b6f311e..HEAD`. src/ui/update.js, e2e/pwa.spec.js and this SUMMARY exist. `git diff --quiet sw-kill-switch.js` exits 0. No switch server or vite preview from this worktree is left running.
