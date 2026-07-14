/**
 * Тесты OpenAQ v3. Фикстуры синтетические (структура по openapi.json,
 * сверено 2026-07-14), «сейчас» — 2026-07-14T09:00:00Z.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  openAqLatestByLocation,
  openAqLocationsResponse,
} from '../__fixtures__/openaq.fixture';
import { fetchOpenAq } from '../openaq';
import { calledUrls, jsonResponse, type FetchLike } from './helpers';

const fetchMock = vi.fn<FetchLike>();

function mockOpenAqApi(): void {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/v3/locations?')) {
      return Promise.resolve(jsonResponse(openAqLocationsResponse));
    }
    const latest = url.match(/\/v3\/locations\/(\d+)\/latest/);
    if (latest) {
      const body = openAqLatestByLocation[Number(latest[1])] ?? { results: [] };
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
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('fetchOpenAq', () => {
  it('без OPENAQ_API_KEY → configured:false, запросы не выполняются', async () => {
    vi.stubEnv('OPENAQ_API_KEY', undefined);

    const { status, stations } = await fetchOpenAq();

    expect(status).toEqual({
      id: 'openaq',
      configured: false,
      ok: false,
      stations: 0,
      detail: 'не настроен',
    });
    expect(stations).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('нормализует свежие PM2.5-показания в StationReading', async () => {
    mockOpenAqApi();

    const { status, stations } = await fetchOpenAq();

    expect(status).toEqual({ id: 'openaq', configured: true, ok: true, stations: 2 });
    expect(stations).toHaveLength(2);

    const almaly = stations.find((s) => s.stationId === 'openaq-2001');
    expect(almaly).toEqual({
      sourceId: 'openaq',
      stationId: 'openaq-2001',
      name: 'AirGradient Almaty Center',
      lat: 43.2523,
      lon: 76.9089,
      districtSlug: 'almaly',
      measurements: [{ pollutant: 'pm25', value: 18.4, aqi: 68 }],
      stationAqi: null,
      observedAt: '2026-07-14T08:15:00.000Z',
    });

    const bostandyk = stations.find((s) => s.stationId === 'openaq-2002');
    expect(bostandyk?.districtSlug).toBe('bostandyk');
    expect(bostandyk?.measurements).toEqual([{ pollutant: 'pm25', value: 12.1, aqi: 57 }]);
  });

  it('передаёт ключ заголовком X-API-Key', async () => {
    mockOpenAqApi();

    await fetchOpenAq();

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({ 'X-API-Key': 'test-openaq-key' });
  });

  it('каждый запрос уходит с таймаут-сигналом AbortSignal', async () => {
    mockOpenAqApi();

    await fetchOpenAq();

    expect(fetchMock.mock.calls.length).toBeGreaterThan(1); // гео-запрос + точечные /latest
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('устаревшие по datetimeLast и локации без координат не запрашиваются точечно', async () => {
    mockOpenAqApi();

    await fetchOpenAq();

    const urls = calledUrls(fetchMock);
    // 2003 молчит >3 ч, у 2005 нет координат — /latest для них не вызывается.
    expect(urls.some((u) => u.includes('/locations/2003/latest'))).toBe(false);
    expect(urls.some((u) => u.includes('/locations/2005/latest'))).toBe(false);
    // 1 гео-запрос + latest для 2001, 2002, 2004.
    expect(urls).toHaveLength(4);
  });

  it('показание старше трёх часов отбрасывается (локация 2004)', async () => {
    mockOpenAqApi();

    const { stations } = await fetchOpenAq();

    expect(stations.some((s) => s.stationId === 'openaq-2004')).toBe(false);
  });

  it('HTTP 500 на гео-запросе → ok:false, без исключения', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'internal error' }, 500));

    const { status, stations } = await fetchOpenAq();

    expect(status).toEqual({
      id: 'openaq',
      configured: true,
      ok: false,
      stations: 0,
      detail: 'HTTP 500',
    });
    expect(stations).toEqual([]);
  });

  it('сетевой сбой → ok:false, без исключения', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const { status } = await fetchOpenAq();

    expect(status.ok).toBe(false);
    expect(status.detail).toContain('сбой запроса');
  });
});
