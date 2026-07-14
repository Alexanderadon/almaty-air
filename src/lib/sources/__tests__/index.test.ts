/**
 * Тесты агрегатора getCityAir: медианы по районам, модельный фолбэк,
 * статусы источников, устойчивость к отказам.
 *
 * Open-Meteo — реальная фикстура (2026-07-14): pm2_5=18.2/pm10=25.2 во всех
 * районах, кроме Медеуского (pm2_5=7.9/pm10=14). OpenAQ/WAQI — синтетика.
 * «Сейчас» — 2026-07-14T09:00:00Z.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DISTRICT_SLUGS } from '../../types';
import {
  openAqLatestByLocation,
  openAqLocationsResponse,
} from '../__fixtures__/openaq.fixture';
import openMeteoCurrent from '../__fixtures__/openmeteo-current.json';
import { waqiBoundsResponse, waqiFeedByUid } from '../__fixtures__/waqi.fixture';
import { getCityAir } from '../index';
import { jsonResponse, type FetchLike } from './helpers';

const fetchMock = vi.fn<FetchLike>();

/** Диспетчер: полноценные ответы всех трёх источников. */
function mockAllProviders(): void {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.startsWith('https://air-quality-api.open-meteo.com/')) {
      return Promise.resolve(jsonResponse(openMeteoCurrent));
    }
    if (url.includes('api.openaq.org/v3/locations?')) {
      return Promise.resolve(jsonResponse(openAqLocationsResponse));
    }
    const latest = url.match(/api\.openaq\.org\/v3\/locations\/(\d+)\/latest/);
    if (latest) {
      const body = openAqLatestByLocation[Number(latest[1])] ?? { results: [] };
      return Promise.resolve(jsonResponse(body));
    }
    if (url.includes('api.waqi.info/v2/map/bounds')) {
      return Promise.resolve(jsonResponse(waqiBoundsResponse));
    }
    const feed = url.match(/api\.waqi\.info\/feed\/@(\d+)\//);
    if (feed) {
      const body = waqiFeedByUid[Number(feed[1])] ?? { status: 'error', data: 'Unknown ID' };
      return Promise.resolve(jsonResponse(body));
    }
    return Promise.reject(new Error(`неожиданный URL в тесте: ${url}`));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-14T09:00:00Z'));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('OPENAQ_API_KEY', 'test-openaq-key');
  vi.stubEnv('WAQI_TOKEN', 'test-waqi-token');
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('getCityAir — агрегация станций и модели', () => {
  it('районы со станциями получают медиану, остальные — модель CAMS', async () => {
    mockAllProviders();

    const city = await getCityAir();

    expect(city.districts.map((d) => d.slug)).toEqual([...DISTRICT_SLUGS]);
    expect(city.modelOnly).toBe(false);
    expect(city.updatedAt).toBe('2026-07-14T09:00:00.000Z');

    // Алмалы: OpenAQ 18.4 мкг/м³ → AQI 68; WAQI iaqi.pm25 → 62. median([68,62]) = 65.
    const almaly = city.districts.find((d) => d.slug === 'almaly');
    expect(almaly).toEqual({
      slug: 'almaly',
      aqi: 65,
      pm25: 18.4,
      dominant: 'pm25',
      stationCount: 2,
      dataOrigin: 'stations',
      observedAt: '2026-07-14T08:15:00.000Z',
    });

    // Бостандык: одна станция OpenAQ, 12.1 мкг/м³ → AQI 57.
    const bostandyk = city.districts.find((d) => d.slug === 'bostandyk');
    expect(bostandyk?.aqi).toBe(57);
    expect(bostandyk?.stationCount).toBe(1);
    expect(bostandyk?.dataOrigin).toBe('stations');

    // Медеу: только WAQI со stationAqi 55 — pm25 и dominant неизвестны.
    const medeu = city.districts.find((d) => d.slug === 'medeu');
    expect(medeu).toEqual({
      slug: 'medeu',
      aqi: 55,
      pm25: null,
      dominant: null,
      stationCount: 1,
      dataOrigin: 'stations',
      observedAt: '2026-07-14T08:00:00.000Z',
    });

    // Ауэзов: станций нет → модель CAMS (pm2_5=18.2 → AQI 68 > AQI PM10 23).
    const auezov = city.districts.find((d) => d.slug === 'auezov');
    expect(auezov).toEqual({
      slug: 'auezov',
      aqi: 68,
      pm25: 18.2,
      dominant: 'pm25',
      stationCount: 0,
      dataOrigin: 'model',
      observedAt: '2026-07-14T08:00:00.000Z',
    });
  });

  it('citywide — медианы по районам', async () => {
    mockAllProviders();

    const city = await getCityAir();

    // AQI районов: [68, 65, 68, 57, 68, 55, 68, 68] → медиана 68.
    expect(city.citywide.aqi).toBe(68);
    // PM2.5 районов: [18.2, 18.4, 18.2, 12.1, 18.2, —, 18.2, 18.2] → медиана 18.2.
    expect(city.citywide.pm25).toBe(18.2);
  });

  it('в stations — только реальные сенсоры, без модельных точек', async () => {
    mockAllProviders();

    const city = await getCityAir();

    expect(city.stations).toHaveLength(4); // openaq 2001, 2002 + waqi 101, 102
    expect(city.stations.every((s) => s.sourceId !== 'openmeteo')).toBe(true);

    expect(city.sources.map((s) => s.id)).toEqual(['openaq', 'waqi', 'openmeteo']);
    expect(city.sources.map((s) => s.ok)).toEqual([true, true, true]);
    expect(city.sources.map((s) => s.stations)).toEqual([2, 2, 8]);
  });

  it('без ключей станционных провайдеров все районы — модель, modelOnly:true', async () => {
    vi.stubEnv('OPENAQ_API_KEY', undefined);
    vi.stubEnv('WAQI_TOKEN', undefined);
    mockAllProviders();

    const city = await getCityAir();

    expect(city.modelOnly).toBe(true);
    expect(city.stations).toEqual([]);
    expect(city.districts.every((d) => d.dataOrigin === 'model')).toBe(true);
    expect(city.districts.every((d) => d.stationCount === 0)).toBe(true);

    const medeu = city.districts.find((d) => d.slug === 'medeu');
    expect(medeu?.aqi).toBe(44); // модель: pm2_5=7.9 → AQI 44
    expect(medeu?.pm25).toBe(7.9);

    // AQI районов: [68×7, 44] → медиана 68.
    expect(city.citywide.aqi).toBe(68);

    const openaqStatus = city.sources.find((s) => s.id === 'openaq');
    expect(openaqStatus?.configured).toBe(false);
    expect(openaqStatus?.detail).toBe('не настроен');
  });

  it('HTTP 500 одного провайдера не роняет агрегатор', async () => {
    vi.stubEnv('WAQI_TOKEN', undefined);
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith('https://air-quality-api.open-meteo.com/')) {
        return Promise.resolve(jsonResponse(openMeteoCurrent));
      }
      if (url.includes('api.openaq.org')) {
        return Promise.resolve(jsonResponse({ detail: 'internal error' }, 500));
      }
      return Promise.reject(new Error(`неожиданный URL в тесте: ${url}`));
    });

    const city = await getCityAir();

    const openaqStatus = city.sources.find((s) => s.id === 'openaq');
    expect(openaqStatus).toEqual({
      id: 'openaq',
      configured: true,
      ok: false,
      stations: 0,
      detail: 'HTTP 500',
    });
    expect(city.modelOnly).toBe(true);
    expect(city.districts.every((d) => d.dataOrigin === 'model')).toBe(true);
    expect(city.citywide.aqi).toBe(68);
  });

  it('полный отказ всех источников → районы с aqi:null, без исключений', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const city = await getCityAir();

    expect(city.districts).toHaveLength(8);
    for (const district of city.districts) {
      expect(district.aqi).toBeNull();
      expect(district.pm25).toBeNull();
      expect(district.dominant).toBeNull();
      expect(district.stationCount).toBe(0);
      expect(district.observedAt).toBeNull();
    }
    expect(city.citywide).toEqual({ aqi: null, pm25: null });
    expect(city.stations).toEqual([]);
    expect(city.modelOnly).toBe(true);
    expect(city.sources.every((s) => !s.ok)).toBe(true);
  });
});
