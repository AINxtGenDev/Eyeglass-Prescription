<div align="center">

# 👓 Eyeglass Prescription

### 3D-Brillenglas-Simulator · *How thick and heavy will my lenses be?*

[![Deploy](https://github.com/AINxtGenDev/Eyeglass-Prescription/actions/workflows/deploy.yml/badge.svg)](https://github.com/AINxtGenDev/Eyeglass-Prescription/actions/workflows/deploy.yml)
![Sprache](https://img.shields.io/badge/Sprache-Deutsch%20(de--AT)-red?style=flat-square&logo=googletranslate&logoColor=white)
![Node](https://img.shields.io/badge/Node-22-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=flat-square&logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-5.1-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-1.65-2EAD33?style=flat-square&logo=playwright&logoColor=white)
![WCAG](https://img.shields.io/badge/WCAG-2.2%20AA-0b57d0?style=flat-square&logo=accessibility&logoColor=white)
![No backend](https://img.shields.io/badge/Backend-none-lightgrey?style=flat-square&logo=githubpages&logoColor=white)

**[🌐 Open the website](https://ainxtgendev.github.io/Eyeglass-Prescription/)** · [🗺️ Roadmap](.planning/ROADMAP.md) · [📋 Requirements](.planning/REQUIREMENTS.md) · [📓 Session log](session.md)

</div>

---

## ✨ What it does

Type in your paper prescription (Brillenrezept), pick a frame and a material, and the page **computes** the lens geometry per eye:

| | |
|---|---|
| 📏 **Thickness** | thickest and thinnest point with location, centre thickness, edge thickness |
| ⚖️ **Weight** | per lens, from volume × sourced material density |
| 🔍 **Comparison** | "Was bringt ein anderes Material?" in mm and g, plus a Vorher/Nachher comparison of two frame/material choices |
| 🧑‍🔬 **Experten-Ansicht** | base curve (auto or manual), minimum thicknesses, aspheric front, own material, decentration, intermediate values and a 2D cross-section |

It is built first for 🧑 **lay people** holding a paper prescription, and second for 👩‍⚕️ **opticians and optometry students** who want exact numbers.

> [!IMPORTANT]
> ⚠️ Educational visualization only, **not a substitute for an optician**. The page names its main simplifications.

---

## 🚦 Status

| Phase | | What |
|---|:---:|---|
| 1️⃣ Verified engine & live pipeline | ✅ | Optics engine with tiered tests, gated GitHub Pages deploy, minimal German page, checked on a real phone |
| 2️⃣ Lay-first input, results & comparison | ✅ | German Rx entry, frame and material choice, plain-language results, mm/g comparison, Experten-Ansicht with cross-section; live and checked on a Pixel 7 Pro |
| 3️⃣ 3D lenses & frame | ✅ | Procedural lens meshes, parametric frame, thickness heatmap (Dickenkarte), A/B side by side, phone-bar thumbnail, fullscreen; complete 2026-11-11, checked on a Pixel 7 Pro and desktop; tablet landscape layout fixed in dev-1.6, Dickenkarte shows both lenses since dev-1.7 (2026-11-12) |
| 4️⃣ Refraction view & offline | ⏳ | Ray-traced "Durchblick" through the real lens surfaces, offline support; in progress (10 of 15 plans built and tested locally 2026-11-13, not yet live) |

---

## 🧾 Features

### 📝 Prescription entry
- 🗒️ Table laid out like the paper Rx: **R / L × Sph, Zyl, Achse, PD**
- 🔢 Accepts `-2,25`, `−2.25`, `+1`, `plan`, `2,5 dpt`, `90°` — never `parseFloat`
- 🔄 Plus-cylinder is converted to minus-cylinder, both forms shown
- 💬 Three message levels: **Fehler**, **Hinweis** ("Meinten Sie −2,25?"), **außerhalb des Modells** — values are never silently clamped
- 👁️ PD as `32/33`, `64` (split) or `32,5`; missing PD uses a stated default
- ➕/➖ "±" button for phones whose decimal keypad has no minus key
- 🔗 "Gleich für beide Augen", one-tap presets, and an explanation of other values on the paper (Add, Prisma, HSA)

### 🕶️ Frame
- 🟠 Shapes **Rund, Rechteckig, Panto, Pilot** as visual cards
- 🏷️ Temple stamp like `52□18 140` fills width and bridge, with a "Wo finde ich das?" drawing

### 🧪 Materials
- **CR-39 1,50 · Trivex 1,53 · Polycarbonat 1,59 · 1,60 · 1,67 · 1,74**, each with sourced index, density and Abbe number
- 🧩 Own material in the Experten-Ansicht, clearly labelled as user-supplied

### 🔬 Optics engine (pure JavaScript, no DOM)
- 📐 Each surface uses its own power; thick-lens back surface; back-vertex power round trip within 0,01 dpt
- 🍩 True toric back surface for cylinder, TABO axis convention
- ↔️ Decentration `(A + DBL)/2 − mono PD`, nasal; left and right lens computed separately
- 🧮 Centre thickness solved from minimum centre/edge thickness over the real frame outline
- ✅ Validated by analytic cases, Zeiss thickness charts, a ray-trace oracle and property tests

### ♿ Accessibility & 🇦🇹 language
- ⌨️ Fully keyboard operable, every term explained by tap or keyboard
- 🎨 WCAG 2.2 AA checked with axe in CI; no information by colour alone
- 📱 Works from 320 px width to desktop
- 🇦🇹 German with Austrian conventions (`lang="de-AT"`, comma decimals), all text from one dictionary

---

## 🛠️ Tech

```text
HTML + CSS + JavaScript (ES modules)   →  vanilla light DOM, no framework
Optics engine                          →  pure JS in a Web Worker, single source of truth for every number
Build / unit tests                     →  Vite 8 · Vitest 5 · fast-check
Browser tests                          →  Playwright 1.65 · axe-core
Deploy                                 →  GitHub Actions → GitHub Pages (failing tests block the deploy)
3D (phase 3)                           →  Three.js
```

### 🚀 Run locally

```bash
npm ci
npm run dev          # dev server
npm test             # unit tests
npm run build && npm run test:e2e   # browser tests against the built site
```

---

## 📚 Project docs

| | |
|---|---|
| 💡 [`idea.md`](idea.md) | corrected specification |
| 🎯 [`.planning/PROJECT.md`](.planning/PROJECT.md) | project context and decisions |
| 📋 [`.planning/REQUIREMENTS.md`](.planning/REQUIREMENTS.md) | v1 requirements and traceability |
| 🗺️ [`.planning/ROADMAP.md`](.planning/ROADMAP.md) | phases and plans |
| 🔎 [`.planning/research/`](.planning/research/) | research: stack, features, architecture, pitfalls |
| 📓 [`session.md`](session.md) | session log |

<div align="center">

🤖 Planned with [GSD](https://github.com/gsd-build/get-shit-done) · every phase reviewed by the `lens-critic` agent

</div>
