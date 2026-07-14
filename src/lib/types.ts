/**
 * Контракт данных «Воздух Алматы».
 *
 * Концентрации — мкг/м³. AQI — шкала US EPA (ревизия PM2.5 2024 года),
 * считается в приложении из концентраций, чужим композитным AQI не доверяем.
 * Метки времени — ISO 8601 (UTC); отображение — Asia/Almaty (UTC+5).
 */

export const DISTRICT_SLUGS = [
  'alatau',
  'almaly',
  'auezov',
  'bostandyk',
  'zhetysu',
  'medeu',
  'nauryzbay',
  'turksib',
] as const;

export type DistrictSlug = (typeof DISTRICT_SLUGS)[number];

export type PollutantCode = 'pm25' | 'pm10';

export type SourceId = 'openaq' | 'waqi' | 'openmeteo';

export interface Measurement {
  pollutant: PollutantCode;
  /** Концентрация, мкг/м³. */
  value: number;
  /** US AQI, вычисленный из value; null, если value вне области определения шкалы. */
  aqi: number | null;
}

export interface StationReading {
  sourceId: SourceId;
  stationId: string;
  name: string;
  lat: number;
  lon: number;
  /** null — станция вне границ восьми районов города. */
  districtSlug: DistrictSlug | null;
  measurements: Measurement[];
  /** Готовый композитный AQI станции, если источник его отдаёт (WAQI); иначе null. */
  stationAqi: number | null;
  observedAt: string;
}

export interface DistrictAir {
  slug: DistrictSlug;
  /** Итоговый AQI района (медиана по станциям либо модельное значение). */
  aqi: number | null;
  pm25: number | null;
  dominant: PollutantCode | null;
  stationCount: number;
  /** stations — по реальным сенсорам в районе; model — по модели CAMS для центроида. */
  dataOrigin: 'stations' | 'model';
  observedAt: string | null;
}

export interface SourceStatus {
  id: SourceId;
  /** Есть ли ключ/токен (для openmeteo всегда true). */
  configured: boolean;
  /** Успешен ли последний запрос. */
  ok: boolean;
  stations: number;
  detail?: string;
}

export interface CityAir {
  updatedAt: string;
  citywide: { aqi: number | null; pm25: number | null };
  districts: DistrictAir[];
  stations: StationReading[];
  sources: SourceStatus[];
  /** true — станционных данных нет, все значения по модели CAMS. */
  modelOnly: boolean;
}

export type HistoryWindow = '24h' | '7d' | '30d';

export interface HourlyPoint {
  /** ISO-время начала часа. */
  time: string;
  pm25: number | null;
  pm10: number | null;
  /** AQI по худшему из загрязнителей (max), правило EPA. */
  aqi: number | null;
}

export interface DistrictForecast {
  slug: DistrictSlug;
  /** Почасовой прогноз модели CAMS (всегда origin model — честно маркировать в UI). */
  points: HourlyPoint[];
}

export interface DistrictHistory {
  slug: DistrictSlug;
  window: HistoryWindow;
  /** model — Open-Meteo CAMS; db — собственная история (фаза 3). */
  origin: 'model' | 'db';
  points: HourlyPoint[];
}
