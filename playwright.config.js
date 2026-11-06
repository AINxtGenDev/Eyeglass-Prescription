import { defineConfig, devices } from '@playwright/test';

const LOCAL_URL = 'http://localhost:4173/Eyeglass-Prescription/';
const baseURL = process.env.BASE_URL ?? LOCAL_URL;
const PERF_SPEC = /perf-throttled\.spec\.js$/;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: { baseURL },
  // Local runs serve the production build under the real base path.
  // With BASE_URL set (e.g. the live Pages URL) no server is started.
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npm run preview', url: LOCAL_URL, reuseExistingServer: !process.env.CI },
  // The CPU-throttled phone proxy (01-14) is informational and slow: it lives in project 'perf',
  // which exists only with PERF=1 (`npm run test:perf`), and the gate projects ignore its spec.
  projects: [
    {
      name: 'desktop',
      testIgnore: PERF_SPEC,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 780 },
        isMobile: true,
        hasTouch: true,
      },
      testIgnore: PERF_SPEC,
    },
    ...(process.env.PERF === '1'
      ? [{ name: 'perf', testMatch: PERF_SPEC, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }]
      : []),
  ],
});
