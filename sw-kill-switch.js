// The ONE kill-switch flag (D-24, orchestrator decision 2, lens-critic M1) and the ONE
// effective-flag expression (round-2 NEW-1). vite.config.js computes swKillEffective(<Node env>)
// once and feeds it to selfDestroying and to define __SW_KILL__ (read by src/ui/update.js from
// 04-14: no registration while on); test/dist/pwa-build.test.js and e2e/pwa.spec.js call
// swKillEffective(<Node env>) to decide which assertions apply. This file names no runtime
// global on purpose, so it stays environment-neutral; callers pass the env object in. SW_KILL_REHEARSAL=1 is for local
// test builds only (dist-kill, 04-14) and is never set in CI. See the KILL SWITCH comment in
// vite.config.js before changing it; pushing a change is outward-facing and needs explicit approval.

export const SW_SELF_DESTROY = false;

export function swKillEffective(env = {}) {
  return SW_SELF_DESTROY || env.SW_KILL_REHEARSAL === '1';
}
