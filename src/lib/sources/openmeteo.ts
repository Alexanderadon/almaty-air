/**
 * Open-Meteo Air Quality — модельный слой (CAMS Global, сетка ~40 км).
 * Работает без ключа, поэтому configured всегда true.
 *
 * Текущие значения запрашиваются одним вызовом для восьми центроидов районов
 * (API принимает списки координат через запятую и возвращает JSON-массив —
 * проверено живым запросом 2026-07-14). Это МОДЕЛЬНЫЕ данные: агрегатор
 * не смешивает их с реальными станциями, а использует как фолбэк района.
 */

import { pm10ToAqi, pm25ToAqi } from '../aqi';
import { DISTRICTS } from '../districts';
import type {
  DistrictHistory,
  DistrictSlug,
  HistoryWindow,
  HourlyPoint,
  Measurement,
  SourceStatus,
  StationReading,
} from '../types';
import {
  errorDetail,
  FETCH_TIMEOUT_MS,
  REVALIDATE_CURRENT,
  REVALIDATE_HISTORY,
  toIsoUtc,
  type NextFetchInit,
  type ProviderResult,
} from './shared';

const AIR_QUALITY_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/** Глубина истории в днях по окну; forecast_days=1 добирает часы текущих суток. */
const PAST_DAYS: Record<HistoryWindow, number> = { '24h': 2, '7d': 7, '30d': 30 };

/** Точное число часовых точек в окне — ровно столько, сколько обещает подпись. */
const KEEP_POINTS: Record<HistoryWindow, number> = { '24h': 24, '7d': 7 * 24, '30d': 30 * 24 };

interface OpenMeteoCurrentBlock {
  time?: string;
  interval?: number;
  pm2_5?: number | null;
  pm10?: number | null;
}

interface OpenMeteoCurrentEntry {
  latitude?: number;
  longitude?: number;
  current?: OpenMeteoCurrentBlock;
}

interface OpenMeteoHourlyBlock {
  time?: string[];
  pm2_5?: (number | null)[];
  pm10?: (number | null)[];
}

interface OpenMeteoHistoryResponse {
  hourly?: OpenMeteoHourlyBlock;
}

/** Конечная неотрицательная концентрация либо null. */
function sanitizeConcentration(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function buildMeasurements(block: OpenMeteoCurrentBlock): Measurement[] {
  const measurements: Measurement[] = [];
  const pm25 = sanitizeConcentration(block.pm2_5);
  if (pm25 !== null) measurements.push({ pollutant: 'pm25', value: pm25, aqi: pm25ToAqi(pm25) });
  const pm10 = sanitizeConcentration(block.pm10);
  if (pm10 !== null) measurements.push({ pollutant: 'pm10', value: pm10, aqi: pm10ToAqi(pm10) });
  return measurements;
}

/**
 * Текущие модельные значения PM2.5/PM10 для центроидов восьми районов.
 * Один HTTP-запрос; порядок элементов ответа совпадает с порядком координат
 * в запросе (порядок DISTRICTS). Никогда не бросает исключений.
 */
export async function fetchOpenMeteoCurrent(): Promise<ProviderResult> {
  const failed = (detail: string): ProviderResult => ({
    status: { id: 'openmeteo', configured: true, ok: false, stations: 0, detail },
    stations: [],
  });

  try {
    const lats = DISTRICTS.map((d) => d.centroid[0].toFixed(4)).join(',');
    const lons = DISTRICTS.map((d) => d.centroid[1].toFixed(4)).join(',');
    const url = `${AIR_QUALITY_API}?latitude=${lats}&longitude=${lons}&current=pm2_5,pm10&timezone=UTC`;
    const init: NextFetchInit = {
      next: { revalidate: REVALIDATE_CURRENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    };
    const res = await fetch(url, init);
    if (!res.ok) return failed(`HTTP ${res.status}`);

    const payload: unknown = await res.json();
    const entries: OpenMeteoCurrentEntry[] = Array.isArray(payload)
      ? (payload as OpenMeteoCurrentEntry[])
      : [payload as OpenMeteoCurrentEntry];

    const stations: StationReading[] = [];
    DISTRICTS.forEach((district, index) => {
      const current = entries[index]?.current;
      if (!current?.time) return;
      const observedAt = toIsoUtc(current.time);
      if (observedAt === null) return;
      const measurements = buildMeasurements(current);
      if (measurements.length === 0) return;
      stations.push({
        sourceId: 'openmeteo',
        stationId: `openmeteo-${district.slug}`,
        name: `Модель CAMS · ${district.nameRu}`,
        lat: district.centroid[0],
        lon: district.centroid[1],
        districtSlug: district.slug,
        measurements,
        stationAqi: null,
        observedAt,
      });
    });

    const status: SourceStatus = {
      id: 'openmeteo',
      configured: true,
      ok: true,
      stations: stations.length,
    };
    return { status, stations };
  } catch (error) {
    return failed(errorDetail(error));
  }
}

/**
 * Почасовая модельная история для центроида района.
 *
 * Запрашиваем past_days по окну + forecast_days=1: у CAMS часы текущих суток
 * лежат в «прогнозном» дне. Часы позже текущего момента отсекаются (прогноз —
 * не история), затем срезаются хвостовые точки без данных, и окно ужимается
 * ровно до KEEP_POINTS часов (24/168/720) — сколько обещает подпись вкладки.
 * AQI точки — максимум из AQI(PM2.5) и AQI(PM10), правило EPA «худший
 * загрязнитель» (контракт HourlyPoint). При любом сбое — пустой список точек,
 * исключений не бросает.
 */
export async function fetchOpenMeteoHistory(
  slug: DistrictSlug,
  window: HistoryWindow,
): Promise<DistrictHistory> {
  const empty: DistrictHistory = { slug, window, origin: 'model', points: [] };
  const district = DISTRICTS.find((d) => d.slug === slug);
  if (!district) return empty; // недостижимо при корректном DistrictSlug — защитная ветка

  try {
    const [lat, lon] = district.centroid;
    const url =
      `${AIR_QUALITY_API}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&hourly=pm2_5,pm10&past_days=${PAST_DAYS[window]}&forecast_days=1&timezone=UTC`;
    const init: NextFetchInit = {
      next: { revalidate: REVALIDATE_HISTORY },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    };
    const res = await fetch(url, init);
    if (!res.ok) return empty;

    const payload = (await res.json()) as OpenMeteoHistoryResponse;
    const times = payload.hourly?.time ?? [];
    const pm25s = payload.hourly?.pm2_5 ?? [];
    const pm10s = payload.hourly?.pm10 ?? [];
    const now = Date.now();

    let points: HourlyPoint[] = [];
    for (let i = 0; i < times.length; i++) {
      const time = toIsoUtc(times[i]);
      if (time === null) continue;
      if (Date.parse(time) > now) break; // будущие (прогнозные) часы — не история
      const pm25 = sanitizeConcentration(pm25s[i]);
      const pm10 = sanitizeConcentration(pm10s[i]);
      // Худший из загрязнителей (правило EPA) — как в текущих значениях района.
      const pm25Aqi = pm25 !== null ? pm25ToAqi(pm25) : null;
      const pm10Aqi = pm10 !== null ? pm10ToAqi(pm10) : null;
      const aqi =
        pm25Aqi !== null && pm10Aqi !== null ? Math.max(pm25Aqi, pm10Aqi) : (pm25Aqi ?? pm10Aqi);
      points.push({ time, pm25, pm10, aqi });
    }

    while (points.length > 0) {
      const last = points[points.length - 1];
      if (last.pm25 !== null || last.pm10 !== null) break;
      points.pop();
    }

    points = points.slice(-KEEP_POINTS[window]);

    return { slug, window, origin: 'model', points };
  } catch {
    return empty;
  }
}
