/**
 * Агрегатор источников: собирает показания провайдеров в CityAir.
 *
 * Правила агрегации:
 * - Реальные станции — только OpenAQ и WAQI. Модельные точки Open-Meteo
 *   НЕ попадают в CityAir.stations и stationCount — модель честно живёт
 *   только в DistrictAir с dataOrigin:'model' (см. .planning/DECISIONS.md, D9).
 * - Медиана района ярусная, шкалы AQI не смешиваются:
 *   ярус 1 — станции с истинными концентрациями (OpenAQ): AQI считается у нас
 *   по EPA-2024 (PM2.5 → PM10); если такие станции в районе есть, медиана
 *   строится ТОЛЬКО по ним;
 *   ярус 2 — станции лишь с чужим готовым stationAqi (WAQI: своя методика
 *   усреднения и, возможно, до-2024 ревизия шкалы) — используются, только
 *   когда концентрационных станций в районе нет.
 * - AQI района: медиана по станциям выбранного яруса (округляется до целого).
 *   Район без станций получает модельное значение CAMS для центроида:
 *   максимум из AQI(PM2.5) и AQI(PM10) — по конвенции EPA «худший загрязнитель».
 * - AQI города: медиана по AQI районов; PM2.5 города — медиана по районам.
 * - Ничего не бросает: при полном отказе всех источников — районы с aqi:null
 *   и статусы источников с ok:false.
 */

import { median } from '../aqi';
import { getDbHistory, hasDbCoverage } from '../history';
import type {
  CityAir,
  DistrictAir,
  DistrictHistory,
  DistrictSlug,
  HistoryWindow,
  PollutantCode,
  SourceId,
  StationReading,
} from '../types';
import { DISTRICT_SLUGS } from '../types';
import { fetchOpenMeteoCurrent, fetchOpenMeteoHistory } from './openmeteo';
import { fetchOpenAq } from './openaq';
import { fetchWaqi } from './waqi';
import type { ProviderResult } from './shared';

export { fetchOpenAq } from './openaq';
export {
  fetchOpenMeteoCurrent,
  fetchOpenMeteoHistory,
  getDistrictForecast,
} from './openmeteo';
export { fetchWaqi } from './waqi';
export type { ProviderResult } from './shared';

/** Округление концентрации до 0.1 мкг/м³ для витрины. */
function round1(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value * 10) / 10;
}

function measurementOf(station: StationReading, pollutant: PollutantCode) {
  return station.measurements.find((m) => m.pollutant === pollutant);
}

/**
 * AQI станции из истинных концентраций (ярус 1): PM2.5 → PM10.
 * null — у станции нет ни одного концентрационного измерения с AQI
 * (например, WAQI, где есть только чужой готовый stationAqi).
 */
function concentrationAqi(station: StationReading): number | null {
  const pm25Aqi = measurementOf(station, 'pm25')?.aqi;
  if (pm25Aqi != null) return pm25Aqi;
  const pm10Aqi = measurementOf(station, 'pm10')?.aqi;
  if (pm10Aqi != null) return pm10Aqi;
  return null;
}

/** Станция и AQI, с которым она входит в медиану своего яруса. */
interface RatedStation {
  station: StationReading;
  aqi: number;
}

/** Провайдер отверг промис (не должен случаться — провайдеры ловят всё сами). */
function providerCrashed(id: SourceId): ProviderResult {
  return {
    status: { id, configured: true, ok: false, stations: 0, detail: 'внутренняя ошибка' },
    stations: [],
  };
}

function settledOr(
  result: PromiseSettledResult<ProviderResult>,
  id: SourceId,
): ProviderResult {
  return result.status === 'fulfilled' ? result.value : providerCrashed(id);
}

function buildDistrict(
  slug: DistrictSlug,
  realStations: StationReading[],
  modelBySlug: Map<DistrictSlug, StationReading>,
): DistrictAir {
  const own = realStations.filter((s) => s.districtSlug === slug);

  // Ярусы не смешиваем (см. шапку модуля): ярус 1 — истинные концентрации
  // (AQI по EPA-2024 считаем сами), ярус 2 — только чужой готовый stationAqi
  // (WAQI). Если в районе есть хоть одна станция яруса 1, медиана — ТОЛЬКО
  // по ярусу 1; ярус 2 — фолбэк, модель CAMS — последний ярус.
  const tier1: RatedStation[] = [];
  const tier2: RatedStation[] = [];
  for (const station of own) {
    const concAqi = concentrationAqi(station);
    if (concAqi !== null) tier1.push({ station, aqi: concAqi });
    else if (station.stationAqi !== null) tier2.push({ station, aqi: station.stationAqi });
  }
  const used = tier1.length > 0 ? tier1 : tier2;

  const aqiValues: number[] = [];
  const pm25Values: number[] = [];
  const pm25Aqis: number[] = [];
  const pm10Aqis: number[] = [];
  let latestObservedAt: string | null = null;

  for (const { station, aqi } of used) {
    aqiValues.push(aqi);

    const pm25 = measurementOf(station, 'pm25');
    if (pm25 && Number.isFinite(pm25.value)) pm25Values.push(pm25.value);
    if (pm25?.aqi != null) pm25Aqis.push(pm25.aqi);
    const pm10 = measurementOf(station, 'pm10');
    if (pm10?.aqi != null) pm10Aqis.push(pm10.aqi);

    if (
      latestObservedAt === null ||
      Date.parse(station.observedAt) > Date.parse(latestObservedAt)
    ) {
      latestObservedAt = station.observedAt;
    }
  }

  if (aqiValues.length > 0) {
    const aqiMedian = median(aqiValues);
    const pm25AqiMedian = median(pm25Aqis);
    const pm10AqiMedian = median(pm10Aqis);
    let dominant: PollutantCode | null = null;
    if (pm25AqiMedian !== null && (pm10AqiMedian === null || pm25AqiMedian >= pm10AqiMedian)) {
      dominant = 'pm25';
    } else if (pm10AqiMedian !== null) {
      dominant = 'pm10';
    }
    return {
      slug,
      aqi: aqiMedian === null ? null : Math.round(aqiMedian),
      pm25: round1(median(pm25Values)),
      dominant,
      stationCount: aqiValues.length,
      dataOrigin: 'stations',
      observedAt: latestObservedAt,
    };
  }

  // Станций нет — модельное значение CAMS для центроида района.
  const model = modelBySlug.get(slug);
  if (model) {
    const pm25 = measurementOf(model, 'pm25');
    const pm10 = measurementOf(model, 'pm10');
    const pm25Aqi = pm25?.aqi ?? null;
    const pm10Aqi = pm10?.aqi ?? null;
    let aqi: number | null = null;
    let dominant: PollutantCode | null = null;
    if (pm25Aqi !== null && (pm10Aqi === null || pm25Aqi >= pm10Aqi)) {
      aqi = pm25Aqi;
      dominant = 'pm25';
    } else if (pm10Aqi !== null) {
      aqi = pm10Aqi;
      dominant = 'pm10';
    }
    if (aqi !== null) {
      return {
        slug,
        aqi,
        pm25: pm25 && Number.isFinite(pm25.value) ? round1(pm25.value) : null,
        dominant,
        stationCount: 0,
        dataOrigin: 'model',
        observedAt: model.observedAt,
      };
    }
  }

  // Данных нет совсем — честный пустой район.
  return {
    slug,
    aqi: null,
    pm25: null,
    dominant: null,
    stationCount: 0,
    dataOrigin: 'model',
    observedAt: null,
  };
}

/**
 * Текущее качество воздуха по городу: все настроенные провайдеры опрашиваются
 * параллельно, отказ любого из них (или всех) не роняет результат.
 */
export async function getCityAir(): Promise<CityAir> {
  const [openMeteoSettled, openAqSettled, waqiSettled] = await Promise.allSettled([
    fetchOpenMeteoCurrent(),
    fetchOpenAq(),
    fetchWaqi(),
  ]);
  const openMeteo = settledOr(openMeteoSettled, 'openmeteo');
  const openAq = settledOr(openAqSettled, 'openaq');
  const waqi = settledOr(waqiSettled, 'waqi');

  const realStations: StationReading[] = [...openAq.stations, ...waqi.stations];

  const modelBySlug = new Map<DistrictSlug, StationReading>();
  for (const station of openMeteo.stations) {
    if (station.districtSlug !== null) modelBySlug.set(station.districtSlug, station);
  }

  const districts = DISTRICT_SLUGS.map((slug) =>
    buildDistrict(slug, realStations, modelBySlug),
  );

  const districtAqis = districts
    .map((d) => d.aqi)
    .filter((v): v is number => v !== null);
  const districtPm25s = districts
    .map((d) => d.pm25)
    .filter((v): v is number => v !== null);
  const cityAqi = median(districtAqis);

  return {
    updatedAt: new Date().toISOString(),
    citywide: {
      aqi: cityAqi === null ? null : Math.round(cityAqi),
      pm25: round1(median(districtPm25s)),
    },
    districts,
    stations: realStations,
    sources: [openAq.status, waqi.status, openMeteo.status],
    modelOnly: realStations.length === 0,
  };
}

/**
 * Почасовая история района: сначала собственная БД (фаза 3), при
 * недостаточном покрытии окна или сбое БД — модель CAMS через Open-Meteo.
 * Сбой БД страницу не роняет: ошибка логируется, работает модельный фолбэк.
 */
export async function getDistrictHistory(
  slug: DistrictSlug,
  window: HistoryWindow,
): Promise<DistrictHistory> {
  try {
    const points = await getDbHistory(slug, window);
    if (hasDbCoverage(points, window)) {
      return { slug, window, origin: 'db', points };
    }
  } catch (error) {
    console.warn(`История из БД недоступна (${slug}, ${window}) — фолбэк на модель CAMS:`, error);
  }
  return fetchOpenMeteoHistory(slug, window);
}
