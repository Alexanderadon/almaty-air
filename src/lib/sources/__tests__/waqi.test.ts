/**
 * Тесты WAQI. Фикстуры синтетические (структура по JSON API aqicn.org),
 * «сейчас» — 2026-07-14T09:00:00Z.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { waqiBoundsResponse, waqiFeedByUid } from '../__fixtures__/waqi.fixture';
import { fetchWaqi } from '../waqi';
import { calledUrls, jsonResponse, type FetchLike } from './helpers';

const fetchMock = vi.fn<FetchLike>();

function mockWaqiApi(
  bounds: unknown = waqiBoundsResponse,
  feeds: Record<number, object> = waqiFeedByUid,
): void {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/v2/map/bounds')) {
      return Promise.resolve(jsonResponse(bounds));
    }
    const feed = url.match(/\/feed\/@(\d+)\//);
    if (feed) {
      const body = feeds[Number(feed[1])] ?? { status: 'error', data: 'Unknown ID' };
      return Promise.resolve(jsonResponse(body));
    }
    return Promise.reject(new Error(`неожиданный URL в тесте: ${url}`));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-14T09:00:00Z'));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('WAQI_TOKEN', 'test-waqi-token');
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('fetchWaqi', () => {
  it('без WAQI_TOKEN → configured:false, запросы не выполняются', async () => {
    vi.stubEnv('WAQI_TOKEN', undefined);

    const { status, stations } = await fetchWaqi();

    expect(status).toEqual({
      id: 'waqi',
      configured: false,
      ok: false,
      stations: 0,
      detail: 'не настроен',
    });
    expect(stations).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('iaqi.pm25 — уже AQI: попадает в stationAqi, measurements пуст', async () => {
    mockWaqiApi();

    const { status, stations } = await fetchWaqi();

    expect(status).toEqual({ id: 'waqi', configured: true, ok: true, stations: 2 });

    const embassy = stations.find((s) => s.stationId === 'waqi-101');
    expect(embassy).toEqual({
      sourceId: 'waqi',
      stationId: 'waqi-101',
      name: 'Almaty US Embassy, Kazakhstan',
      lat: 43.2523,
      lon: 76.9089,
      districtSlug: 'almaly',
      measurements: [],
      stationAqi: 62,
      observedAt: '2026-07-14T08:00:00.000Z',
    });
  });

  it('без PM-компонент в iaqi берётся композитный AQI фида', async () => {
    mockWaqiApi();

    const { stations } = await fetchWaqi();

    const medeu = stations.find((s) => s.stationId === 'waqi-102');
    expect(medeu?.districtSlug).toBe('medeu');
    expect(medeu?.stationAqi).toBe(55);
    expect(medeu?.measurements).toEqual([]);
  });

  it('отрицательный iaqi.pm25 — глюк канала: отбрасывается, берётся pm10', async () => {
    const bounds = {
      status: 'ok',
      data: [
        {
          lat: 43.2523,
          lon: 76.9089,
          uid: 300,
          aqi: '41',
          station: { name: 'Glitchy PM25', time: '2026-07-14T13:00:00+05:00' },
        },
      ],
    };
    const feeds: Record<number, object> = {
      300: {
        status: 'ok',
        data: {
          aqi: 41,
          idx: 300,
          city: { geo: [43.2523, 76.9089], name: 'Glitchy PM25' },
          time: { iso: '2026-07-14T13:00:00+05:00' },
          iaqi: { pm25: { v: -3 }, pm10: { v: 41 } },
        },
      },
    };
    mockWaqiApi(bounds, feeds);

    const { stations } = await fetchWaqi();

    expect(stations).toHaveLength(1);
    expect(stations[0].stationAqi).toBe(41);
  });

  it('станция без единого канала в диапазоне [0, 500] отбрасывается целиком', async () => {
    const bounds = {
      status: 'ok',
      data: [
        {
          lat: 43.2523,
          lon: 76.9089,
          uid: 301,
          aqi: '-2',
          station: { name: 'All negative', time: '2026-07-14T13:00:00+05:00' },
        },
      ],
    };
    const feeds: Record<number, object> = {
      301: {
        status: 'ok',
        data: {
          aqi: -2,
          idx: 301,
          city: { geo: [43.2523, 76.9089], name: 'All negative' },
          time: { iso: '2026-07-14T13:00:00+05:00' },
          iaqi: { pm25: { v: -3 }, pm10: { v: -1 } },
        },
      },
    };
    mockWaqiApi(bounds, feeds);

    const { status, stations } = await fetchWaqi();

    expect(stations).toEqual([]);
    expect(status).toEqual({ id: 'waqi', configured: true, ok: true, stations: 0 });
  });

  it('iaqi.pm25 выше потолка шкалы прижимается к 500', async () => {
    const bounds = {
      status: 'ok',
      data: [
        {
          lat: 43.2523,
          lon: 76.9089,
          uid: 302,
          aqi: '500',
          station: { name: 'Extreme smog', time: '2026-07-14T13:00:00+05:00' },
        },
      ],
    };
    const feeds: Record<number, object> = {
      302: {
        status: 'ok',
        data: {
          aqi: 500,
          idx: 302,
          city: { geo: [43.2523, 76.9089], name: 'Extreme smog' },
          time: { iso: '2026-07-14T13:00:00+05:00' },
          iaqi: { pm25: { v: 99999 } },
        },
      },
    };
    mockWaqiApi(bounds, feeds);

    const { stations } = await fetchWaqi();

    expect(stations).toHaveLength(1);
    expect(stations[0].stationAqi).toBe(500);
  });

  it('каждый запрос уходит с таймаут-сигналом AbortSignal', async () => {
    mockWaqiApi();

    await fetchWaqi();

    expect(fetchMock.mock.calls.length).toBeGreaterThan(1); // bounds + точечные /feed
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('станции с aqi:"-" не запрашиваются точечно', async () => {
    mockWaqiApi();

    await fetchWaqi();

    const urls = calledUrls(fetchMock);
    expect(urls.some((u) => u.includes('/feed/@103/'))).toBe(false);
  });

  it('фид старше трёх часов отбрасывается (uid 104)', async () => {
    mockWaqiApi();

    const { stations } = await fetchWaqi();

    expect(stations.some((s) => s.stationId === 'waqi-104')).toBe(false);
  });

  it('точечные запросы ограничены двенадцатью станциями', async () => {
    const manyBounds = {
      status: 'ok',
      data: Array.from({ length: 15 }, (_, i) => ({
        lat: 43.2523,
        lon: 76.9089,
        uid: 200 + i,
        aqi: '50',
        station: { name: `Station ${200 + i}`, time: '2026-07-14T13:00:00+05:00' },
      })),
    };
    const feeds: Record<number, object> = {};
    for (let i = 0; i < 15; i++) {
      const uid = 200 + i;
      feeds[uid] = {
        status: 'ok',
        data: {
          aqi: 50,
          idx: uid,
          city: { geo: [43.2523, 76.9089], name: `Station ${uid}` },
          time: { iso: '2026-07-14T13:00:00+05:00' },
          iaqi: { pm25: { v: 50 } },
        },
      };
    }
    mockWaqiApi(manyBounds, feeds);

    const { stations } = await fetchWaqi();

    const feedCalls = calledUrls(fetchMock).filter((u) => u.includes('/feed/@'));
    expect(feedCalls).toHaveLength(12);
    expect(stations).toHaveLength(12);
  });

  it('status:"error" в теле → ok:false с причиной от API', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'error', data: 'Invalid key' }));

    const { status, stations } = await fetchWaqi();

    expect(status).toEqual({
      id: 'waqi',
      configured: true,
      ok: false,
      stations: 0,
      detail: 'Invalid key',
    });
    expect(stations).toEqual([]);
  });

  it('HTTP 500 → ok:false, без исключения', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    const { status } = await fetchWaqi();

    expect(status.ok).toBe(false);
    expect(status.detail).toBe('HTTP 500');
  });

  it('сетевой сбой → ok:false, без исключения', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const { status } = await fetchWaqi();

    expect(status.ok).toBe(false);
    expect(status.detail).toContain('сбой запроса');
  });
});
