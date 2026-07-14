import Link from 'next/link';
import { AqiBadge } from '@/components/ui/AqiBadge';
import type { DistrictAir } from '@/lib/types';
import { pluralRu } from './plural';

export interface DistrictCardProps {
  district: DistrictAir;
  /** Русское название района (из GeoJSON: «Ауэзовский район» и т.п.). */
  nameRu: string;
  className?: string;
}

/** Короткая пометка происхождения данных района. */
function originHint(district: DistrictAir): string {
  if (district.aqi === null) return 'Данных пока нет';
  if (district.dataOrigin === 'model') return 'Модель CAMS (Copernicus)';
  const n = district.stationCount;
  return `${n} ${pluralRu(n, ['станция', 'станции', 'станций'])} мониторинга`;
}

/** Карточка района: название, AQI-бейдж и происхождение данных; ссылка на страницу района. */
export function DistrictCard({ district, nameRu, className = '' }: DistrictCardProps) {
  return (
    <Link
      href={`/district/${district.slug}`}
      className={`group flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent ${className}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-snug">{nameRu}</span>
        <AqiBadge aqi={district.aqi} size="sm" className="shrink-0" />
      </span>
      <span className="text-xs text-muted">{originHint(district)}</span>
    </Link>
  );
}
