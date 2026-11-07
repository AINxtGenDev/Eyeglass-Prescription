// Material section (02-07, MAT-01, D-14): six radio cards in MATERIALS order (ascending index),
// index first and a neutral descriptor (never "dünner": a higher index is not always thinner,
// PITFALLS Pitfall 8). Each card's second line names the Abbe number νe from materials.js.
// Moved from main.js: currentMaterialId and the material line under the result cards.
import { MATERIALS } from '../engine/materials.js';
import { t } from '../i18n/t.js';
import { $, setText } from './dom.js';
import { icon } from './icons.js';

const DEFAULT_MATERIAL = 'cr39';
const densityNf = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2 });
// Abbe number νe = (ne − 1)/(nF′ − nC′): higher means less dispersion, hence fewer colour fringes.
// That meaning is textbook knowledge, not from a fetched document; the νe values are the cited
// Zeiss rows in materials.js, which list νe next to ne.
const abbeNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 });

/** Selected id, guarded to a MATERIALS key (T-01-21). */
export function currentMaterialId() {
  const el = /** @type {HTMLInputElement | null} */ (document.querySelector('input[name=material]:checked'));
  const id = el?.value ?? '';
  return Object.hasOwn(MATERIALS, id) ? id : DEFAULT_MATERIAL;
}

/** Six radio cards from MATERIALS ids only; labels from the dictionary. Built once at init. */
function buildMaterialCards() {
  const box = /** @type {HTMLElement} */ (document.querySelector('#material .material-cards'));
  for (const id of Object.keys(MATERIALS)) {
    const label = document.createElement('label');
    label.className = 'radio-card material-card';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'material';
    radio.value = id;
    radio.checked = id === DEFAULT_MATERIAL;
    const title = document.createElement('span');
    title.className = 'radio-card-name';
    title.textContent = t('material.' + id + '.title');
    const sub = document.createElement('span');
    sub.className = 'radio-card-sub';
    sub.textContent = t('material.' + id + '.sub', { abbe: abbeNf.format(MATERIALS[id].ve) });
    label.append(radio, icon('check'), title, sub);
    box.append(label);
  }
}

/** @param {{ schedule: (timeStamp: number) => void }} deps */
export function initMaterialInput({ schedule }) {
  buildMaterialCards();
  $('material').addEventListener('change', (e) => schedule(e.timeStamp));
}

/** The material line under a result card (MAT-01). */
export function renderMaterialLine(eye, materialId) {
  const m = MATERIALS[materialId];
  setText(
    `result-${eye.toLowerCase()}-material`,
    t('result.materialLine', {
      eye: t(eye === 'OD' ? 'rx.od' : 'rx.os'),
      label: t('material.' + materialId),
      density: densityNf.format(m.density) + ' g/cm³',
      // From the catalogue, not the result: the line renders even when the lens fails (MAT-01).
      abbe: abbeNf.format(m.ve),
    }),
  );
}
