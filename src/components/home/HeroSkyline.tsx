export interface HeroSkylineProps {
  className?: string;
}

/**
 * Декоративный силуэт хребта Заилийского Алатау для герой-блока главной:
 * три перекрывающихся гребня (дальний — выше и бледнее, ближний — ниже и
 * плотнее), пики нарастают вправо — к югу, как видит хребет город.
 *
 * Серверный чистый SVG без клиентского JS. Цвет — var(--hero-tint):
 * герой задаёт её инлайном из цвета текущей категории AQI (фолбэк
 * var(--accent)), поэтому фон тихо «дышит» состоянием воздуха и работает
 * в обеих темах: непрозрачности 0.05/0.09/0.14 не грязнят светлую тему
 * и не светятся на тёмной. Маска-градиент растворяет вершины кверху.
 *
 * Позиционирование встроено: absolute к низу ближайшего relative-контейнера
 * (герой получает relative + isolate + overflow-hidden), -z-10 уводит слой
 * под текст. preserveAspectRatio="none" растягивает гребни на всю ширину.
 */
export function HeroSkyline({ className = '' }: HeroSkylineProps) {
  return (
    <svg
      viewBox="0 0 1440 180"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[140px] w-full sm:h-[160px] ${className}`}
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 62%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 62%)',
      }}
    >
      {/* Дальний гребень: самые высокие пики, едва заметный */}
      <path
        d="M0 128 L64 116 L118 123 L176 102 L232 114 L294 90 L348 106 L414 82 L472 98 L534 72 L592 92 L662 60 L722 84 L792 52 L852 74 L922 42 L982 64 L1052 32 L1112 54 L1182 24 L1252 46 L1322 14 L1382 32 L1440 20 L1440 180 L0 180 Z"
        fill="var(--hero-tint)"
        fillOpacity={0.05}
      />
      {/* Средний гребень */}
      <path
        d="M0 146 L72 136 L134 142 L204 121 L272 134 L342 110 L410 126 L482 102 L552 120 L622 94 L692 114 L762 86 L832 106 L902 76 L972 98 L1042 66 L1112 90 L1182 58 L1262 82 L1332 50 L1440 72 L1440 180 L0 180 Z"
        fill="var(--hero-tint)"
        fillOpacity={0.09}
      />
      {/* Ближний гребень: низкий и самый плотный */}
      <path
        d="M0 161 L82 152 L152 158 L232 141 L312 152 L392 132 L472 145 L552 124 L632 139 L712 116 L792 132 L872 108 L952 126 L1032 100 L1112 120 L1192 92 L1282 112 L1362 86 L1440 102 L1440 180 L0 180 Z"
        fill="var(--hero-tint)"
        fillOpacity={0.14}
      />
    </svg>
  );
}
