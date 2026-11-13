// The live subset (orchestrator decision 5) runs against the production dist and the live site,
// where window.__eyeglassView does not exist (F-04). Every listed spec must be hook-free.
// 04-08 (lens-critic M4): at least one live spec loads the 3D chunk (guardPage(test, { view: true })).
// Every phase-3 live spec uses guardPage(test) → without3d → window.__eyeglassNo3d, so none of them
// ever loads the 3D view; the hook-free Durchblick smoke ref-live.spec.js closes that gap.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LIVE_SPECS } from '../../e2e/support/live-specs.js';

const e2eDir = fileURLToPath(new URL('../../e2e/', import.meta.url));

describe('live subset', () => {
  test('contains smoke.spec.js', () => {
    expect(LIVE_SPECS).toContain('smoke.spec.js');
  });

  test.each([...LIVE_SPECS])('%s exists and uses no test hook', (name) => {
    const file = path.join(e2eDir, name);
    expect(existsSync(file), file).toBe(true);
    const text = readFileSync(file, 'utf8');
    expect(text).not.toContain('__eyeglassView');
    expect(text).not.toContain('backgroundProbe(');
  });

  test('ref-live.spec.js is listed and at least one live spec loads the 3D chunk (M4)', () => {
    expect(LIVE_SPECS).toContain('ref-live.spec.js');
    const loads3d = LIVE_SPECS.filter((name) => readFileSync(path.join(e2eDir, name), 'utf8').includes('guardPage(test, { view: true })'));
    expect(loads3d.length).toBeGreaterThanOrEqual(1);
  });
});
