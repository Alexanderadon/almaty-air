/**
 * WAQI (aqicn.org) — официальные станции (Казгидромет, посольство США).
 * Требует WAQI_TOKEN (query-параметр token — так устроен их API).
 *
 * ВАЖНО про единицы: iaqi.pm25/pm10 в фиде WAQI — это уже AQI-шкалированные
 * значения (конвенция WAQI), НЕ мкг/м³. Обратная конверсия AQI→концентрация
 * лосси, поэтому measurements[] у станций WAQI пуст (там только истинные
 * концентрации), а AQI станции кладётся в stationAqi:
 * iaqi.pm25 → iaqi.pm10 → композитный aqi фида, что найдётся первым.
 *
 * Схема запросов: /v2/map/bounds по рамке Алматы → точечные /feed/@{uid}/
 * (не больше DETAIL_CAP, приоритет станциям внутри районов). Показания
 * старше трёх часов (time.iso) отбрасываются.
 */

import { districtForPoint } from '../districts';
import type { DistrictSlug, SourceStatus, StationReading } from '../types';
import {
  errorDetail,
  FETCH_TIMEOUT_MS,
  isFresh,
  REVALIDATE_CURRENT,
  toIsoUtc,
  type NextFetchInit,
  type ProviderResult,
} from './shared';

const BASE = 'https://api.waqi.info';
/** Рамка Алматы: lat1,lon1,lat2,lon2. */
const BOUNDS = '43.03,76.74,43.41,77.17';
/** Потолок точечных запросов /feed за один цикл. */
const DETAIL_CAP = 12;

interface WaqiBoundsStation {
  lat?: number;
  lon?: number;
  uid?: number;
  /** Композитный AQI строкой; "-" — станция без данных. */
  aqi?: string | number;
  station?: { name?: string; time?: string };
}

interface WaqiBoundsResponse {
  status?: string;
  data?: WaqiBoundsStation[] | string;
}

interface WaqiIaqiValue {
  v?: number;
}

interface WaqiFeedData {
  aqi?: number | string;
  idx?: number;
  city?: { geo?: number[]; name?: string };
  time?: { iso?: string; s?: string; tz?: string };
  iaqi?: Record<string, WaqiIaqiValue | undefined>;
}

interface WaqiFeedResponse {
  status?: string;
  data?: WaqiFeedData | string;
}

interface Candidate {
  uid: number;
  lat: number;
  lon: number;
  name: string | null;
  districtSlug: DistrictSlug | null;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * AQI-шкалированное значение WAQI с проверкой здравого диапазона [0, 500].
 * Отрицательное — глюк/сентинел станции, отбрасываем (null); выше потолка
 * шкалы — прижимаем к 500, как toAqi в src/lib/aqi.ts (AQI > 500 при
 * экстремальном смоге реален, шкала просто упирается в максимум).
 */
function stationAqiOrNull(value: unknown): number | null {
  const v = finiteOrNull(value);
  if (v === null || v < 0) return null;
  return Math.min(v, 500);
}

/** Свежий фид станции → StationReading; null, если данных нет или они устарели. */
async function fetchFeedReading(
  candidate: Candidate,
  token: string,
  nowMs: number,
): Promise<StationReading | null> {
  const init: NextFetchInit = {
    next: { revalidate: REVALIDATE_CURRENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  };
  const res = await fetch(`${BASE}/feed/@${candidate.uid}/?token=${token}`, init);
  if (!res.ok) return null;
  const body = (await res.json()) as WaqiFeedResponse;
  if (body.status !== 'ok' || typeof body.data !== 'object' || body.data === null) return null;
  const data = body.data;

  const rawIso = data.time?.iso;
  const observedAt = typeof rawIso === 'string' ? toIsoUtc(rawIso) : null;
  if (observedAt === null || !isFresh(observedAt, nowMs)) return null;

  const iaqi = data.iaqi ?? {};
  const stationAqi =
    stationAqiOrNull(iaqi.pm25?.v) ?? stationAqiOrNull(iaqi.pm10?.v) ?? stationAqiOrNull(data.aqi);
  if (stationAqi === null) return null;

  const geo = data.city?.geo;
  const lat = finiteOrNull(geo?.[0]) ?? candidate.lat;
  const lon = finiteOrNull(geo?.[1]) ?? candidate.lon;

  return {
    sourceId: 'waqi',
    stationId: `waqi-${candidate.uid}`,
    name: data.city?.name?.trim() || candidate.name || `Станция WAQI №${candidate.uid}`,
    lat,
    lon,
    districtSlug: districtForPoint(lat, lon),
    // Только истинные концентрации; у WAQI их нет — AQI лежит в stationAqi.
    measurements: [],
    stationAqi,
    observedAt,
  };
}

/**
 * Свежие (≤ 3 ч) показания станций WAQI в рамке Алматы.
 * Без WAQI_TOKEN — configured:false. Никогда не бросает исключений.
 */
export async function fetchWaqi(): Promise<ProviderResult> {
  const token = process.env.WAQI_TOKEN;
  const failed = (configured: boolean, detail: string): ProviderResult => ({
    status: { id: 'waqi', configured, ok: false, stations: 0, detail },
    stations: [],
  });
  if (!token) return failed(false, 'не настроен');

  try {
    const init: NextFetchInit = {
      next: { revalidate: REVALIDATE_CURRENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    };
    const res = await fetch(`${BASE}/v2/map/bounds?latlng=${BOUNDS}&networks=all&token=${token}`, init);
    if (!res.ok) return failed(true, `HTTP ${res.status}`);

    const body = (await res.json()) as WaqiBoundsResponse;
    if (body.status !== 'ok' || !Array.isArray(body.data)) {
      const reason = typeof body.data === 'string' ? body.data : 'неожиданный ответ API';
      return failed(true, reason);
    }

    const candidates: Candidate[] = [];
    for (const entry of body.data) {
      if (typeof entry.uid !== 'number') continue;
      const lat = finiteOrNull(entry.lat);
      const lon = finiteOrNull(entry.lon);
      if (lat === null || lon === null) continue;
      // "-" — станция сейчас без данных, точечный запрос не тратим.
      if (finiteOrNull(Number(entry.aqi)) === null) continue;
      candidates.push({
        uid: entry.uid,
        lat,
        lon,
        name: entry.station?.name?.trim() || null,
        districtSlug: districtForPoint(lat, lon),
      });
    }

    // Приоритет станциям внутри восьми районов — им нужны данные для медиан.
    const ordered = [
      ...candidates.filter((c) => c.districtSlug !== null),
      ...candidates.filter((c) => c.districtSlug === null),
    ].slice(0, DETAIL_CAP);

    const nowMs = Date.now();
    const settled = await Promise.allSettled(
      ordered.map((candidate) => fetchFeedReading(candidate, token, nowMs)),
    );
    const stations: StationReading[] = [];
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value !== null) stations.push(result.value);
    }

    const status: SourceStatus = {
      id: 'waqi',
      configured: true,
      ok: true,
      stations: stations.length,
    };
    return { status, stations };
  } catch (error) {
    return failed(true, errorDetail(error));
  }
}
