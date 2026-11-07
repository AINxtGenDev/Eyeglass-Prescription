# Phase 2: Lay-First German Input, Results & Comparison - Context

**Gathered:** 2026-11-07
**Status:** Ready for planning

**How decided:** The user was offered four gray areas (Rx entry style, page flow on phone, comparison model, result wording). They answered "use best practices easy to use" and chose none to discuss. Every decision below is therefore Claude's best-practice choice under the rule "as easy as possible for a lay user". Each one can be revised in `/gsd:ui-phase 2` or during plan review without asking the user again, as long as the change keeps or improves lay usability. That rule follows the standing instruction in memory `best-practice-default`.

<domain>
## Phase Boundary

Phase 2 turns the phase-1 developer page into the lay-first product. A non-expert copies a paper prescription into a German R/L table, picks a frame (shape, size or temple stamp) and a material, and reads per-eye thickness and weight in plain German. They can compare materials (mm/g savings) and two configurations. An "Experten-Ansicht" adds manual base curve, thickness constraints, aspheric front, custom material, decentration, intermediate values and an SVG cross-section.

Requirements: RX-01, RX-04..08, FRAME-02, FRAME-03, MAT-03..06, RES-01..05, UX-01..05, ANA-01, ANA-02 (see `.planning/REQUIREMENTS.md`).

Not in this phase: 3D meshes and the heatmap (phase 3), the ray-traced view and offline support (phase 4), sharing and print (v2).

</domain>

<decisions>
## Implementation Decisions

### Rx entry (RX-01, RX-04..08)
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

### Frame (FRAME-02, FRAME-03)
- **D-10:** **Shape is picked from visual radio cards**, each with a small SVG outline drawn from the engine's own `frameOutline` and a German name (Rund, Rechteckig, Panto, Pilot). This replaces the phase-1 `<select>`. Picking a shape fills its typical A/B/DBL defaults (existing `prefillFrame`). If the user has already typed sizes, they are kept, and a small "Standardmaße übernehmen" link applies the defaults.
- **D-11:** **The temple stamp is the primary, most prominent frame input:** "Maße vom Brillenbügel (z. B. 52□18 140)". It parses `52□18 140`, `52-18-140`, `52 18 140` and `52/18 145` into A and DBL and ignores the temple length. B comes from the shape and is shown as "geschätzt aus der Form". The separate A, B and DBL fields stay below it, editable, and in sync with the stamp.
- **D-12:** "Wo finde ich das?" opens an inline illustration of a temple with a stamp. It must be **our own SVG drawing**. `references/` images are git-ignored third-party material and must never be published or copied.
- **D-13:** Rim depth (FRAME-02) is an **Expert-view field** with a documented default. In phase 2 it affects only front-surface protrusion relative to the rim, if the engine models that; otherwise it is stored for phase 3. The researcher checks what the engine needs (the engine currently has no rim-depth input), and the planner adds it as a non-breaking LensSpec field.

### Material (MAT-03..06, RES-02)
- **D-14:** Material is chosen from **radio cards with lay names plus the index**, for example "Standard 1,50 (CR-39)", "Dünner 1,60", "Sehr dünn 1,67", "Am dünnsten 1,74", Trivex 1,53, Polycarbonat 1,59. This replaces the `<select>`. Final wording is for the UI spec. Abbe stays visible as secondary info, as in phase 1.
- **D-15:** **The material comparison (RES-02) is always visible in Simple view**, directly under the main result, as "Was bringt ein anderes Material?". This answers the core-value question without a click. It is a table with one row per material: centre thickness, thickest point and weight. The differences are absolute and signed, relative to **the user's currently selected material** ("1,67: 1,7 mm dünner, 2 g leichter"; for lower indices "dicker/schwerer"). Percentages are only a secondary hint. The selected row is marked by text ("Ihre Auswahl"), not only by colour. Thickness is shown for the thicker of the two lenses (labelled with which eye), and weight for both lenses together. A per-eye breakdown is available on expand.
- **D-16:** Comparison rows are computed **after** the selected configuration's result is painted, at lower priority in the same worker, and the newest input wins (latest-wins). The planner/researcher must keep ENG-09 (a)–(d) intact for the main result. The comparison may show "rechnet …" on its own.
- **D-17:** Custom material (MAT-06) is the last radio card, "Eigenes Material" (Expert view only). It has fields for ne, density and optional Abbe, with validated plausible ranges (researcher proposes them). The result is labelled "beruht auf Ihren Angaben, kein geprüftes Material". This needs a non-breaking engine extension, because the engine looks up materials only by `materialId` today. Custom material rows are excluded from the "Was bringt…" table, which compares sourced materials only.

### Page flow and layout (UX-03)
- **D-18:** **One scrolling page, no step wizard.** Order: Beispiel banner → Rezept → Fassung → Material → Ergebnis → material comparison → configuration comparison → Expert sections → disclaimer → Technische Angaben. A wizard hides the cause-and-effect link that is the point of the tool.
- **D-19:** **Desktop/tablet (≥ about 900 px):** two columns, inputs left, and the results column right, sticky. Phase 3 puts the 3D view at the top of this sticky column, so the planner reserves that slot.
- **D-20:** **Phone:** a **sticky compact summary bar** at the bottom of the viewport shows per eye the thickest point and weight (e.g. "R 4,1 mm · 9 g | L 3,8 mm · 8 g"), shows "rechnet …" and stale state, and jumps to the full result on tap. This meets UX-03 "the result stays visible while editing" in phase 2. Phase 3 reuses the slot for a small 3D preview. The bar must not cover a focused input (check scroll padding and the on-screen keyboard).
- **D-21:** Long German compound words: `hyphens: auto` with `lang="de-AT"`, `overflow-wrap: anywhere` as the safety net, and `&shy;` in the dictionary for known long terms. Playwright checks 320 px for horizontal overflow. German hyphenation support on iOS is an open STATE.md concern for the researcher.

### Results wording (RES-01, RES-04)
- **D-22:** **One result card per eye.** A plain-German headline sentence comes first, then the four numbers as labelled values:
  - Headline example: "Rechtes Glas: am dicksten 4,1 mm außen (zur Schläfe), am dünnsten 2,0 mm innen (zur Nase). Mitte 1,8 mm, Gewicht 9 g."
  - Rounding: 0,1 mm and 1 g. Below 0,5 g shows "unter 1 g".
- **D-23:** **Location words for lay users:** "außen (zur Schläfe)", "innen (zur Nase)", "oben" and "unten", plus combinations like "außen unten". Expert view adds the technical terms (temporal/nasal/superior/inferior). A small orientation sketch per card is an option for the UI spec.
- **D-24:** **Left/right difference callout (RES-04):** shown when the thickest points differ by ≥ 1,0 mm or the weights by ≥ 3 g. These are design constants the researcher should justify or adjust as cosmetic visibility thresholds, documented in code like τ in phase 1. Example wording: "Das linke Glas ist an der dicksten Stelle 1,4 mm dicker als das rechte — weil die Werte der beiden Augen verschieden sind." No medical judgement.
- **D-25:** **UX-05 vocabulary:** "Stärke" is never used. Power is always "… dpt (Dioptrien)" and thickness is always "Mittendicke" or "Randdicke" / "dickste Stelle". A dictionary test fails if "Stärke" appears in `de-AT.js`.

### Examples and presets (RES-05)
- **D-26:** **The page starts with a realistic example** and a visible banner, "Beispiel — ersetzen Sie die Werte durch Ihre eigenen". The banner disappears after the first edit of any Rx field. The researcher/planner picks values that show something interesting, for example a moderate myope with a small cylinder in a Rechteckig frame.
- **D-27:** Rx presets (leicht kurzsichtig, stark kurzsichtig, weitsichtig, Hornhautverkrümmung) and frame presets appear as a row of chip buttons above the table. **If the user has typed their own values, applying a preset asks first** with a non-modal inline confirmation ("Ihre Eingaben ersetzen?" with Ersetzen / Abbrechen). This is not `window.confirm`. On an untouched example, presets apply immediately.

### Configuration comparison (RES-03)
- **D-28:** **The Rx is shared, not compared**: it belongs to the person. A "Vergleichen" button freezes the current frame and material as **A** ("Vorher"). The user then changes frame and/or material, and that becomes **B** ("Nachher"). Both are computed with the same Rx. "Vergleich beenden" returns to a single configuration. There are exactly two configurations; desktop does not get four.
- **D-29:** **Wide screens:** A and B side by side, with a difference row ("B ist 1,2 mm dünner und 3 g leichter"). **Phone:** a segmented toggle "Vorher | Nachher" switches the cards, and the difference line stays visible above the toggle.
- **D-30:** The Expert cross-section overlays A and B (ANA-01). The two are told apart by line style plus a text legend, not by colour alone.

### Explanations (UX-01)
- **D-31:** **Every technical term gets an inline toggletip.** A real `<button>` with an "i" icon and an accessible name sits next to the term ("Erklärung: Zylinder"). It has `aria-expanded` and shows the 1–2 sentence explanation inline below the field. It opens by tap, click, Enter and Space, never on hover only, and Esc closes it. All texts come from the `de-AT` dictionary. Terms covered are at least the UX-01 list.

### Expert view (UX-02, MAT-03..05, ANA-01, ANA-02)
- **D-32:** **The "Experten-Ansicht" switch** is a labelled toggle (`role="switch"` or a checkbox) at the top of the page. It reveals Expert sections in place, next to the inputs and results they belong to, not as a separate page. The state is **not persisted** in phase 2 (no storage of anything on a shared origin, see "Deferred").
- **D-33:** **Manual base curve** (MAT-03, 0,00…+10,00 dpt): an empty field means automatic. Next to it, always show the automatic value and the rule ("dünnstes Glas, flachste Vorderfläche innerhalb 0,1 mm"), plus the Vogel reference value. This content moves here from the phase-1 result table (UX-02).
- **D-34:** **Min centre and edge thickness** (MAT-04): fields pre-filled with the sourced per-material defaults from `materials.js`. Changing the material re-fills them unless the user edited them, and "Standard" resets them. The result marks the binding constraint in words ("Die Mittendicke ist durch den Mindestwert festgelegt" or "… durch die Mindest-Randdicke").
- **D-35:** **Front surface "sphärisch / asphärisch"** (MAT-05) uses radio buttons. Aspheric reveals a k field with a documented default. The label is always "allgemeines Modell, kein bestimmtes Herstellerdesign". The engine already accepts `k1`. The researcher must decide the default k and how the base-curve optimiser treats aspheric fronts; STATE.md notes there are no citable conic constants.
- **D-36:** Decentration (ANA-02) and the intermediate values (radii, sags at named points, D1/D2, binding constraint) go in an Expert "Zwischenwerte" block, read-only, with units.
- **D-37:** **Cross-section** (ANA-01): inline SVG generated from engine output, with dimensioned centre and edge thickness. A meridian select offers horizontal (default), plus the two principal meridians when Zyl ≠ 0. It has `<title>`/`<desc>` and an adjacent text/table equivalent of the key numbers.
- **D-38:** The phase-1 "Technische Angaben" `<details>` (timings, compute mode) stays at the bottom, collapsed, unchanged in function.

### Accessibility and testing (UX-04)
- **D-39:** axe-core checks run in CI on Simple view, Expert view and comparison mode, at 320 px and desktop widths. A Playwright keyboard-only test walks the full flow: Rx → stamp → material → compare → expert → toggletip. WCAG AA contrast applies. Every state uses text or an icon as well as colour.

### Claude's Discretion
- Exact breakpoints, spacing, colours, typography and iconography: leave these to the UI spec from `/gsd:ui-phase 2`. The roadmap marks this phase "UI hint: yes", so run it before planning.
- The exact German wording of every string, within D-25.
- The concrete example and preset values, as long as they are realistic and cover minus, plus and cylinder.
- Thresholds in D-05 (40–50 mm question band) and D-24: the researcher may adjust them with justification.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` § "Phase 2" — goal and success criteria 1–6
- `.planning/REQUIREMENTS.md` — RX-01, RX-04..08, FRAME-02/03, MAT-03..06, RES-01..05, UX-01..05, ANA-01/02 (exact wording, locked)
- `.planning/PROJECT.md` — core value, constraints, key decisions
- `CLAUDE.md` (repo root) — project rules: de-AT only, engine first, lens-critic gate, `references/` must not be published

### Domain research (from project init)
- `.planning/research/FEATURES.md` §1 "Prescription conventions" — paper Rx variants, PD handling, stamp formats, contact-lens hint; D1/D2/D4–D7 differentiators
- `.planning/research/PITFALLS.md` — PD default, Rx parsing pitfalls, toric model notes
- `.planning/research/STACK.md` and `CLAUDE.md` § "i18n String Structure" / "UI Approach" — vanilla light DOM, `t()`, `Intl`, no `type=number`
- `.planning/research/SUMMARY.md` — resolved conflicts
- `.planning/research/ARCHITECTURE.md` — engine/UI separation

### Phase 1 outputs that constrain this phase
- `.planning/phases/01-verified-engine-live-pipeline/01-SKELETON.md` — frozen LensSpec → LensResult contract (add fields only, never rename or remove)
- `.planning/phases/01-verified-engine-live-pipeline/01-VERIFICATION.md` — what phase 1 proved
- `.planning/phases/01-verified-engine-live-pipeline/01-15-SUMMARY.md` — Worker protocol, latest-wins, `#result[data-pending]`, ENG-09 (a)–(d) measurement setup that must not regress
- `.claude/agents/lens-critic.md` — review gate criteria (plan and result)

### Design input (local only, never publish)
- `references/000.png` — dark value-box style (used for the value echo idea only, not sliders)
- `references/00_brillengroesse.png` — frame-size and temple-stamp guide (content idea for "Wo finde ich das?"; draw our own SVG)
- `references/01-brille.png` — frame photos (shape-card inspiration)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/state/parse.js` (`parseDiopter`, `parseAxis`, `parseMm`): tested paper-style parsing; extend it for PD `32/33`, binocular split and the stamp parser.
- `src/state/transpose.js`: plus→minus cyl transposition, both forms shown (RX-03 done).
- `src/state/compute-client.js` + `src/worker/engine.worker.js` + `compute-protocol.js`: per-eye latest-wins worker pipeline with sync fallback and watchdog. Extend it for comparison jobs (material rows, config A/B) without breaking main-result priority.
- `src/state/frame-scheduler.js`: paint-frame batching.
- `src/engine/evaluate.js` (`evaluateLens`, `evaluatePair`): the spec already supports `baseCurve` (manual), `minCT`, `minET`, `fittingHeight`; `surfaces.k1` exists. Custom material and rim depth need new optional spec fields.
- `src/engine/frame/outline.js` (`frameOutline`) + `shapes.js` (`SHAPES`): reuse for shape-card SVG thumbnails and the cross-section outline extent.
- `src/engine/materials.js`: per-material ne, density, νe, minCT, minET with citations; source for D-14/D-34 defaults.
- `src/i18n/de-AT.js`, `t.js`, `format.js` (`fmtDiopter`, `fmtMm`, `fmtGram`, …): all strings and number formatting.
- `src/ui/main.js`: `readField` / `showFieldOk` / `showFieldError` echo+error pattern, `renderDiagnostics`, `setStale`, `baseCurveText` (moves to Expert view).

### Established Patterns
- All visible text via `t()` and `textContent` only (no innerHTML); `data-i18n` attributes in `index.html`.
- Field echo (`<output>`) and error (`<p class="error" aria-live="polite">`) linked through `aria-describedby`.
- Engine is pure JS, enforced by ESLint and `src/engine/boundary.test.js`; every number comes from the engine.
- Dictionary tests (`src/i18n/dictionary.test.js`) check key sets; add the "no Stärke" check here (D-25).
- `main.js` is 709 lines. The planner should split UI modules (rx-input, frame, material, results, compare, expert, toggletip) instead of growing one file.

### Integration Points
- `index.html` is static markup filled by `applyDictionary()`; the phase-2 restructure replaces most of `<main>` but keeps `#result[data-pending]`, `#tech`, `#disclaimer` and `#app-commit` (used by e2e and ENG-09 tooling).
- Existing e2e specs (`e2e/smoke.spec.js`, `worker.spec.js`, `perf-throttled.spec.js`) use current element ids. Update them deliberately, not by accident.
- CI (`.github/workflows/deploy.yml`) already runs Playwright; add axe checks there.

</code_context>

<specifics>
## Specific Ideas

- The user's standing direction is "use best practices, it must be as easy as possible to use" (PROJECT.md key decisions, and this discussion).
- The material comparison answers the core-value question ("does a higher index help?") without any extra click.
- The temple stamp is the lay user's easiest route to real frame data; promote it above raw A/B/DBL.

</specifics>

<deferred>
## Deferred Ideas

- Persisting inputs or the Expert toggle (localStorage, opt-in): v2 together with SHARE-01. This avoids storing health-adjacent data on the shared `ainxtgendev.github.io` origin without consent.
- Fitting-height input in the UI: the engine supports it, but no phase-2 requirement asks for it (phase-1 D-04 omitted it). Backlog.
- "Was würde helfen?" ranked levers (INS-01), tangible size references (INS-05), "Rechenweg anzeigen" (INS-04), 360° edge chart (INS-03): v2.
- More than two configurations in the desktop comparison: not in v1.

</deferred>

---

*Phase: 02-lay-first-german-input-results-comparison*
*Context gathered: 2026-11-07*
