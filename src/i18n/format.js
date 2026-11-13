// de-AT display formatting (L10N-01). Display only: never re-parse the output
// (grouping separator is U+00A0). No toFixed: Intl handles rounding and -0.

const NBSP = ' ';
const MINUS = '−';

const diopterNf = new Intl.NumberFormat('de-AT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});
// signDisplay 'negative': −0.04 → "0,0" (the default 'auto' gives "-0,0").
const oneDecimalNf = new Intl.NumberFormat('de-AT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'negative',
});
const msNf = new Intl.NumberFormat('de-AT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const intNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });
// 03-12 iso lines: steps of 0,25 mm need 2 decimals; every thickness value stays on fmtMm (0,1).
const isoNf = new Intl.NumberFormat('de-AT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
  signDisplay: 'negative',
});

const typographicMinus = (s) => s.replace('-', MINUS);

/** −2.25 → "−2,25 dpt", 2.25 → "+2,25 dpt", 0/−0 → "0,00 dpt". */
export function fmtDiopter(v) {
  return typographicMinus(diopterNf.format(v)) + NBSP + 'dpt';
}

/** Axis in TABO degrees; 0 is shown as 180°. */
export function fmtAxis(deg) {
  return intNf.format(deg === 0 ? 180 : deg) + '°';
}

/** 1 decimal: 1.84 → "1,8 mm", −0.04 → "0,0 mm". */
export function fmtMm(v) {
  return typographicMinus(oneDecimalNf.format(v)) + NBSP + 'mm';
}

/** 1 decimal: 12.34 → "12,3 g". */
export function fmtGram(v) {
  return typographicMinus(oneDecimalNf.format(v)) + NBSP + 'g';
}

/** 2 decimals: 1.234 → "1,23 ms". */
export function fmtMs(v) {
  return msNf.format(v) + NBSP + 'ms';
}

/** Whole grams: 6.86 → "7 g"; null below 0,5 g (the caller shows t('result.weightUnder1')). */
export function fmtGramWhole(v) {
  return v < 0.5 ? null : intNf.format(v) + NBSP + 'g';
}

/** Conic constant k, 1 decimal, no unit: −1 → "−1,0", 0 → "0,0" (MAT-05). */
export function fmtConic(v) {
  return typographicMinus(oneDecimalNf.format(v));
}

/** Iso-line value, no unit (the legend says mm), 1–2 decimals: 2.5 → "2,5", 2.25 → "2,25", 3 → "3,0". */
export function fmtIsoValue(v) {
  return typographicMinus(isoNf.format(v));
}

/**
 * Size change as a percentage (04-01, UI-SPEC fmtPercent, MINOR 5): v = |SM − 1| ≥ 0 as a
 * fraction. One decimal below 3 %, whole percent from 3 % (the value is decided on the rounded
 * one-decimal string): 0.02949 → "2,9 %", 0.0296 → "3 %", 0.056037 → "6 %", 0.00004 → "0,0 %".
 */
export function fmtPercent(v) {
  const p = v * 100;
  const one = oneDecimalNf.format(p);
  if (Number(one.replace(',', '.')) < 3) return one + NBSP + '%';
  return intNf.format(p) + NBSP + '%';
}

/** Iso-line step with unit, 1–2 decimals: 0.25 → "0,25 mm", 1 → "1,0 mm". */
export function fmtIsoStep(v) {
  return typographicMinus(isoNf.format(v)) + NBSP + 'mm';
}
