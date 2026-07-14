/**
 * Чистые помощники текстовой альтернативы графика AQI (WCAG 1.1.1):
 * экстремумы серии и прореживание «худшая точка за календарный день».
 * Вынесены из AqiAreaChart, чтобы покрыть логику юнит-тестами (vitest, node).
 */

export interface SummaryPoint {
  /** Unix-время точки, мс. */
  ms: number;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
}

export interface AqiSummary<T extends SummaryPoint> {
  min: T;
  max: T;
  last: T;
  /** Значения AQI соответствующих точек (гарантированно не null). */
  minAqi: number;
  maxAqi: number;
  lastAqi: number;
}

/**
 * Минимум, максимум и последняя точка с непустым AQI.
 * Ожидает точки, отсортированные по времени; точки с aqi === null
 * пропускаются. null — если ни одной точки со значением нет.
 * При равных значениях минимум/максимум — первая по времени точка.
 */
export function summarizeAqi<T extends SummaryPoint>(
  points: readonly T[],
): AqiSummary<T> | null {
  let min: T | undefined;
  let max: T | undefined;
  let last: T | undefined;
  let minAqi = Infinity;
  let maxAqi = -Infinity;
  let lastAqi = 0;
  for (const point of points) {
    if (point.aqi === null) continue;
    if (point.aqi < minAqi) {
      minAqi = point.aqi;
      min = point;
    }
    if (point.aqi > maxAqi) {
      maxAqi = point.aqi;
      max = point;
    }
    last = point;
    lastAqi = point.aqi;
  }
  return min !== undefined && max !== undefined && last !== undefined
    ? { min, max, last, minAqi, maxAqi, lastAqi }
    : null;
}

/**
 * Одна точка на календарный день (в заданном часовом поясе) — точка
 * с максимальным AQI дня («худший час», конвенция EPA для сводок).
 * День, где все значения null, представлен своей первой точкой —
 * пропуск данных остаётся виден и в текстовой таблице.
 * Результат отсортирован по времени.
 */
export function dailyWorstPoints<T extends SummaryPoint>(
  points: readonly T[],
  timeZone: string,
): T[] {
  const dayFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const byDay = new Map<string, T>();
  for (const point of points) {
    const key = dayFmt.format(point.ms);
    const current = byDay.get(key);
    if (
      current === undefined ||
      (point.aqi !== null && (current.aqi === null || point.aqi > current.aqi))
    ) {
      byDay.set(key, point);
    }
  }
  return [...byDay.values()].sort((a, b) => a.ms - b.ms);
}
