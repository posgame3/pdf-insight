import { expect, test } from '@playwright/test';
import { FIXTURE_PDF, mockApi } from '../support/mockApi';

/** Regenerates docs/screenshot.png: `SCREENSHOT=1 npx playwright test screenshot --project=desktop`. */
test('README screenshot', async ({ page }) => {
  test.skip(!process.env.SCREENSHOT, 'Set SCREENSHOT=1 to regenerate docs/screenshot.png');
  await mockApi(page);
  await page.setViewportSize({ width: 1180, height: 1400 });
  await page.goto('./');
  await page.getByLabel(/Przeciągnij plik PDF/).setInputFiles(FIXTURE_PDF);
  await expect(page.getByRole('button', { name: 'Pobierz JSON' })).toBeVisible();
  await page.getByRole('button', { name: 'Pobierz JSON' }).blur();
  await page.screenshot({ path: 'docs/screenshot.png', fullPage: false });
});
