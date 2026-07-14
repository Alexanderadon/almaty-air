/**
 * Цветовые утилиты для OG-карточек (тёмный фон).
 *
 * Палитра категорий AQI (src/lib/aqi.ts) рассчитана на светлые бейджи:
 * тёмные цвета старших категорий («Вредно» и выше) нечитаемы как цвет текста
 * на тёмном фоне карточки — их приходится осветлять к белому.
 */

/** '#RRGGBB' → [r, g, b]. Бросает на любом другом формате (палитра — своя, фиксированная). */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Ожидался цвет вида #RRGGBB, получено: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** '#RRGGBB' + alpha → 'rgba(r, g, b, a)' для градиентов satori. */
export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Воспринимаемая светлота цвета (Rec. 709), 0 — чёрный, 1 — белый. */
export function perceivedLuma(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Порог светлоты, ниже которого цвет считается нечитаемым на тёмном фоне
 * и подмешивается к белому.
 */
const LUMA_FLOOR = 0.55;

/**
 * Цвет, читаемый на тёмном фоне карточки: светлые цвета возвращаются как есть,
 * тёмные частично подмешиваются к белому (тон сохраняется, светлота растёт).
 * Для всех цветов AQI-палитры итоговая светлота ≥ 0.5.
 */
export function legibleOnDark(hex: string): string {
  const luma = perceivedLuma(hex);
  if (luma >= LUMA_FLOOR) return hex;
  const t = ((LUMA_FLOOR - luma) / LUMA_FLOOR) * 0.75;
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`.toUpperCase();
}
