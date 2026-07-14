'use client';

/**
 * Панель карты: динамический импорт AirMap без SSR (Leaflet требует window).
 * Высота зарезервирована фиксированно — страница не прыгает при загрузке.
 * isolate/z-0 запирают z-index'ы Leaflet внутри панели, чтобы карта
 * не перекрывала липкую шапку сайта.
 *
 * Под картой — раскрывающийся текстовый список станций (WCAG 1.1.1):
 * данные районов дублируются карточками районов на странице, а показания
 * станций (в том числе вне границ восьми районов) без списка существовали бы
 * только в маркерах карты — недоступно клавиатуре и скринридерам.
 * Список рендерится на сервере (сам AirMap — только на клиенте).
 */

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';
import { DISTRICTS } from '@/lib/districts';
import type {
  DistrictAir,
  PollutantCode,
  SourceId,
  StationReading,
} from '@/lib/types';

const AirMap = dynamic(() => import('./AirMap'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const DISTRICT_NAME = new Map(DISTRICTS.map((d) => [d.slug, d.nameRu] as const));

const SOURCE_LABEL: Record<SourceId, string> = {
  openaq: 'OpenAQ',
  waqi: 'WAQI',
  openmeteo: 'Open-Meteo (модель CAMS)',
};

const POLLUTANT_LABEL: Record<PollutantCode, string> = {
  pm25: 'PM2.5',
  pm10: 'PM10',
};

const CONCENTRATION_FMT = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 1,
});

/** Время замера в поясе Алматы: «14 июля, 14:05». */
const OBSERVED_FMT = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

function StationListItem({ station }: { station: StationReading }) {
  const observed = new Date(station.observedAt);
  const place =
    station.districtSlug !== null
      ? (DISTRICT_NAME.get(station.districtSlug) ?? station.districtSlug)
      : 'вне границ восьми районов';
  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <p className="font-semibold">{station.name}</p>
      <p className="text-muted">
        {place} · {SOURCE_LABEL[station.sourceId]}
      </p>
      {station.measurements.length > 0 && (
        <p className="tabular-nums">
          {station.measurements
            .map(
              (m) =>
                `${POLLUTANT_LABEL[m.pollutant]}: ${CONCENTRATION_FMT.format(m.value)} мкг/м³` +
                (m.aqi !== null ? ` (AQI ${m.aqi})` : ''),
            )
            .join(' · ')}
        </p>
      )}
      {station.stationAqi !== null && <p>AQI станции: {station.stationAqi}</p>}
      {!Number.isNaN(observed.getTime()) && (
        <p className="text-muted">Замер: {OBSERVED_FMT.format(observed)}</p>
      )}
    </li>
  );
}

export interface MapPanelProps {
  districts: DistrictAir[];
  stations: StationReading[];
  className?: string;
}

export function MapPanel({ districts, stations, className = '' }: MapPanelProps) {
  // Станции в районах — первыми (по названию района), вне районов — в конце.
  const sorted = [...stations].sort((a, b) => {
    if (a.districtSlug === null && b.districtSlug !== null) return 1;
    if (a.districtSlug !== null && b.districtSlug === null) return -1;
    const nameA = a.districtSlug !== null ? (DISTRICT_NAME.get(a.districtSlug) ?? '') : '';
    const nameB = b.districtSlug !== null ? (DISTRICT_NAME.get(b.districtSlug) ?? '') : '';
    return nameA.localeCompare(nameB, 'ru') || a.name.localeCompare(b.name, 'ru');
  });

  return (
    <div className={className}>
      <div className="relative isolate z-0 h-[420px] overflow-hidden rounded-2xl border border-border bg-card md:h-[520px]">
        <AirMap districts={districts} stations={stations} />
      </div>

      {sorted.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer rounded-lg font-medium text-muted transition-colors hover:text-foreground">
            Показания станций списком ({sorted.length})
          </summary>
          <p className="mt-2 text-muted">
            Все станции с карты, включая расположенные вне границ восьми районов.
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {sorted.map((station) => (
              <StationListItem
                key={`${station.sourceId}-${station.stationId}`}
                station={station}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
