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
