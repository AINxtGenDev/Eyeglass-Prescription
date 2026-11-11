---
phase: 03
slug: 3d-lenses-frame
status: verified
threats_total: 54
threats_closed: 54
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-11-11
audited: 2026-11-11
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register source: the `<threat_model>` blocks of 03-01 … 03-17-PLAN.md (54 threats: T-03-01 … T-03-53 plus T-03-SC).
> Verification: each `mitigate` entry checked against the implementation at HEAD `b166a63`. Evidence is file:line. Supporting runs on 2026-11-11: `npx eslint src` (clean, no output), `npx vitest run test/ci/pins.test.js` (6/6 passed), `npx vitest run` of mesh-protocol, mesh-client, boundary, rim, heat, frame, lens tests (7 files, 150/150 passed). The e2e suite was not re-run in this audit. e2e evidence means the test exists at the cited line, plus the CI result recorded in 03-17-SUMMARY.md (run 42682803647 green, live e2e 565 passed / 1 failed).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| user input → engine / text | Rx, frame and rim-depth text parsed and validated, then formatted back into German text | Rx values (personal health data, never leaves the page) |
| engine numbers → GPU / DOM | engine surfaces become mesh buffers, labels, legend, aria names | derived geometry, formatted numbers |
| page ↔ mesh worker | mesh items and Float32Array buffers cross postMessage (same-origin module worker) | geometry only |
| npm registry → bundle | new runtime dependency `three@0.187.0` | code (supply chain) |
| page → debug handle | `window.__eyeglassView` (frozen) on the shared `ainxtgendev.github.io` origin | counters, ior, geometry maxima, pixels |
| browser GPU → view | WebGL context loss and restore | none |
| local main → GitHub Pages | outward-facing deploy | public build |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Evidence | Status |
|-----------|----------|-----------|-------------|----------|--------|
| T-03-01 | Tampering (misleading number) | bevelSplit, frontLeadMm | mitigate | src/engine/rim.js:42,60 (pure helpers); rim.test.js:79-85 (fast-check property: ≥ 0, sum = t − D, monotone), :113-151 (frontLeadMm examples); frame.test.js:237-255 (lead vs. 3D geometry); de-AT.js:189 `frame.rim.bevel` ("angenommen"); de-AT.js:186-187, 693-694 "bündig" next to the lead | closed |
| T-03-02 | Tampering (HTML injection) | paintRim | mitigate | src/ui/frame-input.js:81-108 `setText` + `fmtMm` only; eslint.config.js:24-35 innerHTML/outerHTML/insertAdjacentHTML ban on `src/ui/**`; grep for sinks in src: 0 hits | closed |
| T-03-03 | Repudiation (silent behaviour change) | Phase-2 rim text | mitigate | 03-01-PLAN.md:21,49 (objective statement); 03-01-SUMMARY.md:38-42 "Old and new example strings (T-03-03)" | closed |
| T-03-04 | Tampering (picture ≠ numbers) | lens.js | mitigate | src/engine/mesh/lens.js:10-11 imports engine `frontSagAt/backSagAt/thicknessAt`; lens.test.js:120-197 D-04 tests | closed |
| T-03-05 | DoS (NaN / oversized buffers) | buildLensMesh | mitigate | lens.js:70-72 length guards (throw), :75,91,132 `finite` flag; view refuses upload: lenses.js:143, frame.js:181; fuzz finiteness heat.test.js:209-232, frame.test.js:479-509 | closed |
| T-03-06 | Elevation (boundary erosion) | eslint.config.js | mitigate | eslint.config.js:40-56 (three only in src/ui/view/**), :58-67 worker, :74-91 engine, :106-115 state/i18n; src/engine/boundary.test.js:61-93 probes with positive controls; grep: no `three` import outside src/ui/view | closed |
| T-03-07 | Tampering (frame ≠ rim text) | engine frame.js | mitigate | src/engine/mesh/frame.js:14,153 rim z from `bevelApexMm`; frame.test.js:201-217 (per-vertex vs bevelSplit), :237-255 (vs frontLeadMm) | closed |
| T-03-08 | Tampering (callouts ≠ cards) | heat.js | mitigate | heat.test.js:57-58 scale `toBe` thinnest/thickest, :103-123 callouts = meridianProfile ends, `toBe(thickest(m).value)` | closed |
| T-03-09 | DoS (degenerate frames) | buildFrameMesh | mitigate | frame.js:327 length guard, :431-436 `finite`; frame.test.js:327 Pitfall-9 simplicity test at size limits, :468-476, :499-509 fuzz | closed |
| T-03-10 | Tampering (stale mesh applied) | mesh-client | mitigate | src/state/mesh-client.js:82 `current: job.gen === meshGen`, :173 `isMeshCurrent`; sync path stale stop :129-139 | closed |
| T-03-11 | DoS (malformed items, huge buffers) | mesh-protocol | mitigate | src/state/mesh-protocol.js:39 `Number.isFinite`, :41-60 slot/eye/shape/surfaces validation, :63-74 frame validation, :77-92 `normalise` forces LENS_LENGTHS/FRAME_LENGTHS, :122/:150/:161 try/catch, returns `ok: false` or error reply, never throws | closed |
| T-03-12 | DoS (main result starved) | worker topology | mitigate | src/ui/view/view.js:517 dedicated `mesh.worker.js` (engine worker separate, pipeline.js:390); mesh-client.js:126-156 one item per setTimeout(0) with stale stop; e2e/view.spec.js:69 "numbers never wait"; real-phone re-measure accepted unmet by user (03-17-SUMMARY.md:328-334) | closed |
| T-03-13 | Information disclosure | transfer | accept | see Accepted Risks AR-03-01 | closed |
| T-03-SC | Tampering (supply chain) | three@0.187.0 | mitigate | package.json:31 exact `"three": "0.187.0"`; package-lock.json:2060-2063 sha512 integrity; deploy.yml:32,74 `npm ci`; test/ci/pins.test.js:62-75 exact versions + save-exact (passed); npm view output in 03-05-SUMMARY.md:65 (no install scripts, no deps) | closed |
| T-03-14 | Tampering (stale mesh shown) | view.js onMesh | mitigate | view.js:558-561 stale reply only refills pool, :574-577 second `isMeshCurrent` check in paint frame; badge `view.badge.updating` view.js:1405-1408 | closed |
| T-03-15 | Tampering (CSP bypass / injection) | view.js | mitigate | no sinks in src (grep 0 hits; lint clean); labels.js:62,103 CSSOM `style.transform`; vite.config.js:25-27 CSP `script-src 'self'; style-src 'self'`; e2e/helpers.js:236-246 guardPage fails on CSP console messages; view.js:517 same-origin module worker | closed |
| T-03-16 | Information disclosure | window.__eyeglassView | mitigate | view.js:1412 `Object.freeze`; members :1413-1549 return counters, ior, maxima, projections, pixels; no `UNMASKED_RENDERER`/`getParameter` in src (grep 0 hits); no raw Rx field returned. Residual: ships in production (03-REVIEW.md B-IN-06), accepted by lens-critic (03-LENS-CRITIC-RESULT.md:61), see AR-03-04 | closed |
| T-03-17 | DoS (GPU/heap growth) | lenses.js, mesh worker | mitigate | src/ui/view/lenses.js:53-65 pool + `allocCount`, :101-108 geometries created once per slot; e2e/view-memory.spec.js:58 D-27 test; e2e/view.spec.js:69 | closed |
| T-03-47 | DoS (blank box / crash) | view.js, pipeline.js | mitigate | view.js:170-178 no-WebGL note; pipeline.js:257-283 load-failure message with retry/reload, mount error without retry; e2e/view.spec.js A-WR-02, D-17 tests (03-REVIEW-FIX.md) | closed |
| T-03-48 | Tampering (numbers hidden) | view-place.js | mitigate | src/ui/view-place.js:19-37 slot after `#result` below 900 px; e2e/layout.spec.js:60-74 `numbersBeforeView`, run at 320×640 (:85) and 360×780 (:192) | closed |
| T-03-49 | Tampering (HTML injection) | labels.js, retry UI | mitigate | labels.js:3-4,33,62 createElement + textContent + CSSOM transform; lint sink ban eslint.config.js:24-35 | closed |
| T-03-18 | DoS (malformed frame item) | protocol frame path | mitigate | mesh-protocol.js:63-74 `invalidFrame`, :118-143 try/catch → `failFrame` (ok false) | closed |
| T-03-19 | Tampering (display input changes numbers) | displayFrame | mitigate | frame-input.js:129 `displayFrame`, pipeline.js:221 passed as `display` only; e2e/view.spec.js:345-366 asserts compute-message count and card values unchanged | closed |
| T-03-20 | Tampering (injection in tech lines) | view.js | mitigate | no sinks in src/ui/view (grep 0 hits); values via fmtMm/setText | closed |
| T-03-21 | DoS (GPU memory on phones) | tiers / chart | mitigate | tiers.js:19-22 phone tiers pixel ratio ≤ 1.5, transmissionScale 0.5/0.35, chart 1024; tiers.js:30-32 `mittel` start on phones; scene.js:111-112; backdrop.js:135-136, scene.js:274 dispose on tier change; no `shadowMap`/`castShadow` in src/ui/view (grep 0 hits) | closed |
| T-03-22 | DoS (blank after context loss) | scene.js | mitigate | scene.js:66 `RESTORE_WAIT_MS = 5000`, :257 contextlost, :269 contextrestored (PMREM regen, :72-76); e2e/view.spec.js:535-556 loss/restore test | closed |
| T-03-23 | Tampering (impression read as exact) | caption | mitigate | de-AT.js:647 badge "Visueller Eindruck", :650 "… nur angenähert", :633 dispersion "(angenähert)" | closed |
| T-03-24 | Information disclosure (GPU fingerprint) | tier() | accept | see AR-03-02; scene.js:312 `tier: () => tier` returns only the tier name | closed |
| T-03-25 | DoS (scroll hijack) | controls.js | mitigate | controls.js:214 pointer path only without coarse pointer, :225-226 `enableZoom` only while stage focused, :304-305 focus/blur; e2e/view-controls.spec.js:235 wheel test | closed |
| T-03-26 | DoS (GPU leak via cameras) | presets | mitigate | scene.js:118 single `PerspectiveCamera` (only one in src); e2e/view-controls.spec.js:66-83 memory equal after preset cycle | closed |
| T-03-27 | DoS (sustained jank) | tier monitor | mitigate | scene.js:44,200-211 median-of-30 step-down; tiers.js:38-40 `stepDown` one-way; scene.js:9,230 render on demand | closed |
| T-03-50 | Tampering (protrusion not visible) | Seite pose | mitigate | e2e/view-controls.spec.js:94-107 ≥ 3 px/mm at 320×640 | closed |
| T-03-51 | DoS (scroll trap) | controls.js touch | mitigate | controls.js:214 static at rest on coarse pointer, :229-246 explicit toggle, :291 IntersectionObserver auto-off; e2e/view-controls.spec.js:463, :485, :532 | closed |
| T-03-28 | Tampering (text vs picture vs card) | text.js | mitigate | src/ui/view/text.js:6,29 same `bevelSplit`; view.js:43,792-812 aria from cardStrings | closed |
| T-03-29 | Tampering (injection via aria/text) | view.js | mitigate | view.js:792,798,812 `setAttribute('aria-label', label)`; no HTML sinks | closed |
| T-03-30 | Tampering (map colour ≠ legend) | heat.js / legend.js | mitigate | heat.js:19 and legend.js:13 one `cividis.js` LUT; heat.js:65-75 ShaderMaterial `toneMapped: false`; e2e/view-heat.spec.js:202 pixel = legend colour | closed |
| T-03-31 | Tampering (CSP bypass in SVG) | legend.js | mitigate | legend.js:9,34 `createElementNS` + textContent; no `.style`/style attribute in legend.js (grep 0 hits) | closed |
| T-03-32 | Tampering (table ≠ cards / xsec) | legend.js | mitigate | e2e/view-heat.spec.js:136 "table = engine numbers", :301 callouts = table | closed |
| T-03-33 | DoS (material churn) | lenses.js setMode | mitigate | lenses.js:210 `setMode` swaps pre-created materials; view.js:448-452 `compileAsync` at mount; e2e/view-heat.spec.js:224 leak test | closed |
| T-03-34 | Tampering (label ≠ engine) | labels.js | mitigate | labels.js:9-10 text from `heatCallouts`/`isoLabelPoints` via format.js; e2e/view-heat.spec.js:301 | closed |
| T-03-35 | Tampering (injection / CSP) | labels.js | mitigate | labels.js:33,103,184 textContent + CSSOM transform; lint ban | closed |
| T-03-36 | DoS (layout thrash) | labels.js | mitigate | labels.js:73,88-94 heat-label sizes cached, re-measured only on text change; trace frame times in 03-13-SUMMARY.md:109. Note: the older eye-label `place()` (labels.js:52-63, 03-06) still reads `offsetWidth` per call for ≤ 2 spans; outside this threat's declared scope (Dickenkarte labels), not a security gap | closed |
| T-03-37 | Tampering (A/B different scales) | compare3d.js | mitigate | compare3d.js:6-14,60 one camera; camera-math.js compareContext `Math.max` over A ∪ B lens spheres; e2e/view-compare.spec.js:110 same-scale width test | closed |
| T-03-38 | Tampering (stale A mesh) | view.js | mitigate | view.js:1325-1333 A item in the same mesh job, key includes `rA.surfaces`; :574 isMeshCurrent | closed |
| T-03-39 | DoS (render-target growth) | compare3d.js | mitigate | compare3d.js:11-12 one camera reuses transmission target; e2e/view-compare.spec.js:293 memory equal over 5 cycles | closed |
| T-03-40 | DoS (GPU memory growth) | whole view | mitigate | e2e/view-memory.spec.js:58 D-27 ≥ 50 changes with memory/programs/allocs; MCP memory 21/6/11 over 56 changes (REQUIREMENTS.md:96) | closed |
| T-03-41 | DoS (thumbnail cost) | copyThumb | mitigate | e2e/view.spec.js:691-740 copies only after settle, `passesPerThumbFrame` 2; :743 no copy during orbit | closed |
| T-03-42 | Tampering (CSP regression) | 3D chunk, mesh worker | mitigate | e2e/worker.spec.js:24-26 CSP string equal to vite.config.js:25-27; :400-422 CSP holds with 3D chunk and mesh worker; guardPage CSP check | closed |
| T-03-43 | Information disclosure (thumbnail) | bar-thumb | accept | see AR-03-03; index.html:776 canvas `aria-hidden="true"`; no storage/network APIs in src (grep 0 hits) | closed |
| T-03-52 | Repudiation (proxy overstates perf) | perf-throttled.spec.js | mitigate | e2e/perf-throttled.spec.js:601 `WORKER_NOTE = 'worker unthrottled …'`; real-phone result accepted unmet by user (03-17-SUMMARY.md:328-334, REQUIREMENTS.md:96) | closed |
| T-03-53 | DoS (inaccessible view) | 3D view markup | mitigate | e2e/a11y.spec.js:113-178 eight 3D states incl. `?calloutsoff` table-only, :13-16 two viewports, :214-223 axe loop; :291, :417 keyboard order tests | closed |
| T-03-44 | Repudiation / unauthorised publication | git push | mitigate | 03-17-PLAN.md:112,125 blocking checkpoint with rollback path; 03-17-SUMMARY.md:266 user answer "Push now", fast-forward, no force; :315 second push separately approved | closed |
| T-03-45 | Tampering (done without evidence) | REQUIREMENTS.md | mitigate | REQUIREMENTS.md:91-96, 196-201 trace rows; VIZ-06 (:96) and UX-03 (:75) record the user acceptance / e2e evidence explicitly | closed |
| T-03-46 | Tampering (deployed ≠ reviewed) | deploy | mitigate | vite.config.js:4-15 commit injected into HTML; index.html:6 `app-commit` meta; .github/workflows/deploy.yml:63-90 verify-live curl grep for `GITHUB_SHA::7` + live e2e; 03-17-SUMMARY.md:316-317 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-13 | Mesh buffers cross postMessage to a same-origin module worker (view.js:517, mesh.worker.js:12). They hold geometry only; the Rx-derived shape is already on the page. | plan author (03-04-PLAN.md threat register) | 2026-11-08 |
| AR-03-02 | T-03-24 | Debug handle `tier()` returns only the tier name (scene.js:312), derived from pointer/screen size and already shown in Technische Angaben. No renderer strings. | plan author (03-08-PLAN.md threat register) | 2026-11-08 |
| AR-03-03 | T-03-43 | Bar thumbnail is an `aria-hidden` same-page pixel copy (index.html:776); no storage, no network. | plan author (03-15-PLAN.md threat register) | 2026-11-08 |
| AR-03-04 | T-03-16 (residual, B-IN-06) | `window.__eyeglassView` ships in production. `pixels()`/`pixel()` force a synchronous render and GPU readback on demand. A same-origin script can already read the whole DOM (incl. the Rx inputs), so the handle adds no data capability; worst case is a forced-render DoS by a script that is already same-origin. Hardening option kept for later: gate behind `import.meta.env.DEV` or `?testhandle`. | lens-critic (03-LENS-CRITIC-RESULT.md:61) | 2026-11-09 |

---

## Unregistered Flags

All SUMMARY `## Threat Flags` sections report "None". Informational items named there, mapped:

| Flag | Source | Mapping |
|------|--------|---------|
| `window.__eyeglassNo3d` test global | 03-05-SUMMARY.md:145 | can only turn the view off; same reasoning as AR-03-04 |
| `?failframe`, `?calloutsoff`, `?perfmarks`, `?thumbguardoff`, `?nowebgl` URL flags | 03-07/13/15-SUMMARY | presentation or test-only, no number or markup path; no threat mapping needed |

Post-plan additions on 2026-11-10/11 (src/ui/view/fullscreen.js, Rx header CSS, footer copyright, version.js; commits 3a0ff0e … 6caa119) are outside the register. I saw no obvious threat. The whole-`src` sink grep and `npx eslint src` are clean, and fullscreen.js uses the Fullscreen API with no markup sink. No new register entry.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-11 | 54 | 54 | 0 | gsd-security-auditor (Claude) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-11
