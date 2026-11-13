import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'dist-e2e/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.planning/**',
      'references/**',
      'node_modules/**',
    ],
  },
  js.configs.recommended,
  // Node globals for configs, tests and e2e. No browser globals here (flat-config globals merge, Pitfall B).
  {
    files: ['*.config.js', 'test/**/*.js', 'src/**/*.test.js', 'e2e/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Browser globals ONLY for the UI layer. No HTML injection sinks (XSS mitigation T-01-05).
  {
    files: ['src/ui/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML)$/]',
          message: 'Use textContent instead of innerHTML/outerHTML (XSS mitigation T-01-05).',
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'Use textContent instead of insertAdjacentHTML (XSS mitigation T-01-05).',
        },
      ],
    },
  },
  // 03-02: three only in the lazy view chunk (src/ui/view/**)
  {
    files: ['src/ui/**/*.js'],
    ignores: ['src/ui/view/**', '**/*.test.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*'],
              message: 'Only src/ui/view/** may import Three.js (03-02, lazy 3D chunk).',
            },
          ],
        },
      ],
    },
  },
  // Worker glue (01-15): worker globals only, no Three.js, no UI.
  {
    files: ['src/worker/**/*.js'],
    languageOptions: { globals: { ...globals.worker } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'The worker must not import Three.js.' },
            { group: ['**/ui/**'], message: 'The worker must not depend on the UI layer.' },
          ],
        },
      ],
    },
  },
  // Engine boundary (DEPL-03): pure JS, no Three.js, no DOM, bottom layer.
  {
    files: ['src/engine/**/*.js'],
    ignores: ['src/engine/**/*.test.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'Engine must not import Three.js (DEPL-03).' },
            {
              group: ['**/ui/**', '**/i18n/**', '**/state/**'],
              message: 'Engine is the bottom layer.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'self',
        'localStorage',
        'sessionStorage',
        'requestAnimationFrame',
        'performance',
        'fetch',
        'XMLHttpRequest',
      ],
    },
  },
  // State and i18n layers: no Three.js, no UI imports.
  {
    files: ['src/state/**/*.js', 'src/i18n/**/*.js'],
    ignores: ['**/*.test.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'State/i18n must not import Three.js.' },
            { group: ['**/ui/**'], message: 'State/i18n must not depend on the UI layer.' },
          ],
        },
      ],
      // 01-15: state/i18n stay DOM-free so they run in Node, the worker and the page alike.
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'self',
        'localStorage',
        'sessionStorage',
        'requestAnimationFrame',
        'fetch',
        'XMLHttpRequest',
      ],
    },
  },
];
