import { defineConfig, devices } from '@playwright/test';
import { LIVE_SPECS } from './e2e/support/live-specs.js';

// Production build (dist/, the deployed artifact) and the e2e build (dist-e2e/, `vite build --mode
// e2e`, differs only by the MODE-gated test handle). The full suite runs against dist-e2e; with
// E2E_LIVE=1 only the hook-free LIVE_SPECS run, against dist (orchestrator decision 5).
const LOCAL_URL = 'http://localhost:4173/Eyeglass-Prescription/';
const E2E_URL = 'http://localhost:4174/Eyeglass-Prescription/';
const LIVE = process.env.E2E_LIVE === '1';
const SERVER_URL = LIVE ? LOCAL_URL : E2E_URL;
const baseURL = process.env.BASE_URL ?? SERVER_URL;
const PERF_SPEC = /perf-throttled\.spec\.js$/;
// 04-06: the service-worker spec runs only in project 'pwa', on the production dist served by the
// switch server (4175), or against PWA_BASE_URL (the live site, `npm run test:pwa:live`).
const PWA_SPEC = /pwa\.spec\.js$/;
const PWA_URL = 'http://localhost:4175/Eyeglass-Prescription/';
const PWA_LIVE = Boolean(process.env.PWA_BASE_URL);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LIVE_MATCH = new RegExp(`(^|[\\\\/])(${LIVE_SPECS.map(escapeRe).join('|')})$`);
const liveOnly = LIVE ? { testMatch: LIVE_MATCH } : {};

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  // One retry on CI (Playwright's recommended default): a runner timing flake no longer blocks the
  // deploy, and a test that passes only on the retry is still reported as flaky.
  retries: process.env.CI ? 1 : 0,
  // F-01: on CI the flaky reporter lists those retried passes in the job summary.
  reporter: process.env.CI ? [['dot'], ['./e2e/support/flaky-reporter.js']] : 'list',
  use: { baseURL },
  // Local runs serve a build under the real base path: dist-e2e on 4174 by default, the production
  // dist on 4173 with E2E_LIVE=1. With BASE_URL set (e.g. the live Pages URL) no server is started.
  // round-2 NEW-5: never reuse a server on a fixed port; parallel worktrees share 4173/4174/4175, and
  // a reused server could be another worktree's build. A clash now fails loudly; wait for the other
  // run or stop the server you started (never kill a process you did not start).
  // 04-06: the switch server for project 'pwa' serves the production dist/ (the deployed artifact),
  // so `npm run build` must run before `npm run test:e2e` (CI builds first). Same rule as above
  // (round-2 NEW-5): never reuse a server on a fixed port, parallel worktrees share the ports.
  // With PWA_BASE_URL set (the live pwa check) neither server starts.
  webServer: [
    ...(process.env.BASE_URL || PWA_LIVE
      ? []
      : [{ command: LIVE ? 'npm run preview' : 'npm run preview:e2e', url: SERVER_URL, reuseExistingServer: false }]),
    ...(process.env.BASE_URL || PWA_LIVE || LIVE
      ? []
      : [{ command: 'node e2e/support/switch-server.js', url: PWA_URL, reuseExistingServer: false }]),
  ],
  // The CPU-throttled phone proxy (01-14) is informational and slow: it lives in project 'perf',
  // which exists only with PERF=1 (`npm run test:perf`), and the gate projects ignore its spec.
  projects: [
    // Pitfall 5: from 04-06 the app registers a service worker; the gate projects block it, so no
    // spec here ever runs on a worker-controlled page (the pwa project tests the worker).
    {
      name: 'desktop',
      testIgnore: [PERF_SPEC, PWA_SPEC],
      ...liveOnly,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 780 },
        // 03-08 (D-12): a phone-sized window.screen, so the tier choice sees a phone (the
        // Desktop Chrome descriptor would report its 1920 × 1080 screen). hasTouch makes
        // '(pointer: coarse)' match in Chromium.
        screen: { width: 360, height: 780 },
        isMobile: true,
        hasTouch: true,
        serviceWorkers: 'block',
      },
      testIgnore: [PERF_SPEC, PWA_SPEC],
      ...liveOnly,
    },
    ...(process.env.PERF === '1'
      ? [
          {
            name: 'perf',
            testMatch: PERF_SPEC,
            // D-22: ENG-09 is re-measured with the service worker active
            use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, serviceWorkers: 'allow' },
          },
        ]
      : []),
    // MINOR 9: the switch server's served build is global state, so this project matches exactly
    // one file and runs its tests one at a time in file order. Keep every switch-dependent test in
    // pwa.spec.js; never add a second file to this project. Not created in E2E_LIVE mode.
    // 04-14: the update tests swap the served build through /__switch/a | b | kill, so two tests
    // must never run at the same time. The switch-server command builds nothing (plan-checker
    // warning 4): pwa.spec.js builds dist-b/ and dist-kill/ lazily, only when its switch describe runs.
    ...(LIVE
      ? []
      : [
          {
            name: 'pwa',
            testMatch: PWA_SPEC,
            fullyParallel: false,
            use: { ...devices['Desktop Chrome'], serviceWorkers: 'allow', baseURL: process.env.PWA_BASE_URL ?? PWA_URL },
          },
        ]),
  ],
});
