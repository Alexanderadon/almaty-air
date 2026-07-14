/**
 * Тесты POST /api/collect: авторизация по x-collect-secret (правильный /
 * неправильный / отсутствующий / незаданный в env), успешный поток
 * сбор → срез → рассылка и безопасный ответ 500 без деталей ошибки.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST, dynamic } from '../route';
import type { CityAir } from '@/lib/types';
import { DISTRICT_SLUGS } from '@/lib/types';

const { getCityAir, saveCityAirSnapshot, notifyOnDeterioration } = vi.hoisted(() => ({
  getCityAir: vi.fn(),
  saveCityAirSnapshot: vi.fn(),
  notifyOnDeterioration: vi.fn(),
}));

vi.mock('@/lib/sources', () => ({ getCityAir }));
vi.mock('@/lib/history', () => ({ saveCityAirSnapshot }));
vi.mock('@/lib/push', () => ({ notifyOnDeterioration }));

const SECRET = 'test-collect-secret';

function cityAirStub(): CityAir {
  return {
    updatedAt: '2026-07-14T09:37:12.345Z',
    citywide: { aqi: 87, pm25: 28.6 },
    districts: DISTRICT_SLUGS.map((slug) => ({
      slug,
      aqi: 87,
      pm25: 28.6,
      dominant: 'pm25',
      stationCount: 3,
      dataOrigin: 'stations',
      observedAt: '2026-07-14T09:20:00.000Z',
    })),
    stations: [],
    sources: [],
    modelOnly: false,
  };
}

function collectRequest(secret?: string): Request {
  return new Request('https://almaty-air.test/api/collect', {
    method: 'POST',
    headers: secret === undefined ? {} : { 'x-collect-secret': secret },
  });
}

let savedSecret: string | undefined;

beforeEach(() => {
  savedSecret = process.env.COLLECT_SECRET;
  process.env.COLLECT_SECRET = SECRET;
  getCityAir.mockReset().mockResolvedValue(cityAirStub());
  saveCityAirSnapshot.mockReset().mockResolvedValue({ saved: 8, pruned: 3 });
  notifyOnDeterioration
    .mockReset()
    .mockResolvedValue({ configured: true, crossed: [], notified: 2, removed: 0 });
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env.COLLECT_SECRET;
  else process.env.COLLECT_SECRET = savedSecret;
});

describe('POST /api/collect — авторизация', () => {
  it('без заголовка — 401, сбор не запускается', async () => {
    const response = await POST(collectRequest());

    expect(response.status).toBe(401);
    expect(getCityAir).not.toHaveBeenCalled();
  });

  it('с неверным секретом — 401', async () => {
    const response = await POST(collectRequest('wrong-secret'));

    expect(response.status).toBe(401);
    expect(getCityAir).not.toHaveBeenCalled();
  });

  it('секрет другой длины — 401 (хэширование выравнивает длины, не бросает)', async () => {
    const response = await POST(collectRequest('x'));

    expect(response.status).toBe(401);
  });

  it('COLLECT_SECRET не задан в env — 401 даже с любым заголовком', async () => {
    delete process.env.COLLECT_SECRET;

    const response = await POST(collectRequest(''));

    expect(response.status).toBe(401);
    expect(getCityAir).not.toHaveBeenCalled();
  });

  it('с верным секретом — 200', async () => {
    const response = await POST(collectRequest(SECRET));

    expect(response.status).toBe(200);
  });
});

describe('POST /api/collect — поток сбора', () => {
  it('срез пишется из полученного CityAir, рассылка — после среза', async () => {
    const response = await POST(collectRequest(SECRET));
    const body = (await response.json()) as Record<string, unknown>;

    const air = getCityAir.mock.results[0].value as Promise<CityAir>;
    expect(saveCityAirSnapshot).toHaveBeenCalledWith(await air);
    expect(notifyOnDeterioration).toHaveBeenCalledWith(await air);
    // Порядок: сначала срез в БД, потом уведомления (пересечение ищется по ts < часа).
    expect(saveCityAirSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      notifyOnDeterioration.mock.invocationCallOrder[0],
    );

    expect(body).toEqual({
      savedDistricts: 8,
      pruned: 3,
      notified: 2,
      modelOnly: false,
      at: '2026-07-14T09:37:12.345Z',
    });
  });

  it('ошибка сбора — 500 с безопасным сообщением без деталей', async () => {
    getCityAir.mockRejectedValue(
      new Error('connection to postgres://user:password@host failed'),
    );
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(collectRequest(SECRET));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('postgres://');
    expect(JSON.stringify(body)).not.toContain('password');
    expect(body.error).toBe('Внутренняя ошибка сбора данных.');
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });

  it('ошибка записи среза тоже уходит в 500, рассылка не запускается', async () => {
    saveCityAirSnapshot.mockRejectedValue(new Error('БД недоступна'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(collectRequest(SECRET));

    expect(response.status).toBe(500);
    expect(notifyOnDeterioration).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it('маршрут форсирует динамический рендеринг', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
