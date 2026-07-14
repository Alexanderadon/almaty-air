// Записывает демо-тур по сайту в webm (Playwright recordVideo).
// Запуск: node scripts/video-tour.mjs [baseURL]  → docs/video/tour.webm
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] ?? 'https://almaty-air-two.vercel.app';
const OUT_DIR = path.resolve('docs', 'video');
const RAW_DIR = path.join(OUT_DIR, 'raw');
mkdirSync(RAW_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  colorScheme: 'dark',
  recordVideo: { dir: RAW_DIR, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();

/** Плавный скролл до элемента — резкие прыжки в видео выглядят дёшево. */
async function glideTo(selector) {
  await page.evaluate((sel) => {
    document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, selector);
  await page.waitForTimeout(1700);
}

// 1. Главная: герой с горами и счётчиком AQI.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(2600);

// 2. Карта: дождаться тайлов, дать рассмотреть бейджи районов и точки станций.
await glideTo('#map-heading');
await page
  .waitForFunction(
    () => {
      const tiles = [...document.querySelectorAll('img.leaflet-tile')];
      return tiles.length > 0 && tiles.every((t) => t.classList.contains('leaflet-tile-loaded'));
    },
    { timeout: 20000 },
  )
  .catch(() => {});
await page.waitForTimeout(2300);

// 3. Карточки районов со спарклайнами и рейтинг.
await glideTo('#districts-heading');
await page.waitForTimeout(1300);
await glideTo('#ranking-heading');
await page.waitForTimeout(1500);

// 4. Переход в район.
await page.locator('a[href="/district/medeu"]').first().click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2400);

// 5. График истории: переключить окна.
await glideTo('#history-heading');
await page.getByRole('tab', { name: '7 дней' }).click();
await page.waitForTimeout(1800);
await page.getByRole('tab', { name: '30 дней' }).click();
await page.waitForTimeout(1800);

// 6. Прогноз на 48 часов.
await glideTo('#forecast-heading');
await page.waitForTimeout(2200);

// 7. Назад на главную, финальный кадр: переключение темы (тёмная → светлая).
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const toggle = page.locator('header button[aria-label^="Тема"]');
if (await toggle.count()) {
  await toggle.click();
  await page.waitForTimeout(900);
  await toggle.click();
  await page.waitForTimeout(1600);
}

await context.close(); // финализирует видео
await browser.close();

const raw = readdirSync(RAW_DIR).find((f) => f.endsWith('.webm'));
if (!raw) {
  console.error('Видео не записалось');
  process.exit(1);
}
renameSync(path.join(RAW_DIR, raw), path.join(OUT_DIR, 'tour.webm'));
rmSync(RAW_DIR, { recursive: true, force: true });
console.log('OK: docs/video/tour.webm');
