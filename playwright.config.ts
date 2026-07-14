import { defineConfig, devices } from '@playwright/test';

/**
 * Конфигурация e2e-прогонов (Playwright).
 *
 * Два режима:
 * - локальный/CI (по умолчанию): Playwright сам поднимает `pnpm start`
 *   на :3000 (сборка должна быть выполнена заранее: `pnpm build`);
 * - против удалённого окружения: `PLAYWRIGHT_BASE_URL=https://… pnpm e2e` —
 *   webServer в этом случае не запускается. Playwright НЕ пропускает
 *   webServer автоматически при удалённом baseURL, поэтому гейт явный.
 */

const remoteBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: remoteBaseUrl ?? 'http://localhost:3000',
    locale: 'ru-RU',
    timezoneId: 'Asia/Almaty',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: remoteBaseUrl
    ? undefined
    : {
        command: 'pnpm start',
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
