/**
 * Погода Open-Meteo: разбор ответа, параметры запроса, сбои → null (никогда
 * не бросает — слой декоративный).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildWeatherUrl, fetchCurrentWeather, parseCurrentWeather } from '../weather';
import { calledUrls, jsonResponse, type FetchLike } from './helpers';

/** Реалистичный ответ api.open-meteo.com/v1/forecast с блоком current. */
const PAYLOAD = {
  latitude: 43.25,
  longitude: 76.875,
  timezone: 'UTC',
  current_units: { temperature_2m: '°C', weather_code: 'wmo code', wind_speed_10m: 'm/s' },
  current: {
    time: '2026-09-07T12:00',
    interval: 900,
    temperature_2m: 27.4,
    weather_code: 3,
    wind_speed_10m: 2.6,
    is_day: 1,
  },
};

const fetchMock = vi.fn<FetchLike>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('parseCurrentWeather', () => {
  it('разбирает блок current, время — в ISO UTC', () => {
    expect(parseCurrentWeather(PAYLOAD)).toEqual({
      temperatureC: 27.4,
      weatherCode: 3,
      windSpeedMs: 2.6,
      isDay: true,
      observedAt: '2026-09-07T12:00:00.000Z',
    });
  });

  it('без температуры или кода — null; ветер необязателен', () => {
    expect(parseCurrentWeather({ current: { time: '2026-09-07T12:00', weather_code: 3 } })).toBeNull();
    expect(
      parseCurrentWeather({ current: { time: '2026-09-07T12:00', temperature_2m: 1 } }),
    ).toBeNull();
    expect(parseCurrentWeather({})).toBeNull();
    expect(parseCurrentWeather(null)).toBeNull();
    expect(
      parseCurrentWeather({
        current: { time: '2026-09-07T12:00', temperature_2m: -4, weather_code: 71, is_day: 0 },
      }),
    ).toEqual({
      temperatureC: -4,
      weatherCode: 71,
      windSpeedMs: null,
      isDay: false,
      observedAt: '2026-09-07T12:00:00.000Z',
    });
  });
});

describe('fetchCurrentWeather', () => {
  it('запрашивает центр Алматы, ветер в м/с, время в UTC', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(PAYLOAD));
    const weather = await fetchCurrentWeather();
    expect(weather?.temperatureC).toBe(27.4);
    const url = new URL(calledUrls(fetchMock)[0]);
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('43.238');
    expect(url.searchParams.get('longitude')).toBe('76.889');
    expect(url.searchParams.get('current')).toContain('weather_code');
    expect(url.searchParams.get('wind_speed_unit')).toBe('ms');
    expect(url.searchParams.get('timezone')).toBe('UTC');
    expect(buildWeatherUrl()).toBe(calledUrls(fetchMock)[0]);
  });

  it('HTTP-ошибка, битый JSON и сетевой сбой → null, без исключений', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ reason: 'bad' }, 500));
    expect(await fetchCurrentWeather()).toBeNull();

    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    expect(await fetchCurrentWeather()).toBeNull();

    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    expect(await fetchCurrentWeather()).toBeNull();
  });
});
