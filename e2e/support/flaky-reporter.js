// F-01 (lens-critic m1): CI runs Playwright with `retries: 1`, so a test that passes only on the
// retry is "flaky" and does not fail the run. This reporter lists those tests in the GitHub job
// summary ($GITHUB_STEP_SUMMARY) from inside the test step itself, so the workflow needs no
// always()/|| true step to surface them. It never changes the exit code: onEnd returns nothing,
// and a write error is only printed to stderr.
// Reporter API: https://playwright.dev/docs/api/class-reporter (allTests, outcome, titlePath, location).
import { appendFileSync } from 'node:fs';
import path from 'node:path';

export default class FlakyReporter {
  onBegin(config, suite) {
    this.rootDir = config.rootDir;
    this.suite = suite;
  }

  onEnd() {
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (!file || !this.suite) return;
    const flaky = this.suite.allTests().filter((t) => t.outcome() === 'flaky');
    const lines = ['', '### Flaky tests (passed only on retry)', ''];
    if (flaky.length === 0) lines.push('No flaky tests.');
    for (const t of flaky) {
      const [, project, , ...titles] = t.titlePath();
      const where = `${path.relative(this.rootDir, t.location.file)}:${t.location.line}`;
      // A config without named projects has an empty project title; skip empty parts.
      lines.push(`- ${[project, where, ...titles].filter(Boolean).join(' › ')}`);
    }
    try {
      appendFileSync(file, `${lines.join('\n')}\n`);
    } catch (err) {
      console.error(`flaky-reporter: could not write ${file}: ${err.message}`);
    }
  }

  printsToStdio() {
    return false;
  }
}
