/**
 * Тесты Open-Meteo (модель CAMS).
 *
 * Фикстуры openmeteo-current.json и openmeteo-history.json — РЕАЛЬНЫЕ ответы
 * air-quality-api.open-meteo.com, захваченные 2026-07-14 (current для восьми
 * центроидов районов; hourly с past_days=2&forecast_days=1 для центроида
 * Алмалинского района). Тестовое «сейчас» подгоняется под их метки времени.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pm10ToAqi, pm25ToAqi } from '../../aqi';
import { DISTRICTS } from '../../districts';
import openMeteoCurrent from '../__fixtures__/openmeteo-current.json';
import openMeteoHistory from '../__fixtures__/openmeteo-history.json';
import { fetchOpenMeteoCurrent, fetchOpenMeteoHistory } from '../openmeteo';
import { calledUrls, jsonResponse, type FetchLike } from './helpers';

interface MutableHistory {
  hourly: {
    time: string[];
    pm2_5: (number | null)[];
    pm10: (number | null)[];
  };
}

function cloneHistory(): MutableHistory {
  return JSON.parse(JSON.stringify(openMeteoHistory)) as MutableHistory;
}

/**
 * Синтетическая почасовая история: `hours` точек с шагом в час от startIso.
 * Метки времени — в формате Open-Meteo (`YYYY-MM-DDTHH:MM`, без зоны, UTC).
 */
function syntheticHistory(hours: number, startIso: string): MutableHistory {
  const start = Date.parse(startIso);
  const time: string[] = [];
  const pm25: (number | null)[] = [];
  const pm10: (number | null)[] = [];
  for (let i = 0; i < hours; i++) {
    time.push(new Date(start + i * 3_600_000).toISOString().slice(0, 16));
    pm25.push(10);
    pm10.push(20);
  }
  return { hourly: { time, pm2_5: pm25, pm10 } };
}

const fetchMock = vi.fn<FetchLike>();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-14T09:00:00Z'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchOpenMeteoCurrent — нормализация', () => {
  it('возвращает по одному модельному показанию на район', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openMeteoCurrent));

    const { status, stations } = await fetchOpenMeteoCurrent();

    expect(status).toEqual({ id: 'openmeteo', configured: true, ok: true, stations: 8 });
    expect(stations).toHaveLength(8);
    expect(stations.map((s) => s.districtSlug)).toEqual(DISTRICTS.map((d) => d.slug));

    const alatau = stations[0];
    expect(alatau.sourceId).toBe('openmeteo');
    expect(alatau.stationId).toBe('openmeteo-alatau');
    expect(alatau.name).toBe('Модель CAMS · Алатауский район');
    expect(alatau.lat).toBe(DISTRICTS[0].centroid[0]);
    expect(alatau.lon).toBe(DISTRICTS[0].centroid[1]);
    expect(alatau.stationAqi).toBeNull();
    expect(alatau.observedAt).toBe('2026-07-14T08:00:00.000Z');
    // Значения из реальной фикстуры: pm2_5=18.2, pm10=25.2.
    expect(alatau.measurements).toEqual([
      { pollutant: 'pm25', value: 18.2, aqi: 68 },
      { pollutant: 'pm10', value: 25.2, aqi: 23 },
    ]);

    // Медеу — другая ячейка сетки CAMS: pm2_5=7.9 → AQI 44.
    const medeu = stations[5];
    expect(medeu.districtSlug).toBe('medeu');
    expect(medeu.measurements[0]).toEqual({ pollutant: 'pm25', value: 7.9, aqi: 44 });
  });

  it('запрашивает все восемь центроидов одним вызовом со списками координат', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openMeteoCurrent));

    await fetchOpenMeteoCurrent();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = calledUrls(fetchMock)[0];
    expect(url).toContain('current=pm2_5,pm10');
    expect(url).toContain('timezone=UTC');
    const latList = new URL(url).searchParams.get('latitude') ?? '';
    expect(latList.split(',')).toHaveLength(8);
  });

  it('HTTP 500 → ok:false, без исключения', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: true }, 500));

    const { status, stations } = await fetchOpenMeteoCurrent();

    expect(status.ok).toBe(false);
    expect(status.configured).toBe(true);
    expect(status.detail).toBe('HTTP 500');
    expect(stations).toEqual([]);
  });

  it('сетевой сбой → ok:false, без исключения', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const { status, stations } = await fetchOpenMeteoCurrent();

    expect(status.ok).toBe(false);
    expect(status.detail).toContain('сбой запроса');
    expect(stations).toEqual([]);
  });
});

describe('fetchOpenMeteoHistory — окна и обрезка', () => {
  it.each([
    ['24h', 2],
    ['7d', 7],
    ['30d', 30],
  ] as const)('окно %s → past_days=%i и forecast_days=1', async (window, pastDays) => {
    fetchMock.mockResolvedValue(jsonResponse(openMeteoHistory));

    await fetchOpenMeteoHistory('almaly', window);

    const url = calledUrls(fetchMock)[0];
    expect(url).toContain(`past_days=${pastDays}`);
    expect(url).toContain('forecast_days=1');
    expect(url).toContain('hourly=pm2_5,pm10');
  });

  it('окно 24h: будущие часы отсечены, остаются последние 24 точки', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openMeteoHistory));

    const history = await fetchOpenMeteoHistory('almaly', '24h');

    expect(history.slug).toBe('almaly');
    expect(history.window).toBe('24h');
    expect(history.origin).toBe('model');
    expect(history.points).toHaveLength(24);
    // Фикстура: часы 2026-07-12T00:00…2026-07-14T23:00; «сейчас» 09:00Z →
    // последняя точка — 09:00, первая из 24 — вчера 10:00.
    expect(history.points[0].time).toBe('2026-07-13T10:00:00.000Z');
    expect(history.points[23].time).toBe('2026-07-14T09:00:00.000Z');
    // Индекс 57 в фикстуре = 2026-07-14T09:00.
    const expectedPm25 = openMeteoHistory.hourly.pm2_5[57];
    expect(history.points[23].pm25).toBe(expectedPm25);
    expect(history.points[23].aqi).toBe(pm25ToAqi(expectedPm25));
  });

  it('хвостовые точки без данных срезаются, дыры в середине остаются', async () => {
    const modified = cloneHistory();
    const n = modified.hourly.time.length; // 72
    for (const i of [n - 3, n - 2, n - 1]) {
      modified.hourly.pm2_5[i] = null;
      modified.hourly.pm10[i] = null;
    }
    modified.hourly.pm2_5[10] = null;
    modified.hourly.pm10[10] = null;
    fetchMock.mockResolvedValue(jsonResponse(modified));
    // Всё содержимое фикстуры в прошлом — будущих часов нет.
    vi.setSystemTime(new Date('2026-07-15T00:30:00Z'));

    const history = await fetchOpenMeteoHistory('almaly', '7d');

    expect(history.points).toHaveLength(69);
    expect(history.points[69 - 1].time).toBe('2026-07-14T20:00:00.000Z');
    expect(history.points[10]).toEqual({
      time: '2026-07-12T10:00:00.000Z',
      pm25: null,
      pm10: null,
      aqi: null,
    });
  });

  it('AQI точки: при отсутствии PM2.5 берётся PM10', async () => {
    const modified = cloneHistory();
    modified.hourly.pm2_5[20] = null;
    modified.hourly.pm10[20] = 30;
    fetchMock.mockResolvedValue(jsonResponse(modified));
    vi.setSystemTime(new Date('2026-07-15T00:30:00Z'));

    const history = await fetchOpenMeteoHistory('almaly', '7d');

    expect(history.points[20].pm25).toBeNull();
    expect(history.points[20].pm10).toBe(30);
    expect(history.points[20].aqi).toBe(pm10ToAqi(30));
  });

  it('AQI точки — худший из загрязнителей (правило EPA): пылевая буря с доминирующим PM10', async () => {
    const modified = cloneHistory();
    // Час пылевой бури: PM2.5 умеренный, PM10 экстремальный.
    modified.hourly.pm2_5[20] = 30;
    modified.hourly.pm10[20] = 350;
    fetchMock.mockResolvedValue(jsonResponse(modified));
    vi.setSystemTime(new Date('2026-07-15T00:30:00Z'));

    const history = await fetchOpenMeteoHistory('almaly', '7d');

    const pm25Aqi = pm25ToAqi(30);
    const pm10Aqi = pm10ToAqi(350);
    // Тест осмыслен, только если PM10 действительно доминирует.
    expect(pm10Aqi).not.toBeNull();
    expect(pm25Aqi).not.toBeNull();
    expect(pm10Aqi as number).toBeGreaterThan(pm25Aqi as number);
    expect(history.points[20].aqi).toBe(pm10Aqi);
  });

  it.each([
    ['7d', 168],
    ['30d', 720],
  ] as const)('окно %s ужимается ровно до %i точек — лишние сутки не рисуются', async (window, keep) => {
    // 800 часов от 2026-06-01T00:00Z — всё в прошлом относительно «сейчас».
    fetchMock.mockResolvedValue(jsonResponse(syntheticHistory(800, '2026-06-01T00:00:00Z')));

    const history = await fetchOpenMeteoHistory('almaly', window);

    expect(history.points).toHaveLength(keep);
    // Последняя точка — последний час данных (индекс 799), первая — ровно keep-1 часов раньше.
    const lastMs = Date.parse('2026-06-01T00:00:00Z') + 799 * 3_600_000;
    expect(history.points[keep - 1].time).toBe(new Date(lastMs).toISOString());
    expect(history.points[0].time).toBe(new Date(lastMs - (keep - 1) * 3_600_000).toISOString());
  });

  it('HTTP 500 → пустой список точек, без исключения', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: true }, 500));

    const history = await fetchOpenMeteoHistory('medeu', '7d');

    expect(history).toEqual({ slug: 'medeu', window: '7d', origin: 'model', points: [] });
  });

  it('сетевой сбой → пустой список точек, без исключения', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const history = await fetchOpenMeteoHistory('turksib', '30d');

    expect(history).toEqual({ slug: 'turksib', window: '30d', origin: 'model', points: [] });
  });
});

describe('таймаут запросов', () => {
  it('current и history уходят с таймаут-сигналом AbortSignal', async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        String(input).includes('hourly=')
          ? jsonResponse(openMeteoHistory)
          : jsonResponse(openMeteoCurrent),
      ),
    );

    await fetchOpenMeteoCurrent();
    await fetchOpenMeteoHistory('almaly', '24h');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });
});
