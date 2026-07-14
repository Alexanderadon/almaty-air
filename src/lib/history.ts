/**
 * Собственная история качества воздуха (фаза 3): Supabase Postgres.
 *
 * Сборщик раз в час снимает срез CityAir в таблицу readings (одна строка на
 * район на час, UNIQUE(district_slug, ts) — повторный сбор в тот же час
 * обновляет строку, а не дублирует её). Витрина истории сначала пробует БД
 * и лишь при недостаточном покрытии окна падает на модель CAMS (Open-Meteo).
 *
 * Все метки времени — начало часа в UTC.
 */

import { getPrisma } from './db';
import type { CityAir, DistrictSlug, HistoryWindow, HourlyPoint } from './types';

const HOUR_MS = 3_600_000;

/** Глубина хранения истории: окно 30d плюс трёхмесячный запас. */
export const RETENTION_DAYS = 92;

/** Сколько часовых точек составляют каждое окно истории. */
export const WINDOW_HOURS: Record<HistoryWindow, number> = {
  '24h': 24,
  '7d': 7 * 24,
  '30d': 30 * 24,
};

/** Минимальная доля покрытых часов окна, при которой история отдаётся из БД. */
export const DB_COVERAGE_THRESHOLD = 0.8;

/** Начало часа (UTC), которому принадлежит момент date. */
export function truncateToHourUtc(date: Date): Date {
  return new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS);
}

export interface SnapshotResult {
  /** Сколько строк-районов записано (upsert). */
  saved: number;
  /** Сколько строк старше периода хранения удалено. */
  pruned: number;
}

/**
 * Срез CityAir в readings: по одной строке на район, ts — начало часа (UTC).
 * По умолчанию час берётся из air.updatedAt. PM10 пока не агрегируется
 * в DistrictAir — колонка остаётся null (контракт задачи фазы 3).
 * Заодно чистит строки старше RETENTION_DAYS.
 */
export async function saveCityAirSnapshot(air: CityAir, ts?: Date): Promise<SnapshotResult> {
  const prisma = getPrisma();

  const base = ts ?? new Date(air.updatedAt);
  const hour = truncateToHourUtc(Number.isNaN(base.getTime()) ? new Date() : base);

  let saved = 0;
  for (const district of air.districts) {
    const values = {
      aqi: district.aqi,
      pm25: district.pm25,
      dataOrigin: district.dataOrigin,
      stationCount: district.stationCount,
    };
    await prisma.reading.upsert({
      where: { districtSlug_ts: { districtSlug: district.slug, ts: hour } },
      create: { districtSlug: district.slug, ts: hour, pm10: null, ...values },
      update: values,
    });
    saved += 1;
  }

  const cutoff = new Date(hour.getTime() - RETENTION_DAYS * 24 * HOUR_MS);
  const { count: pruned } = await prisma.reading.deleteMany({ where: { ts: { lt: cutoff } } });

  return { saved, pruned };
}

/**
 * Часовые точки района из БД за окно, заканчивающееся текущим часом
 * (включительно), по возрастанию времени. Может бросить при недоступной БД —
 * вызывающая сторона обязана ловить (см. getDistrictHistory).
 */
export async function getDbHistory(
  slug: DistrictSlug,
  window: HistoryWindow,
): Promise<HourlyPoint[]> {
  const prisma = getPrisma();

  const end = truncateToHourUtc(new Date());
  const start = new Date(end.getTime() - (WINDOW_HOURS[window] - 1) * HOUR_MS);

  const rows = await prisma.reading.findMany({
    where: { districtSlug: slug, ts: { gte: start, lte: end } },
    orderBy: { ts: 'asc' },
  });

  return rows.map((row) => ({
    time: row.ts.toISOString(),
    pm25: row.pm25,
    pm10: row.pm10,
    aqi: row.aqi,
  }));
}

/**
 * Достаточно ли точек из БД, чтобы показывать окно без модельного фолбэка:
 * покрыто не меньше DB_COVERAGE_THRESHOLD часов окна (строки уникальны
 * по часу — счётчик точек и есть число покрытых часов).
 */
export function hasDbCoverage(points: HourlyPoint[], window: HistoryWindow): boolean {
  return points.length >= WINDOW_HOURS[window] * DB_COVERAGE_THRESHOLD;
}
