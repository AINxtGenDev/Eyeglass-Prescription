// Plus/minus cylinder transposition (RX-03). Pure and DOM-free; codes only, German text
// lives in the dictionary. S′ = S + C, C′ = −C, α′ = (α + 90) mod 180 (01-RESEARCH §Transposition).
// The engine accepts only the minus-cylinder form (cyl ≤ 0).

export const RX_CODES = Object.freeze({
  CYL_TRANSPOSED: 'CYL_TRANSPOSED',
  AXIS_MISSING_FOR_CYL: 'AXIS_MISSING_FOR_CYL',
});

/** @typedef {{ sph: number, cyl: number, axisDeg: number }} Rx */

/** @param {number} sph @param {number} cyl @param {number} axisDeg @returns {Rx} */
const form = (sph, cyl, axisDeg) => ({ sph: sph + 0, cyl: cyl + 0, axisDeg: axisDeg % 180 }); // + 0: no −0

/** @param {Rx} rx @returns {Rx} the other cylinder form */
const flip = ({ sph, cyl, axisDeg }) => form(sph + cyl, -cyl, axisDeg + 90);

/**
 * Both cylinder forms of one Rx. axisDeg is TABO in [0, 180) (parseAxis maps 180 to 0).
 * @param {Rx} rx
 * @returns {{ minus: Rx, plus: Rx | null, transposed: boolean }}
 */
export function transpose({ sph, cyl, axisDeg }) {
  const input = form(sph, cyl, axisDeg);
  if (cyl === 0) return { minus: input, plus: null, transposed: false };
  if (cyl > 0) return { minus: flip(input), plus: input, transposed: true };
  return { minus: input, plus: flip(input), transposed: false };
}
