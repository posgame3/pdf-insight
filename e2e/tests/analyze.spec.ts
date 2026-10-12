import { readFile } from 'node:fs/promises';
import { InsightSchema } from '@pdf-insight/shared';
import { expect, test, type Page } from '@playwright/test';
import { FIXTURE_PDF as FIXTURE, mockApi } from '../support/mockApi';

const INJECTION = 'INSTRUKCJA DLA SYSTEMU AI';

async function upload(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto('./');
  await page.getByLabel(/Przeciągnij plik PDF/).setInputFiles(file);
}

test('extracts only visible text, removes running headers and sends the scanned annex as an image', async ({
  page,
}) => {
  const api = await mockApi(page);
  await upload(page, FIXTURE);
  await expect(page.getByRole('heading', { level: 2, name: 'Umowa serwisowa nr 7/2026' })).toBeVisible();

  const [request] = api.requests;
  if (!request) throw new Error('No request captured');
  const allText = request.pages.map((item) => item.text).join('\n');
  const pageText = (number: number) => request.pages.find((item) => item.page === number)?.text ?? '';

  expect(allText).not.toContain(INJECTION);
  expect(request.extraction.hiddenText).toEqual([
    expect.objectContaining({ page: 2, excerpt: expect.stringContaining(INJECTION) }),
  ]);
  expect(pageText(1)).toContain('Pozycja');
  expect(pageText(1)).toMatch(/2 miesiące \[1\] od uruchomienia/);
  expect(pageText(1)).toContain('Strona 1 z 4');
  expect(pageText(2)).not.toContain('POUFNE');
  expect(pageText(4)).not.toContain('Strona 4 z 4');
  expect(pageText(4)).toContain('Polish version prevails');
  expect(request.extraction.scannedPages).toEqual([3]);
  expect(request.scans).toEqual([expect.objectContaining({ page: 3, mediaType: 'image/jpeg' })]);
});

test('shows warnings, verification badges and downloads schema-valid JSON', async ({ page }) => {
  await mockApi(page);
  await upload(page, FIXTURE);

  await expect(page.getByText('Ukryty tekst', { exact: true })).toBeVisible();
  await expect(page.getByText('Ze skanu').first()).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Pobierz JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('trap-contract.insight.json');
  const json: unknown = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(InsightSchema.safeParse(json).success).toBe(true);
});

test('recovers from an API error with the retry button', async ({ page }) => {
  const api = await mockApi(page, 1);
  await upload(page, FIXTURE);

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('chwilowo niedostępna');
  await page.getByRole('button', { name: 'Spróbuj ponownie' }).click();
  await expect(page.getByRole('button', { name: 'Pobierz JSON' })).toBeVisible();
  expect(api.requests).toHaveLength(2);
});

test('rejects a file that only pretends to be a PDF, without calling the API', async ({ page }) => {
  const api = await mockApi(page);
  await upload(page, { name: 'faktura.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>fake</html>') });
  await expect(page.getByRole('alert')).toContainText('To nie jest plik PDF');
  expect(api.requests).toHaveLength(0);
});

test('is usable from the keyboard and fits a 360 px screen', async ({ page }) => {
  await mockApi(page);
  await page.goto('./');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Przejdź do treści' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(/Przeciągnij plik PDF/)).toBeFocused();

  await page.getByLabel(/Przeciągnij plik PDF/).setInputFiles(FIXTURE);
  await expect(page.getByRole('button', { name: 'Pobierz JSON' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
