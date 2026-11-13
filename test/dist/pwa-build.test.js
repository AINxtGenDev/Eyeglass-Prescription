// OFF-01 / D-18 / D-19 / D-23 / D-25: the offline build output. Manifest, icons and index.html
// are asserted in every build; the service-worker shape depends on the one effective kill flag
// (NEW-1): the normal worker when it is off, the plugin's destroyer when it is on, so a kill
// build passes its own gate without test edits.
// Runs in the 'dist' project after `npm run build` (`npm run test:dist`).
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { swKillEffective } from '../../sw-kill-switch.js';
import { checkNormalSw, checkDestroyerSw, precacheBytes, PRECACHE_LIMIT_BYTES } from './sw-shape.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const DIST = path.join(root, 'dist');
const KILL = swKillEffective(process.env);
const BASE = '/Eyeglass-Prescription/';
// Same string as vite.config.js CSP (worker.spec.js checks it exactly as well).
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  "object-src 'none'; base-uri 'self'; form-action 'none'";

function requireDist() {
  if (!existsSync(DIST)) throw new Error('dist/ missing: run `npm run build` first');
}
const read = (f) => readFileSync(path.join(DIST, f), 'utf8');

/** Width and height from a PNG IHDR chunk. @param {Buffer} b */
function pngSize(b) {
  const sig = b.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a' || b.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

describe('web app manifest (D-25)', () => {
  test('fields, scope and start_url', () => {
    requireDist();
    const m = JSON.parse(read('manifest.webmanifest'));
    expect(m.name).toBe('Brillenglas-Simulator – Dicke und Gewicht');
    expect(m.short_name).toBe('Brillenglas');
    expect(m.lang).toBe('de-AT');
    expect(m.scope).toBe(BASE);
    expect(m.start_url).toBe(BASE);
    expect(m.display).toBe('standalone');
    expect(m.theme_color).toBe('#ffffff');
    expect(m.background_color).toBe('#ffffff');
    expect(m.icons).toEqual([
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
  });

  test('every icon exists and its PNG size matches the declared size', () => {
    requireDist();
    const m = JSON.parse(read('manifest.webmanifest'));
    for (const icon of m.icons) {
      const file = path.join(DIST, icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(readFileSync(file)), icon.src).toEqual({ width: w, height: h });
    }
    expect(existsSync(path.join(DIST, 'favicon.svg'))).toBe(true);
  });
});

describe('dist/index.html (D-23)', () => {
  test('manifest link, favicon, exact CSP, no registerSW.js, no inline script', () => {
    requireDist();
    const html = read('index.html');
    expect(html).toContain(`<link rel="manifest" href="${BASE}manifest.webmanifest">`);
    expect(html).toMatch(new RegExp(`<link rel="icon" href="${BASE}favicon\\.svg"`));
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`);
    expect(html).not.toContain('registerSW.js');
    const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)].map((x) => x[1]);
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.filter((attrs) => !/\bsrc=/.test(attrs))).toEqual([]);
  });
});

describe.runIf(!KILL)('service worker, kill switch off: normal worker (D-19, N12)', () => {
  test('normal worker: full precache, eyeglass-rx, SKIP_WAITING only, clientsClaim, < 2 MB', () => {
    requireDist();
    const failures = checkNormalSw(DIST);
    const bytes = precacheBytes(DIST);
    // stdout directly: Vitest 5 hides console output of passing tests by default.
    process.stdout.write(
      `precache size: ${bytes} bytes (${(bytes / 1e6).toFixed(3)} MB, limit ${PRECACHE_LIMIT_BYTES})\n`,
    );
    expect(failures).toEqual([]);
  });
});

describe.runIf(KILL)('service worker, kill switch on: destroyer worker (D-24)', () => {
  test('destroyer worker: no precache, deletes caches, unregisters', () => {
    requireDist();
    expect(checkDestroyerSw(DIST)).toEqual([]);
  });
});
