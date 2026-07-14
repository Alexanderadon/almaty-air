import { aqiCategory } from '@/lib/aqi';
import type { HourlyPoint } from '@/lib/types';
import { SPARKLINE_BOX, sparklineGeometry } from './sparklinePath';

export interface SparklineProps {
  /** Почасовые точки AQI за 24 часа (как отдаёт getDistrictHistory('24h')). */
  points: HourlyPoint[];
  className?: string;
}

/**
 * Цвет категории с подмесом --foreground — тот же рецепт, что у линии
 * большого графика (contrastCategoryColor в AqiAreaChart): светлые категории
 * («Хорошо» #F5F0BB) в чистом виде не читаются на светлом фоне, тёмным
 * категориям на тёмной теме нужен больший подмес (38% против 28%).
 */
function strokeColor(aqi: number): string {
  const base = aqiCategory(aqi).color;
  return (
    `light-dark(color-mix(in srgb, ${base} 72%, var(--foreground) 28%), ` +
    `color-mix(in srgb, ${base} 62%, var(--foreground) 38%))`
  );
}

/**
 * Декоративный спарклайн AQI за 24 часа: серверный inline-SVG, ноль
 * клиентского JS. Линия окрашена категорией последнего значения, точки с
 * aqi === null честно разрывают линию. Меньше двух значений — не рендерится
 * вовсе. Скрыт от скринридеров (aria-hidden): числа AQI есть рядом в
 * карточке; подсказка при наведении — через SVG-элемент <title>
 * (атрибут title на SVG в HTML тултип не даёт).
 */
export function Sparkline({ points, className = '' }: SparklineProps) {
  // Сортировка по времени — защита от неупорядоченной серии (как в AqiAreaChart).
  const ordered = points
    .map((p) => ({ ms: Date.parse(p.time), aqi: p.aqi }))
    .filter((p) => Number.isFinite(p.ms))
    .sort((a, b) => a.ms - b.ms);
  const geometry = sparklineGeometry(ordered.map((p) => p.aqi));
  if (geometry === null) return null;

  const { width, height } = SPARKLINE_BOX;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <title>Динамика за 24 часа</title>
      <path
        d={geometry.area}
        fill={aqiCategory(geometry.last).color}
        fillOpacity={0.12}
        stroke="none"
      />
      <path
        d={geometry.line}
        fill="none"
        stroke={strokeColor(geometry.last)}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
