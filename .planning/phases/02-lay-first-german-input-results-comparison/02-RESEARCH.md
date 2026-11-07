# Phase 2: Lay-First German Input, Results & Comparison - Research

**Researched:** 2026-11-07
**Domain:** Vanilla light-DOM German UI on an existing pure-JS optics engine and worker pipeline: form validation, comparison scheduling, SVG cross-section, a11y testing
**Confidence:** MEDIUM-HIGH. Engine and pipeline facts come from reading the code and running it in Node (HIGH). Browser-platform facts come from MDN, WAI and Chrome docs (HIGH-MEDIUM). Optician terminology and real-device iOS behaviour are MEDIUM-LOW, and the items that need a device are marked.

## Summary

Phase 2 adds no new technology. Every library it needs is already installed and pinned: `@axe-core/playwright` 4.14.0 and `axe-core` 4.14.0 are in `devDependencies` and already used in `e2e/smoke.spec.js:445` and `e2e/worker.spec.js:203`. The work splits into three parts: (1) small, additive engine extensions, (2) a priority extension of the existing worker client, and (3) a large UI rebuild in light-DOM vanilla JS.

Running the engine in Node during this research turned up three engine facts the planner has to act on:

1. **`evaluateLens` hard-codes `k1: 0`** in both `baseCurveAuto(...)` and `common` (`src/engine/evaluate.js`). MAT-05 needs a new optional LensSpec field.
2. **The engine rejects a manual base curve of 0,00 dpt** (`optPositive` requires `> 0`). MAT-03 requires 0,00…+10,00.
3. **Feeding an aspheric front into the existing "thinnest" optimiser gives absurd lenses.** With k = −1, a +4,00 lens jumps from D1 = +3,95 (CT 4,88 mm) to D1 = +14,00 (CT 3,10 mm, front sag 13,5 mm). This is a model artefact. Patent US4289387 (Jalie) shows the real-world point of an asphere is a *flatter* front. Recommendation: choose the automatic base curve on the spherical design (k = 0), then apply k at that D1 with one extra `solveCT`.

Performance has plenty of headroom if the comparison is scheduled correctly. Measured in Node on this machine (v22.17.0):

| Case | Normal | Grenzfall |
|---|---|---|
| One pair, automatic base curve | 1,67 ms | 10,4 ms |
| All 6 materials × 2 eyes | 9,9 ms | 54,5 ms |

The Pixel's worker bench in 01-11 (01-11-SUMMARY Task 3 step 6, lines 119–126) measured 2,30 ms per normal pair, 9,95 ms per Grenzfall pair and 25,4 ms per rescan pair. (Correction 2026-11-07, lens-critic M3: an earlier version of this paragraph cited 3,66 / 17,4 ms as the Pixel; those are the 01-11 **desktop** Node bench, 01-11-SUMMARY lines 48–54.) If comparison work is queued as **one material pair per worker job, at lower priority than the main compute, cancelled on every new main request**, the main result waits for at most one job. The worst single job on the phone is a rescan pair, ≈ 25,4 ms; with 01-11's longest (c) of 27,3 ms that is ≈ 53 ms, which keeps ENG-09 (c) ≤ 100 ms intact. ENG-09 (a) is a main-thread budget and is affected only by the compare paint frame, which must be measured.

The highest-risk platform items:

- The iOS decimal keypad has no minus key (WebKit bug 193825: UIKit has no such keyboard type). Signed fields (Sph, Zyl, k) therefore need an explicit "±" button.
- Chrome Android ≥ 108 no longer resizes the layout viewport for the on-screen keyboard, so a fixed bottom bar hides behind the keyboard.
- The CSP `style-src 'self'` blocks `style="…"` attributes and `setAttribute('style', …)` (MDN), including inside generated SVG.

**Primary recommendation:** Build Phase 2 in this order:

1. Additive engine extensions with tests first: `frontConic`, `customMaterial`, baseCurve ≥ 0, `meridianProfile`, rim helper.
2. A priority/compare lane in `compute-client.js` with its own `data-pending`.
3. The UI split into modules that keep the ENG-09 ids.

Gate everything with Vitest, and with Playwright + axe (WCAG tags, zero violations) at 320 px and desktop.

<user_constraints>
## User Constraints (from CONTEXT.md)

The user delegated every decision ("use best practices easy to use"). Each one can be revised in `/gsd:ui-phase 2` or plan review without asking the user again, as long as the change keeps or improves lay usability (memory `best-practice-default`).

### Locked Decisions

#### Rx entry (RX-01, RX-04..08)
- **D-01:** Keep **text fields in a paper-shaped table** (rows R/L, columns Sph, Zyl, Achse, PD). **No sliders.** The reference `references/000.png` uses sliders, but they are slow and imprecise for exact 0,25 steps across ±12 dpt, hard to use with a keyboard or screen reader, and do not mirror the paper. The reference is used only for its visual idea: a large, clearly readable value echo next to each label.
- **D-02:** Row labels show both conventions, "Rechtes Auge (R / OD)" and "Linkes Auge (L / OS)", with R first, the same order as the paper.
- **D-03:** On narrow screens (about < 480 px, exact breakpoint is for the UI spec) the table reflows into **one card per eye** (R card, then L card), each with the four labelled fields in a 2×2 grid. Field order and labels stay identical, so copying from paper still works top to bottom.
- **D-04:** "Gleich für beide Augen" is a checkbox, **off by default**. When on, the L fields mirror R and are read-only, and they visibly show the mirrored values. Turning it off keeps the copied values so the user can edit them.
- **D-05:** **PD uses smart parsing, with no mode switch.** `32/33` in either PD field fills R and L. A single value ≥ 50 mm is read as binocular, split evenly, and shown with a note ("64 mm Gesamt-PD → je 32 mm"). A single value in 25,0…40,0 is monocular. Values between 40 and 50 get a friendly question, never a guess.
- **D-06:** **Missing PD** defaults to 32 mm per eye (64 mm binocular, per `.planning/research/PITFALLS.md` and `FEATURES.md`), and every result states it, for example "PD angenommen: 32 mm je Auge — fragen Sie Ihren Optiker nach Ihrem Wert". The researcher should cite a source for the adult-average value, or label it as a design default.
- **D-07:** **Validation has three tiers, each with an icon and text, never colour alone:**
  - (1) **Fehler** blocks that eye: Zyl without Achse, Achse 200°, not a number.
  - (2) **Hinweis** still computes with the entered value: off a 0,25 step → "Meinten Sie −2,25?" with a one-tap button that applies the suggestion.
  - (3) **Außerhalb des Modells** blocks that eye and explains the modelled range.

  Messages sit under the field and are linked via `aria-describedby`, extending the phase-1 `*-err` pattern. Validation runs on input after a short pause and on blur, so errors do not flash on every keystroke. Values are never clamped.
- **D-08:** The contact-lens hint (`BC`/`DIA` typed, or values like 8,6 / 14,2 in the wrong field) is a Hinweis-tier message, following `FEATURES.md` §1. This is cheap and prevents a known lay mistake.
- **D-09:** RX-08 is one collapsed `<details>` under the table: "Auf meinem Rezept stehen noch andere Werte (Add, Prisma, HSA …)". It explains Add, Prisma/Basis, HSA, F/N and EP/H. It states that Add and prism are not modelled, that the distance lens is shown, and that HSA does not change thickness.

#### Frame (FRAME-02, FRAME-03)
- **D-10:** **Shape is picked from visual radio cards**, each with a small SVG outline drawn from the engine's own `frameOutline` and a German name (Rund, Rechteckig, Panto, Pilot). This replaces the phase-1 `<select>`. Picking a shape fills its typical A/B/DBL defaults (existing `prefillFrame`). If the user has already typed sizes, they are kept, and a small "Standardmaße übernehmen" link applies the defaults.
- **D-11:** **The temple stamp is the primary, most prominent frame input:** "Maße vom Brillenbügel (z. B. 52□18 140)". It parses `52□18 140`, `52-18-140`, `52 18 140` and `52/18 145` into A and DBL and ignores the temple length. B comes from the shape and is shown as "geschätzt aus der Form". The separate A, B and DBL fields stay below it, editable, and in sync with the stamp.
- **D-12:** "Wo finde ich das?" opens an inline illustration of a temple with a stamp. It must be **our own SVG drawing**. `references/` images are git-ignored third-party material and must never be published or copied.
- **D-13:** Rim depth (FRAME-02) is an **Expert-view field** with a documented default. In phase 2 it affects only front-surface protrusion relative to the rim, if the engine models that; otherwise it is stored for phase 3. The researcher checks what the engine needs (the engine currently has no rim-depth input), and the planner adds it as a non-breaking LensSpec field.

#### Material (MAT-03..06, RES-02)
- **D-14:** Material is chosen from **radio cards with lay names plus the index**, for example "Standard 1,50 (CR-39)", "Dünner 1,60", "Sehr dünn 1,67", "Am dünnsten 1,74", Trivex 1,53, Polycarbonat 1,59. This replaces the `<select>`. Final wording is for the UI spec. Abbe stays visible as secondary info, as in phase 1.
- **D-15:** **The material comparison (RES-02) is always visible in Simple view**, directly under the main result, as "Was bringt ein anderes Material?". This answers the core-value question without a click. It is a table with one row per material: centre thickness, thickest point and weight. The differences are absolute and signed, relative to **the user's currently selected material** ("1,67: 1,7 mm dünner, 2 g leichter"; for lower indices "dicker/schwerer"). Percentages are only a secondary hint. The selected row is marked by text ("Ihre Auswahl"), not only by colour. Thickness is shown for the thicker of the two lenses (labelled with which eye), and weight for both lenses together. A per-eye breakdown is available on expand.
- **D-16:** Comparison rows are computed **after** the selected configuration's result is painted, at lower priority in the same worker, and the newest input wins (latest-wins). The planner/researcher must keep ENG-09 (a)–(d) intact for the main result. The comparison may show "rechnet …" on its own.
- **D-17:** Custom material (MAT-06) is the last radio card, "Eigenes Material" (Expert view only). It has fields for ne, density and optional Abbe, with validated plausible ranges (researcher proposes them). The result is labelled "beruht auf Ihren Angaben, kein geprüftes Material". This needs a non-breaking engine extension, because the engine looks up materials only by `materialId` today. Custom material rows are excluded from the "Was bringt…" table, which compares sourced materials only.

#### Page flow and layout (UX-03)
- **D-18:** **One scrolling page, no step wizard.** Order: Beispiel banner → Rezept → Fassung → Material → Ergebnis → material comparison → configuration comparison → Expert sections → disclaimer → Technische Angaben. A wizard hides the cause-and-effect link that is the point of the tool.
- **D-19:** **Desktop/tablet (≥ about 900 px):** two columns, inputs left, and the results column right, sticky. Phase 3 puts the 3D view at the top of this sticky column, so the planner reserves that slot.
- **D-20:** **Phone:** a **sticky compact summary bar** at the bottom of the viewport shows per eye the thickest point and weight (e.g. "R 4,1 mm · 9 g | L 3,8 mm · 8 g"), shows "rechnet …" and stale state, and jumps to the full result on tap. This meets UX-03 "the result stays visible while editing" in phase 2. Phase 3 reuses the slot for a small 3D preview. The bar must not cover a focused input (check scroll padding and the on-screen keyboard).
- **D-21:** Long German compound words: `hyphens: auto` with `lang="de-AT"`, `overflow-wrap: anywhere` as the safety net, and `&shy;` in the dictionary for known long terms. Playwright checks 320 px for horizontal overflow. German hyphenation support on iOS is an open STATE.md concern for the researcher.

#### Results wording (RES-01, RES-04)
- **D-22:** **One result card per eye.** A plain-German headline sentence comes first, then the four numbers as labelled values:
  - Headline example: "Rechtes Glas: am dicksten 4,1 mm außen (zur Schläfe), am dünnsten 2,0 mm innen (zur Nase). Mitte 1,8 mm, Gewicht 9 g."
  - Rounding: 0,1 mm and 1 g. Below 0,5 g shows "unter 1 g".
- **D-23:** **Location words for lay users:** "außen (zur Schläfe)", "innen (zur Nase)", "oben" and "unten", plus combinations like "außen unten". Expert view adds the technical terms (temporal/nasal/superior/inferior). A small orientation sketch per card is an option for the UI spec.
- **D-24:** **Left/right difference callout (RES-04):** shown when the thickest points differ by ≥ 1,0 mm or the weights by ≥ 3 g. These are design constants the researcher should justify or adjust as cosmetic visibility thresholds, documented in code like τ in phase 1. Example wording: "Das linke Glas ist an der dicksten Stelle 1,4 mm dicker als das rechte — weil die Werte der beiden Augen verschieden sind." No medical judgement.
- **D-25:** **UX-05 vocabulary:** "Stärke" is never used. Power is always "… dpt (Dioptrien)" and thickness is always "Mittendicke" or "Randdicke" / "dickste Stelle". A dictionary test fails if "Stärke" appears in `de-AT.js`.

#### Examples and presets (RES-05)
- **D-26:** **The page starts with a realistic example** and a visible banner, "Beispiel — ersetzen Sie die Werte durch Ihre eigenen". The banner disappears after the first edit of any Rx field. The researcher/planner picks values that show something interesting, for example a moderate myope with a small cylinder in a Rechteckig frame.
- **D-27:** Rx presets (leicht kurzsichtig, stark kurzsichtig, weitsichtig, Hornhautverkrümmung) and frame presets appear as a row of chip buttons above the table. **If the user has typed their own values, applying a preset asks first** with a non-modal inline confirmation ("Ihre Eingaben ersetzen?" with Ersetzen / Abbrechen). This is not `window.confirm`. On an untouched example, presets apply immediately.

#### Configuration comparison (RES-03)
- **D-28:** **The Rx is shared, not compared**: it belongs to the person. A "Vergleichen" button freezes the current frame and material as **A** ("Vorher"). The user then changes frame and/or material, and that becomes **B** ("Nachher"). Both are computed with the same Rx. "Vergleich beenden" returns to a single configuration. There are exactly two configurations; desktop does not get four.
- **D-29:** **Wide screens:** A and B side by side, with a difference row ("B ist 1,2 mm dünner und 3 g leichter"). **Phone:** a segmented toggle "Vorher | Nachher" switches the cards, and the difference line stays visible above the toggle.
- **D-30:** The Expert cross-section overlays A and B (ANA-01). The two are told apart by line style plus a text legend, not by colour alone.

#### Explanations (UX-01)
- **D-31:** **Every technical term gets an inline toggletip.** A real `<button>` with an "i" icon and an accessible name sits next to the term ("Erklärung: Zylinder"). It has `aria-expanded` and shows the 1–2 sentence explanation inline below the field. It opens by tap, click, Enter and Space, never on hover only, and Esc closes it. All texts come from the `de-AT` dictionary. Terms covered are at least the UX-01 list.

#### Expert view (UX-02, MAT-03..05, ANA-01, ANA-02)
- **D-32:** **The "Experten-Ansicht" switch** is a labelled toggle (`role="switch"` or a checkbox) at the top of the page. It reveals Expert sections in place, next to the inputs and results they belong to, not as a separate page. The state is **not persisted** in phase 2 (no storage of anything on a shared origin, see "Deferred").
- **D-33:** **Manual base curve** (MAT-03, 0,00…+10,00 dpt): an empty field means automatic. Next to it, always show the automatic value and the rule ("dünnstes Glas, flachste Vorderfläche innerhalb 0,1 mm"), plus the Vogel reference value. This content moves here from the phase-1 result table (UX-02).
- **D-34:** **Min centre and edge thickness** (MAT-04): fields pre-filled with the sourced per-material defaults from `materials.js`. Changing the material re-fills them unless the user edited them, and "Standard" resets them. The result marks the binding constraint in words ("Die Mittendicke ist durch den Mindestwert festgelegt" or "… durch die Mindest-Randdicke").
- **D-35:** **Front surface "sphärisch / asphärisch"** (MAT-05) uses radio buttons. Aspheric reveals a k field with a documented default. The label is always "allgemeines Modell, kein bestimmtes Herstellerdesign". The engine already accepts `k1`. The researcher must decide the default k and how the base-curve optimiser treats aspheric fronts; STATE.md notes there are no citable conic constants.
- **D-36:** Decentration (ANA-02) and the intermediate values (radii, sags at named points, D1/D2, binding constraint) go in an Expert "Zwischenwerte" block, read-only, with units.
- **D-37:** **Cross-section** (ANA-01): inline SVG generated from engine output, with dimensioned centre and edge thickness. A meridian select offers horizontal (default), plus the two principal meridians when Zyl ≠ 0. It has `<title>`/`<desc>` and an adjacent text/table equivalent of the key numbers.
- **D-38:** The phase-1 "Technische Angaben" `<details>` (timings, compute mode) stays at the bottom, collapsed, unchanged in function.

#### Accessibility and testing (UX-04)
- **D-39:** axe-core checks run in CI on Simple view, Expert view and comparison mode, at 320 px and desktop widths. A Playwright keyboard-only test walks the full flow: Rx → stamp → material → compare → expert → toggletip. WCAG AA contrast applies. Every state uses text or an icon as well as colour.

### Claude's Discretion
- Exact breakpoints, spacing, colours, typography and iconography: leave these to the UI spec from `/gsd:ui-phase 2`. The roadmap marks this phase "UI hint: yes", so run it before planning.
- The exact German wording of every string, within D-25.
- The concrete example and preset values, as long as they are realistic and cover minus, plus and cylinder.
- Thresholds in D-05 (40–50 mm question band) and D-24: the researcher may adjust them with justification.

### Deferred Ideas (OUT OF SCOPE)
- Persisting inputs or the Expert toggle (localStorage, opt-in): v2 together with SHARE-01. This avoids storing health-adjacent data on the shared `ainxtgendev.github.io` origin without consent.
- Fitting-height input in the UI: the engine supports it, but no phase-2 requirement asks for it (phase-1 D-04 omitted it). Backlog.
- "Was würde helfen?" ranked levers (INS-01), tangible size references (INS-05), "Rechenweg anzeigen" (INS-04), 360° edge chart (INS-03): v2.
- More than two configurations in the desktop comparison: not in v1.
</user_constraints>

### Changes this research proposes to locked decisions

These are explicit proposals. Each one keeps or improves lay usability or correctness, so CONTEXT.md allows the planner to adopt it.

| Decision | Proposed change | Why |
|---|---|---|
| D-35 | The automatic base curve for an aspheric front is chosen **on the spherical design** (k = 0). The conic is then applied at that D1. The free "thinnest" search must not run with k ≠ 0. | Measured: with k = −1 the search jumps a +4,00 CR-39 lens to D1 +14,00 with 13,5 mm front sag (see Pitfall 1). That is a model artefact, not a lens anyone makes. |
| D-35 | Default k = −1 (paraboloid). UI range −5,0…−1,0 (revised 2026-11-07, lens-critic MINOR-2: only the cited range; k = 0 is the 'sphärisch' option). | US4289387 (Jalie) claims a hyperboloidal front with p between 0 and −4. With p = 1 + k, that is k from −1 to −5. k = −1 is the mildest end of the cited range. |
| D-13 | Rim depth does **not** go into LensSpec in phase 2. Use a pure engine helper `edgeBeyondRim(metrics, rimDepthMm)`: the edge-thickness excess over the rim depth, total front + back. The front/back split needs a bevel-position model, so it moves to phase 3 together with the 3D rim. | Rim depth does not change thickness or weight. Putting it in the spec would change the cache key and force a worker recompute for a number that is one subtraction on engine output. |
| D-20 | Add `interactive-widget=resizes-content` to the viewport meta, and `scroll-padding-bottom` = bar height. A real-iPhone check is mandatory before the phase is signed off. | Chrome ≥ 108 on Android defaults to `resizes-visual`, so fixed elements "can be obscured by the OSK". `resizes-content` restores the bar above the keyboard on Chrome and Firefox. Safari does not support it. WCAG 2.2 SC 2.4.11 names sticky footers and lists technique C43 (scroll-padding). |
| D-01 / D-07 | Add a "±" sign button next to Sph, Zyl (and k) on every platform. | The iOS decimal keypad has no minus key (WebKit bug 193825, UIKit limitation). Without the button, an iPhone user cannot type −2,25. |
| D-24 | Keep 1,0 mm. Keep 3 g, but document that the mm criterion is the one that fires in practice. | Measured on the canonical frame: 1 dpt of anisometropia ≈ 1,0 mm difference at the thickest point, but only ≈ 0,85 g in weight (see RES-04 below). |
| D-05 | Keep the 40–50 mm question band. Add a question when two values ≥ 50 are entered ("64/61" = distance/near). | ANSUR 2012 binocular PD: minimum 51,0 mm (female), maximum 77,0 mm (male). A single value in 40–50 is neither a plausible monocular PD (> 77/2) nor a plausible binocular one (< 51). |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RX-01 | Paper-shaped R/L × Sph/Zyl/Achse/PD table | Keep the existing `#rx-od-sph`… ids. Reflow to cards with CSS only, no DOM duplication (§ Architecture, Pattern 6) |
| RX-04 | Ranges with plain-German messages, never clamped | Range checks go in a new pure `src/state/validate.js` (codes, not text). Check the **transposed** (engine) form for the model range (§ Pitfall 8) |
| RX-05 | Three tiers, field-linked | `{ tier: 'error'|'hint'|'out-of-model', code, data, suggestion? }`. Display is debounced; the compute path is **not** debounced (§ Pitfall 5) |
| RX-06 | Mono/binocular PD, missing default stated | `parsePd()` in `src/state/parse.js`. Default 32 mm justified by ANSUR 2012 (§ Open Q1) |
| RX-07 | "Gleich für beide Augen" | L fields get `readonly` (not `disabled`) and mirror Sph/Zyl/Achse (§ Pitfall 9) |
| RX-08 | Add, Prisma, HSA, F/N explained | `<details>` + dictionary. Also catch HSA typed into PD (8…20 mm) as a hint (§ Pattern 3) |
| FRAME-02 | A 40–62, B 28–55, DBL 14–24, rim depth, shape defaults | Range validation in `validate.js`. Rim depth via the `edgeBeyondRim` helper (§ Open Q4) |
| FRAME-03 | Temple stamp parse, "Wo finde ich das?" | `parseStamp()` with all □ variants, swap detection, B from the shape ratio (§ Pattern 3) |
| MAT-03 | Manual base curve 0,00…+10,00 | Engine change: allow `baseCurve ≥ 0`. New warn code for a convex back in manual mode (§ Pitfall 2) |
| MAT-04 | Min CT/ET defaults and binding constraint | `materials.js` minCT/minET; `intermediates.bindingConstraint`; `CT_SET_BY_MIN_*` info codes already exist |
| MAT-05 | Spherical/aspheric front with documented default k | New `frontConic` spec field. Default k = −1, range [−5, 0], D1 chosen at k = 0 (§ Open Q2) |
| MAT-06 | Custom material | New `customMaterial` spec field. Plausibility ranges (§ Open Q3) |
| RES-01 | Plain headline per eye, 0,1 mm / 1 g | Existing `metrics` fields. Add a new `fmtGramInt` formatter; keep `fmtGram` for Expert (§ Pitfall 10) |
| RES-02 | Material comparison with absolute differences | Compare lane in `compute-client.js`, one pair per job (§ Pattern 1) |
| RES-03 | Two configurations, side by side / toggle | Configuration A = a frozen frame+material spec pair in the compare lane, cached by key (§ Pattern 1) |
| RES-04 | Large L/R difference in words | Thresholds justified by measurement (§ RES-04 thresholds) |
| RES-05 | Example + presets, confirm before overwrite | Example values verified in the engine; inline confirm with focus on "Abbrechen" (§ Pattern 5) |
| UX-01 | Explanations by tap and keyboard | APG disclosure pattern (`aria-expanded`, `aria-controls`) (§ Pattern 4) |
| UX-02 | Simple vs Expert | Native checkbox + `role="switch"`; `hidden` on Expert sections; not persisted |
| UX-03 | 320 px…desktop, result visible, no overflow | `overflow-wrap: anywhere`, `&shy;` as `\u00AD`, `interactive-widget`, scroll-padding (§ Pitfalls 4, 6) |
| UX-04 | Keyboard, labels, AA contrast, axe in CI | Axe `withTags([...WCAG])`, zero violations, run with hidden content opened (§ Validation) |
| UX-05 | No "Stärke" | **Already enforced**: `src/i18n/dictionary.test.js` "never uses \"Stärke\"". Extend it to the toggletip and SVG strings (all in the dictionary) |
| ANA-01 | Cross-section of a selectable meridian, overlay A/B | New pure `src/engine/profile.js` `meridianProfile()`, run in the worker compare lane (§ Pattern 2) |
| ANA-02 | Decentration + binding constraint | `metrics.decentration`, `intermediates.bindingConstraint` already exist |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- The UI is **de-AT only**. The dictionary is `src/i18n/de-AT.js`. All visible text goes through `t()` and `textContent`; no `innerHTML`.
- **Engine first:** `src/engine/` is pure JS with no Three.js or DOM, enforced by ESLint + `src/engine/boundary.test.js`. It is the single source of truth for every number. New numbers (profiles, rim overhang) go in the engine, not in the UI.
- **Frozen LensSpec → LensResult contract** (01-SKELETON.md): fields may be added, never renamed or removed.
- **lens-critic gate** on the plan and the result.
- **`references/` must never be published or copied.** The "Wo finde ich das?" drawing and the shape thumbnails are our own SVG.
- ADD and prism are recognised and explained, not modelled.
- Pinned exact versions, SHA-pinned actions (DEPL-04; `test/ci/pins.test.js`).
- `gsd-sdk` is not installed. Use `node ~/.claude/get-shit-done/bin/gsd-tools.cjs`.
- Global: verify before asserting, cite sources, no storage on the shared origin, ask before outward-facing actions. Pushing to `main` deploys.
- CSP (build only, `vite.config.js`): `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:` …; `worker.spec.js` checks the exact string. **Do not change it.**

## Architectural Responsibility Map

There is no backend. The "tiers" are the browser main thread, the module Web Worker and static hosting.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parse/validate Rx, PD, stamp, custom-material input (codes) | `src/state` (pure, main thread) | `src/i18n` (texts) | Pure and testable in Node; codes, never German text |
| Thickness, weight, profiles, rim overhang, conic, custom material | `src/engine` (runs in Worker) | — | Single source of truth; DOM-free |
| Scheduling main vs comparison jobs, latest-wins, caches | `src/state/compute-client.js` (main thread, pure) | Worker handler `compute-protocol.js` | Already DOM-free and unit-tested; extend there |
| Rendering cards, tables, SVG, toggletips, layout | `src/ui/*` (main thread) | CSS | Only tier with browser globals |
| Rounding and difference arithmetic for display | `src/i18n/format.js` + a pure `src/state/compare.js` | — | Display rule (rounded-then-subtracted) is testable in Node |
| Hosting and caching | GitHub Pages (static) | — | No change in phase 2 |

## Standard Stack

### Core (all already installed, versions from `package.json`, verified with `node -p require(...).version`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla ES modules, light DOM | — | UI | Project rule (CLAUDE.md "UI Approach"); native `label for` / `aria-describedby` |
| vite | 8.3.6 | build, `base` sub-path | Already in use |
| vitest | 5.1.0 | engine/state/i18n unit tests | Already in use; coverage gate on `src/engine/**` (lines 95, branches 90) |
| fast-check | 4.10.2 | property tests (parsers, `meridianProfile` invariants) | Already in use |
| @playwright/test | 1.65.0 | e2e at 320 px / 360 px / desktop | Already in use; chromium-1208 installed locally |
| @axe-core/playwright + axe-core | 4.14.0 / 4.14.0 | automated WCAG checks | Already imported in two specs. The package's major.minor tracks the bundled axe-core [CITED: github.com/dequelabs/axe-core-npm README] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Intl.NumberFormat('de-AT')` | built-in | 1 g integer formatting, signed differences (`signDisplay: 'exceptZero'`) | All new numbers |
| `@preact/signals-core` | — | NOT recommended in phase 2 | CLAUDE.md: start with a hand-written store. The phase-2 state (Rx, frame, material, expert overrides, compare A) fits one plain object + `schedule()` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One worker with a priority lane | A second worker for comparisons | True parallelism on multi-core phones, but double the memory, two outline caches, and a second watchdog/fallback path. Not needed: measured headroom is large |
| Disclosure-button "toggletip" (D-31) | Inclusive Components toggletip (live region `role="status"`) | The live-region version suits floating bubbles and re-announces on every click. The inline disclosure is in DOM order below the field, so screen-reader users can read it again. D-31 already specifies inline + `aria-expanded`, which matches APG Disclosure |
| `interactive-widget=resizes-content` | `visualViewport` JS repositioning | JS repositioning lags on iOS Safari (reported > 1 s, Stack Overflow mirror, LOW) and costs main-thread work in ENG-09 frames |

**Installation:** none. No `npm install` in phase 2.

## Package Legitimacy Audit

No external packages are added in phase 2. Every dependency used is already pinned in `package.json` and `package-lock.json`, and was installed and audited in phase 1.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none new)* | — | — | — | — | not run (nothing to check) | — |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 user input (text / radio / checkbox / chip / button)
        │  input/change event (timeStamp)
        ▼
 schedule() ──► frame-scheduler (rAF)  ──► runFrame
                                            │ 1. read DOM fields
                                            │ 2. src/state: parse → validate (codes) → transpose
                                            │ 3. render echoes + (debounced) field messages
                                            │ 4. build specs: main {OD,OS}; compare jobs
                                            ▼
                          compute-client (pure, main thread)
                 ┌──────────── priority order in pump() ─────────────┐
                 │ (1) MAIN   per-eye seq, latest-wins (unchanged)    │
                 │ (2) COMPARE generation-tagged, 1 pair per job,     │
                 │     queue cleared on every new MAIN request,       │
                 │     LRU cache by JSON(spec)                        │
                 │ (3) BENCH  (Technische Angaben only)               │
                 └───────────────── one job in flight ────────────────┘
                                            │ postMessage
                                            ▼
                     Worker: compute-protocol handler → engine
                       evaluateLens / meridianProfile (pure)
                                            │ result / compare / profile
                                            ▼
           onResults (main)  ─► rAF paint: result cards, sticky bar, L/R callout
                                 #result[data-pending] (main only, unchanged semantics)
           onCompare (main)  ─► rAF paint: material table, A/B cards, cross-section SVG
                                 #compare[data-pending] (new, comparison only)
```

### Recommended Project Structure

```
src/
├── engine/
│   ├── evaluate.js        # + frontConic, customMaterial, baseCurve ≥ 0 (additive)
│   ├── profile.js         # NEW meridianProfile(surfaces, frame, eye, thetaDeg, samples)
│   └── rim.js             # NEW edgeBeyondRim(metrics, rimDepthMm) (+ RIM_DEPTH_DEFAULT_MM)
├── state/
│   ├── parse.js           # + parsePd, parseStamp, parseIndex/parseDensity/parseConic
│   ├── validate.js        # NEW range/step/plausibility tiers → codes
│   ├── compare.js         # NEW material-row/AB difference arithmetic on rounded values
│   ├── presets.js         # NEW example + Rx/frame presets (data only)
│   └── compute-client.js  # + compare lane (requestCompare, cancel, LRU)
├── i18n/de-AT.js          # + tip.*, val.*, cmp.*, xs.* keys (with \u00AD where needed)
└── ui/
    ├── main.js            # init/composition only (≈ 100 lines)
    ├── dom.js             # $, setText (no-op when unchanged), el() builder (no innerHTML)
    ├── pipeline.js        # client wiring, deliveries, pending/data-pending, fallback
    ├── timing.js          # ENG-09 readouts, Event Timing, bench (moved verbatim)
    ├── rx-input.js        # table/cards, ± buttons, same-for-both, PD smart fill
    ├── frame-input.js     # stamp, shape cards, A/B/DBL
    ├── material-input.js  # material cards, custom material
    ├── results.js         # per-eye cards, sticky bar, L/R callout
    ├── compare-view.js    # material table + A/B
    ├── expert.js          # switch, base curve, min thickness, conic, Zwischenwerte
    ├── cross-section.js   # SVG builder (createElementNS + textContent)
    └── toggletip.js       # disclosure buttons, Esc handling
```

### Pattern 1: Compare lane in the existing client (RES-02, RES-03, D-16)

**What:** A second request kind in `compute-client.js`, with lower priority than `compute` and higher than `bench`. One material pair (2 `evaluateLens`) per worker job, so a new main request waits for at most one small job. Each compare request carries a `generation` (incremented on every main `request()`). `requestCompare(jobs, generation)` replaces the whole queue. Results from an older generation are dropped. An LRU cache keyed by `JSON.stringify(spec)` (the same key rule as T-01-35) makes repeated material rows free.

**Budget (measured):** Node desktop today 1,67 ms per normal pair, 10,4 ms per Grenzfall pair. 01-11 desktop Node bench (01-11-SUMMARY:48–54, i7-8809G): 3,66 ms normal, 17,4 ms Grenzfall — desktop, not the phone (corrected 2026-11-07, lens-critic M3; this line previously called them the Pixel). Pixel worker bench (01-11-SUMMARY:119–126): 2,30 ms normal, 9,95 ms Grenzfall, 25,4 ms rescan pair. Worst main-result delay from a compare job in flight on the phone is therefore one rescan pair ≈ 25,4 ms. ENG-09 (c) was measured at 27,3 ms longest on the phone (01-11 run 2), so the sum (≈ 53 ms) stays under 100 ms. The compare paint frame runs on the main thread and is judged against (a) < 16,7 ms in 02-14 and 02-15.

**The selected material row reuses the main result**, never recomputed. Per edit: 5 other materials × 2 eyes + configuration A (2 evaluations when its key changes) = at most 12 extra evaluations.

**Sync fallback:** do not auto-run comparisons in sync mode. A Grenzfall pair is 10 ms desktop, about 40 ms on a 4×-slower phone, which is a long task on the main thread. Show "Vergleich berechnen" as a button. This mirrors the phase-1 MINOR-6 decision for the bench.

```js
// sketch — src/state/compute-client.js (pure; extends pump() order)
function pump() {
  if (!ready || !transport || inFlight) return;
  if (sendMainIfAny()) return;                 // (1) unchanged code path
  const job = compareQueue.shift();            // (2) new
  if (job) {
    inFlight = { id: nextId++, kind: 'compare', gen: job.gen, key: job.key };
    dispatch({ type: 'compare', id: inFlight.id, eyes: job.specs, profile: job.profile ?? null });
    return;
  }
  if (bench) { /* (3) unchanged */ }
}
// request(): ++generation; compareQueue.length = 0  (latest wins; in-flight compare is ignored on return)
```

### Pattern 2: Meridian profile in the engine (ANA-01)

**What:** `meridianProfile({ surfaces, frame, eye }, thetaDeg, samples = 96)`. It intersects the line through `surfaces.oc` at TABO angle θ (lens-local, CCW from +x, the same for both eyes per `conventions.js`) with `frameOutline(frame.shape, frame.A, frame.B, eye)`. Then it samples `frontSagAt`/`backSagAt` (from `design.js`) along the chord.

It returns plain data:

```js
{ thetaDeg,
  s: Float64Array,      // signed distance from OC
  zFront, zBack,        // zFront = −sF, zBack = −ct − sB (conventions.js)
  ends: [{ s, t, location }, …],
  ct }
```

`thickness = ct − sF + sB` (metrics.js `thicknessAt`), the same formula as the metrics, so the SVG numbers equal the result numbers.

**Principal meridians:** α = `axisDeg` (power Sph) and α + 90° (power Sph + Zyl), minus-cylinder form. Drop duplicates when α ∈ {0, 90} coincides with horizontal/vertical.

**Edge cases:**

- Take the nearest intersection on each side of the OC (panto/pilot are not convex everywhere).
- If the OC is outside the outline (`OC_OUTSIDE_OUTLINE`), the line may miss the outline: return `{ ok: false, code: 'NO_CHORD' }`.

**Where it runs:** as a `compare`-lane job that sends `surfaces` + `frame` + `eye` (plain data). It does not re-solve the lens, and it only runs while the cross-section is visible. Building the outline on the main thread on a cache miss costs ≈ 1,6 ms on desktop (outline.js comment), ×4 on a phone, inside a frame budget of 16,7 ms. Keep it in the worker.

**A/B overlay:** both profiles in one SVG, aligned at s = 0 (OC) and the front vertex z = 0, same mm scale. A is a solid line, B is dashed, and there is a text legend "A (Vorher) — durchgezogen / B (Nachher) — gestrichelt" (D-30). Draw at true 1:1 aspect so curvature is honest. At 320 px, a 60 mm chord is ≈ 5 px/mm.

Extra invariant tests for `meridianProfile`: t at the ends equals `thicknessAt` at the outline points; t(0) = ct; θ and θ + 180° give the same chord reversed.

### Pattern 3: Pure parsers for PD, stamp and custom material (RX-06, FRAME-03, MAT-06)

```js
// src/state/parse.js additions (codes only)
// parsePd("32/33") → { ok, kind: 'mono-pair', OD: 32, OS: 33 }
// parsePd("64")    → { ok, kind: 'binocular', total: 64, OD: 32, OS: 32 }
// parsePd("32,5")  → { ok, kind: 'mono', value: 32.5 }
// parsePd("45")    → { ok: false, code: 'PD_AMBIGUOUS' }          // 40 < v < 50 → question
// parsePd("64/61") → { ok: false, code: 'PD_DISTANCE_NEAR' }      // both ≥ 50 → question
// parseStamp("52□18 140" | "52-18-140" | "52 18 140" | "52/18 145" | "52 □ 18")
//   separators: □ U+25A1, ▢ U+25A2, ◻ U+25FB, ☐ U+2610, "[]", "-", "/", "x", whitespace
//   → { ok, A: 52, DBL: 18, temple: 140|null }; first in 14–24 and second in 40–62 → code 'STAMP_SWAPPED'
```

The PD bands are backed by ANSUR 2012: binocular minimum 51,0 mm, maximum 77,0 mm. Wutscher (an Austrian optician) gives an adult monocular PD of "zwischen 25 und 35 mm" ([wutscher.com](https://wutscher.com/ratgeber/pupillendistanz-was-ist-das/)).

HSA typed into PD: a single value in 8…20 mm gets a hint: "Ist das der HSA (Hornhautscheitelabstand)? Die PD liegt meist bei 25–35 mm je Auge." [ASSUMED band; HSA ~12–14 mm is from memory].

### Pattern 4: Toggletip = APG Disclosure (UX-01, D-31)

```html
<span class="term">Zyl
  <button type="button" class="tip-btn" aria-expanded="false" aria-controls="tip-cyl"
          data-i18n-aria-label="tip.cyl.name"><span aria-hidden="true">i</span></button>
</span>
<p id="tip-cyl" class="tip" hidden data-i18n="tip.cyl.text"></p>
```

- APG Disclosure: the control is a button with `aria-expanded` true/false and an optional `aria-controls`. Enter and Space toggle it ([w3.org/WAI/ARIA/apg/patterns/disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)). A native `<button>` provides Enter and Space for free.
- Esc closes it while focus is on the button or inside the tip, and focus returns to the button.
- Do not attach the tip via the input's `aria-describedby`. Inclusive Components warns that describing it in advance makes the button seem to "do nothing" ([inclusive-components.design](https://inclusive-components.design/tooltips-toggletips/)).
- The target must be ≥ 24×24 CSS px. Axe rule `target-size` is tagged `wcag22aa` and `wcag258` (checked locally via `axe.getRules()`).

### Pattern 5: Inline non-modal confirm (D-27)

- Insert a `role="group"` with `aria-labelledby` pointing at the question text, directly after the chip row.
- Move focus to **"Abbrechen"**. APG: when a step "is not easily reversible … it may be advisable to set focus on the least destructive action" ([APG dialog-modal](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)).
- Esc = Abbrechen. On close, focus returns to the chip.
- Announce the question with the group's existing `aria-live="polite"` region, or rely on the focus move. Do not use both, to avoid a double announcement.

### Pattern 6: Table that reflows into cards without DOM duplication (RX-01, D-03)

Keep one `<table>` (ids unchanged). Below the breakpoint, switch `display` to grid/block on `table, tbody, tr, td` and show each column label through a visible `<label>` inside each cell. Today the label is `visually-hidden`; make it visible in card mode.

Known risk: changing `display` on table elements can drop table semantics in some browser/screen-reader pairs [ASSUMED, from memory]. Because each input keeps its own `<label for>`, the form still works even if table semantics are lost. Verify with axe and a manual VoiceOver/TalkBack pass.

### Pattern 7: Switch (UX-02, D-32)

Use `<input type="checkbox" role="switch" id="expert">` with a visible `<label for>`. APG: role `switch`; a checkbox-based switch "uses the HTML `checked` attribute instead of `aria-checked`"; Space toggles; "the label on a switch does not change when its state changes" ([APG switch](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)). Expert sections get the `hidden` attribute. The state is not persisted.

### Anti-Patterns to Avoid

- **Running `optimiseBaseCurve` with k ≠ 0:** produces bowl-shaped plus lenses (see Pitfall 1).
- **Debouncing the compute path:** only the message display waits. The worker request must still go out in the input frame, or ENG-09 (c) regresses.
- **`style="…"` in generated SVG/HTML or `el.setAttribute('style', …)`:** blocked by CSP `style-src 'self'`. Use classes, SVG presentation attributes (`stroke`, `fill`, `stroke-dasharray`), or `el.style.prop = …` (MDN: individual style properties "will not be blocked").
- **An inline `<style>` inside the SVG:** blocked by the same CSP.
- **`disabled` for mirrored L fields:** removes them from the tab order and from axe contrast checks. Use `readonly`.
- **Adding comparison work to `#result[data-pending]`:** e2e `settled()` and the ENG-09 tooling rely on its main-only meaning.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WCAG checks | Custom contrast/label scripts | `@axe-core/playwright` `withTags([...])` | Already installed; maintained rule set incl. `target-size`, `color-contrast` |
| Number formatting / rounding | `toFixed`, string concatenation | `Intl.NumberFormat('de-AT')` via `format.js` | `-0`, U+2212 and NBSP handling already tested |
| Line/outline geometry for thumbnails | A new shape drawer | `frameOutline(shape, A, B, 'OD', 72)` | Same outline as the engine; n must be a multiple of 4 |
| Thickness along a meridian | UI-side sag maths | Engine `meridianProfile` using `design.js` | Single source of truth; covered by engine tests |
| Disclosure/toggletip widgets | ARIA from scratch on `div`s | Native `<button>`, `<details>`, checkbox `role="switch"`, radio `<fieldset>` | Keyboard behaviour for free (arrow keys in radio groups, Space/Enter on buttons) |
| Soft-keyboard handling | `visualViewport` repositioning | `interactive-widget=resizes-content` + CSS `scroll-padding` | Declarative; no main-thread work |

**Key insight:** every number on the page must trace back to `src/engine`. Even "trivial" UI arithmetic (differences, overhang) belongs in pure, tested `src/state`/`src/engine` functions, so lens-critic can check it.

## Runtime State Inventory

Phase 2 contains a refactor (splitting `main.js`). Answers per category:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. No storage by design (verified: no `localStorage`/IndexedDB in `src/`; phase-2 persistence is deferred) | none |
| Live service config | GitHub Pages serves `dist/` from Actions; nothing else is configured | none |
| OS-registered state | None | none |
| Secrets/env vars | `GITHUB_SHA` read in `vite.config.js` only | none |
| Build artifacts | `dist/` rebuilt by CI; the hashed worker name is matched by regex in `e2e/helpers.js` `WORKER_URL` | keep the worker file name containing "worker" |
| **e2e/tooling ids (code contract)** | `#result[data-pending]`, `#result-{od,os}-{ct,thick,etmin,weight,status}` (cards; `thick` = thickest(m) = max(CT, etMax), revised after lens-critic B1) and `#result-{od,os}-{dec,etmax,basecurve}` (Expert Zwischenwerte; `etmax` = 'Dickster Rand', the edge value), `#calc-status`, `.result-table`, `#disclaimer`, `#tech`, `#compute-mode[data-mode]`, `#timing*`, `#rx-*-{sph,cyl,axis,pd}[-echo|-err]`, `#rx-od-forms`, `#frame-{a,b,dbl}`, `#material` (select), `#frame-shape` (select), `#app-commit`, `meta[name=app-commit]` | Keep the numeric ids on the new value elements. `#material`/`#frame-shape` become fieldsets, so update `smoke.spec.js` (selectOption → radio check, option count → radio count), `perf-throttled.spec.js:141–142`, and the base-curve assertion (`smoke.spec.js:56`, moves to Expert). Change them deliberately, in the same plan as the markup change |

## Common Pitfalls

### Pitfall 1: Aspheric front + "thinnest" optimiser = bowl lenses
**What goes wrong:** Measured with `optimiseBaseCurve` (CR-39, rechteckig 52×38/18, PD 32), starting from the spherical result D1 +3,95, CT 4,88 mm:

| Front | D1 | CT | Front sag |
|---|---|---|---|
| Spherical (k = 0) | +3,95 | 4,88 mm | 3,9 mm |
| k = −1 | +14,00 | 3,10 mm | 13,5 mm |
| k = −2 | +14,00 | 1,99 mm | 11,6 mm |

+2,00: D1 1,99 → 11,50 at k = −1. The D-C tie-break does not catch it, because J(lo) exceeds J_min + τ.

**Why it happens:** a steep hyperboloid approaches a cone whose edge sag grows slowly, so steepening "pays" in this purely geometric objective. Optical quality (oblique astigmatism) is not in the objective. That is exactly why real aspherics use flatter fronts (Jalie US4289387 Table I: +3,00 front 8,50 → 4,75 D).

**How to avoid:** automatic D1 = the spherical search result (k = 0), then one `solveCT` at that D1 with k. With a manual base curve, apply k directly. Measured effect at fixed D1:

| Rx | k | CT |
|---|---|---|
| +4,00 | 0 | 4,88 mm |
| +4,00 | −1 | 4,82 mm |
| +4,00 | −5 | 4,61 mm |
| +6,00/−1,00×90 | 0 | 6,10 mm |
| +6,00/−1,00×90 | −1 | 5,91 mm |
| +6,00/−1,00×90 | −5 | 5,32 mm |
| −4,00/−2,00×30, −8,00 | any | identical (front at the +0,50 floor) |

The UI must say plainly: "In diesem Modell ändert die asphärische Vorderfläche vor allem Plusgläser."

**Warning signs:** an aspheric result with D1 > the spherical D1 + 0,05; front protrusion > 10 mm.

### Pitfall 2: Manual base curve 0,00 is rejected by the engine
**What goes wrong:** `invalidReason` uses `optPositive(spec.baseCurve)`, which requires `> 0`. Typing 0 gives INVALID_SPEC `base-curve`, although MAT-03 allows 0,00…+10,00.

**How to avoid:** accept `baseCurve ≥ 0` (c1 = 0 is handled: `sphereSag(0, r²) = 0`, `radius(0) = null`). The manual path skips the GAP-1 convex-back check, so add a **warn** code (e.g. `MANUAL_BACK_CONVEX`, data `{ D2max }`) when max(D2a, D2b) > 0. It needs `DIAG_DATA` + three dictionary keys (`dictionary.test.js:61–86` enforces this).

01-SKELETON also notes: "with MAT-03 revisit the user decision … that minus lenses keep the thinnest-model result at the +0,50 floor". The planner should surface that decision in the Expert base-curve copy.

### Pitfall 3: iOS has no minus key on `inputmode="decimal"`
**What goes wrong:** an iPhone user cannot type a negative Sph/Zyl. WebKit bug 193825: "UIKit doesn't support a number pad UIKeyboardType with a minus key" ([bugs.webkit.org/193825](https://bugs.webkit.org/show_bug.cgi?id=193825)). The reports date from 2019–2020 and no fix was found (MEDIUM: no official current statement).

**How to avoid:** a `<button type="button">` "±" before each signed field (Sph, Zyl, k), with the accessible name "Vorzeichen von Sph rechts umkehren". It flips the sign of the parsed value, or inserts "−" when the field is empty, then dispatches `input`. Keep `inputmode="decimal"`. Do not sniff the UA.

**Warning signs:** a real-iPhone test cannot produce −2,25.

### Pitfall 4: Sticky bottom bar vs on-screen keyboard and focus (D-20, WCAG 2.4.11)
**What goes wrong:** Chrome ≥ 108 on Android defaults to `resizes-visual`: "Elements that use `position: fixed` remain in place and can be obscured by the OSK" ([developer.chrome.com/blog/viewport-resize-behavior](https://developer.chrome.com/blog/viewport-resize-behavior)). Without the keyboard, a bottom bar can hide a focused control. WCAG 2.2 SC 2.4.11 (AA) names "sticky footers" ([w3.org Understanding 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)).

**How to avoid:**
- `<meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content">`. Supported in Chrome 108+ and Firefox 132+; not in Safari ([htmhell.dev](https://htmhell.dev/adventcalendar/2024/4/)).
- `html { scroll-padding-bottom: <bar height> }` (technique C43).
- Accept that on iOS the bar sits behind the keyboard while typing. That is acceptable: it reappears on "Fertig", and the field echo stays visible. Verify on a real iPhone.

### Pitfall 5: Debounced validation that also delays compute, or flashes "ungültig"
**What goes wrong:** "-" or "-2," mid-typing parses as `PARSE_NOT_A_NUMBER`. If the result card immediately says "Eingabe ungültig" while the field message is still debounced, the two disagree. If compute is debounced too, ENG-09 (c) ≤ 100 ms fails.

**How to avoid:** compute runs every input frame (latest-wins, as today). The result card shows a neutral "Eingabe unvollständig …" for an eye blocked by a parse error until the field message is due (pause or blur). The pause length is a design constant [ASSUMED ≈ 600 ms; no cited source].

### Pitfall 6: German hyphenation is not guaranteed on phones
**What goes wrong:** MDN: browsers "will only hyphenate if this attribute is present and the appropriate hyphenation dictionary is available". BCD `hyphens: auto`: Safari iOS 4.2 (prefixed until 17), Chrome Android 55, Chrome desktop 88 (all platforms). No per-language data. Chromium's 2016 intent-to-ship says auto hyphenation depends on platform dictionaries ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/LsnvY7FFrY0/m/XfAcOFYYAAAJ)). German on Chrome Android is UNVERIFIED.

**How to avoid:**
- Never rely on it. Use `-webkit-hyphens: auto; hyphens: auto` (prefix for iOS < 17).
- Use `overflow-wrap: anywhere`. MDN: its break opportunities "are considered when calculating min-content intrinsic sizes", unlike `break-word`. This matters inside tables.
- Put `\u00AD` (soft hyphen; · below marks the break points) in the dictionary for: Hornhaut·scheitel·abstand, Mindest·mitten·dicke, Mindest·rand·dicke, Pupillen·distanz, Brechungs·index, Experten·ansicht, Fassungs·maße.
- The Playwright 320 px test must pass with hyphenation off (assert `scrollWidth <= clientWidth`).

**Warning sign:** e2e `toHaveText('Mindestranddicke')` fails because of the invisible U+00AD. Normalise in the test helpers.

### Pitfall 7: CSP blocks style attributes in generated SVG/HTML
See Anti-Patterns. MDN `style-src`: inline style attributes, `<style>` elements, `setAttribute('style', …)` and `style.cssText` are blocked. Setting individual `element.style.x` is allowed ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src)). The e2e `worker.spec.js` "no CSP violation" checks should also cover the Expert/compare views.

### Pitfall 8: Which form gets the range check?
**What goes wrong:** RX-04 checks Zyl "after transposition". If Sph is checked only as typed, a plus-cyl entry like +11,00 +2,00 × 90 (Sph +13,00 in minus-cyl form) passes the paper check but is outside the engine's tested domain.

**How to avoid:** check the **transposed** (engine) form for "Außerhalb des Modells", and show both forms in the message (RX-03 already shows both).

### Pitfall 9: "Gleich für beide Augen" and PD
**Recommendation:** the checkbox mirrors Sph, Zyl and Achse only. PD has its own smart fill (`32/33`, `64`), and monocular PDs legitimately differ. Open question for the UI spec (D-04 says "L fields"). Mirrored fields are `readonly` and still focusable, and their `aria-describedby` message says "übernommen von rechts".

### Pitfall 10: Rounding consistency and changed display precision
**What goes wrong:**
- RES-01 shows 1 g, while phase-1 `fmtGram` shows 0,1 g, and `smoke.spec.js:111` expects `7,0 g`.
- Differences computed from unrounded values can contradict the displayed numbers: 4,1 − 2,5 shown as "1,7 mm dünner".

**How to avoid:**
- Add a `fmtGramWhole` with an "unter 1 g" rule (< 0,5 g). Keep 0,1 g in Expert "Zwischenwerte".
- In `src/state/compare.js`, compute differences from the **displayed rounded values**, so the on-screen arithmetic always adds up. The total weight is the sum of the two displayed per-eye grams.
- Document both rules in code as display rules, not physics. lens-critic should confirm.

### Pitfall 11: Comparison semantics with Expert overrides
**What goes wrong:** if the user set a manual base curve or minCT, should other material rows use them? minCT/minET are material-specific.

**Recommendation:** the selected row = the main result (all overrides). Other rows = the same Rx, frame, manual base curve and front shape, but **each material's own sourced minCT/minET**. Show a footnote when overrides are active. Custom material is never a comparison row (D-17), but it can be "Ihre Auswahl".

## Code Examples

### Engine: additive LensSpec fields (contract-safe)

```js
// src/engine/evaluate.js — additions only (01-SKELETON: add fields, never rename)
// @property {number|null} [frontConic] conic constant k of the front, null/0 = sphere (MAT-05)
// @property {{ ne: number, density: number, ve: number|null }|null} [customMaterial] MAT-06;
//           requires materialId === 'custom' and non-null minCT/minET (no invented defaults)
const m = spec.materialId === 'custom' ? { ...spec.customMaterial, minCT: NaN, minET: NaN } : MATERIALS[spec.materialId];
const k1 = spec.frontConic ?? 0;
// automatic: search at k1 = 0, then re-solve at the chosen D1 with k1 (Pitfall 1)
```

### Axe in Playwright (extends the existing usage)

```js
// Source: github.com/dequelabs/axe-core-npm packages/playwright README (include/withTags/analyze)
import AxeBuilder from '@axe-core/playwright';
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
test.use({ viewport: { width: 320, height: 640 } });
test('axe: expert + compare + tips open @320', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('switch', { name: /Experten/ }).check();
  await page.getByRole('button', { name: 'Vergleichen' }).click();
  for (const b of await page.locator('button[aria-expanded="false"].tip-btn').all()) await b.click();
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);   // all impacts, not only serious
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
```

Local check (`axe.getRules`): `wcag2a` 62 rules, `wcag2aa` 3, `wcag21aa` 3, `wcag22aa` 1 (`target-size`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Android keyboard shrinks the layout viewport | Default `resizes-visual`; opt in with `interactive-widget` | Chrome 108 | A fixed bottom bar hides behind the keyboard unless you opt in |
| `-webkit-hyphens` only on Safari | Unprefixed `hyphens` | Safari/iOS 17 | Keep the prefix for older iPhones |
| Hover tooltips | Toggletips/disclosures, WCAG 2.2 target size 24 px | WCAG 2.2 (2023) | axe `target-size` now gates the "i" buttons |

## Open Questions (RESOLVED — each answered with a source or labelled a design constant)

1. **Adult PD default (D-06).** ANSUR 2012 (via [Wikipedia "Pupillary distance"](https://en.wikipedia.org/wiki/Pupillary_distance)): female mean 61,7 mm (SD 3,6, n 1986), male 64,0 mm (SD 3,4, n 4082). Dodgson 2004 (SPIE 5291) is quoted secondarily as "near 63 mm" (full text not accessed). → **Keep 64 mm / 32 mm per eye as a design default**, labelled "angenommen". It equals the male mean and is about 0,6 SD above the female mean. Caveat: the sample is the US Army, not DACH. Effect of 1 mm PD error: decentration changes by 1 mm (ENG-05 formula). Confidence MEDIUM.

2. **Aspheric front (MAT-05).** Citable: Jalie US4289387, a hyperboloidal front for reduced thickness; the sag equation `y² = 2000(n′−n)x/F₀ − p·x²`; "p has a value ranging from 0 to −4"; examples +3,00 (front 8,50 → 4,75 D) and −4,00 (5,00 → 1,25 D) ([patents.google.com/patent/US4289387A](https://patents.google.com/patent/US4289387A/en)). US5083859 defines p = 1 − e² and uses back-surface p −1,5 / −0,6 for a −6/−7 atoroidal CR-39 back ([US5083859A](https://patents.google.com/patent/US5083859A/en)). Comparing with the standard conic `y² = 2Rx − (1+k)x²` gives p = 1 + k. That step is my derivation [ASSUMED, standard conic algebra]. → **Default k = −1 (p = 0), range −5…−1** (revised 2026-11-07, lens-critic MINOR-2: −1 < k < 0 is not covered by the source and is not offered; k = 0 is the sphere). Scope (verified 2026-11-07 on the patent page): the patent makes the **front** hyperboloidal only for plus lenses; for minus lenses it makes the **back** hyperboloidal. The model's front conic on a minus lens is therefore a generic surface, not the patent's design. The automatic D1 stays the k = 0 value unless the thinner CT would make the back convex; then D1 is raised minimally (lens-critic M2, see 02-11). For −1 < k < 0, `baseCurveAuto`'s conic-aware cap only widens, so the spherical D1 always stays in the domain. The optimiser treatment is in Pitfall 1. Confidence MEDIUM. lens-critic must review the "D1 at k = 0" rule.

3. **Custom material ranges (MAT-06).** All are design constants; anchors come from verified data. ne − nd in `materials.js` is 0,001 (CR-39) to 0,007 (1.74); users will often type a nominal or nd value, so the toggletip explains "ne liegt meist 0,001–0,007 über nd". Crown glass reference: nd ≈ 1,523, density 2,54–2,55 g/cm³, Abbe ≈ 56–59 (US4508834 and a slideshare deck; MEDIUM, sources differ on Abbe).

   | Field | Fehler (blocks) | Hinweis (computes) | Anchor |
   |---|---|---|---|
   | ne | outside 1,40…2,00 | outside 1,49…1,90 | listed 1,500–1,738; glass up to ~1,9 [ASSUMED for 1,9] |
   | density g/cm³ | outside 0,80…5,00 | outside 1,00…4,00 | plastics 1,11–1,47 (`materials.js`); crown 2,54 |
   | Abbe (optional) | outside 15…80 | outside 25…65 | PC 29 … crown ~58 |
   | minCT/minET | required. Prefilled from the **listed material with the nearest ne**, editable | — | no invented engine defaults |

   Engine: a new optional `customMaterial`, plus `materialId: 'custom'`; `invalidReason` checks finite, ne > 1, density > 0. `intermediates.abbe` becomes `number|null` (type widening only).

4. **Rim depth (FRAME-02).** Optically it is the front-to-back depth of the frame rim (eyewire) that holds the lens bevel. It does not change lens thickness, weight or power. The phase-2 number that needs no new assumption is `edgeBeyondRim = max(0, etMax − rimDepth)`, total front + back, at the etMax location. The front/back split needs a bevel-position model (e.g. a centred bevel) and a frame wrap, so it is deferred to phase 3 / VIZ-03. Default rim depth: **no citable value found** → a design constant [ASSUMED 3,0 mm, flagged for UI-spec/user confirmation]. FEATURES E8 supports showing protrusion "if rim depth is modelled". Confidence LOW for the default, HIGH that thickness and weight are unaffected.

5. **RES-04 thresholds.** Measured (CR-39, rechteckig 52×38/18, PD 32, spherical):

   | Pair | Δ thickest point = max(CT, etMax) | Δ weight |
   |---|---|---|
   | −4/−5 | 1,04 mm | 0,85 g |
   | −4/−5,25 | 1,31 mm | 1,06 g |
   | −2/−3 | 0,99 mm | 0,83 g |
   | +1/+2 | 0,97 mm | 1,58 g |
   | +2/+3 | 0,97 mm | 1,59 g |
   | +4/+5 | 0,98 mm | 1,63 g |

   Correction 2026-11-07 (lens-critic B1): the first version measured the "thickest point" as etMax (thickest edge) and gave +2/+3 0,61 mm. For plus lenses the centre is thicker than any edge (R +3,00: CT 3,902 vs etMax 2,824), so the thickest point is max(CT, etMax); re-measured values above (scratchpad node script, CR-39, rechteckig 52×38/18, spherical, PD 32 / 31,5).

   → **1,0 mm** fires from about 1 dpt of anisometropia, depending on rounding and on which eye has the larger PD, for minus and plus alike (R −1/L −2 shows 2,8 / 3,8 mm and fires; R −2/L −1 shows 3,7 / 2,8 mm and stays silent; R +2/L +1 shows 2,9 / 2,0 and stays silent; revision round 2, lens-critic MINOR-d). It is ≈ 3× the ±0,3 mm Zeiss CT tolerance already used for τ, and 10× the 0,1 mm display step. It stays a design constant. **3 g**: on the canonical frame a 1 dpt difference moves at most 2 displayed g, and a sweep (sph −8…+5, 1/1,5/2/3 dpt differences) found no pair where the 3 g rule fires while the 1,0 mm rule does not. The earlier "secondary trigger for plus pairs" reasoning came from the etMax metric and is withdrawn; 3 g stays only because D-24 states it, as a guard for large or dense configurations. A PD difference alone can also fire the rule (−4/−4 with PD 29 / 34: Δ 1,2 mm), so the sentence names the cause (Rx, PD or both). PD counts as a cause only from |ΔPD| ≥ 2 mm (LR_PD_CAUSE_MM, design constant): 1 mm of PD moves the thickest point by 0,11–0,37 mm (sph −2…−6, measured 2026-11-07), so a typical 32 / 31,5 pair cannot drive the sentence and must not be blamed (lens-critic round 2 MINOR-a). No medical claim.

6. **Performance.** See Pattern 1. Measure in the existing perf proxy with the comparison active. Add a Node bench `test/bench/compare.test.js` reporting "6 materials × 2 eyes" for NORMAL and GRENZFALL: 9,9 ms and 54,5 ms on this machine today.

7. **Cross-section data.** See Pattern 2. `LensResult.surfaces` (n, ct, c1, k1, ca, cb, axisRad, oc), the spec frame and `design.js` sag functions give everything needed.

8. **Hyphenation and iOS minus.** See Pitfalls 6 and 3. Both need a real-device check, recorded in VERIFICATION.

9. **Terminology (de-AT).**
   - Austrian optician Wutscher uses "SPH", "ZYL (oder Cyl)", "ACH oder A", "ADD", "PD", "Einzel-PD"/"Gesamtwert" ([wutscher.com](https://wutscher.com/magazin/brillenpass-erklaert/)).
   - Temple numbers: "Glasbreite – Stegbreite – Bügellänge", with "ein kleines Quadrat zwischen dem Wert für die Glasbreite und der Stegbreite" ([allaboutvision.com/de](https://www.allaboutvision.com/de/brillen/modell/brillengroesse/)).
   - The frame measuring system is standardised in DIN EN ISO 8624:2020-11 (full text not accessed).
   - **Basiskurve vs Durchbiegung:** German patents use "Basiskurve" as a Flächenbrechwert and "Durchbiegung" for the overall bending. No source settles Austrian lay usage. → Use **"Basiskurve"** as the label and mention "auch Durchbiegung" in the tip (LOW; confirm with an optician).
   - Mittendicke, Randdicke, Glasbreite, Glashöhe and Stegbreite are consistent across sources (MEDIUM).

10. **A11y patterns.** See Patterns 4, 5 and 7, and Pitfall 4.

11. **Axe in CI.** No workflow change is needed. `deploy.yml` already runs `npm run test:e2e` (desktop + mobile projects) in `build`, and against the live URL in `verify-live`. A new `e2e/a11y.spec.js` is picked up automatically. `test/ci/workflow-structure.test.js` stays green because nothing in the YAML changes.

12. **Splitting `main.js`.** Use the structure above. Move code verbatim first (one commit per module, e2e green after each). Change markup second, and update the selectors in the same commit. Keep the timing/pending code byte-identical in behaviour.

### Remaining genuinely open (need a human or a device)

- iPhone check: ± button, bar behind the keyboard, German hyphenation (Pitfalls 3, 4, 6). Is an iPhone available to the user? Unknown.
- Rim-depth default (3,0 mm assumed) and the Basiskurve/Durchbiegung wording: confirm with an optician, or accept them as labelled design constants.
- Does "Gleich für beide Augen" also mirror PD (Pitfall 9)? Recommended: no.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/tests | ✓ | v22.17.0 (`.nvmrc` 22) | — |
| Playwright + Chromium | e2e/axe | ✓ | 1.65.0, chromium-1208 | — |
| axe-core / @axe-core/playwright | UX-04 | ✓ | 4.14.0 / 4.14.0 | — |
| Real Android phone | ENG-09 regression, keyboard bar | ✓ (Pixel, Chrome 156 per 01-11) | — | 4× throttled proxy (estimate only) |
| Real iPhone (Safari) | Pitfalls 3, 4, 6 | unknown | — | none: an untested iOS claim must stay "unverified" in VERIFICATION |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.1.0 (project `unit`, node env) + fast-check 4.10.2; Playwright 1.65.0 + @axe-core/playwright 4.14.0 |
| Config file | `vite.config.js` (`test.projects`), `playwright.config.js` (desktop 1280, mobile 360; perf only with PERF=1) |
| Quick run command | `npm test` |
| Full suite command | `npm run lint && npm run test:coverage && npm run build && npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RX-01 | Table ids, labels, R before L, reflow at 320 px | e2e | `npx playwright test e2e/rx.spec.js` | ❌ Wave 0 |
| RX-04 | Ranges per field, never clamped (value kept in field and echo) | unit + e2e | `npx vitest run src/state/validate.test.js` | ❌ Wave 0 |
| RX-05 | Three tiers, "Meinten Sie" button applies the suggestion, `aria-describedby` linked | unit + e2e | `npx vitest run src/state/validate.test.js`; `e2e/rx.spec.js` | ❌ |
| RX-06 | `32/33`, `64`, `32,5`, `45` → question, `64/61` → question, missing → default stated in the result | unit + e2e | `npx vitest run src/state/parse.test.js` | ✅ extend |
| RX-07 | Mirror on/off keeps values, readonly, focusable | e2e | `e2e/rx.spec.js` | ❌ |
| RX-08 | `<details>` present with Add/Prisma/HSA/F/N, "nicht berechnet" text | e2e + dict unit | `e2e/rx.spec.js`; `dictionary.test.js` | ✅ extend |
| FRAME-02 | A/B/DBL ranges, rim depth field + `edgeBeyondRim` | unit + e2e | `npx vitest run src/engine/rim.test.js src/state/validate.test.js` | ❌ |
| FRAME-03 | Stamp variants (□ ▢ ◻ ☐ [] - / x space), swap hint, B "geschätzt" | unit (property) + e2e | `npx vitest run src/state/parse.test.js` | ✅ extend |
| MAT-03 | baseCurve 0 accepted; manual 0…10; `MANUAL_BACK_CONVEX` warn | unit | `npx vitest run src/engine/evaluate.test.js` | ✅ extend |
| MAT-04 | Defaults from `materials.js`, re-fill unless edited, binding constraint text | unit + e2e | `evaluate.test.js`; `e2e/expert.spec.js` | ❌ e2e |
| MAT-05 | k = 0 ≡ today (golden values unchanged); automatic D1 with k equals the spherical D1; plus lens CT decreases monotonically for k −1 → −5 | unit + property | `npx vitest run src/engine/evaluate.test.js src/engine/properties.test.js` | ✅ extend |
| MAT-06 | customMaterial equal to cr39 constants → bitwise-equal metrics to `materialId: 'cr39'`; INVALID_SPEC on bad input; label shown | unit + e2e | `evaluate.test.js` | ✅ extend |
| RES-01 | Headline per eye, 0,1 mm / 1 g, "unter 1 g" | unit (format) + e2e | `npx vitest run src/i18n/format.test.js` | ✅ extend |
| RES-02 | 6 rows, selected row = main result, signed differences from rounded values, custom excluded | unit (`compare.test.js`, client lane) + e2e | `npx vitest run src/state/compare.test.js src/state/compute-client.test.js` | ❌ / ✅ extend |
| RES-03 | Freeze A, change B, difference row; phone toggle keeps the difference visible | e2e (desktop + mobile) | `e2e/compare.spec.js` | ❌ |
| RES-04 | Callout at ≥ 1,0 mm or ≥ 3 g, not below | unit | `compare.test.js` | ❌ |
| RES-05 | Example banner disappears after the first Rx edit; preset over typed values → inline confirm, focus on Abbrechen, Esc | e2e | `e2e/presets.spec.js` | ❌ |
| UX-01 | Every UX-01 term has a tip button + dictionary key; Enter/Space/Esc | unit (dict) + e2e | `dictionary.test.js`; `e2e/a11y.spec.js` | ✅ extend / ❌ |
| UX-02 | Simple view hides base curve etc.; switch reveals them; not persisted (reload → off) | e2e | `e2e/expert.spec.js` | ❌ |
| UX-03 | 320 px: no horizontal overflow (all states); sticky bar visible while scrolling inputs; scroll-padding | e2e | `e2e/layout.spec.js` | ❌ |
| UX-04 | axe WCAG tags, zero violations: simple/expert/compare/tips open × 320 px/desktop; keyboard-only full flow | e2e | `e2e/a11y.spec.js` | ❌ |
| UX-05 | No "Stärke" | unit | `dictionary.test.js` | ✅ (exists) |
| ANA-01 | `meridianProfile` invariants (t(0) = ct; ends = `thicknessAt`; θ vs θ+180); SVG has title/desc + text table; A/B dashed vs solid + legend | unit (property) + e2e | `npx vitest run src/engine/profile.test.js`; `e2e/expert.spec.js` | ❌ |
| ANA-02 | Decentration nasal sign per eye; binding constraint wording | unit + e2e | `evaluate.test.js` (exists for decentration); `e2e/expert.spec.js` | ✅ / ❌ |
| ENG-09 (regression) | Main result unchanged with the compare lane: latest-wins, main before compare, at most one compare job ahead | unit + e2e | `compute-client.test.js`; `e2e/worker.spec.js`; `npm run test:perf` (manual, informational) | ✅ extend |

### Sampling Rate

- **Per task commit:** `npm test` (and `npx playwright test <touched spec>` after a build, for UI tasks)
- **Per wave merge:** full suite command
- **Phase gate:** full suite green + `npm run test:perf` recorded + a real-phone check (Pixel; iPhone if available) before `/gsd:verify-work`, then lens-critic

### Wave 0 Gaps

- [ ] `src/state/validate.js` + `validate.test.js`: RX-04/05, FRAME-02, MAT-06 tiers
- [ ] `src/state/compare.js` + `compare.test.js`: RES-02/04 arithmetic
- [ ] `src/engine/profile.js` + `profile.test.js`; `src/engine/rim.js` + `rim.test.js` (keep coverage ≥ 95/90)
- [ ] e2e specs: `rx`, `presets`, `compare`, `expert`, `layout`, `a11y` (desktop + mobile projects; 320 px via `test.use`)
- [ ] `e2e/helpers.js`: `settledCompare(page)` on `#compare[data-pending]`; a text normaliser stripping U+00AD
- [ ] `test/bench/compare.test.js` (informational timings)

## Security Domain

`security_enforcement: true`, ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no accounts |
| V3 Session Management | no | no sessions |
| V4 Access Control | no | static public site |
| V5 Input Validation | yes | Pure anchored-regex parsers in `src/state/parse.js` (never `parseFloat`); engine `invalidReason`; output only via `textContent` / `createElementNS` |
| V6 Cryptography | no | — |
| V8 Data Protection | yes | Rx is health-adjacent: no storage, no network, no analytics (persistence deferred to v2 with consent) |
| V14 Configuration | yes | CSP unchanged; no new dependencies; SHA-pinned actions |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| DOM XSS through echoed user text (stamp, custom material, PD) | Tampering | `textContent` only; SVG text via `textContent`; ESLint `no-restricted-properties` for `innerHTML`/`outerHTML`/`insertAdjacentHTML` in `src/ui` [recommended addition] |
| ReDoS in new parsers | DoS | Anchored, non-nested quantifiers; length cap (e.g. 32 chars) before matching; property test with long random strings |
| CSP bypass via inline style/script added in the restructure | Tampering | Keep the exact CSP (`worker.spec.js` asserts it); listen for `securitypolicyviolation` in e2e |
| Cross-project leakage on the shared origin | Information disclosure | No storage APIs in phase 2 (grep test: no `localStorage`/`indexedDB`/`document.cookie` in `src/`) |
| Worker message confusion (stale compare result painted as current) | Tampering (integrity of numbers) | Generation tag + `isCurrent` re-check in the paint frame (existing T-01-38 pattern) |

## Sources

### Primary (HIGH confidence)

- Repository code read and run 2026-11-07: `src/engine/{evaluate,solve,power,design,sag,metrics,materials,conventions,diagnostics}.js`, `src/engine/frame/*`, `src/state/{compute-client,compute-protocol,parse,bench-cases}.js`, `src/ui/main.js`, `index.html`, `vite.config.js`, `playwright.config.js`, `.github/workflows/deploy.yml`, `e2e/*`. Node measurements via scratch scripts (engine imported read-only).
- `.planning/phases/01-*/01-SKELETON.md` (frozen contract), `01-11-SUMMARY.md` (Pixel timings).
- MDN BCD `css/properties/hyphens.json` (raw GitHub, fetched 2026-11-07).
- MDN `style-src`, `hyphens`, `overflow-wrap`.
- WAI-ARIA APG: Disclosure, Switch, Dialog (modal) patterns; WCAG 2.2 Understanding SC 2.4.11.
- Chrome for Developers, "viewport resize behavior" (Chrome 108 `resizes-visual`).
- Google Patents US4289387A (Jalie), US5083859A.
- `axe-core` 4.14.0 local `getRules()` output; axe-core-npm Playwright README.

### Secondary (MEDIUM confidence)

- WebKit bug 193825 (iOS decimal keypad minus).
- htmhell.dev 2024/4 (`interactive-widget` support).
- Wikipedia "Pupillary distance" (ANSUR 2012 table); Dodgson 2004 via secondary quotes.
- Wutscher (Austrian optician) Brillenpass and PD pages; allaboutvision.com/de frame size.
- Inclusive Components "Tooltips & Toggletips".
- Blink intent-to-ship CSS hyphens (2016).

### Tertiary (LOW confidence)

- Crown glass constants (slideshare deck; US4508834 snippet).
- Stack Overflow mirror (iOS `visualViewport` lag).
- German patent snippets for Basiskurve/Durchbiegung usage.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | p = 1 + k, mapping Jalie's p ∈ [0, −4] to k ∈ [−1, −5] | Open Q2 | Wrong default/range for MAT-05; lens-critic should re-derive |
| A2 | Rim-depth default 3,0 mm | Open Q4 | Overhang number off by the error; Expert-only and labelled |
| A3 | Custom-material outer bounds (ne 1,40–2,00, density 0,8–5,0, Abbe 15–80) and glass up to ne ~1,9 | Open Q3 | A legitimate exotic material gets blocked, or a typo is accepted |
| A4 | Validation-message pause ≈ 600 ms | Pitfall 5 | Messages feel slow or flashy; UI spec can tune it |
| A5 | HSA ~12–14 mm, giving the 8–20 mm "HSA in PD field" hint band | Pattern 3 | Hint fires wrongly; Hinweis tier only (still computes or asks) |
| A6 | CSS-reflowed table may lose table semantics in some AT | Pattern 6 | Screen-reader confusion; labels keep the form usable |
| A7 | German `hyphens:auto` works on iOS Safari and Chrome Android | Pitfall 6 | Words don't hyphenate; overflow is prevented anyway by `overflow-wrap` + `\u00AD` |
| A8 | `role="switch"` on `input[type=checkbox]` passes axe `aria-allowed-role` | Pattern 7 | Axe failure; fall back to a plain checkbox (D-32 allows either) |
| A9 | "Basiskurve" is the preferred Austrian lay/trade term | Open Q9 | Wording only; the tip names both |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Nothing new; versions read from installed packages.
- Architecture (compare lane, profile, contract extensions): HIGH for feasibility (measured), MEDIUM for the aspheric rule (needs lens-critic).
- Pitfalls: HIGH for engine and CSP items (code/MDN), MEDIUM for iOS and hyphenation (no device).
- Terminology and defaults (PD, rim depth, custom ranges): MEDIUM to LOW, labelled as design constants.

**Research date:** 2026-11-07
**Valid until:** 2026-12-07 (stable stack; re-check iOS/WebKit items if Safari ships `interactive-widget`)
