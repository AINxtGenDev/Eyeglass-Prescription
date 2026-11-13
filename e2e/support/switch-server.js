// Test-only server, never deployed (04-06, Playwright project 'pwa'). It serves a build directory
// under /Eyeglass-Prescription/ like GitHub Pages does. Playwright cannot route an updated
// service-worker script (microsoft/playwright#14711), so the update tests (04-14) swap the served
// build here instead.
//   SWITCH_PORT  port, default 4175
//   SWITCH_ROOT  directory to serve, default dist (the production build, the deployed artifact)
// Every response carries Cache-Control: no-cache, so the browser always revalidates (update checks
// see a swapped build at once). A path that resolves outside the served root is a 404 (T-04-25).
// 04-14: GET /__switch/<name> swaps the served root (200 'ok'): a = dist (always restores the
// production build, whatever is served now), b = dist-b (`npm run build:b`), kill = dist-kill
// (`npm run build:kill`, the kill-switch rehearsal). Unknown names are a 404. These paths are
// outside the base and exist only in this test server.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.SWITCH_PORT ?? 4175);
let ROOT = path.resolve(process.env.SWITCH_ROOT ?? 'dist');
const BASE = '/Eyeglass-Prescription/';
const SWITCH = '/__switch/';
const ROOTS = { a: 'dist', b: 'dist-b', kill: 'dist-kill' };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json; charset=utf-8',
};

/** Send a plain response with the no-cache header. */
function send(res, status, headers, body) {
  res.writeHead(status, { 'Cache-Control': 'no-cache', ...headers });
  res.end(body);
}

/** The file for a request path inside ROOT, or null (outside the base, traversal, decode error). */
function resolveFile(urlPath) {
  if (!urlPath.startsWith(BASE)) return null;
  let rel;
  try {
    rel = decodeURIComponent(urlPath.slice(BASE.length));
  } catch {
    return null;
  }
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return null;
  return file;
}

const server = http.createServer(async (req, res) => {
  const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (urlPath.startsWith(SWITCH)) {
    const name = urlPath.slice(SWITCH.length);
    if (!Object.hasOwn(ROOTS, name)) {
      send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
      return;
    }
    ROOT = path.resolve(ROOTS[name]);
    console.log(`switch server: now serving ${ROOT}`);
    send(res, 200, { 'Content-Type': 'text/plain; charset=utf-8' }, 'ok');
    return;
  }
  if (urlPath === '/' || urlPath === BASE.slice(0, -1)) {
    send(res, 302, { Location: BASE }, '');
    return;
  }
  const file = resolveFile(urlPath);
  if (file === null) {
    send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(file);
    const type = MIME[path.extname(file)] ?? 'application/octet-stream';
    send(res, 200, { 'Content-Type': type, 'Content-Length': body.length }, req.method === 'HEAD' ? undefined : body);
  } catch {
    send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
  }
});

server.listen(PORT, () => {
  console.log(`switch server: ${ROOT} at http://localhost:${PORT}${BASE}`);
});
