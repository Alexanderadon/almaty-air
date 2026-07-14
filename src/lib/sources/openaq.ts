/**
 * OpenAQ v3 — станционный слой (сенсоры AirGradient в Алматы, только PM2.5).
 * Требует OPENAQ_API_KEY (заголовок X-API-Key).
 *
 * Стратегия запросов (сверено с живым openapi.json 2026-07-14):
 * у /v3/parameters/{id}/latest НЕТ гео-фильтра (только limit/page/datetime_min),
 * массового latest-эндпоинта в v3 нет вовсе. Поэтому:
 *   1) один гео-запрос /v3/locations?coordinates&radius=25000&parameters_id=2 —
 *      метаданные всех локаций с PM2.5-сенсорами и datetimeLast;
 *   2) точечные /v3/locations/{id}/latest только для локаций, свежих по
 *      datetimeLast (значит, лишних запросов к молчащим сенсорам нет),
 *      с приоритетом локаций внутри районов города и потолком DETAIL_CAP —
 *      бюджет держит нас в лимитах OpenAQ (60 зап/мин) при ревалидации 1800 с.
 */

import { pm25ToAqi } from '../aqi';
import { districtForPoint } from '../districts';
import type { DistrictSlug, SourceStatus, StationReading } from '../types';
import {
  errorDetail,
  isFresh,
  REVALIDATE_CURRENT,
  toIsoUtc,
  type NextFetchInit,
  type ProviderResult,
} from './shared';

const BASE = 'https://api.openaq.org/v3';
/** Центр Алматы для гео-запроса. */
const CENTER = '43.238,76.889';
/** Максимально допустимый API радиус, м. */
const RADIUS_M = 25000;
/** id параметра pm25 в справочнике OpenAQ. */
const PM25_PARAMETER_ID = 2;
const LOCATIONS_LIMIT = 1000;
/** Потолок точечных запросов latest за один цикл. */
const DETAIL_CAP = 24;

interface OpenAqDatetime {
  utc?: string | null;
  local?: string | null;
}

interface OpenAqCoordinates {
  latitude?: number | null;
  longitude?: number | null;
}

interface OpenAqSensor {
  id?: number | null;
  name?: string | null;
  parameter?: { id?: number | null; name?: string | null } | null;
}

interface OpenAqLocation {
  id?: number | null;
  name?: string | null;
  coordinates?: OpenAqCoordinates | null;
  datetimeLast?: OpenAqDatetime | null;
  sensors?: OpenAqSensor[] | null;
}

interface OpenAqLocationsResponse {
  results?: OpenAqLocation[];
}

interface OpenAqLatestEntry {
  datetime?: OpenAqDatetime | null;
  value?: number | null;
  coordinates?: OpenAqCoordinates | null;
  sensorsId?: number | null;
  locationsId?: number | null;
}

interface OpenAqLatestResponse {
  results?: OpenAqLatestEntry[];
}

interface Candidate {
  id: number;
  name: string;
  lat: number;
  lon: number;
  districtSlug: DistrictSlug | null;
  pm25SensorIds: Set<number>;
}

function isPm25Sensor(sensor: OpenAqSensor): boolean {
  return sensor.parameter?.id === PM25_PARAMETER_ID || sensor.parameter?.name === 'pm25';
}

/** Свежее PM2.5-показание локации → StationReading; null, если данных нет. */
async function fetchLatestReading(
  candidate: Candidate,
  apiKey: string,
  nowMs: number,
): Promise<StationReading | null> {
  const init: NextFetchInit = {
    headers: { 'X-API-Key': apiKey },
    next: { revalidate: REVALIDATE_CURRENT },
  };
  const res = await fetch(`${BASE}/locations/${candidate.id}/latest?limit=100`, init);
  if (!res.ok) return null;
  const entries = ((await res.json()) as OpenAqLatestResponse).results ?? [];

  for (const entry of entries) {
    if (typeof entry.sensorsId !== 'number' || !candidate.pm25SensorIds.has(entry.sensorsId)) {
      continue;
    }
    const rawUtc = entry.datetime?.utc;
    const observedAt = typeof rawUtc === 'string' ? toIsoUtc(rawUtc) : null;
    if (observedAt === null || !isFresh(observedAt, nowMs)) continue;
    const value = entry.value;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue;

    return {
      sourceId: 'openaq',
      stationId: `openaq-${candidate.id}`,
      name: candidate.name,
      lat: candidate.lat,
      lon: candidate.lon,
      districtSlug: candidate.districtSlug,
      measurements: [{ pollutant: 'pm25', value, aqi: pm25ToAqi(value) }],
      stationAqi: null,
      observedAt,
    };
  }
  return null;
}

/**
 * Свежие (≤ 3 ч) PM2.5-показания сенсоров OpenAQ вокруг Алматы.
 * Без OPENAQ_API_KEY — configured:false. Никогда не бросает исключений.
 */
export async function fetchOpenAq(): Promise<ProviderResult> {
  const apiKey = process.env.OPENAQ_API_KEY;
  const failed = (configured: boolean, detail: string): ProviderResult => ({
    status: { id: 'openaq', configured, ok: false, stations: 0, detail },
    stations: [],
  });
  if (!apiKey) return failed(false, 'не настроен');

  try {
    const url =
      `${BASE}/locations?coordinates=${CENTER}&radius=${RADIUS_M}` +
      `&parameters_id=${PM25_PARAMETER_ID}&limit=${LOCATIONS_LIMIT}`;
    const init: NextFetchInit = {
      headers: { 'X-API-Key': apiKey },
      next: { revalidate: REVALIDATE_CURRENT },
    };
    const res = await fetch(url, init);
    if (!res.ok) return failed(true, `HTTP ${res.status}`);

    const locations = ((await res.json()) as OpenAqLocationsResponse).results ?? [];
    const nowMs = Date.now();

    const candidates: Candidate[] = [];
    for (const location of locations) {
      if (typeof location.id !== 'number') continue;
      const lat = location.coordinates?.latitude;
      const lon = location.coordinates?.longitude;
      if (typeof lat !== 'number' || typeof lon !== 'number') continue;

      const rawLast = location.datetimeLast?.utc;
      const lastSeen = typeof rawLast === 'string' ? toIsoUtc(rawLast) : null;
      if (lastSeen === null || !isFresh(lastSeen, nowMs)) continue;

      const pm25SensorIds = new Set<number>();
      for (const sensor of location.sensors ?? []) {
        if (typeof sensor.id === 'number' && isPm25Sensor(sensor)) pm25SensorIds.add(sensor.id);
      }
      if (pm25SensorIds.size === 0) continue;

      candidates.push({
        id: location.id,
        name: location.name?.trim() || `Сенсор OpenAQ №${location.id}`,
        lat,
        lon,
        districtSlug: districtForPoint(lat, lon),
        pm25SensorIds,
      });
    }

    // Приоритет локациям внутри восьми районов — им нужны данные для медиан.
    const ordered = [
      ...candidates.filter((c) => c.districtSlug !== null),
      ...candidates.filter((c) => c.districtSlug === null),
    ].slice(0, DETAIL_CAP);

    const settled = await Promise.allSettled(
      ordered.map((candidate) => fetchLatestReading(candidate, apiKey, nowMs)),
    );
    const stations: StationReading[] = [];
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value !== null) stations.push(result.value);
    }

    const status: SourceStatus = {
      id: 'openaq',
      configured: true,
      ok: true,
      stations: stations.length,
    };
    return { status, stations };
  } catch (error) {
    return failed(true, errorDetail(error));
  }
}
