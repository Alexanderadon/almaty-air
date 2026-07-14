/**
 * Общая обвязка провайдеров данных: типы результата, лимит свежести,
 * настройки кэша fetch и утилиты нормализации времени.
 */

import type { SourceStatus, StationReading } from '../types';

/** Единый результат любого провайдера. Провайдеры НИКОГДА не бросают исключений. */
export interface ProviderResult {
  status: SourceStatus;
  stations: StationReading[];
}

/** Показания старше трёх часов считаем устаревшими и отбрасываем. */
export const STALE_LIMIT_MS = 3 * 60 * 60 * 1000;

/** Кэш fetch для текущих значений (Next.js Data Cache), секунды. */
export const REVALIDATE_CURRENT = 1800;

/** Кэш fetch для истории, секунды. */
export const REVALIDATE_HISTORY = 3600;

/**
 * RequestInit с полем `next` (Next.js Data Cache). Объявлен локально,
 * чтобы typecheck не зависел от ambient-типов Next под vitest.
 */
export type NextFetchInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

/**
 * Нормализует метку времени источника к строгому ISO UTC
 * (`2026-07-14T08:00:00.000Z`). Строки без указания зоны трактуются как UTC
 * (Open-Meteo с `timezone=UTC` отдаёт `2026-07-14T08:00` без суффикса).
 * null — если строку не удалось разобрать.
 */
export function toIsoUtc(raw: string): string | null {
  const t = raw.trim();
  if (t === '') return null;
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(t);
  const ms = Date.parse(hasTimezone ? t : `${t}Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

/** Показание не старше STALE_LIMIT_MS относительно nowMs. */
export function isFresh(iso: string, nowMs: number): boolean {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return false;
  return nowMs - ms <= STALE_LIMIT_MS;
}

/** Человекочитаемая (RU) причина сбоя для SourceStatus.detail. */
export function errorDetail(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `сбой запроса: ${error.message}`;
  }
  return 'сбой запроса';
}
