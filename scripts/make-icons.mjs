// Renders the app icons (D-25) from our own drawing public/favicon.svg with Playwright's
// Chromium. No @vite-pwa/assets-generator (04-RESEARCH: not needed for three PNGs, and it would
// add a dependency). Run `node scripts/make-icons.mjs` after changing the SVG and commit the PNGs.
//   icon-192.png, icon-512.png: the full drawing (purpose 'any')
//   icon-512-maskable.png: the drawing scaled into the central 80 % on the #f3f4f6 square
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const pub = fileURLToPath(new URL('../public/', import.meta.url));
const svg = readFileSync(path.join(pub, 'favicon.svg'), 'utf8');
const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-512-maskable.png', size: 512, scale: 0.8 },
];

const browser = await chromium.launch();
try {
  for (const { file, size, scale } of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const inner = Math.round(size * scale);
    const off = (size - inner) / 2;
    await page.setContent(
      `<html><body style="margin:0;background:#f3f4f6">` +
        `<img src="${src}" width="${inner}" height="${inner}" ` +
        `style="position:absolute;left:${off}px;top:${off}px;display:block"></body></html>`,
    );
    await page.locator('img').evaluate((img) => img.decode());
    await page.screenshot({ path: path.join(pub, file), clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log(`${file} ${size}x${size} (drawing ${inner}px)`);
  }
} finally {
  await browser.close();
}
