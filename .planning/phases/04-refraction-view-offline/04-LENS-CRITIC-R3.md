# Phase 4 — lens-critic plan review (round 3)

**Date:** 2026-11-13
**Reviewed:** 04-01-PLAN.md … 04-15-PLAN.md after revision 2
**Verdict:** FAIL (NEEDS WORK) — 0 BLOCKER, 1 MAJOR (NEW-11), 7 MINOR (A–G)

Both round-2 MAJORs (NEW-1, NEW-2) are closed. The new MAJOR came in with revision 2: the M3 (a) threshold is derived from the Node oracle as a ratio, and at most panel sizes that ratio divides by zero. The reviewer's own round-2 claim ("≥ 3× at 13 sizes") did not hold in a wider sweep.

## Status of round-2 findings

| ID | Status | Evidence |
|---|---|---|
| NEW-1 kill build fails its own gate | closed | Flag traced end to end: `SW_SELF_DESTROY` + `swKillEffective(env)` in `sw-kill-switch.js` (04-04 T1 3a); `vite.config.js` computes `SW_KILL` once for `selfDestroying` and `define __SW_KILL__`, grep forbids the env name in the config; `update.js` reads only `__SW_KILL__` (04-14 T1); Node tests use `swKillEffective(process.env)` (04-04 T2, 04-06 T2); skips on offline 17, N12, item 18, CSP-with-worker, scope (04-06), describe-level skip for 19–24, 20b, rehearsal (04-14 T2), banner axe states inside it (04-12 T2); 04-14 T3 step 6a flips the constant and runs build, build:e2e, test:dist, pwa project; 04-12 step 3a repeats. Plugin `index.js` `_generateBundle` still emits the manifest in self-destroying mode. Residues: MINOR A, B. |
| NEW-2 step-down costs more rays | closed | Monotonic rule gated in P0 (04-03 T3), CI ray-count gate (04-03 T1/T3), bench always (04-05 T3); P0 stops instead of loosening. Scratch `r3-rays.mjs` (item-12 frame, ±4,00): grob leafPx 3 at cell 11/10/9 always monotonic; grob/mittel 0,58–0,66 at cell 11, 0,70–0,76 at cell 10; grob/fein ≤ 0,34; real leaf 2,70–2,75 px (cell 11), 2,48 px (cell 10); boundary error ≤ 1,94 px. `r3-n10.mjs` worst case −10/−4×30: cell 11 → 0,4998 px (fails 0,45), cell 10 → 0,4395 px (passes), cell 9 → 0,348 px. A valid set exists: 6/1, 8/2, 10/3. Residue: MINOR D. |
| NEW-3 M3 test geometry | partly | (b), (c), viewport fixed (04-08 T1). (a) reopened by its threshold: NEW-11. |
| NEW-4 grob headroom | closed | P0 ≤ 0,45 px; N10 test at 0,45 for fixed tiers (04-03 T3). |
| NEW-5 shared ports | closed for Playwright | `reuseExistingServer: false` (04-02 T1, 04-06 T2), ground rule 15. Manual servers: MINOR C. |
| NEW-6 stale switch state | closed | File-level `beforeAll` reset to `/__switch/a` when not live, plus describe-level `beforeEach` (04-14 T2 step 4). |
| NEW-7 A/B swap | partly | Design right (04-11 T1 step 4); item-12 rim may be outside a portrait two-panel field: MINOR E. |
| NEW-8 parity coverage | closed | Symmetric difference against `PARITY_ALLOW`, positive control, synthetic failure (04-02 T1 9a). Residue: MINOR G. |
| NEW-9 strings | closed | `cylSameNote`, `formulaSource`, `pastRimInField` interface lines. "Brechwertfaktor" as a German term UNVERIFIED. |
| NEW-10 SC1 artefact | partly | 04-13 T1 guard exists; it does not match the real `session.md` structure: MINOR F. |

Closed items from rounds 1 and 2 are not reopened, except that M3's on-screen gate is weakened by NEW-11. Spot-checked: M4, M5, round-1 MINOR 3/4/5/8/9/10.

## MAJOR

### NEW-11. The M3 (a) threshold is undefined or unpassable at most panel sizes

- **Where:** 04-08-PLAN.md:32 and :152. Rule: `M3A_MIN = 0,75 × correct ratio`, floor 2, flips ≤ 1/M3A_MIN; on screen `changedPixels(LL) ≥ M3A_MIN × changedPixels(LR)`.
- **Evidence:** oracle sweep over 242 panel sizes (240–640 × 240–640, 40 px steps), OD and OS (`r3-m3sweep.mjs`):
  - 174 cases: correct LR count is 0 → ratio `Infinity` → `M3A_MIN = Infinity`; the oracle test passes (0 ≤ 1/∞), but on screen `LL ≥ Infinity × 0` is `LL ≥ NaN`, which is false (checked in Node).
  - 4 cases (e.g. 320×600): LL and LR both 0.
  - Several finite ratios below 2,67 (e.g. 18/14 = 1,29 at 280×560) → M3A_MIN < 2 → plan stops.
  - The oracle runs at the P0-recorded panel size; the on-screen test only logs the size it got.
- **Real gate?** Yes — a flip swaps LL and LR, so it cannot pass a flipped picture. But at the expected geometry it cannot pass at all, and relaxing is forbidden, so 04-08 T3 stalls.
- **Fix (division-free, oracle at the actual panel size):**
  1. Compute `LL_o`, `LR_o` in the same test from the actual panel size. Require `LL_o ≥ 20` and `LR_o ≤ 0,25·LL_o`; if that fails, enlarge windows to 60×60 or move them, and assert the result in the oracle test.
  2. On screen: `LL_s ≥ 0,6·LL_o` and `LR_s ≤ LR_o + 0,2·LL_o`, fixed literals.
  3. A flip gives `LL_s ≈ LR_o ≤ 0,25·LL_o` and fails condition 1; keep the named oracle test proving that.
  4. Assert the on-screen panel size equals the oracle's.

## MINOR

- **A. Rehearsal navigation cap does not add up** (04-14-PLAN.md:190, step 2(b)). Three test reloads plus the destroyer's `client.navigate` (plugin `index.js:173–197`) give ≥ 4 navigations against "≤ 3". A second destroyer cycle is possible: the first reload after the switch is served from build A's precache, whose `update.js` still calls `registerSW`. So the KILL SWITCH comment's "not racy because update.js does not register" (04-04-PLAN.md:117) holds only from the second load on; the end state converges. Fix: count up to the second reload, bound ≤ 4; reword the comment to "converges after one load".
- **B. Step 6a is a subset of the gate, not the gate.** It omits lint, coverage, desktop/mobile `test:e2e`, `test:e2e:live`, `test:pwa:live`, while the KILL SWITCH comment says "full gate". Low risk (no desktop/mobile assertion on `#tech-offline` found). Fix: run the VALIDATION full-suite command in 6a, or rename it.
- **C. Manual servers on fixed ports not covered by ground rule 15.** Wave 2 (04-03, 04-04, 04-15) in parallel; `measure-stages.mjs`, D-30 MCP previews and the manual switch server bind 4173/4175 outside Playwright. Fix: curl-check the port is free before measuring/screenshotting; after start, check served `#app-commit` equals `git rev-parse --short HEAD`.
- **D. "rim case from mittel" may contain no rim** (04-10-PLAN.md:142). Mobile is 360×780 (`playwright.config.js:29–36`), two portrait panels (~179×270). Item-12 frame at −4,00: first non-lens class at tan 0,434; horizontal half-field ~0,38 (`r3-ab.mjs`: 0 rim points at 189×285, 300×450, 320×480). Fix: assert `rimInField === true` before the step; if not, choose the frame in Node.
- **E. 04-11 A/B check may be infeasible** (04-11-PLAN.md:86). Same geometry: for W/H below ~0,75 the item-12 rim is outside the field (fails loudly). Fix: pick A's frame or Rx in Node at the measured 1280×800 panel so there are ≥ 8 class-2/4 points; name the choice.
- **F. NEW-10 guard assumes a structure that does not exist** (04-13-PLAN.md:79). `session.md` has one section (`## 2026-11-06 — …`); line 56 said "Open for the user to accept or veto" and would match `grep -E "SC1|D-02"`. Fix: require an exact marker line (e.g. `SC1/D-02 reported to user 2026-11-13: accepted by default …`); orchestrator updates line 56.
- **G. Parity allow-list broader than needed** (04-02-PLAN.md:135). `index-`/`view-` allowed wholesale hides non-gated differences in the entry; `view-` would match a future `view-ref-*`. Fix: match whole chunk names; for `index-`, compare content after replacing hashed chunk names.
- **Note (no finding):** provisional grob cell 11 passes the ≤ 0,5 px N10 test by 0,0002 px; set provisional grob cell to 10 before P0.

## Verified

**By running** (scratch, production `warp.js` does not exist yet; scratch tracer `t2.mjs` + scratch classifier): `r3-rays.mjs`, `r3-n10.mjs`, `r3-m3sweep.mjs`, `r3-m3quad.mjs` (quadrant windows worse, min ratio 0,67), re-run of `r2-m3b.mjs`, `r3-ab.mjs`, Node `Infinity*0` comparisons.

**By reading:** 04-03, 04-04, 04-06, 04-14, 04-VALIDATION in full; relevant parts of 04-01, 02, 05, 08, 09, 10, 11, 12, 13; `playwright.config.js`, `session.md`, vite-plugin-pwa 2.0.0 tarball.

**Not verified:** Playwright/SW/kill behaviour by execution; real stage and panel sizes at 360×780 and 1280×800 (D and E depend on them); production `warpGrid` costs; scratch quadtree vs implementation; German term "Brechwertfaktor".

## Sources

- [DOZ-Verlag Formelsammlung, table of contents](https://doz-verlag.de/sites/default/files/2024-06/Inhaltsverzeichnis-Formelsammlung.pdf)
- [Lehmanns listing of the same collection](https://www.lehmanns.ch/media/257673/1)
