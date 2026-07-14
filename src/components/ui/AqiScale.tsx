import { AQI_CATEGORIES } from '@/lib/aqi';

export interface AqiScaleProps {
  className?: string;
}

/** Горизонтальная легенда шкалы AQI: шесть сегментов с диапазонами и названиями категорий. */
export function AqiScale({ className = '' }: AqiScaleProps) {
  return (
    <ol
      aria-label="Шкала индекса качества воздуха AQI (US EPA)"
      className={`flex w-full gap-1 ${className}`}
    >
      {AQI_CATEGORIES.map((cat) => (
        <li key={cat.key} className="min-w-0 flex-1">
          <div
            aria-hidden="true"
            className="h-2 rounded-full"
            style={{ backgroundColor: `var(--aqi-${cat.key})` }}
          />
          <p className="mt-1.5 text-center">
            <span className="block text-[11px] font-semibold tabular-nums">
              {cat.aqiRange[0]}–{cat.aqiRange[1]}
            </span>
            <span className="block text-[11px] leading-tight text-muted">
              <span className="md:hidden">{cat.shortRu}</span>
              <span className="hidden md:inline">{cat.labelRu}</span>
            </span>
          </p>
        </li>
      ))}
    </ol>
  );
}
