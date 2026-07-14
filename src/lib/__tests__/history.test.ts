import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DB_COVERAGE_THRESHOLD,
  RETENTION_DAYS,
  WINDOW_HOURS,
  getDbHistory,
  hasDbCoverage,
  saveCityAirSnapshot,
  truncateToHourUtc,
} from '../history';
import { getDistrictHistory } from '../sources';
import type { CityAir, DistrictAir, HourlyPoint } from '../types';
import { DISTRICT_SLUGS } from '../types';

// БД и модельный фолбэк мокаем целиком: тесты проверяют форму запросов,
// а не сам Prisma, и не ходят в сеть. vi.hoisted — потому что фабрики
// vi.mock исполняются раньше тела модуля теста.
const { upsert, deleteMany, findMany, getPrisma, fetchOpenMeteoHistory } = vi.hoisted(() => {
  const upsert = vi.fn();
  const deleteMany = vi.fn();
  const findMany = vi.fn();
  return {
    upsert,
    deleteMany,
    findMany,
    getPrisma: vi.fn(() => ({ reading: { upsert, deleteMany, findMany } })),
    fetchOpenMeteoHistory: vi.fn(),
  };
});

vi.mock('../db', () => ({ getPrisma }));

vi.mock('../sources/openmeteo', () => ({
  fetchOpenMeteoCurrent: vi.fn(),
  fetchOpenMeteoHistory,
}));

function districtOf(slug: DistrictAir['slug'], overrides: Partial<DistrictAir> = {}): DistrictAir {
  return {
    slug,
    aqi: 87,
    pm25: 28.6,
    dominant: 'pm25',
    stationCount: 3,
    dataOrigin: 'stations',
    observedAt: '2026-07-14T09:20:00.000Z',
    ...overrides,
  };
}

function cityAirOf(updatedAt = '2026-07-14T09:37:12.345Z'): CityAir {
  return {
    updatedAt,
    citywide: { aqi: 87, pm25: 28.6 },
    districts: DISTRICT_SLUGS.map((slug) => districtOf(slug)),
    stations: [],
    sources: [],
    modelOnly: false,
  };
}

function pointsOf(count: number): HourlyPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(Date.UTC(2026, 6, 13, i)).toISOString(),
    pm25: 20 + i,
    pm10: null,
    aqi: 60 + i,
  }));
}

beforeEach(() => {
  upsert.mockReset().mockResolvedValue({});
  deleteMany.mockReset().mockResolvedValue({ count: 0 });
  findMany.mockReset().mockResolvedValue([]);
  getPrisma.mockClear();
  fetchOpenMeteoHistory.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('truncateToHourUtc', () => {
  it('обрезает минуты/секунды/миллисекунды до начала часа UTC', () => {
    expect(truncateToHourUtc(new Date('2026-07-14T09:37:12.345Z')).toISOString()).toBe(
      '2026-07-14T09:00:00.000Z',
    );
  });

  it('начало часа не меняется', () => {
    expect(truncateToHourUtc(new Date('2026-07-14T09:00:00.000Z')).toISOString()).toBe(
      '2026-07-14T09:00:00.000Z',
    );
  });
});

describe('saveCityAirSnapshot — форма строк', () => {
  it('пишет по одной строке на каждый из 8 районов, ts усечён до часа', async () => {
    const result = await saveCityAirSnapshot(cityAirOf(), new Date('2026-07-14T09:37:12.345Z'));

    expect(result.saved).toBe(8);
    expect(upsert).toHaveBeenCalledTimes(8);

    const hour = new Date('2026-07-14T09:00:00.000Z');
    const slugs = upsert.mock.calls.map(([arg]) => arg.where.districtSlug_ts.districtSlug);
    expect(slugs).toEqual([...DISTRICT_SLUGS]);
    for (const [arg] of upsert.mock.calls) {
      expect(arg.where.districtSlug_ts.ts).toEqual(hour);
      expect(arg.create).toEqual({
        districtSlug: arg.where.districtSlug_ts.districtSlug,
        ts: hour,
        aqi: 87,
        pm25: 28.6,
        pm10: null, // PM10 пока не агрегируется в DistrictAir
        dataOrigin: 'stations',
        stationCount: 3,
      });
      // При повторном сборе в тот же час строка обновляется, pm10 не трогаем.
      expect(arg.update).toEqual({
        aqi: 87,
        pm25: 28.6,
        dataOrigin: 'stations',
        stationCount: 3,
      });
    }
  });

  it('без явного ts час берётся из air.updatedAt', async () => {
    await saveCityAirSnapshot(cityAirOf('2026-01-02T23:59:59.999Z'));

    expect(upsert.mock.calls[0][0].where.districtSlug_ts.ts).toEqual(
      new Date('2026-01-02T23:00:00.000Z'),
    );
  });

  it('null-значения района сохраняются честно (без подмены)', async () => {
    const air = cityAirOf();
    air.districts[0] = districtOf('alatau', {
      aqi: null,
      pm25: null,
      dominant: null,
      stationCount: 0,
      dataOrigin: 'model',
      observedAt: null,
    });

    await saveCityAirSnapshot(air, new Date('2026-07-14T09:00:00.000Z'));

    expect(upsert.mock.calls[0][0].create).toMatchObject({
      districtSlug: 'alatau',
      aqi: null,
      pm25: null,
      dataOrigin: 'model',
      stationCount: 0,
    });
  });

  it('чистит строки старше 92 дней от часа среза и возвращает pruned', async () => {
    deleteMany.mockResolvedValue({ count: 17 });

    const result = await saveCityAirSnapshot(cityAirOf(), new Date('2026-07-14T09:37:00.000Z'));

    const hour = Date.parse('2026-07-14T09:00:00.000Z');
    const cutoff = new Date(hour - RETENTION_DAYS * 24 * 3_600_000);
    expect(deleteMany).toHaveBeenCalledWith({ where: { ts: { lt: cutoff } } });
    expect(result.pruned).toBe(17);
  });
});

describe('getDbHistory — выборка окна', () => {
  it('запрашивает ровно окно часов до текущего часа включительно и мапит строки в HourlyPoint', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T09:41:00.000Z'));
    findMany.mockResolvedValue([
      { ts: new Date('2026-07-14T08:00:00.000Z'), pm25: 30.2, pm10: 44.1, aqi: 92 },
      { ts: new Date('2026-07-14T09:00:00.000Z'), pm25: null, pm10: null, aqi: null },
    ]);

    const points = await getDbHistory('almaly', '24h');

    expect(findMany).toHaveBeenCalledWith({
      where: {
        districtSlug: 'almaly',
        ts: {
          gte: new Date('2026-07-13T10:00:00.000Z'), // 24 часа: 13.07 10:00 … 14.07 09:00
          lte: new Date('2026-07-14T09:00:00.000Z'),
        },
      },
      orderBy: { ts: 'asc' },
    });
    expect(points).toEqual([
      { time: '2026-07-14T08:00:00.000Z', pm25: 30.2, pm10: 44.1, aqi: 92 },
      { time: '2026-07-14T09:00:00.000Z', pm25: null, pm10: null, aqi: null },
    ]);
  });
});

describe('hasDbCoverage — порог 80%', () => {
  it.each([
    ['24h', 20, true], // 20/24 ≈ 83% ≥ 80%
    ['24h', 19, false], // 19/24 ≈ 79% < 80%
    ['7d', 135, true], // 135/168 ≈ 80.4%
    ['7d', 134, false], // 134/168 ≈ 79.8%
    ['30d', 576, true], // ровно 80% — включительно
    ['30d', 575, false],
  ] as const)('%s: %i точек → %s', (window, count, expected) => {
    expect(hasDbCoverage(pointsOf(count), window)).toBe(expected);
    // Санити: порог согласован с константами.
    expect(WINDOW_HOURS[window] * DB_COVERAGE_THRESHOLD).toBeLessThanOrEqual(
      WINDOW_HOURS[window],
    );
  });
});

describe('getDistrictHistory — БД против модели', () => {
  it('при покрытии ≥ 80% отдаёт точки из БД с origin "db", модель не трогает', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T09:41:00.000Z'));
    findMany.mockResolvedValue(
      pointsOf(20).map((p) => ({ ts: new Date(p.time), pm25: p.pm25, pm10: p.pm10, aqi: p.aqi })),
    );

    const history = await getDistrictHistory('almaly', '24h');

    expect(history.origin).toBe('db');
    expect(history.slug).toBe('almaly');
    expect(history.window).toBe('24h');
    expect(history.points).toHaveLength(20);
    expect(fetchOpenMeteoHistory).not.toHaveBeenCalled();
  });

  it('при покрытии < 80% падает на модель CAMS с origin "model"', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T09:41:00.000Z'));
    findMany.mockResolvedValue(
      pointsOf(19).map((p) => ({ ts: new Date(p.time), pm25: p.pm25, pm10: p.pm10, aqi: p.aqi })),
    );
    const model = { slug: 'almaly', window: '24h', origin: 'model', points: pointsOf(24) };
    fetchOpenMeteoHistory.mockResolvedValue(model);

    const history = await getDistrictHistory('almaly', '24h');

    expect(fetchOpenMeteoHistory).toHaveBeenCalledWith('almaly', '24h');
    expect(history).toBe(model);
  });

  it('сбой БД не роняет страницу: console.warn и фолбэк на модель', async () => {
    findMany.mockRejectedValue(new Error('соединение с БД потеряно'));
    const model = { slug: 'medeu', window: '7d', origin: 'model', points: [] };
    fetchOpenMeteoHistory.mockResolvedValue(model);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const history = await getDistrictHistory('medeu', '7d');

    expect(history).toBe(model);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('сбой самой инициализации клиента (нет DATABASE_URL) тоже уводит на модель', async () => {
    getPrisma.mockImplementationOnce(() => {
      throw new Error('DATABASE_URL не задан');
    });
    const model = { slug: 'turksib', window: '30d', origin: 'model', points: [] };
    fetchOpenMeteoHistory.mockResolvedValue(model);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const history = await getDistrictHistory('turksib', '30d');

    expect(history).toBe(model);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
