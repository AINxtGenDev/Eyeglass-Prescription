// Degradation guard (04-05, REF-02, F-06 m5, D-16; RESEARCH Pattern 6). Pure: no clock, no
// globals. The caller measures each sample and decides which samples are COUNTED (UI-SPEC
// "Degradation": superseded or cancelled jobs, warm-up jobs, redraws without a new trace and
// samples while the page was hidden are simply not passed in, so they neither count nor reset).
//
// Rule: `need` counted samples in a row over `budgetMs` → one tier down; a sample within budget
// (ms ≤ budgetMs) resets the run. At the `last` tier there is no further step and stillSlow
// becomes true. Stepping is one-way per session: the guard never steps back up (no oscillation).
//
// Budgets:
// - Durchblick (default): 200 ms, the INP "good" threshold (https://web.dev/articles/inp), the
//   same budget as phase-3 D-28.
// - Thumbnail (phase-3 view.js): 50 ms, the long-task threshold (W3C Long Tasks API,
//   https://www.w3.org/TR/longtasks-1/: "Long task refers to any of the following occurrences
//   whose duration exceeds 50ms"), with a two-tier order on → off.

const REF_ORDER = ['fein', 'mittel', 'grob'];
const refDown = (tier) => REF_ORDER[REF_ORDER.indexOf(tier) + 1];

/**
 * @param {string} tier the start tier
 * @returns {{ tier: string, run: number, stillSlow: boolean, stepped: boolean }}
 */
export const initGuard = (tier) => ({ tier, run: 0, stillSlow: false, stepped: false });

/**
 * @param {{ tier: string, run: number, stillSlow: boolean, stepped: boolean }} g current state (not mutated)
 * @param {number} ms one counted sample
 * @param {{ budgetMs?: number, need?: number, last?: string, down?: (tier: string) => string }} [opts]
 * @returns {{ tier: string, run: number, stillSlow: boolean, stepped: boolean }} a new state
 */
export function nextGuard(g, ms, { budgetMs = 200, need = 2, last = 'grob', down = refDown } = {}) {
  if (ms <= budgetMs) return { ...g, run: 0 };
  const run = g.run + 1;
  if (run < need) return { ...g, run };
  if (g.tier === last) return { ...g, run: 0, stillSlow: true };
  return { tier: down(g.tier), run: 0, stillSlow: false, stepped: true };
}
