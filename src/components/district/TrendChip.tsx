import type { HourlyPoint } from '@/lib/types';

/** Направление изменения AQI за сутки: чище / грязнее / примерно так же. */
export type Trend = 'better' | 'worse' | 'same';

/** Изменения в пределах ±5 пунктов AQI считаем шумом («≈ как сутки назад»). */
const TREND_THRESHOLD = 5;

/**
 * Базовую точку ищем только среди первых часов окна: если данных за начало
 * суток нет, честнее не показывать чип, чем сравнивать с серединой дня.
 */
const BASELINE_SCAN = 3;

/**
 * Тренд AQI: текущее значение против точки ~24 часа назад
 * (начало окна истории «24h»). null — данных для сравнения нет.
 */
export function computeTrend(
  points: readonly HourlyPoint[],
  currentAqi: number | null,
): Trend | null {
  if (currentAqi === null) return null;

  let baseline: number | null = null;
  const scanEnd = Math.min(BASELINE_SCAN, points.length);
  for (let i = 0; i < scanEnd; i++) {
    const aqi = points[i].aqi;
    if (aqi !== null) {
      baseline = aqi;
      break;
    }
  }
  if (baseline === null) return null;

  const delta = currentAqi - baseline;
  if (delta < -TREND_THRESHOLD) return 'better';
  if (delta > TREND_THRESHOLD) return 'worse';
  return 'same';
}

const TREND_VIEW: Record<Trend, { mark: string; text: string }> = {
  better: { mark: '↓', text: 'чище, чем сутки назад' },
  worse: { mark: '↑', text: 'грязнее, чем сутки назад' },
  same: { mark: '≈', text: 'как сутки назад' },
};

export interface TrendChipProps {
  trend: Trend;
  className?: string;
}

/**
 * Чип сравнения с прошлыми сутками. Цвета нейтральные (не категорийные):
 * тренд — контекст, а не оценка опасности, ей занимается бейдж AQI.
 */
export function TrendChip({ trend, className = '' }: TrendChipProps) {
  const view = TREND_VIEW[trend];

  return (
    <p
      className={`inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted ${className}`}
    >
      <span aria-hidden="true" className="font-semibold text-foreground">
        {view.mark}
      </span>
      {/* «≈» скрыт от скринридеров — добавляем «примерно» словом. */}
      {trend === 'same' && <span className="sr-only">примерно</span>}
      <span>{view.text}</span>
    </p>
  );
}
