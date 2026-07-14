import { aqiCategory } from '@/lib/aqi';

export interface AdviceCardProps {
  /** Значение AQI; при null карточка не рендерится (нет данных — нет рекомендаций). */
  aqi: number | null;
  className?: string;
}

/** Карточка рекомендаций для текущей категории AQI: название категории + практический совет. */
export function AdviceCard({ aqi, className = '' }: AdviceCardProps) {
  if (aqi === null) return null;
  const cat = aqiCategory(aqi);

  return (
    <section
      aria-label={`Рекомендации: ${cat.labelRu}`}
      className={`relative overflow-hidden rounded-2xl border border-border bg-card p-5 pl-6 ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: `var(--aqi-${cat.key})` }}
      />
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        Рекомендации
      </p>
      {/* h2: карточка идёт сразу после h1 страницы — h3 ломал порядок заголовков (axe heading-order). */}
      <h2 className="mt-1 text-base font-semibold">{cat.labelRu}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{cat.adviceRu}</p>
    </section>
  );
}
