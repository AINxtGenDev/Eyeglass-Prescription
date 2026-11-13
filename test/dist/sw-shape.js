// Service-worker shape checks on a build directory (M1). Helper module, not a test file: used by
// test/dist/pwa-build.test.js and by the 04-14 kill-switch rehearsal. Each check returns a list
// of failure strings; an empty list means pass.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const ICONS = ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png'];
// D-19: the precache stays below 2 MB for phones on metered data.
export const PRECACHE_LIMIT_BYTES = 2_000_000;

function readSw(dir) {
  const file = path.join(path.resolve(dir), 'sw.js');
  if (!existsSync(file)) throw new Error(`${file} missing: run \`npm run build\` first`);
  return readFileSync(file, 'utf8');
}

/**
 * Precache URLs of a generateSW worker (relative to the build dir), or null if there is none.
 * @param {string} dir
 * @returns {string[] | null}
 */
export function precacheUrls(dir) {
  const m = readSw(dir).match(/precacheAndRoute\(\s*\[([\s\S]*?)\]/);
  if (!m) return null;
  return [...m[1].matchAll(/url:\s*"([^"]+)"/g)].map((x) => x[1]);
}

/**
 * Summed size in bytes of every precached file.
 * @param {string} dir
 */
export function precacheBytes(dir) {
  const urls = precacheUrls(dir) ?? [];
  return urls.reduce((sum, u) => sum + statSync(path.join(path.resolve(dir), u)).size, 0);
}

/**
 * The normal worker: full precache, namespaced cache id, prompt-mode update, clientsClaim.
 * @param {string} dir
 * @returns {string[]}
 */
export function checkNormalSw(dir) {
  const fail = [];
  const sw = readSw(dir);
  const urls = precacheUrls(dir);
  if (!urls) return ['no precacheAndRoute([...]) list in sw.js'];

  const count = (u) => urls.filter((x) => x === u).length;
  if (count('index.html') !== 1) fail.push(`index.html precached ${count('index.html')} times, expected 1`);
  if (count('manifest.webmanifest') !== 1) {
    fail.push(`manifest.webmanifest precached ${count('manifest.webmanifest')} times, expected exactly 1`);
  }
  for (const u of ['favicon.svg', ...ICONS]) if (count(u) < 1) fail.push(`${u} not precached`);

  // Generic: every JS chunk, worker and stylesheet, so the lazy 3D chunk and every worker
  // (engine, mesh, later warp) are covered without naming hashes.
  const assets = readdirSync(path.join(path.resolve(dir), 'assets')).filter((f) => /\.(js|css)$/.test(f));
  if (assets.length === 0) fail.push('assets/ has no .js or .css file');
  for (const a of assets) if (count(`assets/${a}`) < 1) fail.push(`assets/${a} not precached`);

  if (!sw.includes('eyeglass-rx')) fail.push("cache id 'eyeglass-rx' missing");

  // Prompt mode (D-20): skipWaiting only inside the SKIP_WAITING message handler.
  // Generated form: self.addEventListener("message",e=>{e.data&&"SKIP_WAITING"===e.data.type&&self.skipWaiting()})
  const handler = /addEventListener\(\s*"message"\s*,\s*\w+\s*=>\s*\{[^}]*"SKIP_WAITING"[^}]*skipWaiting\(\)[^}]*\}\s*\)/;
  const h = sw.match(handler);
  if (!h) fail.push('SKIP_WAITING message handler missing');
  const rest = h ? sw.replace(h[0], '') : sw;
  if (/skipWaiting\(\)/.test(rest)) fail.push('unconditional skipWaiting() call outside the message handler');

  if (!/\.clientsClaim\(\)/.test(sw)) fail.push('clientsClaim() missing (N12)');

  const bytes = precacheBytes(dir);
  if (!(bytes < PRECACHE_LIMIT_BYTES)) fail.push(`precache ${bytes} bytes, limit ${PRECACHE_LIMIT_BYTES}`);
  return fail;
}

/**
 * The plugin's self-destroying worker (selfDestroying: true): no precache, deletes caches,
 * unregisters itself.
 * @param {string} dir
 * @returns {string[]}
 */
export function checkDestroyerSw(dir) {
  const fail = [];
  const sw = readSw(dir);
  if (/precacheAndRoute/.test(sw)) fail.push('destroyer sw.js still has a precache list');
  if (!sw.includes('caches.keys')) fail.push('caches.keys missing');
  if (!/caches\.delete\(/.test(sw)) fail.push('cache delete missing');
  if (!sw.includes('unregister')) fail.push('unregister missing');
  const size = Buffer.byteLength(sw);
  if (!(size < 2048)) fail.push(`destroyer sw.js is ${size} bytes, expected < 2 KB`);
  return fail;
}
