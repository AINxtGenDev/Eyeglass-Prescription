// Preset chips and the inline non-modal confirm (02-09, RES-05, D-27; UI-SPEC "Preset chips",
// "Inline confirm"; RESEARCH Pattern 5). A preset writes field text and dispatches one `input`
// event, so parse → validate → compute runs exactly as for typing (T-02-25). Typed values are
// only replaced after an explicit "Ersetzen" (T-02-24). No browser dialog, no modal.
import { RX_PRESETS, FRAME_PRESETS } from '../state/presets.js';
import { t } from '../i18n/t.js';
import { $ } from './dom.js';

const RX_FIELDS = ['sph', 'cyl', 'axis'];
const CONFIRM_Q = 'preset-confirm-q';

/** The open confirm, if any: only one at a time. */
let openConfirm = null;

function button(text, className) {
  const b = document.createElement('button');
  b.type = 'button';
  if (className) b.className = className;
  b.textContent = text;
  return b;
}

function closeConfirm() {
  openConfirm?.remove();
  openConfirm = null;
}

/**
 * Insert the question after the chip row. Focus goes to "Eingaben behalten" (the least
 * destructive action, APG dialog-modal guidance); Esc keeps; afterwards focus returns to the chip.
 * The focus move announces the group, so there is no extra live region (Pattern 5).
 */
function ask(slot, chip, label, replace) {
  closeConfirm();
  const group = document.createElement('div');
  group.className = 'preset-confirm';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', CONFIRM_Q);
  const q = document.createElement('p');
  q.id = CONFIRM_Q;
  q.className = 'preset-confirm-q';
  q.textContent = t('preset.confirm.q');
  const body = document.createElement('p');
  body.textContent = t('preset.confirm.body', { preset: label });
  const actions = document.createElement('div');
  actions.className = 'preset-confirm-actions';
  const yes = button(t('preset.confirm.replace'), 'btn-danger');
  const keep = button(t('preset.confirm.keep'));
  actions.append(yes, keep);
  group.append(q, body, actions);
  const done = (apply) => {
    closeConfirm();
    if (apply) replace();
    chip.focus();
  };
  yes.addEventListener('click', () => done(true));
  keep.addEventListener('click', () => done(false));
  group.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    done(false);
  });
  slot.append(group);
  openConfirm = group;
  keep.focus();
}

/** One chip row: apply at once without own values, otherwise ask first. */
function buildRow(rowId, slotId, presets, label, hasOwn, apply) {
  const box = /** @type {HTMLElement} */ (document.querySelector(`#${rowId} .chips`));
  const slot = $(slotId);
  for (const p of presets) {
    const text = label(p);
    const chip = button(text, 'chip');
    chip.addEventListener('click', () => {
      if (hasOwn()) ask(slot, chip, text, () => apply(p));
      else {
        closeConfirm();
        apply(p);
      }
    });
    box.append(chip);
  }
}

/**
 * Write the six Sph/Zyl/Achse fields (PD is kept) and run one input frame. "Gleich für beide
 * Augen" is switched off first, so the mirror does not overwrite the L values.
 */
function applyRx(p, onApplied) {
  const same = /** @type {HTMLInputElement} */ ($('rx-same'));
  if (same.checked) {
    same.checked = false;
    same.dispatchEvent(new Event('change', { bubbles: true }));
  }
  for (const eye of ['od', 'os']) {
    for (const f of RX_FIELDS) /** @type {HTMLInputElement} */ ($(`rx-${eye}-${f}`)).value = p[eye][f];
  }
  onApplied(p);
  $('rx-od-sph').dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * @param {{
 *   hasOwnRx: () => boolean,
 *   onRxApplied: (p: (typeof RX_PRESETS)[number]) => void,
 *   hasOwnFrame: () => boolean,
 *   applyFrame: (A: string, DBL: string) => void,
 * }} hooks
 */
export function initPresets({ hasOwnRx, onRxApplied, hasOwnFrame, applyFrame }) {
  buildRow('rx-presets', 'rx-preset-confirm-slot', RX_PRESETS, (p) => t('preset.rx.' + p.id), hasOwnRx, (p) =>
    applyRx(p, onRxApplied),
  );
  buildRow(
    'frame-presets',
    'frame-preset-confirm-slot',
    FRAME_PRESETS,
    (p) => t('preset.frame.' + p.id, { A: p.A, DBL: p.DBL }),
    hasOwnFrame,
    (p) => applyFrame(p.A, p.DBL),
  );
}
