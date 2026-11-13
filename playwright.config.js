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
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LIVE_MATCH = new RegExp(`(^|[\\\\/])(${LIVE_SPECS.map(escapeRe).join('|')})$`);
const liveOnly = LIVE ? { testMatch: LIVE_MATCH } : {};

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  // One retry on CI (Playwright's recommended default): a runner timing flake no longer blocks the
  // deploy, and a test that passes only on the retry is still reported as flaky.
  retries: process.env.CI ? 1 : 0,
  use: { baseURL },
  // Local runs serve a build under the real base path: dist-e2e on 4174 by default, the production
  // dist on 4173 with E2E_LIVE=1. With BASE_URL set (e.g. the live Pages URL) no server is started.
  // round-2 NEW-5: never reuse a server on a fixed port; parallel worktrees share 4173/4174/4175, and
  // a reused server could be another worktree's build. A clash now fails loudly; wait for the other
  // run or stop the server you started (never kill a process you did not start).
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: LIVE ? 'npm run preview' : 'npm run preview:e2e',
        url: SERVER_URL,
        reuseExistingServer: false,
      },
  // The CPU-throttled phone proxy (01-14) is informational and slow: it lives in project 'perf',
  // which exists only with PERF=1 (`npm run test:perf`), and the gate projects ignore its spec.
  projects: [
    {
      name: 'desktop',
      testIgnore: PERF_SPEC,
      ...liveOnly,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
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
      },
      testIgnore: PERF_SPEC,
      ...liveOnly,
    },
    ...(process.env.PERF === '1'
      ? [{ name: 'perf', testMatch: PERF_SPEC, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }]
      : []),
  ],
});
