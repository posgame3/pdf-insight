import { mkdir, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { AnalyzeRequestSchema } from '@pdf-insight/shared';
import { expect, test } from '@playwright/test';
import { MOCK_API_URL } from '../../playwright.config';

/**
 * Developer tool, skipped by default: shows exactly what the browser would send to the API for a local PDF,
 * without calling the API. `INSPECT_PDF=/path/to/file.pdf npx playwright test inspect --project=desktop`
 * writes test-results/inspect/<file>.request.json (scan images replaced by their size).
 */
const pdfPath = process.env.INSPECT_PDF;

test('inspect the extraction of a local PDF', async ({ page }) => {
  test.skip(!pdfPath, 'Set INSPECT_PDF to a PDF path');
  if (!pdfPath) return;
  let captured: unknown;
  await page.route(`${MOCK_API_URL}/analyze`, async (route) => {
    captured = route.request().postDataJSON();
    await route.fulfill({ status: 503, json: { error: { code: 'ai_unavailable', message: '-' } } });
  });
  await page.goto('./');
  await page.getByLabel(/Przeciągnij plik PDF/).setInputFiles(pdfPath);
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 60_000 });

  const request = AnalyzeRequestSchema.parse(captured);
  const report = {
    ...request,
    scans: request.scans.map((scan) => ({ page: scan.page, mediaType: scan.mediaType, base64Chars: scan.data.length })),
  };
  await mkdir('test-results/inspect', { recursive: true });
  await writeFile(`test-results/inspect/${basename(pdfPath)}.request.json`, JSON.stringify(report, null, 2));
});
