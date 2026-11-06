// Dictionary lookup (L10N-02). Every visible string comes from de-AT.js.
import dict from './de-AT.js';

/**
 * @param {string} key
 * @param {Record<string, unknown>} [params] values for "{name}" placeholders
 * @returns {string}
 */
export function t(key, params = {}) {
  const template = dict[key];
  if (template === undefined) {
    // Production shows the key (visible, not silent); dev and tests fail loudly.
    if (import.meta.env?.PROD) return key;
    throw new Error('Missing i18n key: ' + key);
  }
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}
