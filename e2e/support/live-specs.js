// Hook-free specs that run against the production dist and the live site (orchestrator decision 5).
// Never add a spec that uses window.__eyeglassView or backgroundProbe (test/ci/live-subset.test.js).
export const LIVE_SPECS = Object.freeze([
  'smoke.spec.js',
  'rx.spec.js',
  'results.spec.js',
  'frame.spec.js',
  'presets.spec.js',
  'compare.spec.js',
  'expert.spec.js',
  'xsec.spec.js',
  // 04-08 (lens-critic M4): the hook-free Durchblick smoke, the one live spec that loads the 3D chunk.
  'ref-live.spec.js',
]);
