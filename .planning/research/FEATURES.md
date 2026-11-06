# Feature Research

**Domain:** Browser-based spectacle-lens thickness calculator + 3D lens/frame visualizer (lay-first, expert-capable)
**Researched:** 2026-11-06
**Confidence:** MEDIUM. Competitor feature sets come from vendor pages, app-store listings and retailer guides. No competitor was used hands-on. Prescription conventions are confirmed by several DACH/EN sources. The lay-user needs listed here are my own synthesis and have not been tested with real users.

---

## 0. What the landscape actually looks like (evidence summary)

Five groups of products exist. None of them covers the whole target of this project.

| Category | Examples | What they do | Gap vs. this project |
|---|---|---|---|
| **Optician/lab calculators (web, 2D)** | Chadwick Optical lens-thickness calculator | Sph/Cyl/Axis, eyesize, bridge, effective diameter (ED), PD, min thickness, base curve and index as inputs. Outputs min/max edge of the uncut blank, nasal/temporal edge on the horizontal meridian, and an "axis inspector" (thickness at any angle and distance). | Expert-only jargon (ED, uncut blank). No 3D. No lay explanations. No comparison. |
| **Retailer/optician "thickness simulators" (web)** | visio-net (UK) simulator; Zenni/EyeBuyDirect/Warby Parker index charts | Sph + Cyl + lens size, compared across 1.50/1.60/1.67/1.74. Mostly a **power-band → index recommendation table**. Results are "indicative only." | No frame shape, no decentration, no real geometry. The recommendation bands disagree with each other (see below). |
| **Consumer apps (iOS)** | Lens Thickness by GlassifyMe ($6.99), Visall LensGuide, POL Guide | Rx + approximate or real frame size, compares materials/indexes, life-size view on a face model, mm readout, auto base curve, share result. | Paid, iOS-only. 3.8★ from 11 ratings, with complaints about inaccurate and unspecified materials. No cross-section and no formula transparency. |
| **Manufacturer/POS consultation tools** | ZEISS VISUCONSULT 100 (material/index thickness & weight demo), HOYA Digital Fitting App (thickness in frame shapes, iPad Pro LiDAR), FittingBox Optical Fit Pro (3D thickness simulation in selected frame, on face) | 3D thickness in a real frame, at the point of sale, run by the optician. | Not available to lay users. Closed and tied to hardware or a store. Numbers are not explained. |
| **Calculator snippets / content sites** | Optica-App, FreeToolsHub, EveryCalculators, many SEO clones | Sagitta formula on one diameter. Edge = sag + min CT. | Ignore cylinder, frame shape and decentration. Optica-App itself says it "does not take into account the curvature of the lens." |

**Takeaway:** competitors fall into two groups. Lay tools are simple but inaccurate: power bands and percentages. Accurate tools are expert-only, either 2D lab calculators or closed POS apps. Nothing free, browser-based and transparent combines **(a) paper-Rx-shaped input, (b) a real per-point geometry engine with frame shape and decentration, and (c) a plain-language comparison**. That combination is where this project can differentiate. HIGH confidence that the gap exists among public, findable tools. MEDIUM confidence that no tool fills it, since "didn't find" does not prove "doesn't exist."

**Evidence that lay users need absolute numbers, not percentages:** published "X % thinner" claims contradict each other. Zenni says 1.67 is "up to 30 % thinner than 1.50". Other guides give 20/33/42 % for 1.6/1.67/1.74, or "~33 %" for 1.74. One source says the 1.67 vs 1.74 difference at −6.00 is "typically < 0.5 mm". Index-recommendation bands also conflict: Warby Parker puts 1.67 at ±4–8; EyeBuyDirect at ±7–9. A tool that shows *the user's own* mm and grams for *their* frame resolves exactly this confusion. That is the core differentiator.

---

## 1. Prescription conventions the input must handle (DACH + international)

This is a hard requirement, not polish: if the paper does not match the form, a lay user is stuck.

| What appears on paper | Variants seen | Required handling | Source / confidence |
|---|---|---|---|
| Eye labels | `R` / `L`, `RA` / `LA` (rechtes/linkes Auge), `OD` / `OS`, `OU` (both) | Row labels show both, e.g. "Right eye (R / OD)". Add an "OU / same both eyes" sync. | dr-gumpert.de, gelbeseiten.de, cubitts.com. HIGH |
| Sphere | `Sph`, `S`. Values like `+2,75 dpt`, `-1,50`, `−2.25` (Unicode minus), `+1`, `0`, `plan`/`PL`/`Plano` | Accept comma and point decimals, Unicode minus, a trailing `dpt`/`D`, and `pl`/`plan`/`plano` = 0. Values not on a 0.25 step trigger a gentle warning: "Prescriptions are normally in 0.25 steps. Did you mean −2,25?" | dr-gumpert.de (comma, 0.25 steps). HIGH |
| Cylinder | `Cyl`, `Zyl`, `Z`. **Either sign.** DE sources name plus-cylinder notation "DIN-Schreibweise" | **Plus-cyl must be accepted and transposed in v1, not "optional".** Sphere + cyl, flip the sign, axis ±90. Show the transposed form ("We converted this to the equivalent −cyl form: …"). Blank cyl = 0. | flexikon.doccheck.com (Plus-Zylinder = DIN-Schreibweise; example +2,50 −1,50 105° ⇔ +1,00 +1,50 15°). MEDIUM. I could not confirm how often Austrian ophthalmologists actually write plus-cyl. |
| Axis | `A`, `Ach`, `Achse`, `Axis`, `×`. Range 0–180°, sometimes 1–180, with or without `°` | Strip `°`. Treat 0 and 180 as the same. Cyl without axis → friendly error. Axis without cyl → ignore with a note. | allaboutvision.com/de, dr-gumpert.de. HIGH |
| PD | Single binocular value (`PD 64`) **or** monocular `32/33` (R/L). Often **missing**: ophthalmologists' prescriptions frequently have no PD, because the optician measures it | Accept `64` (split into 32/32 with a note), `32/33`, or `32,5`. If PD is missing, use a realistic default (e.g. 32/32 mm) and **say so in the result**: "PD assumed: 32 mm per eye. Ask your optician for yours." | gelbeseiten.de (64 vs 32/33), dr-gumpert.de, timroot.com. MEDIUM |
| Fields out of scope in v1 | `Add` (near addition), `Prisma`/`P` + `Basis`/`B` (oben/unten/innen/außen or degrees), `F`/`N` (Ferne/Nähe), `HSA` (vertex distance), `EP`/`H` (fitting height) | Collapsed "My prescription has more values (Add, Prisma, HSA…)" section that explains each. It states that Add and prism are not modelled (the distance lens is still shown) and that HSA does not change thickness. **Never silently drop them.** | dr-gumpert.de. HIGH |
| Wrong document | Contact-lens Rx has `BC` / `DIA` / `Radius` columns | If the user types `BC` or `DIA`, or values like 8,6 / 14,2 land in the wrong field, show a hint: "This looks like a contact-lens prescription; glasses values differ." | Domain knowledge. LOW. Validate in UX testing. |
| Frame size | Stamped on the inside of the temple: `52□18 140` (lens width □ bridge, temple length) | "Where do I find this?" helper with an illustration. Accept a paste of `52□18 140`, `52-18-140` or `52 18 140` and parse A and DBL from it. Temple length is ignored for optics. **Lens height B is not stamped**, so it must default from the shape preset. | allaboutvision.com, warbyparker.com. HIGH |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Lay users leave if any of these are missing or confusing. Experts dismiss the tool if the numbers are not credible.

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| T1 | **Paper-shaped Rx table** (R/L rows × SPH, CYL, AXIS, PD columns) | Every Rx and Brillenpass uses this layout. Users copy it cell by cell. | LOW | Bilingual column hints (SPH/Sph, CYL/Zyl, AXIS/Achse). Tab order goes row by row, the way people read the paper. |
| T2 | **Tolerant number parsing** (comma/point, Unicode minus, `+`, `dpt`, `plan`, `°`) | DACH prescriptions use a decimal comma. A form that rejects `-2,25` fails at the first keystroke. | LOW–MED | Use `type="text" inputmode="decimal"`, not `type="number"`: number inputs reject commas in many locales and on mobile. Echo the parsed value back ("−2.25 D"). Unit-test the parser in isolation. |
| T3 | **Plus-cyl → minus-cyl transposition, automatic** | Plus-cyl notation is in DACH use ("DIN-Schreibweise"). A tool that rejects positive cyl blocks those users. | LOW | Transpose, then show both forms. This lives in the engine layer and is unit-tested. |
| T4 | **Friendly, specific validation** that never silently clamps | Opticians and lay users both distrust silent changes. Required by PROJECT.md. | MED | Distinguish three cases: *invalid* (cyl without axis, axis 200), *unusual but possible* (SPH −11, off-0.25 step → warning, still computes), and *outside the model* (SPH −14 → "beyond this tool's range"). Messages sit next to the field and are announced to screen readers through `aria-describedby`. |
| T5 | **One-tap explanations for every term** (SPH, CYL, AXIS, PD, index, base curve, edge/center thickness, DBL, A/B) | Every retailer has a "how to read your prescription" guide, which shows that users need it. Lay users don't know what CYL means. | LOW | Tooltips must work on touch, so tap-to-open popovers rather than hover-only. Keep each to one or two sentences plus an optional "learn more". |
| T6 | **Realistic defaults on first load** | Lets users see a result before typing anything. Every consumer tool starts with an example. | LOW | Mild myopia with low astigmatism, PD 32/32, 52□18 rectangular, CR-39. Clearly labelled "Example — replace with your values." |
| T7 | **Rx presets** (mild/strong nearsighted, farsighted, astigmatism) and **frame presets** (Round, Rectangular, Panto, Aviator with typical A/B/DBL) | Users without a paper Rx at hand, and students, want to explore. | LOW | Choosing a preset must not erase typed values without asking: "Replace your values with the preset?" |
| T8 | **Material choice with index shown** (1.50, 1.59 PC, 1.60, 1.67, 1.74) | The question every user asks is "should I pay for thinner lenses?" Every competitor compares indexes. | LOW | Name and index together ("1.67 high-index"). Densities need cited sources (STACK/PITFALLS researchers). |
| T9 | **Headline result in plain language**: thickest edge (minus) or center (plus) in mm, thinnest point, weight per lens in g | That is the user's question. GlassifyMe added mm readings in v1.1 because users asked for them. | LOW (UI) / HIGH (engine) | A sentence plus numbers, e.g. "Your right lens is about **6.1 mm** thick at its thickest edge (temple side) and weighs about **9 g**." Round sensibly: 0.1 mm, 1 g. No false precision. |
| T10 | **Material comparison with absolute savings** | The key lay insight, per PROJECT.md. Competitors only show percentages, which contradict each other. | MED | Table or bars: material → max edge, center, weight, Δ vs current. "Switching to 1.67 saves 1.7 mm and 2 g." |
| T11 | **Frame-size effect visible** (change A or the shape and see the thickness change) | For minus lenses, frame size and decentration are often the biggest lever (Chadwick, visio-net). Lay users don't know this. | MED | Present it as part of the comparison (T10/D1), not as a separate screen. |
| T12 | **Per-eye results** (R and L separately, with sync) | Real prescriptions often differ between eyes. Users want to know whether the two lenses will look different. | LOW | Show both lenses in 3D and both in the summary. Flag a large R/L difference ("Your left lens will be visibly thicker than the right"). |
| T13 | **3D view with touch rotate/zoom + Front/Side/Top presets** | The visual "how will it look" is the reason to use this rather than a chart. Competitors (FittingBox, Hoya, GlassifyMe) all visualize. | HIGH | The side preset matters most for lay users, because edge thickness and protrusion are seen from the side. |
| T14 | **Phone-first layout**: inputs and 3D both usable without losing the view | Lay users are mostly on phones (PROJECT.md constraint). | MED–HIGH | Pattern: 3D sticky in the top ~40 % with collapsible input sheets below, or a tabbed layout (Rx / Frame / Material) with the result strip always visible. |
| T15 | **Disclaimer + "what this does not include"** | Every competitor states that results are "indicative" or "may vary." Users may act on the numbers. | LOW | Short persistent footer plus a full text. Name the specific simplifications: lab tolerances (ANSI gives about +0.3 mm on CT per one source), the optician's actual base curve and blank choice, and aspheric designs varying by manufacturer. |
| T16 | **Accessibility basics** (keyboard, labels, contrast, no colour-only info) | PROJECT.md requirement and WCAG. | MED | The 3D canvas needs a text equivalent: the numeric summary *is* the accessible alternative. |
| T17 | **Physically impossible / out-of-model detection, explained** | Strong plus in a large frame can give a negative edge or sag beyond the radius. Showing garbage breaks trust. | MED | "This prescription can't be made in a 62 mm frame with these settings; try a smaller frame or a higher index." |

### Expert/Student Table Stakes (Expert view)

Opticians and students expect these. Competitor lab calculators (Chadwick) already offer most of them, so lacking them makes the tool look like a toy to that audience.

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| E1 | **Manual base curve** + displayed auto value with the rule used | Chadwick takes base curve as an input. Base-curve choice affects thickness and protrusion. | LOW | Show "Auto: +4.25 D (Vogel's rule, SE = …)". Rule form still to be verified by STACK/ARCH research. |
| E2 | **Min CT / min ET constraints**, adjustable | Standard lab calculator inputs (Chadwick, Meister 1997). | LOW | Show which constraint is binding ("CT set by min edge 1.2 mm at nasal-superior"). |
| E3 | **Nasal / temporal (and superior / inferior) edge thickness with locations** | Chadwick reports near-edge and far-edge. Decentration makes edges asymmetric. | MED | Comes from the engine. Name the location (nasal/temporal) rather than giving an angle only. |
| E4 | **Thickness at any point** ("axis inspector") | Chadwick offers thickness at any angle and distance. | LOW (given the engine) | Tap or hover on the lens or heatmap to read t(x,y). Keyboard alternative: angle + radius inputs. |
| E5 | **Cross-section of a selectable meridian with dimensions** | Classic textbook figure (Meister: s1, s2, CT, ET). Students learn from it. | MED | 2D SVG/canvas, not Three.js: crisper, accessible, easier to dimension. Default meridians: horizontal, plus the axis and axis+90 (principal meridians) when cyl ≠ 0. |
| E6 | **Thickness heatmap with legend + numeric callouts** | PROJECT.md. FittingBox/Hoya show thickness visually. | MED | Colour-blind-safe sequential map (e.g. viridis/cividis) with labelled iso-lines in mm, so the information does not depend on colour alone. |
| E7 | **Decentration shown explicitly** | Opticians check (A+DBL)/2 − mono PD by habit. | LOW | "Decentration: 3.0 mm nasal per eye." |
| E8 | **Front-surface sag / protrusion** | Explains "lens sticks out of the frame." | LOW | Given in mm beyond the rim's front plane, if rim depth is modelled. |
| E9 | **Abbe number per material** | Experts expect index vs Abbe trade-off. PC/1.74 have low Abbe (chromatic fringes). | LOW | Display only. Gives the lay-friendly warning that "thinnest isn't always best." |

### Differentiators (Competitive Advantage)

These align with the Core Value: correct numbers, presented understandably. Do not differentiate on everything; D1–D5 carry the product.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | **Side-by-side / before-after comparison of two configurations** (material × frame), in both 3D and numbers | No public tool shows *your* lens in *your* frame A vs B. Competitors show tables or POS-only demos. This is the "aha." | MED–HIGH | Two lens instances side by side (or a toggle/slider on phone), the same camera, plus a delta table. Limit to 2 configurations on phone and up to 4 in the desktop table. |
| D2 | **"What would help?" levers summary** | Lay users don't know the levers. Auto-generated, ranked suggestions such as: "Biggest saving: smaller frame (A 52→48: −1.9 mm). Higher index 1.60→1.67: −0.8 mm. A rounder shape reduces the thick temporal corner." | MED | Run the engine on a few what-ifs (index +1 step, A −4 mm, round shape, PD-matched frame) and sort by mm saved. Purely factual, with no product recommendation (see anti-features). |
| D3 | **Real per-point geometry with frame shape + decentration** (vs power-band charts) | All found consumer tools ignore shape and decentration or use one diameter. Correctness is the moat, and it is citable and unit-tested. | HIGH | Already the engine plan. It is a differentiator only if validated against citable examples (PROJECT.md). |
| D4 | **Tangible size references** | "6 mm" means little to a lay person. "About as thick as a pencil (~7 mm)" or a life-size 1:1 side-profile strip does. GlassifyMe users praised seeing it "rather than just a number." | LOW | Use well-known objects only (coin edge, pencil) and label them "approx." A 1:1 on-screen ruler needs a screen-size calibration step (credit-card width), so it is optional. |
| D5 | **"Show the math" panel** (Expert) | For students: R1, R2(θ), sags, CT derivation, decentration, with formula and source citation. No competitor exposes this, and it builds trust with opticians. | MED | Read-only, generated from engine intermediates. This is also a debugging and validation aid. |
| D6 | **Shareable/bookmarkable state via URL hash** (no backend) | Lets a user take their configuration to the optician or compare later. GlassifyMe added sharing on request. Fits static hosting. | LOW | The Rx is health-adjacent data. Keep it in the **hash fragment** (not sent to the server), write it only when the user presses "Share/Save link", and explain this. localStorage persistence is opt-in only. |
| D7 | **Printable / PDF one-page summary** ("take this to your optician") | Lay users want to discuss it with the optician. A printed page in DACH optician culture is natural. | LOW–MED | Print CSS: Rx as entered, assumptions (PD assumed?), comparison table, side profiles, disclaimer. Uses the browser's print dialog, so no PDF library is needed. |
| D8 | **Edge-thickness polar/unrolled chart (360°)** | Shows the whole edge profile, which no consumer tool does. It is the honest answer to "where is it thickest?" with cylinder. | MED | Unrolled 0–360° line chart with labels N/S/T/I. Doubles as the accessible equivalent of the heatmap. |
| D9 | **Refraction impression** (checkerboard / eye chart seen through the lens: minification for minus, magnification for plus) | Explains a real lay concern ("my eyes look small"). Hoya/Zeiss use distortion demos in store. | HIGH | Baseline uses MeshPhysicalMaterial (approximate) and must be labelled "visual impression." An accurate ray-traced mode is a stretch goal. **Not on the critical path for Core Value.** |
| D10 | **Lay-level "Why?" explainers** (short illustrated cards) | "Why are minus lenses thick at the edge?", "Why does my PD matter?", "Why does astigmatism make the edge uneven?" Answers the questions the numbers raise. | LOW–MED | 4–6 cards, each with a small static diagram. Better than a long FAQ. |
| D11 | **Bilingual-ready Rx labels from day one** (EN UI, DE abbreviations recognised) | DACH users see `Sph/Zyl/Achse`, `RA/LA`, `dpt` on paper. Recognising them before full German i18n is a cheap win. | LOW | Labels like "CYL (Zyl)". String table structured for later `de-AT`. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Photo/OCR of the paper Rx** | "Just scan it." Very appealing for lay users. | Handwritten DACH prescriptions, the sign/comma/axis confusion, and silent misreads would put wrong numbers in front of the user. The OCR libraries are heavy for a static phone site. Privacy concerns with health data. | Paper-shaped table (T1) + tolerant parser (T2) + echo-back. Revisit after v1 only with mandatory per-field confirmation. |
| **Webcam PD measurement** | Prescriptions often lack PD. | Accuracy is poor for self-measurement (allaboutvision.com/de). Camera permission and privacy. It is a separate product. | Default PD + "ask your optician" + show how much PD changes the result (sensitivity in D2). |
| **AR/face try-on** | Competitors (FittingBox, Hoya) have it. | Explicitly out of scope. A large separate problem that does not serve the Core Value. | Clean 3D on a neutral head silhouette or none. Side profile does the job. |
| **"Recommended index for you" as an authoritative verdict / brand-product suggestions** | Retailers all do power-band recommendations. | The bands contradict each other (±4–8 vs ±7–9 for 1.67). A verdict implies medical or commercial advice. Index choice also depends on Abbe, impact needs, budget and frame type. | Show facts: mm/g per material plus Abbe, and let the user decide. D2 lists levers by mm saved, not "buy X". |
| **Price estimates** | "Is 1.74 worth the money?" | Prices vary by country, optician, coating and brand. Unmaintainable, and it makes the tool look commercial. | Leave out. The comparison shows the physical benefit; the user asks the optician for prices. |
| **Percent-only results ("33 % thinner")** | That's how marketing talks. | Percentages from different sources conflict, hide the absolute difference, and depend on Rx and frame. | Absolute mm and g with an optional "(−28 %)" next to them. |
| **Progressive/bifocal, prism, coatings, tints** | People with Add/prism on their Rx will ask. | Out of scope (PROJECT.md). Modelling them badly is worse than not modelling them. | Recognise the fields (Section 1) and explain clearly that the distance single-vision lens is shown. |
| **Accounts, server saving, analytics on entered Rx** | "Save my glasses." | No backend by design. Sending Rx data anywhere creates GDPR/health-data obligations. | URL-hash share (D6), opt-in localStorage, no third-party trackers. |
| **Excessive precision (0.01 mm, 0.1 g)** | Experts like digits. | False precision. Lab tolerances are ±0.3 mm on CT per one cited source. Lay users read it as exactness. | 0.1 mm / 1 g in Simple view. Expert view may show 0.01 mm explicitly labelled as "model value." |
| **Fully free-form frame drawing / DXF import** | Opticians have exact tracer data (OMA files). | High complexity. Tracer formats are a niche. Distracts from the v1 Core Value. | Parametric shapes + A/B/DBL. OMA/tracer import is a v2+ idea for opticians. |
| **Hover-only tooltips, `type=number` inputs** | Default web patterns. | They break on touch and with comma decimals respectively. | Tap popovers; `inputmode="decimal"` text inputs with a custom parser. |

---

## Feature Dependencies

```
[Rx parser + validation (T2,T3,T4)]
    └──requires──> nothing (pure function; build & test first)

[Optics engine: meridian power, sags, toric back, CT solve, decentration, metrics]
    └──requires──> [Rx parser]  (normalised minus-cyl Rx in)
    └──requires──> [Frame outline model (shapes × A/B/DBL)]
    └──requires──> [Material table with cited n, density, Abbe]

[Headline summary T9] ──requires──> [Engine metrics]
[Material comparison T10] ──requires──> [Engine] (run N times; must be fast)
[Side-by-side D1] ──requires──> [T10] + [3D lens mesh]
[Levers "What would help?" D2] ──requires──> [Engine perf for ~5 what-ifs per input change]
[Show the math D5] ──requires──> [Engine exposes intermediates, not only results]

[3D lens mesh T13] ──requires──> [Engine t(x,y) sampling API]
    [Heatmap E6] ──requires──> [3D mesh] + [Engine t(x,y)]
    [Refraction impression D9] ──requires──> [3D mesh]   (stretch; not on critical path)
[Cross-section E5] ──requires──> [Engine sag per meridian]  (2D, independent of Three.js)
[Edge chart D8]   ──requires──> [Engine edge profile]       (2D, independent of Three.js)

[Simple/Expert toggle] ──enhances──> everything (gate E1–E9, D5)
[URL-hash share D6] ──requires──> [Serialisable app state]
[Print summary D7] ──requires──> [T9, T10, cross-section/side profile as SVG]

[Tooltips T5, Why-cards D10] ──independent──> (content work; parallelisable)
[D9 accurate ray-traced refraction] ──conflicts──> [T14 phone performance] (must be optional/off by default on mobile)
[Presets T7] ──conflicts (UX)──> [typed user values]  (needs confirm-before-replace)
```

### Dependency Notes

- **Parser before engine before UI:** the parser and engine are pure JS and testable without a DOM, so they can be validated first against textbook and manufacturer examples. Every lay-facing number depends on them.
- **Comparison (T10/D1) and levers (D2) multiply engine calls.** They set the real performance budget: several full evaluations per keystroke, not one. Plan a fast "metrics-only" engine path (outline sampling plus integration) separate from full mesh generation.
- **2D views (cross-section, edge chart) do not need Three.js.** Building them early in SVG gives experts and screen-reader users value before the 3D work is finished, and they serve as a visual check of the engine.
- **Engine must expose intermediates (R1, R2(θ), sags, binding constraint) for D5 and E2.** Design that API up front. Retrofitting it is churn.
- **D9 accurate refraction conflicts with phone performance.** Keep it optional and never block the Core Value on it.

---

## MVP Definition

### Launch With (v1)

- [ ] T1–T4 Paper-shaped Rx table, tolerant parser, plus-cyl transposition, friendly validation. Without these, lay users cannot get in.
- [ ] Missing-PD handling (binocular split, default, stated assumption). Very common on ophthalmologist prescriptions.
- [ ] Frame presets + A/B/DBL, with the "read it off your temple (52□18)" helper. Lay users don't know their A/DBL otherwise.
- [ ] T8 materials with cited data, T9 headline summary, T10 material comparison in absolute mm/g. This is the Core Value.
- [ ] T11 frame-size effect inside the comparison. It is the largest lever for minus lenses.
- [ ] T12 per-eye results, T17 impossible-lens detection. Correctness and trust.
- [ ] T13/T14 3D view with Side preset, phone-first layout. Visual payoff on the main device.
- [ ] T5 tooltips, T6/T7 defaults and presets, T15 disclaimer, T16 accessibility basics.
- [ ] Expert view: E1, E2, E3, E5 (cross-section), E6 (heatmap with legend), E7. Credibility with opticians and students.
- [ ] D1 side-by-side (at least a before/after toggle on phone). The key insight per PROJECT.md.

### Add After Validation (v1.x)

- [ ] D2 "What would help?" levers. Add once engine performance for multiple what-ifs is proven.
- [ ] D8 360° edge chart, E4 point inspector, D5 show-the-math. Add when expert users engage.
- [ ] D6 URL-hash share, D7 print summary. Add when users ask to take results to an optician.
- [ ] D4 tangible references and D10 why-cards. Add after first lay-user testing shows which concepts confuse.
- [ ] D9 baseline refraction impression (MeshPhysicalMaterial), clearly labelled approximate.
- [ ] German UI (`de-AT`), since the strings are already structured.

### Future Consideration (v2+)

- [ ] Accurate ray-traced refraction mode. Mobile feasibility is unproven.
- [ ] Tracer/OMA frame import. Optician niche.
- [ ] OCR of the Rx, only with mandatory per-field confirmation.
- [ ] Progressive/prism modelling. A separate, hard optics problem.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| T1–T4 Rx entry, parsing, transposition, validation | HIGH | LOW–MED | P1 |
| PD missing / binocular handling | HIGH | LOW | P1 |
| Frame presets + temple-stamp helper | HIGH | LOW | P1 |
| T9 Headline plain-language summary | HIGH | LOW (UI) | P1 |
| T10/T11 Material + frame comparison (absolute) | HIGH | MED | P1 |
| D3 Real per-point geometry engine | HIGH | HIGH | P1 |
| T13/T14 3D view, Side preset, phone layout | HIGH | HIGH | P1 |
| T5/T6/T7/T15/T16/T17 | HIGH | LOW–MED | P1 |
| E1–E3, E5–E7 Expert core | MED | MED | P1 |
| D1 Side-by-side 3D | HIGH | MED–HIGH | P1 (toggle) / P2 (full split view) |
| D2 Levers summary | HIGH | MED | P2 |
| D8 Edge chart, E4 inspector, D5 math | MED | LOW–MED | P2 |
| D6 Share link, D7 Print | MED | LOW | P2 |
| D4 Tangible refs, D10 Why-cards | MED | LOW | P2 |
| E8 Protrusion, E9 Abbe | MED | LOW | P2 |
| D9 Refraction baseline | MED | MED | P2 |
| D9 Accurate ray-traced refraction | LOW–MED | HIGH | P3 |
| German UI | MED (DACH) | LOW–MED | P2 |

---

## Competitor Feature Analysis

| Feature | Chadwick Optical calculator | visio-net simulator / retailer charts | GlassifyMe iOS app | Zeiss VISUCONSULT / Hoya Digital Fitting / FittingBox OFP | Our Approach |
|---------|------|------|------|------|------|
| Rx input incl. cyl/axis | Yes | Sph + Cyl (no axis noted) | Yes | Yes (optician enters) | Paper-shaped R/L table, DACH notation, ± cyl |
| Frame shape | Eyesize + ED (no shape) | Lens size only | Actual or approximate size | Real frame (catalog/photo) | Parametric shapes × A/B/DBL |
| Decentration / PD | Yes (near/far edge) | Not described | PD (separate app) | Yes | Yes, nasal/temporal/sup/inf |
| Base curve | Manual input | No | Auto | Internal | Auto (cited rule) + manual (Expert) |
| Material comparison | One at a time | 4 indexes compared | Compare indexes | Yes (Zeiss: thickness & weight) | Absolute mm + g deltas, side by side |
| Weight | Not listed | No | Not listed | Zeiss: yes | Yes (cited densities) |
| 3D | No | No | Life-size face model | Yes (on frame/face) | Three.js lens + frame, Side/Top presets |
| Cross-section / profile | No | No | No | Unknown | Yes, dimensioned, selectable meridian |
| Heatmap / full edge profile | Axis inspector (point query) | No | No | Unknown | Heatmap + 360° edge chart |
| Lay explanations | Short prose | Short prose | Step-by-step help | Optician explains | Tap tooltips, why-cards, plain summary |
| Formula transparency | No formulas shown | "≈1/n" stated | No | No | "Show the math" with citations |
| Access | Free web | Free web | $6.99, iOS | B2B / in-store | Free, static web, offline, any device |

---

## Sources

- Chadwick Optical lens-thickness calculator (inputs and outputs, axis inspector): https://chadwickoptical.com/resources/optical-calculators/lens-thickness/. Fetched 2026-11-06. MEDIUM (feature description only, formulas not shown)
- visio-net thickness simulator article: https://visio-net.com/services/choosing-lenses/calculate-lens-thickness and https://www.visio-net.co.uk/services/choosing-lenses/lens-indexes-and-thickness. MEDIUM
- Lens Thickness by GlassifyMe (App Store listing, reviews): https://apps.apple.com/us/app/id1103943577. MEDIUM
- Visall LensGuide / POL Guide / Optica-App listings, via app-store aggregators: https://appshunter.io/ios/app/visall-lensguide/id949595268, https://mwm.ai/apps/pol-guide/927969758, https://apps.apple.com/in/app/optica-app/id930867575. LOW–MEDIUM
- ZEISS VISUCONSULT 100 update (thickness & weight by material/index), AOP 2018: https://www.aop.org.uk/ot/news/2018/11/20/zeiss-launches-vr-app-and-updates-visuconsult-100. MEDIUM (dated)
- HOYA Digital Fitting App (thickness in frame shapes, iPad LiDAR), mivision 2024: https://mivision.com.au/2024/06/hoya-launches-digital-fitting-app/. MEDIUM
- HOYA Vision Simulator 2015: https://www.ots.at/presseaussendung/OTE_20150921_OTE0002/hoya-brings-highly-accurate-3d-vision-simulation-to-stores. MEDIUM (dated)
- FittingBox Optical Fit Pro (3D lens thickness in selected frame): https://fittingbox.com/en/optical-fit/optical-fit-pro/demo. MEDIUM
- Darryl Meister, "Methods for Estimating Lens Thickness", Optical World 26(201), 1997: https://www.laramyk.com/wp-content/uploads/2010/05/methods.pdf. HIGH (sag/thickness method; what opticians compute)
- Index recommendation bands: Zenni https://www.zennioptical.com/blog/high-index-lenses-1-61-vs-1-67-vs-1-74 ; Warby Parker https://www.warbyparker.com/learn/what-are-high-index-lenses ; EyeBuyDirect https://eyebuydirect.ca/prescription-lens/lens-index. MEDIUM (they contradict each other, which is the point)
- Thinness-percentage and tolerance claims: https://www.zenottic.com/en-gb/blogs/eyewear-style-guide/1-67-vs-1-74-high-index-lenses-comparison-guide , https://support.rx-safety.com/hc/en-us/articles/17524812811283 . LOW (single sources, inconsistent)
- German Brillenpass fields (R/L, Sph, Cyl, A, P/B, Add, F/N, HSA, PD, EP, decimal comma): https://www.dr-gumpert.de/html/brillenpass.html ; https://www.gelbeseiten.de/ratgeber/gl/diese-werte-stehen-auf-dem-brillenpass ; https://www.allaboutvision.com/de/brillen/brillenglaeser/brillenpass. MEDIUM–HIGH (consistent across sources)
- Plus-cyl "DIN-Schreibweise" and transposition example: https://flexikon.doccheck.com/de/Brillenglas. MEDIUM
- PD often missing from prescriptions / measured by optician: https://www.dr-gumpert.de/html/pupillendistanz.html ; https://timroot.com/pupillary-distance/ ; https://www.allaboutvision.com/de/augenuntersuchung/messung-des-pupillenabstands. MEDIUM
- Frame temple stamp (52□18 140): https://www.allaboutvision.com/eyeglasses/faq/eyeglass-frame-size.htm ; https://www.warbyparker.com/learn/eyeglass-frame-sizes-explained. HIGH
- English Rx reading guide (OD/OS/OU, Plano): https://cubitts.com/pages/how-to-read-your-glasses-prescription. MEDIUM

**Not verified / gaps:**
- No official Austrian prescription form (Brillenverordnung template, ÖGK) was found. It is unknown how often Austrian ophthalmologists use plus-cyl or omit PD. Mitigation: support all variants.
- No hands-on use of any competitor; their features are taken from vendor descriptions.
- No user testing. The lay-user needs (D2, D4, D10) are hypotheses to validate.

---
*Feature research for: spectacle-lens thickness calculator and 3D lens/frame visualizer*
*Researched: 2026-11-06*
