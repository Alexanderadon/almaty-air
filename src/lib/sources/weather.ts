/**
 * Open-Meteo Forecast — текущая погода в центре Алматы для виджета и сцены
 * в герое. Без ключа. Декоративный слой: при любом сбое возвращает null,
 * страница рендерится без погоды. Никогда не бросает.
 */

import { FETCH_TIMEOUT_MS, REVALIDATE_CURRENT, toIsoUtc, type NextFetchInit } from './shared';

const FORECAST_API = 'https://api.open-meteo.com/v1/forecast';

/** Центр города — та же точка, что у радиуса поиска станций OpenAQ. */
export const ALMATY_CENTER = { latitude: 43.238, longitude: 76.889 } as const;

export interface CurrentWeather {
  /** Температура воздуха на 2 м, °C. */
  temperatureC: number;
  /** Код погоды WMO (см. src/lib/weather-codes.ts). */
  weatherCode: number;
  /** Скорость ветра на 10 м, м/с; null — не пришла. */
  windSpeedMs: number | null;
  /** День по солнцу в точке (для иконки «ясно»: солнце / луна). */
  isDay: boolean;
  /** Метка времени наблюдения, ISO UTC. */
  observedAt: string;
}

interface OpenMeteoForecastResponse {
  current?: {
    time?: string;
    temperature_2m?: number | null;
    weather_code?: number | null;
    wind_speed_10m?: number | null;
    is_day?: number | null;
  };
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function buildWeatherUrl(): string {
  const url = new URL(FORECAST_API);
  url.searchParams.set('latitude', String(ALMATY_CENTER.latitude));
  url.searchParams.set('longitude', String(ALMATY_CENTER.longitude));
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m,is_day');
  url.searchParams.set('wind_speed_unit', 'ms');
  url.searchParams.set('timezone', 'UTC');
  return url.toString();
}

/** Разбор ответа в CurrentWeather; null — если обязательных полей нет. */
export function parseCurrentWeather(payload: unknown): CurrentWeather | null {
  const current = (payload as OpenMeteoForecastResponse | null)?.current;
  if (!current) return null;
  const temperatureC = finiteOrNull(current.temperature_2m);
  const weatherCode = finiteOrNull(current.weather_code);
  const observedAt = typeof current.time === 'string' ? toIsoUtc(current.time) : null;
  if (temperatureC === null || weatherCode === null || observedAt === null) return null;
  return {
    temperatureC,
    weatherCode: Math.round(weatherCode),
    windSpeedMs: finiteOrNull(current.wind_speed_10m),
    isDay: current.is_day !== 0,
    observedAt,
  };
}

export async function fetchCurrentWeather(): Promise<CurrentWeather | null> {
  try {
    const init: NextFetchInit = {
      next: { revalidate: REVALIDATE_CURRENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    };
    const res = await fetch(buildWeatherUrl(), init);
    if (!res.ok) return null;
    return parseCurrentWeather(await res.json());
  } catch {
    return null;
  }
}
