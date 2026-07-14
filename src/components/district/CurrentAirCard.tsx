import { AqiBadge } from '@/components/ui/AqiBadge';
import { SourceNote } from '@/components/ui/SourceNote';
import { UpdatedAt } from '@/components/ui/UpdatedAt';
import { aqiCategory } from '@/lib/aqi';
import type { DistrictAir } from '@/lib/types';
import { TrendChip, type Trend } from './TrendChip';

const CONCENTRATION_FMT = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 1,
});

/** Чип концентрации: «PM2.5 · 23,1 мкг/м³». */
function PollutantChip({ label, value }: { label: string; value: number }) {
  return (
    <li className="inline-flex items-baseline gap-1.5 rounded-full border border-border px-3 py-1">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums">
        {CONCENTRATION_FMT.format(value)}
      </span>
      <span className="text-xs text-muted">мкг/м³</span>
    </li>
  );
}

export interface CurrentAirCardProps {
  /** Агрегат района из getCityAir; null — район не найден в ответе. */
  air: DistrictAir | null;
  /** Сравнение с сутками ранее; null — данных для сравнения нет (чип скрыт). */
  trend: Trend | null;
  className?: string;
}

/**
 * Карточка «воздух сейчас»: слева бейдж AQI, справа категория заголовком,
 * тренд за сутки и чипы концентраций; внизу мелко — время обновления
 * и происхождение данных. Без данных — бейдж «Нет данных» и честный текст.
 */
export function CurrentAirCard({ air, trend, className = '' }: CurrentAirCardProps) {
  const aqi = air?.aqi ?? null;
  const category = aqi !== null ? aqiCategory(aqi) : null;
  const showFooter = air !== null && (air.observedAt !== null || aqi !== null);

  return (
    <div className={`rounded-2xl border border-border bg-card p-5 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <AqiBadge aqi={aqi} size="lg" className="shrink-0" />

        <div className="min-w-0 flex-1 basis-52">
          {category !== null ? (
            <>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                {category.labelRu}
              </h2>
              {trend !== null && <TrendChip trend={trend} className="mt-2" />}
              {air?.pm25 != null && (
                <ul aria-label="Концентрации частиц" className="mt-3 flex flex-wrap gap-2">
                  <PollutantChip label="PM2.5" value={air.pm25} />
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              Текущих данных по району нет — источники временно недоступны.
              Попробуйте обновить страницу позже.
            </p>
          )}
        </div>
      </div>

      {showFooter && (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-3.5">
          {air.observedAt !== null && <UpdatedAt iso={air.observedAt} />}
          {/* Без данных происхождение не заявляем: бейдж уже говорит
              «Нет данных», подпись «По модели CAMS» ему бы противоречила. */}
          {aqi !== null && (
            <SourceNote origin={air.dataOrigin} stationCount={air.stationCount} />
          )}
        </div>
      )}
    </div>
  );
}
