import Link from 'next/link';
import { AqiBadge } from '@/components/ui/AqiBadge';
import type { DistrictAir, HourlyPoint } from '@/lib/types';
import { pluralRu } from './plural';
import { Sparkline } from './Sparkline';

export interface DistrictCardProps {
  district: DistrictAir;
  /** Русское название района (из GeoJSON: «Ауэзовский район» и т.п.). */
  nameRu: string;
  /**
   * Почасовая серия AQI за 24 часа для спарклайна (points из
   * getDistrictHistory(slug, '24h')). Без неё карточка рендерится ровно
   * как раньше — без спарклайна.
   */
  spark?: HourlyPoint[];
  className?: string;
}

/** Короткая пометка происхождения данных района. */
function originHint(district: DistrictAir): string {
  if (district.aqi === null) return 'Данных пока нет';
  if (district.dataOrigin === 'model') return 'Модель CAMS (Copernicus)';
  const n = district.stationCount;
  return `${n} ${pluralRu(n, ['станция', 'станции', 'станций'])} мониторинга`;
}

/**
 * Карточка района: название, AQI-бейдж и происхождение данных; ссылка на
 * страницу района. С серией spark внизу карточки появляется спарклайн за
 * 24 часа: рядом с подписью, а на узких карточках — строкой ниже, справа
 * (flex-wrap). Размер SVG фиксирован (width/height) — места он не «прыгает».
 */
export function DistrictCard({ district, nameRu, spark, className = '' }: DistrictCardProps) {
  return (
    <Link
      href={`/district/${district.slug}`}
      className={`group card-lift flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent ${className}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-snug">{nameRu}</span>
        <AqiBadge aqi={district.aqi} size="sm" className="shrink-0" />
      </span>
      {spark === undefined ? (
        <span className="text-xs text-muted">{originHint(district)}</span>
      ) : (
        <span className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
          <span className="min-w-0 text-xs text-muted">{originHint(district)}</span>
          <Sparkline points={spark} className="ml-auto" />
        </span>
      )}
    </Link>
  );
}
