/**
 * OG-картинка главной: текущий общегородской AQI на тёмной карточке.
 * Файловая конвенция Next сама подставит её в og:image / twitter:image.
 */

import { OG_SIZE, renderAqiOgCard } from '@/lib/og/card';
import { getCityAir } from '@/lib/sources';

// Слой данных (агрегатор источников) не edge-safe — рендерим в Node.js.
export const runtime = 'nodejs';

export const alt = 'Текущий индекс качества воздуха (AQI) в Алматы';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  // getCityAir никогда не бросает: при отказе источников aqi === null,
  // и карточка честно рендерится без чисел.
  const air = await getCityAir();
  return renderAqiOgCard({ title: 'Воздух Алматы', aqi: air.citywide.aqi });
}
