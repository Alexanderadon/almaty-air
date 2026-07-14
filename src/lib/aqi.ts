/**
 * Шкала US EPA AQI для PM2.5 и PM10.
 *
 * Брейкпоинты — по ревизии EPA от мая 2024 года (Technical Assistance Document
 * for the Reporting of Daily Air Quality, EPA-454/B-24-002, май 2024):
 * для PM2.5 граница «Good» опущена до 9.0 мкг/м³, верх шкалы — 325.4 мкг/м³
 * (AQI 500), категория Hazardous — единый сегмент 301–500.
 *
 * Правила усечения EPA: концентрация PM2.5 усекается до 0.1 мкг/м³,
 * PM10 — до целого. Итоговый AQI округляется до ближайшего целого.
 */

export type AqiCategoryKey =
  | 'good'
  | 'moderate'
  | 'usg'
  | 'unhealthy'
  | 'very-unhealthy'
  | 'hazardous';

export interface AqiCategory {
  key: AqiCategoryKey;
  /** Полное название категории. */
  labelRu: string;
  /** Короткая подпись для бейджей и карты. */
  shortRu: string;
  /** Практическая рекомендация жителю (1–2 предложения). */
  adviceRu: string;
  /** Диапазон AQI [min, max] включительно. */
  aqiRange: [number, number];
  /** Цвет фона (hex). Палитра colorblind-safe: светлота монотонно падает с ростом опасности. */
  color: string;
  /** Цвет текста поверх color (hex), контраст WCAG AA ≥ 4.5:1. */
  textColor: string;
}

/**
 * Шесть категорий AQI по возрастанию опасности.
 *
 * Палитра не повторяет дефолтную EPA (зелёный/жёлтый/красный неразличимы при
 * дейтеранопии и протанопии): жёлтый → янтарный → оранжевый → кирпичный →
 * сливовый → тёмно-фиолетовый, светлота строго монотонно убывает — категория
 * читается по светлоте даже в градациях серого.
 */
export const AQI_CATEGORIES: readonly AqiCategory[] = [
  {
    key: 'good',
    labelRu: 'Хорошо',
    shortRu: 'Хорошо',
    adviceRu:
      'Воздух чистый: окна можно держать открытыми, прогулки и спорт на улице — без ограничений.',
    aqiRange: [0, 50],
    color: '#F5F0BB',
    textColor: '#3D3808',
  },
  {
    key: 'moderate',
    labelRu: 'Умеренно',
    shortRu: 'Умеренно',
    adviceRu:
      'Для большинства ограничений нет. Людям с астмой или болезнями сердца лучше сократить длительные интенсивные нагрузки на улице.',
    aqiRange: [51, 100],
    color: '#F2C94C',
    textColor: '#4A3405',
  },
  {
    key: 'usg',
    labelRu: 'Вредно для чувствительных',
    shortRu: 'Чувствительным',
    adviceRu:
      'Детям, пожилым и людям с астмой или болезнями сердца стоит перенести тренировки в помещение и закрыть окна. Остальным — сократить долгие интенсивные нагрузки на улице.',
    aqiRange: [101, 150],
    color: '#E98A3C',
    textColor: '#4A2504',
  },
  {
    key: 'unhealthy',
    labelRu: 'Вредно',
    shortRu: 'Вредно',
    adviceRu:
      'Закройте окна и включите очиститель воздуха, если он есть. Прогулки сократите, спорт перенесите в помещение; на улице поможет маска FFP2.',
    aqiRange: [151, 200],
    color: '#C0503F',
    textColor: '#FFFFFF',
  },
  {
    key: 'very-unhealthy',
    labelRu: 'Очень вредно',
    shortRu: 'Очень вредно',
    adviceRu:
      'Оставайтесь в помещении с закрытыми окнами, используйте очиститель воздуха. Выходите только по необходимости и в маске FFP2, спорт на улице отложите.',
    aqiRange: [201, 300],
    color: '#8E3B6B',
    textColor: '#FFFFFF',
  },
  {
    key: 'hazardous',
    labelRu: 'Опасно',
    shortRu: 'Опасно',
    adviceRu:
      'Без необходимости не выходите: окна закрыты, очиститель работает. На улице — маска FFP2/FFP3, любые нагрузки на воздухе исключите.',
    aqiRange: [301, 500],
    color: '#4A1D4F',
    textColor: '#F5D7F7',
  },
];

interface Breakpoint {
  cLo: number;
  cHi: number;
  iLo: number;
  iHi: number;
}

/** PM2.5, 24 ч, мкг/м³ (ревизия EPA 2024). Концентрация усечена до 0.1. */
const PM25_BREAKPOINTS: readonly Breakpoint[] = [
  { cLo: 0.0, cHi: 9.0, iLo: 0, iHi: 50 },
  { cLo: 9.1, cHi: 35.4, iLo: 51, iHi: 100 },
  { cLo: 35.5, cHi: 55.4, iLo: 101, iHi: 150 },
  { cLo: 55.5, cHi: 125.4, iLo: 151, iHi: 200 },
  { cLo: 125.5, cHi: 225.4, iLo: 201, iHi: 300 },
  { cLo: 225.5, cHi: 325.4, iLo: 301, iHi: 500 },
];

/** PM10, 24 ч, мкг/м³. Концентрация усечена до целого. */
const PM10_BREAKPOINTS: readonly Breakpoint[] = [
  { cLo: 0, cHi: 54, iLo: 0, iHi: 50 },
  { cLo: 55, cHi: 154, iLo: 51, iHi: 100 },
  { cLo: 155, cHi: 254, iLo: 101, iHi: 150 },
  { cLo: 255, cHi: 354, iLo: 151, iHi: 200 },
  { cLo: 355, cHi: 424, iLo: 201, iHi: 300 },
  { cLo: 425, cHi: 604, iLo: 301, iHi: 500 },
];

/**
 * Усечение (не округление) до `decimals` знаков после запятой.
 * `toPrecision(12)` гасит двоичный шум: без него `9.1 * 10 === 90.99999999999999`
 * и усечение дало бы 9.0 вместо 9.1.
 */
function truncate(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.trunc(Number((value * factor).toPrecision(12))) / factor;
}

function toAqi(
  value: number,
  decimals: number,
  breakpoints: readonly Breakpoint[],
): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const c = truncate(value, decimals);
  const top = breakpoints[breakpoints.length - 1];
  if (c > top.cHi) return 500;
  const seg = breakpoints.find((b) => c >= b.cLo && c <= b.cHi);
  /* Усечённое значение всегда попадает в сегмент (сетка усечения совпадает
     с шагом между брейкпоинтами); ветка ниже — защитная. */
  if (!seg) return null;
  const aqi =
    ((seg.iHi - seg.iLo) / (seg.cHi - seg.cLo)) * (c - seg.cLo) + seg.iLo;
  return Math.round(aqi);
}

/**
 * US AQI из концентрации PM2.5 (мкг/м³).
 * null — для отрицательных, NaN и бесконечных значений.
 * Концентрации выше 325.4 мкг/м³ дают AQI 500 (потолок шкалы).
 */
export function pm25ToAqi(v: number): number | null {
  return toAqi(v, 1, PM25_BREAKPOINTS);
}

/**
 * US AQI из концентрации PM10 (мкг/м³).
 * null — для отрицательных, NaN и бесконечных значений.
 * Концентрации выше 604 мкг/м³ дают AQI 500 (потолок шкалы).
 */
export function pm10ToAqi(v: number): number | null {
  return toAqi(v, 0, PM10_BREAKPOINTS);
}

/**
 * Категория по значению AQI. Значения вне [0, 500] прижимаются к краям шкалы
 * (отрицательные → «Хорошо», больше 500 → «Опасно»).
 */
export function aqiCategory(aqi: number): AqiCategory {
  for (const cat of AQI_CATEGORIES) {
    if (aqi <= cat.aqiRange[1]) return cat;
  }
  return AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
}

/**
 * Медиана массива. Нечисловые значения (NaN, ±Infinity) игнорируются;
 * если после фильтрации значений нет — null.
 */
export function median(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
