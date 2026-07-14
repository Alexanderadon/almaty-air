import { expect, test } from '@playwright/test';

/**
 * Дымовые e2e-тесты: главная, страница района (Медеу), служебные эндпоинты.
 *
 * Тесты устойчивы к вариативности данных: конкретное значение AQI и категория
 * не проверяются — только присутствие числа/бейджа и структура страницы.
 * Главная ценность прогонов — график истории: visx строит SVG только после
 * срабатывания ResizeObserver (ParentSize), что требует реального видимого
 * вьюпорта — юнит-тесты в jsdom этого не покрывают.
 */

test.describe('Главная страница', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('герой: h1 и AQI-бейдж с числом видимы', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Качество воздуха в Алматы' }),
    ).toBeVisible();

    // Бейдж героя — role=img с aria-label «Индекс качества воздуха N — …».
    // Число любое (данные меняются каждый час), важно что оно есть.
    const heroBadge = page
      .getByRole('img', { name: /^Индекс качества воздуха \d+ — / })
      .first();
    await expect(heroBadge).toBeVisible();
  });

  test('карта: контейнер Leaflet смонтирован', async ({ page }) => {
    // AirMap грузится динамически без SSR — ждём клиентского монтирования.
    await expect(page.locator('.leaflet-container')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('районы: 8 карточек-ссылок', async ({ page }) => {
    const cards = page.locator(
      'section:has(#districts-heading) a[href^="/district/"]',
    );
    await expect(cards).toHaveCount(8);
  });

  test('легенда шкалы AQI: 6 категорий', async ({ page }) => {
    const scale = page.getByRole('list', {
      name: 'Шкала индекса качества воздуха AQI (US EPA)',
    });
    await expect(scale).toBeVisible();
    await expect(scale.getByRole('listitem')).toHaveCount(6);
  });
});

test.describe('Страница района: Медеу', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/district/medeu');
  });

  test('заголовок «Медеуский район» видим', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Медеуский район' }),
    ).toBeVisible();
  });

  test('график истории: SVG отрисован в видимом вьюпорте', async ({ page }) => {
    const history = page.locator('section:has(#history-heading)');
    await expect(history).toBeVisible();

    // Ключевая проверка: ParentSize (ResizeObserver) отдал ширину и visx
    // отрисовал SVG. В невидимом/нулевом контейнере этого не происходит.
    const chart = history.locator('svg[role="img"]').first();
    await expect(chart).toBeVisible({ timeout: 15_000 });
    await expect(chart).toHaveAttribute(
      'aria-label',
      'График изменения AQI за 24 часа',
    );
  });

  test('переключение таба «7 дней» меняет график', async ({ page }) => {
    const history = page.locator('section:has(#history-heading)');
    await expect(history.locator('svg[role="img"]').first()).toBeVisible({
      timeout: 15_000,
    });

    const tab7d = history.getByRole('tab', { name: '7 дней' });
    await tab7d.click();
    await expect(tab7d).toHaveAttribute('aria-selected', 'true');
    await expect(
      history.locator('svg[aria-label="График изменения AQI за 7 дней"]'),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('карточка push-подписки присутствует', async ({ page }) => {
    // Рендерится после гидрации: нужен инлайновый VAPID-ключ сборки и
    // поддержка Push API (в Chromium headless есть).
    await expect(
      page.getByRole('region', { name: 'Push-уведомления о качестве воздуха' }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Служебные эндпоинты', () => {
  test('POST /api/collect без секрета отвечает 401', async ({ request }) => {
    const res = await request.post('/api/collect');
    expect(res.status()).toBe(401);
  });

  test('манифест PWA: 200, JSON, имя «Воздух Алматы»', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('json');
    const manifest = (await res.json()) as { name?: string };
    expect(manifest.name).toBe('Воздух Алматы');
  });

  test('сервис-воркер /sw.js отдаётся: 200', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
  });
});
