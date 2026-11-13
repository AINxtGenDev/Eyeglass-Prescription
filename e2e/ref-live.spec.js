// REF-01 hook-free Durchblick smoke (04-08, lens-critic M4). In LIVE_SPECS: it runs against the
// production dist in CI and against the live site in verify-live, where the gated test handle does
// not exist. So it uses only the DOM: the mode switch, #view[data-pending], the badge and one size
// line. It loads the 3D chunk (guardPage with view: true), which no phase-3 live spec does.
import { test, expect } from '@playwright/test';
import { settled, guardPage, plain } from './helpers.js';

guardPage(test, { view: true });
test.use({ reducedMotion: 'reduce' });

test('Durchblick shows the traced picture and the size line (M4)', async ({ page }) => {
  test.setTimeout(90_000);
  const clear = page.locator('#example-clear');
  if (await clear.isVisible()) await clear.click();
  for (const eye of ['od', 'os']) {
    await page.locator(`#rx-${eye}-pd`).fill('32');
    await page.locator(`#rx-${eye}-sph`).fill('-4,00');
  }
  await settled(page);
  const mode = page.locator('#view-mode label', { hasText: 'Durchblick' });
  await expect(mode).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#view-mode input[value=ref]')).toBeEnabled({ timeout: 30_000 });
  await mode.click();
  await expect(page.locator('#view')).toHaveAttribute('data-pending', '', { timeout: 30_000 });
  await expect(page.locator('#view-stage .view-badge')).toHaveText('Durchblick · berechnet', { timeout: 30_000 });
  await expect(page.locator('#view-status')).toHaveText('');
  const size = plain(await page.locator('#view-ref-size').textContent());
  expect(size).toContain('Rechtes Glas: Bild etwa 6 % kleiner');
});
