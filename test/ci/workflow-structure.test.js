// DEPL-02 structural proof: every gate runs inside the build job, deploy needs build,
// verify-live needs deploy, and nothing can override a failed gate (T-01-03, T-01-14, T-01-16).
//
// GitHub docs, jobs.<job_id>.needs (verified 2026-11-06,
// https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax):
// "If a job fails or is skipped, all jobs that need it are skipped unless the jobs use a
// conditional expression that causes the job to continue."
// Hence: no always()/failure()/cancelled() and no continue-on-error anywhere.
//
// No YAML library is installed (on purpose). The workflow is written in block style and
// sliced into job sections by their 2-space-indented headers under `jobs:`.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const file = path.join(root, '.github/workflows/deploy.yml');
const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
const lines = text.split('\n');

const JOBS = ['build', 'deploy', 'verify-live'];

function section(startRe, endRe) {
  const start = lines.findIndex((l) => startRe.test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (endRe.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end);
}

const jobsBlock = section(/^jobs:\s*$/, /^\S/);
function job(name) {
  if (!jobsBlock) return null;
  const start = jobsBlock.findIndex((l) => l === `  ${name}:`);
  if (start < 0) return null;
  let end = jobsBlock.length;
  for (let i = start + 1; i < jobsBlock.length; i++) {
    if (/^ {2}[\w-]+:\s*$/.test(jobsBlock[i])) {
      end = i;
      break;
    }
  }
  return jobsBlock.slice(start, end).join('\n');
}

describe('deploy.yml structure', () => {
  test('workflow file exists', () => {
    expect(existsSync(file)).toBe(true);
  });

  test.each(JOBS)('job %s exists', (name) => {
    expect(job(name)).not.toBeNull();
  });

  test('deploy needs build; verify-live needs deploy', () => {
    expect(job('deploy')).toMatch(/^ {4}needs: build$/m);
    expect(job('verify-live')).toMatch(/^ {4}needs: deploy$/m);
  });

  test('build runs every gate in order before the artifact upload', () => {
    const build = job('build') ?? '';
    const order = [
      /run: npm ci$/m,
      /run: npm run lint$/m,
      /run: npm run test:coverage$/m,
      /run: npm run build$/m,
      /run: npm run build:e2e$/m,
      /run: npx playwright install --with-deps chromium$/m,
      /run: npm run test:e2e$/m,
      /run: npm run test:e2e:live$/m,
      /run: npm run test:dist$/m,
      /uses: actions\/upload-pages-artifact@/m,
    ];
    const positions = order.map((re) => build.search(re));
    for (const [i, p] of positions.entries()) expect(p, String(order[i])).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i], `${order[i]} after ${order[i - 1]}`).toBeGreaterThan(positions[i - 1]);
    }
  });

  test('verify-live runs the hook-free live subset, not the full suite', () => {
    const live = job('verify-live') ?? '';
    expect(live).toMatch(/run: npm run test:e2e:live$/m);
    expect(live).not.toMatch(/run: npm run test:e2e$/m);
  });

  test('verify-live runs the @live pwa tests against the live URL after the live subset (M4)', () => {
    const live = job('verify-live') ?? '';
    const e2e = live.search(/run: npm run test:e2e:live$/m);
    const pwa = live.search(/run: npm run test:pwa:live$/m);
    expect(e2e).toBeGreaterThanOrEqual(0);
    expect(pwa, 'test:pwa:live after test:e2e:live').toBeGreaterThan(e2e);
    // The step's own env block (up to the next step) sets PWA_BASE_URL to the same live URL.
    const step = live.slice(pwa).split(/\n {6}- /)[0];
    const baseUrl = live.match(/^ {10}BASE_URL: (\S+)$/m)?.[1];
    expect(baseUrl).toBeTruthy();
    expect(step).toMatch(new RegExp(`^ {10}PWA_BASE_URL: ${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  });

  test('no gate can be bypassed', () => {
    expect(text).not.toBe('');
    for (const banned of ['continue-on-error', 'always()', 'failure()', 'cancelled()', '|| true']) {
      expect(text, banned).not.toContain(banned);
    }
  });

  test('no build run: line is piped or a block scalar (masked exit codes, Pitfall G)', () => {
    const runLines = (job('build') ?? '').split('\n').filter((l) => /^\s*-?\s*run:/.test(l));
    expect(runLines.length).toBeGreaterThanOrEqual(6);
    for (const l of runLines) expect(l, l).not.toContain('|');
  });

  test('top-level permissions are contents: read', () => {
    expect(text).toMatch(/^permissions:\n {2}contents: read$/m);
  });

  test('pages: write and id-token: write appear exactly once, inside deploy', () => {
    for (const perm of ['pages: write', 'id-token: write']) {
      expect(text.split(perm).length - 1, perm).toBe(1);
      expect(job('deploy'), perm).toContain(perm);
    }
  });

  test('triggers: push to main, pull_request, workflow_dispatch', () => {
    const on = (section(/^on:\s*$/, /^\S/) ?? []).join('\n');
    expect(on).toMatch(/^ {2}push:\n {4}branches:\n {6}- main$/m);
    expect(on).toMatch(/^ {2}pull_request:/m);
    expect(on).toMatch(/^ {2}workflow_dispatch:/m);
  });

  test('deploy only runs for main and never for pull requests', () => {
    const ifLine = (job('deploy') ?? '').split('\n').find((l) => /^ {4}if:/.test(l)) ?? '';
    expect(ifLine).toContain("github.ref == 'refs/heads/main'");
    expect(ifLine).toContain("github.event_name != 'pull_request'");
    expect(ifLine).not.toContain('||');
  });
});
