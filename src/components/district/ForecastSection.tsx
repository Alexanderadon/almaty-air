import { AqiAreaChart } from '@/components/charts/AqiAreaChart';
import { aqiCategory } from '@/lib/aqi';
import type { DistrictForecast, HourlyPoint } from '@/lib/types';

/** Часовой пояс отображения — как во всём приложении. */
const DISPLAY_TZ = 'Asia/Almaty';

const DAY_FMT = new Intl.DateTimeFormat('ru-RU', {
  timeZone: DISPLAY_TZ,
  day: 'numeric',
  month: 'long',
});

const HOUR_FMT = new Intl.DateTimeFormat('ru-RU', {
  timeZone: DISPLAY_TZ,
  hour: '2-digit',
  minute: '2-digit',
});

/** Худший час прогноза: первая точка с максимальным AQI. null — значений нет. */
function peakPoint(points: readonly HourlyPoint[]): { aqi: number; date: Date } | null {
  let peakAqi = -Infinity;
  let peakDate: Date | null = null;
  for (const point of points) {
    if (point.aqi === null || point.aqi <= peakAqi) continue;
    const ms = Date.parse(point.time);
    if (!Number.isFinite(ms)) continue;
    peakAqi = point.aqi;
    peakDate = new Date(ms);
  }
  return peakDate !== null ? { aqi: peakAqi, date: peakDate } : null;
}

export interface ForecastSectionProps {
  forecast: DistrictForecast;
  className?: string;
}

/**
 * Секция «Прогноз на 48 часов»: пунктирный график модельного прогноза CAMS,
 * честная пометка о происхождении и сводка худшего часа. Пустой прогноз —
 * заглушка без выдуманных значений.
 */
export function ForecastSection({ forecast, className = '' }: ForecastSectionProps) {
  const peak = peakPoint(forecast.points);

  return (
    <section aria-labelledby="forecast-heading" className={className}>
      <h2 id="forecast-heading" className="text-xl font-semibold tracking-tight">
        Прогноз на 48 часов
      </h2>

      {forecast.points.length === 0 ? (
        <div
          role="status"
          className="mt-4 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center"
        >
          <p className="text-base font-semibold">Прогноз пока недоступен</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Не удалось получить данные модели CAMS. Попробуйте обновить
            страницу через несколько минут.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <AqiAreaChart series={forecast.points} window="24h" variant="forecast" />

          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
            {/* Сетка модели — как в SourceNote origin="model". */}
            <svg
              viewBox="0 0 16 16"
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <path d="M8 2v12M2 8h12" />
            </svg>
            <span>
              Прогноз модели CAMS (Copernicus) — ориентир, не станционные замеры
            </span>
          </p>

          {peak !== null && (
            <p className="mt-3 text-sm text-muted">
              Максимум в ближайшие 48 ч:{' '}
              <span className="font-semibold text-foreground tabular-nums">
                AQI {peak.aqi}
              </span>{' '}
              ({aqiCategory(peak.aqi).labelRu.toLowerCase()}) —{' '}
              <span className="tabular-nums">
                {DAY_FMT.format(peak.date)}, {HOUR_FMT.format(peak.date)}
              </span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
