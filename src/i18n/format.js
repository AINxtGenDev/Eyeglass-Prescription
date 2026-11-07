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
