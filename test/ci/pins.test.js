// DEPL-04 pin audit: every GitHub Action is pinned to a full commit SHA that matches the
// verified table, and every npm dependency is an exact version (T-01-02, T-01-SC).
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(path.join(root, p), 'utf8');

// Source: 01-RESEARCH.md "CI Workflow (DEPL-01…04)". Tags resolved to commit SHAs with
// `gh api repos/<action>/commits/<tag>` on 2026-11-06. Changing a pin means updating this table
// deliberately, after re-resolving the SHA.
const EXPECTED_ACTIONS = {
  'actions/checkout': { sha: '3d3c42e5aac5ba805825da76410c181273ba90b1', tag: 'v7.0.1' },
  'actions/setup-node': { sha: '949feb2413d6458794dcd2491c4babbbce0c15c1', tag: 'v7.1.0' },
  'actions/configure-pages': { sha: '45bfe0192ca1faeb007ade9deae92b16b8254a0d', tag: 'v6.0.0' },
  'actions/upload-pages-artifact': {
    sha: 'fc324d3547104276b827a68afc52ff2a11cc49c9',
    tag: 'v5.0.0',
  },
  'actions/deploy-pages': { sha: '368f82528645a54fb793d4d04e342629a3f51346', tag: 'v5.0.1' },
};

function workflowFiles() {
  const dir = path.join(root, '.github/workflows');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => `.github/workflows/${f}`);
}

describe('GitHub Actions pins', () => {
  test('at least one workflow exists', () => {
    expect(workflowFiles().length).toBeGreaterThan(0);
  });

  test('every uses: is a 40-char SHA with a version comment and matches the verified table', () => {
    const uses = workflowFiles().flatMap((f) =>
      read(f)
        .split('\n')
        .filter((l) => /^\s*-?\s*uses:/.test(l))
        .map((l) => ({ file: f, line: l.trim() })),
    );
    expect(uses.length).toBeGreaterThan(0);
    for (const { file, line } of uses) {
      const value = line.replace(/^-?\s*uses:\s*/, '');
      const m = value.match(/^([\w.-]+\/[\w.-]+)@([0-9a-f]{40})\s+#\s*(v\d[\w.-]*)\s*$/);
      expect(m, `${file}: ${line}`).not.toBeNull();
      const [, action, sha, tag] = m;
      expect(EXPECTED_ACTIONS[action], `${file}: unknown action ${action}`).toBeDefined();
      expect(sha, `${file}: ${action}`).toBe(EXPECTED_ACTIONS[action].sha);
      expect(tag, `${file}: ${action}`).toBe(EXPECTED_ACTIONS[action].tag);
    }
  });
});

describe('npm pins', () => {
  const pkg = JSON.parse(read('package.json'));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

  test('every dependency and devDependency is an exact x.y.z version', () => {
    expect(Object.keys(deps).length).toBeGreaterThan(0);
    for (const [name, version] of Object.entries(deps)) {
      expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  test('package-lock.json exists with lockfileVersion 3', () => {
    expect(existsSync(path.join(root, 'package-lock.json'))).toBe(true);
    expect(JSON.parse(read('package-lock.json')).lockfileVersion).toBe(3);
  });

  test('.npmrc enforces save-exact', () => {
    expect(read('.npmrc')).toMatch(/^save-exact=true$/m);
  });

  test('@vitest/coverage-v8 equals the vitest version', () => {
    expect(deps['@vitest/coverage-v8']).toBe(deps.vitest);
  });
});
