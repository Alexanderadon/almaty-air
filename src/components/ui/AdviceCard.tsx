import { aqiCategory } from '@/lib/aqi';

export interface AdviceCardProps {
  /** Значение AQI; при null блок не рендерится (нет данных — нет рекомендаций). */
  aqi: number | null;
  /**
   * Показывать ли подпись «Рекомендации» над текстом. В герое главной
   * совет идёт сразу под строкой состояния — подпись там лишняя.
   */
  showHeading?: boolean;
  className?: string;
}

/**
 * Практический совет для текущей категории AQI — обычный текстовый блок,
 * без рамки и цветной планки: категорию уже называют бейдж и строка
 * состояния рядом, повторять её цветом не нужно.
 */
export function AdviceCard({ aqi, showHeading = true, className = '' }: AdviceCardProps) {
  if (aqi === null) return null;
  const cat = aqiCategory(aqi);

  return (
    <section aria-label={`Рекомендации: ${cat.labelRu}`} className={`max-w-prose ${className}`}>
      {/* h2: блок идёт сразу после h1 страницы — h3 ломал порядок заголовков (axe heading-order). */}
      {showHeading && (
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Рекомендации</h2>
      )}
      <p className={`text-sm leading-relaxed ${showHeading ? 'mt-1.5' : ''}`}>{cat.adviceRu}</p>
    </section>
  );
}
