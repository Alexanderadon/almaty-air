'use client';

/**
 * Панель карты: динамический импорт AirMap без SSR (Leaflet требует window).
 * Высота зарезервирована фиксированно — страница не прыгает при загрузке.
 * isolate/z-0 запирают z-index'ы Leaflet внутри панели, чтобы карта
 * не перекрывала липкую шапку сайта.
 */

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';
import type { DistrictAir, StationReading } from '@/lib/types';

const AirMap = dynamic(() => import('./AirMap'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

export interface MapPanelProps {
  districts: DistrictAir[];
  stations: StationReading[];
  className?: string;
}

export function MapPanel({ districts, stations, className = '' }: MapPanelProps) {
  return (
    <div
      className={`relative isolate z-0 h-[420px] overflow-hidden rounded-2xl border border-border bg-card md:h-[520px] ${className}`}
    >
      <AirMap districts={districts} stations={stations} />
    </div>
  );
}
