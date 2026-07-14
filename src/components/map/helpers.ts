/**
 * Чистые помощники карты: экранирование HTML для divIcon, разметка
 * AQI-пилюли района и поиск ближайшего района по центроиду.
 *
 * Без импорта Leaflet — файл тестируется в node-окружении
 * (Leaflet при импорте требует window).
 */

import { aqiCategory } from '@/lib/aqi';
import { DISTRICTS, type District } from '@/lib/districts';

/** Заливка пилюли при отсутствии данных — нейтральный серый, вне палитры категорий. */
export const BADGE_NO_DATA_BG = '#9AA3AF';

/** Текст поверх серой пилюли (контраст ≥ 4.5:1). */
export const BADGE_NO_DATA_TEXT = '#22211C';

/** Размер иконки-пилюли: ширины хватает на «500», высота — комфортная цель касания. */
export const BADGE_WIDTH = 42;
export const BADGE_HEIGHT = 36;

/** Минимальное HTML-экранирование строки для вставки в разметку divIcon. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * HTML пилюли с числом AQI для L.divIcon.
 *
 * Собирается только из наших данных: число AQI и nameRu из собственного
 * GeoJSON (OSM); nameRu на всякий случай экранируется. Цвета — из палитры
 * категорий AQI; при aqi === null — серая пилюля с «—».
 * Рамка var(--card) подстраивается под тему сайта.
 */
export function badgeHtml(aqi: number | null, nameRu: string): string {
  const rounded = aqi === null ? null : Math.round(aqi);
  const bg = rounded === null ? BADGE_NO_DATA_BG : aqiCategory(rounded).color;
  const text =
    rounded === null ? BADGE_NO_DATA_TEXT : aqiCategory(rounded).textColor;
  const label = rounded === null ? '—' : String(rounded);
  const aria =
    rounded === null
      ? `${nameRu}: данных пока нет`
      : `${nameRu}: AQI ${rounded}, ${aqiCategory(rounded).labelRu}`;
  const style = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'width:100%',
    'height:100%',
    'border-radius:9999px',
    'border:2px solid var(--card)',
    'box-shadow:0 1px 5px rgba(0,0,0,0.35)',
    `background:${bg}`,
    `color:${text}`,
    'font-weight:700',
    'font-size:14px',
    'line-height:1',
    'white-space:nowrap',
  ].join(';');
  return `<span role="img" aria-label="${escapeHtml(aria)}" style="${style}">${label}</span>`;
}

/**
 * Ближайший район по расстоянию до центроида (равнопрямоугольное приближение:
 * долгота сжимается на cos широты — для масштабов Алматы точности достаточно).
 */
export function nearestDistrict(
  lat: number,
  lon: number,
  districts: readonly District[] = DISTRICTS,
): District {
  if (districts.length === 0) {
    throw new Error('nearestDistrict: пустой список районов.');
  }
  let best = districts[0];
  let bestDist = Infinity;
  for (const district of districts) {
    const [cLat, cLon] = district.centroid;
    const kx = Math.cos((((lat + cLat) / 2) * Math.PI) / 180);
    const dLat = lat - cLat;
    const dLon = (lon - cLon) * kx;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < bestDist) {
      bestDist = dist;
      best = district;
    }
  }
  return best;
}
