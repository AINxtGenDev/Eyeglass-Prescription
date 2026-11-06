import { test, expect, vi } from 'vitest';

// Interpolation is tested against a mocked dictionary so no test-only key ships.
vi.mock('./de-AT.js', () => ({
  default: Object.freeze({ 'echo': 'Erkannt: {value} bei {axis}', 'plain': 'Ohne Parameter' }),
}));

const { t } = await import('./t.js');

test('interpolates every {name} param', () => {
  expect(t('echo', { value: '−2,25 dpt', axis: '90°' })).toBe('Erkannt: −2,25 dpt bei 90°');
});

test('stringifies non-string params', () => {
  expect(t('echo', { value: 0, axis: 180 })).toBe('Erkannt: 0 bei 180');
});

test('keys without placeholders are returned unchanged', () => {
  expect(t('plain', { value: 1 })).toBe('Ohne Parameter');
});

test('missing key throws outside production', () => {
  expect(() => t('missing.key')).toThrow('Missing i18n key: missing.key');
});
