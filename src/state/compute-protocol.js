// Worker-side message handler (01-15, ENG-09). Pure: no DOM and no `self`; the worker glue
// (src/worker/engine.worker.js) and the sync fallback in main.js both call it.
//
// Messages
//   main → worker  { type: 'compute', id, eyes: { OD?: { seq, spec }, OS?: { seq, spec } } }
//   main → worker  { type: 'bench', id, caseId, k }            one run per job; k = frame-miss counter
//   worker → main  { type: 'ready' }
//   worker → main  { type: 'result', id, eyes: { OD?: { seq, result }, OS?: … }, computeMs }
//   worker → main  { type: 'bench', id, caseId, ms, ok, evaluations }
//   worker → main  { type: 'error', id, eyes: [...], message }
//
// No transferables: LensResult has no typed arrays, so structured cloning copies it whole
// (compute-protocol.test.js checks the round trip). The handler never throws.
import { evaluateLens, evaluatePair } from '../engine/evaluate.js';
import { benchPair } from './bench-cases.js';

export { medianOf, tailOf } from './bench-cases.js';

export const READY = Object.freeze({ type: 'ready' });

const EYES = ['OD', 'OS'];

const evaluations = (r) => (r?.ok ? (r.intermediates?.baseCurveSearch?.evaluations ?? null) : null);

/**
 * @param {{ evaluate?: Function, evaluatePairFn?: Function, now?: () => number }} [deps]
 * @returns {(msg: any) => object}
 */
export function createHandler({
  evaluate = evaluateLens,
  evaluatePairFn = evaluatePair,
  now = () => globalThis.performance.now(),
} = {}) {
  return (msg) => {
    const id = msg?.id ?? null;
    try {
      if (msg?.type === 'compute') {
        const t0 = now();
        const eyes = {};
        for (const eye of EYES) {
          const job = msg.eyes?.[eye];
          if (job) eyes[eye] = { seq: job.seq, result: evaluate(job.spec) };
        }
        return { type: 'result', id, eyes, computeMs: now() - t0 };
      }
      if (msg?.type === 'bench') {
        const pair = benchPair(msg.caseId, msg.k);
        const t0 = now();
        const r = evaluatePairFn(pair);
        const ms = now() - t0;
        return {
          type: 'bench',
          id,
          caseId: msg.caseId,
          ms,
          ok: !!(r.OD?.ok && r.OS?.ok),
          evaluations: [evaluations(r.OD), evaluations(r.OS)],
        };
      }
      return { type: 'error', id, eyes: [], message: `unknown message type: ${String(msg?.type)}` };
    } catch (err) {
      const eyes = msg?.type === 'compute' ? EYES.filter((e) => msg.eyes?.[e]) : [];
      return { type: 'error', id, eyes, message: String(err?.message ?? err) };
    }
  };
}
