import { defineConfig } from 'vite';

// Short commit hash shown in the footer (#app-commit). CI sets GITHUB_SHA.
const commit = (process.env.GITHUB_SHA ?? 'dev').slice(0, 7);

// The commit must be in index.html itself (verify-live greps the HTML),
// so it is injected into the page, not only defined in the JS bundle.
const appMeta = {
  name: 'app-meta',
  transformIndexHtml(html) {
    return html.replaceAll('%APP_COMMIT%', commit);
  },
};

// CSP on build output only, so the Vite dev client (inline/HMR) keeps working.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  "object-src 'none'; base-uri 'self'; form-action 'none'";
const cspMeta = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      /(<meta charset[^>]*>)/i,
      `$1\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    );
  },
};

export default defineConfig({
  base: '/Eyeglass-Prescription/',
  plugins: [appMeta, cspMeta],
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.js'],
      exclude: ['**/*.test.js'],
      thresholds: { lines: 95, branches: 90 },
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          // 01-12: the +14 search costs more per lens; several CPU-bound property tests and the
          // Grenzfall bench exceed the 5 s default under v8 coverage (CI runs test:coverage).
          testTimeout: 30_000,
          include: ['src/**/*.test.js', 'test/**/*.test.js'],
        },
      },
    ],
  },
});
