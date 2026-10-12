import { defineConfig, devices } from '@playwright/test';

/** The e2e build points at this address; tests intercept it, so no real API or key is ever involved. */
export const MOCK_API_URL = 'http://127.0.0.1:9999';
const APP_URL = 'http://localhost:4173/pdf-insight/';

export default defineConfig({
  testDir: 'e2e/tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: APP_URL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } } },
  ],
  webServer: {
    command: 'npm run build -w web && npm run preview -w web',
    url: APP_URL,
    env: { VITE_API_URL: MOCK_API_URL },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
