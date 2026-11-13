// F-01 (lens-critic m1): with `retries: 1` on CI a test that passes only on the retry is "flaky"
// and does not fail the run. The flaky reporter lists those tests in the job summary from inside
// the test step, so no always()/|| true step is needed (workflow-structure.test.js bans them).
// A fake root suite stands in for Playwright's; the reporter only uses allTests(), outcome(),
// titlePath() and location, which are part of the public reporter API
// (node_modules/playwright/types/testReporter.d.ts).
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import FlakyReporter from '../../e2e/support/flaky-reporter.js';

const ROOT = '/repo';

function fakeTest(project, file, line, titles, outcome) {
  return {
    titlePath: () => ['', project, file, ...titles],
    location: { file: path.join(ROOT, 'e2e', file), line, column: 3 },
    outcome: () => outcome,
  };
}

function fakeSuite(tests) {
  return { allTests: () => tests };
}

function run(tests) {
  const reporter = new FlakyReporter();
  reporter.onBegin({ rootDir: ROOT }, fakeSuite(tests));
  return reporter.onEnd({ status: 'passed' });
}

let dir;
let saved;

beforeEach(() => {
  saved = process.env.GITHUB_STEP_SUMMARY;
  dir = mkdtempSync(path.join(tmpdir(), 'flaky-reporter-'));
});

afterEach(() => {
  if (saved === undefined) delete process.env.GITHUB_STEP_SUMMARY;
  else process.env.GITHUB_STEP_SUMMARY = saved;
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('flaky reporter', () => {
  test('lists the flaky test and not the passed one; returns nothing (exit code untouched)', () => {
    const file = path.join(dir, 'summary.md');
    process.env.GITHUB_STEP_SUMMARY = file;
    const result = run([
      fakeTest('mobile', 'worker.spec.js', 42, ['race', 'flips once'], 'flaky'),
      fakeTest('desktop', 'a11y.spec.js', 7, ['clean state'], 'expected'),
    ]);
    expect(result).toBeUndefined();
    const text = readFileSync(file, 'utf8');
    expect(text).toContain('Flaky tests (passed only on retry)');
    expect(text).toContain('mobile › e2e/worker.spec.js:42 › race › flips once');
    expect(text).not.toContain('a11y.spec.js');
    expect(text).not.toContain('No flaky tests');
  });

  test('with no flaky test the section reads "No flaky tests"', () => {
    const file = path.join(dir, 'summary.md');
    process.env.GITHUB_STEP_SUMMARY = file;
    run([fakeTest('desktop', 'a11y.spec.js', 7, ['clean state'], 'expected')]);
    const text = readFileSync(file, 'utf8');
    expect(text).toContain('No flaky tests');
    expect(text).not.toContain('a11y.spec.js');
  });

  test('without GITHUB_STEP_SUMMARY nothing is written and nothing throws', () => {
    delete process.env.GITHUB_STEP_SUMMARY;
    expect(() => run([fakeTest('mobile', 'worker.spec.js', 42, ['race'], 'flaky')])).not.toThrow();
    expect(existsSync(path.join(dir, 'summary.md'))).toBe(false);
  });

  test('a write error goes to stderr and does not throw', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.GITHUB_STEP_SUMMARY = path.join(dir, 'missing', 'summary.md');
    expect(() => run([fakeTest('mobile', 'worker.spec.js', 42, ['race'], 'flaky')])).not.toThrow();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0][0])).toContain('flaky-reporter');
  });

  test('does not claim stdio, so the dot reporter keeps the console', () => {
    expect(new FlakyReporter().printsToStdio()).toBe(false);
  });
});
