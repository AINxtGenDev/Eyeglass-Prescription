# Phase 2: Lay-First German Input, Results & Comparison - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-07
**Phase:** 02-lay-first-german-input-results-comparison
**Areas discussed:** none individually. The user delegated all areas to best practice.

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Rx entry style | Text-field table vs sliders (ref 000.png) vs both; 320 px fit | |
| Page flow on phone | Single scroll + sticky summary vs step wizard | |
| Comparison model | How config B is created; material table visibility; phone toggle | |
| Result wording | Sentence vs cards; location words; L/R difference threshold | |

**User's choice (free text):** "use best practices easy to use"
**Notes:** Interpreted as delegating every gray area to Claude, with ease of use for lay users as the deciding criterion. This matches the memory `best-practice-default`.

## Claude's Discretion

All decisions D-01..D-39 in 02-CONTEXT.md. The ones most worth a second look in the UI spec or plan review:

- **Text fields, not sliders (D-01).** Sliders are imprecise for 0,25 steps, poor for accessibility, and don't mirror the paper Rx.
- **Single page with a sticky phone summary bar (D-18–D-20), not a wizard.** This keeps cause and effect visible.
- **Material comparison always visible, deltas relative to the selected material (D-15).**
- **Rx shared between configurations A and B; only frame and material are compared (D-28).**
- **L/R callout thresholds of 1,0 mm or 3 g (D-24).** These are design constants that research needs to justify.

## Deferred Ideas

- Persisting inputs or the Expert toggle: v2 with SHARE-01.
- Fitting-height UI: backlog.
- INS-01/03/04/05: v2.
- More than 2 desktop configurations: not in v1.
