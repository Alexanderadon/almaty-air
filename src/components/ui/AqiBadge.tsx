import { aqiCategory } from '@/lib/aqi';

/** Размер бейджа: sm — строка в списке, md — карточка, lg — герой-блок. */
export type AqiBadgeSize = 'sm' | 'md' | 'lg';

export interface AqiBadgeProps {
  /** Значение AQI; null — данных нет (нейтральный стиль «Нет данных»). */
  aqi: number | null;
  size?: AqiBadgeSize;
  className?: string;
}

const SIZES: Record<AqiBadgeSize, { root: string; value: string; label: string }> = {
  sm: {
    root: 'gap-x-1.5 rounded-full px-2.5 py-0.5',
    value: 'text-sm font-bold',
    label: 'text-xs font-medium',
  },
  md: {
    root: 'gap-x-2 rounded-xl px-3.5 py-1.5',
    value: 'text-xl font-bold',
    label: 'text-sm font-semibold',
  },
  lg: {
    root: 'flex-col gap-y-1 rounded-3xl px-8 py-6 text-center',
    value: 'text-6xl font-extrabold leading-none tracking-tight',
    label: 'text-base font-semibold',
  },
};

/** Бейдж значения AQI: цвет категории по шкале US EPA, значение + короткая подпись. */
export function AqiBadge({ aqi, size = 'md', className = '' }: AqiBadgeProps) {
  const s = SIZES[size];

  if (aqi === null) {
    return (
      <span
        role="img"
        aria-label="Индекс качества воздуха: нет данных"
        className={`inline-flex items-center justify-center border border-dashed border-border bg-card text-muted ${s.root} ${className}`}
      >
        {size === 'lg' && (
          <span aria-hidden="true" className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">
            AQI
          </span>
        )}
        <span aria-hidden="true" className={`${s.value} tabular-nums`}>
          —
        </span>
        <span aria-hidden="true" className={s.label}>
          Нет данных
        </span>
      </span>
    );
  }

  const cat = aqiCategory(aqi);
  const value = Math.round(aqi);

  return (
    <span
      role="img"
      aria-label={`Индекс качества воздуха ${value} — ${cat.labelRu}`}
      className={`inline-flex items-center justify-center ${s.root} ${className}`}
      style={{
        backgroundColor: `var(--aqi-${cat.key})`,
        color: `var(--aqi-${cat.key}-text)`,
      }}
    >
      {size === 'lg' && (
        <span aria-hidden="true" className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">
          AQI
        </span>
      )}
      <span aria-hidden="true" className={`${s.value} tabular-nums`}>
        {value}
      </span>
      <span aria-hidden="true" className={s.label}>
        {cat.shortRu}
      </span>
    </span>
  );
}
