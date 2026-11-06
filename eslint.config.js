import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
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
    files: ['*.config.js', 'test/**/*.js', 'src/**/*.test.js', 'e2e/**/*.js'],
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
    },
  },
];
