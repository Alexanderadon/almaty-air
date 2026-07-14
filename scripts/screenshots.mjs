/**
 * Продакшен-скриншоты для docs/screenshots/ (используются в README).
 *
 * Запуск: node scripts/screenshots.mjs
 * База переопределяется: PLAYWRIGHT_BASE_URL=http://localhost:3000 node …
 *
 * Тёмная схема (prefers-color-scheme: dark) — сайт в ней выглядит выигрышнее
 * (тайлы OSM остаются светлыми — это штатный вид карты в тёмной теме).
 * Перед снимком ждём networkidle и дополнительную паузу, чтобы тайлы карты
 * успели дорисоваться (иначе серая сетка вместо карты).
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'https://almaty-air-two.vercel.app';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

/** Пауза: дорисовка тайлов карты и анимаций после networkidle. */
const SETTLE_MS = 2500;

async function openPage(browser, viewport) {
  const context = await browser.newContext({
    viewport,
    colorScheme: 'dark',
    locale: 'ru-RU',
    timezoneId: 'Asia/Almaty',
    deviceScaleFactor: viewport === MOBILE ? 2 : 1,
    // Карточка push-подписки в состоянии «можно подписаться» (не «denied»).
    permissions: ['notifications'],
  });
  return context.newPage();
}

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(SETTLE_MS);
}

/** Все тайлы Leaflet дорисованы — карта без серых квадратов. */
async function waitForTiles(page) {
  await page.locator('.leaflet-container').waitFor({ timeout: 20_000 });
  await page
    .waitForFunction(
      () => {
        const tiles = Array.from(document.querySelectorAll('img.leaflet-tile'));
        return (
          tiles.length > 0 &&
          tiles.every((t) => t.classList.contains('leaflet-tile-loaded'))
        );
      },
      { timeout: 20_000 },
    )
    .catch(() => {}); // не критично: снимем что успело загрузиться
}

/**
 * fullPage-скриншот, устойчивый к ParentSize: расширение вьюпорта при
 * захвате перерисовывает visx-график (ResizeObserver + debounce), и SVG
 * может оказаться пустым. Растягиваем вьюпорт на всю высоту страницы
 * заранее, даём графику перерисоваться и снимаем обычный кадр.
 */
async function fullPageScreenshot(page, path) {
  const { width } = page.viewportSize();
  const fullHeight = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width, height: Math.ceil(fullHeight) });
  await page.waitForTimeout(800);
  await page.screenshot({ path });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  // Headed по умолчанию: headless-Chromium отдаёт Notification.permission
  // 'denied' даже при выданном разрешении — карточка push-подписки попадала
  // бы в кадр в состоянии «заблокировано». HEADLESS=1 — для сред без дисплея.
  const browser = await chromium.launch({
    headless: process.env.HEADLESS === '1',
  });

  // Главная — desktop (полная страница: герой, карта, районы, шкала).
  {
    const page = await openPage(browser, DESKTOP);
    await page.goto(`${BASE}/`);
    await waitForTiles(page);
    await settle(page);
    await fullPageScreenshot(page, join(OUT_DIR, 'home-desktop.png'));
    await page.context().close();
    console.log('home-desktop.png');
  }

  // Главная — mobile.
  {
    const page = await openPage(browser, MOBILE);
    await page.goto(`${BASE}/`);
    await waitForTiles(page);
    await settle(page);
    await fullPageScreenshot(page, join(OUT_DIR, 'home-mobile.png'));
    await page.context().close();
    console.log('home-mobile.png');
  }

  // Район Медеу — desktop + крупный план графика.
  {
    const page = await openPage(browser, DESKTOP);
    await page.goto(`${BASE}/district/medeu`);
    const history = page.locator('section:has(#history-heading)');
    await history.locator('svg[role="img"]').first().waitFor({ timeout: 20_000 });
    await settle(page);
    await fullPageScreenshot(page, join(OUT_DIR, 'district-desktop.png'));
    console.log('district-desktop.png');

    await history.scrollIntoViewIfNeeded();
    await history.locator('svg[role="img"]').first().waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await history.screenshot({ path: join(OUT_DIR, 'chart-close.png') });
    await page.context().close();
    console.log('chart-close.png');
  }

  // Район Медеу — mobile.
  {
    const page = await openPage(browser, MOBILE);
    await page.goto(`${BASE}/district/medeu`);
    await page
      .locator('section:has(#history-heading) svg[role="img"]')
      .first()
      .waitFor({ timeout: 20_000 });
    await settle(page);
    await fullPageScreenshot(page, join(OUT_DIR, 'district-mobile.png'));
    await page.context().close();
    console.log('district-mobile.png');
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
