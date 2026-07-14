import { AQI_CATEGORIES } from '@/lib/aqi';

export interface AqiScaleProps {
  className?: string;
}

/**
 * Легенда шкалы AQI: шесть категорий, два представления.
 *
 * На узких экранах (<md) — вертикальный список: цветная плашка, диапазон и
 * короткое название в одну строку. В горизонтальной полосе ячейка на 360px
 * получалась ~51px — «Чувствительным» рвалось посреди слова, «Очень вредно»
 * занимало две строки при однострочных соседях.
 *
 * На md+ — горизонтальная полоса из шести сегментов с диапазоном и полным
 * названием под каждым. Скрытие через display:none, поэтому в дереве
 * доступности всегда ровно одно представление.
 */
export function AqiScale({ className = '' }: AqiScaleProps) {
  return (
    <ol
      aria-label="Шкала индекса качества воздуха AQI (US EPA)"
      className={`flex w-full flex-col gap-2.5 md:flex-row md:gap-1 ${className}`}
    >
      {AQI_CATEGORIES.map((cat) => (
        <li key={cat.key} className="min-w-0 md:flex-1">
          {/* <md: строка «плашка · диапазон · название» — без переносов внутри слов */}
          <span className="flex items-center gap-3 md:hidden">
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 rounded"
              style={{ backgroundColor: `var(--aqi-${cat.key})` }}
            />
            <span className="w-16 shrink-0 text-[13px] font-semibold tabular-nums">
              {cat.aqiRange[0]}–{cat.aqiRange[1]}
            </span>
            <span className="truncate text-[13px] text-muted">{cat.shortRu}</span>
          </span>
          {/* md+: сегмент полосы, под ним диапазон и полное название категории */}
          <span className="hidden md:block">
            <span
              aria-hidden="true"
              className="block h-2 rounded-full"
              style={{ backgroundColor: `var(--aqi-${cat.key})` }}
            />
            <span className="mt-1.5 block text-center">
              <span className="block text-[11px] font-semibold tabular-nums">
                {cat.aqiRange[0]}–{cat.aqiRange[1]}
              </span>
              {/* break-words + hyphens-auto — страховка для промежуточных ширин,
                  где полное название («Вредно для чувствительных») шире ячейки */}
              <span className="block break-words text-[11px] leading-tight text-muted hyphens-auto">
                {cat.labelRu}
              </span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
