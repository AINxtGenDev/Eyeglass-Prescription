// Six 16×16 inline SVG icons (UI-SPEC "Icon library"). Built with createElementNS and
// presentation attributes only: no style attribute and no <style> element (CSP, T-02-11).
// Decorative: the text label next to an icon always carries the meaning.
const NS = 'http://www.w3.org/2000/svg';

/** Child shapes per icon: [tag, attributes]. */
const SHAPES = {
  info: [
    ['circle', { cx: 8, cy: 8, r: 6.5 }],
    ['path', { d: 'M8 7.25v4' }],
    ['path', { d: 'M8 4.75v.25' }],
  ],
  error: [
    ['path', { d: 'M8 1.75 14.75 14H1.25z', 'stroke-linejoin': 'round' }],
    ['path', { d: 'M8 6.25v3.5' }],
    ['path', { d: 'M8 11.75v.25' }],
  ],
  hint: [
    ['circle', { cx: 8, cy: 8, r: 6.5 }],
    ['path', { d: 'M6.25 6.25a1.75 1.75 0 1 1 2.5 1.6c-.5.25-.75.6-.75 1.15v.25' }],
    ['path', { d: 'M8 11.5v.25' }],
  ],
  outside: [
    ['circle', { cx: 8, cy: 8, r: 6.5 }],
    ['path', { d: 'M3.4 12.6 12.6 3.4' }],
  ],
  check: [['path', { d: 'M3 8.5 6.5 12 13 4.5', 'stroke-linejoin': 'round' }]],
  chevron: [['path', { d: 'M4 6l4 4 4-4', 'stroke-linejoin': 'round' }]],
};

/**
 * @param {keyof typeof SHAPES} name
 * @returns {SVGSVGElement}
 */
export function icon(name) {
  const svg = document.createElementNS(NS, 'svg');
  const attrs = {
    class: 'icon',
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.5,
    'stroke-linecap': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, String(v));
  for (const [tag, a] of SHAPES[name]) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(a)) el.setAttribute(k, String(v));
    svg.append(el);
  }
  return svg;
}
