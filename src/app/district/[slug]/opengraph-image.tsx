/**
 * OG-картинка страницы района: имя района и его текущий AQI.
 * Файловая конвенция Next сама подставит её в og:image страницы района —
 * generateMetadata в page.tsx не задаёт openGraph.images, конфликта нет.
 */

import { DISTRICTS } from '@/lib/districts';
import { OG_SIZE, renderAqiOgCard } from '@/lib/og/card';
import { getCityAir } from '@/lib/sources';

// Слой данных (агрегатор источников) не edge-safe — рендерим в Node.js.
export const runtime = 'nodejs';

export const alt = 'Текущий индекс качества воздуха (AQI) в районе Алматы';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const district = DISTRICTS.find((d) => d.slug === slug) ?? null;
  // Неизвестный slug сюда обычно не доходит (страница отдаёт 404), но если
  // картинку запросили напрямую — городская карточка без чисел, не ошибка.
  if (!district) {
    return renderAqiOgCard({ title: 'Воздух Алматы', aqi: null });
  }
  const air = await getCityAir();
  const aqi = air.districts.find((d) => d.slug === district.slug)?.aqi ?? null;
  return renderAqiOgCard({
    eyebrow: 'Воздух Алматы',
    title: district.nameRu,
    aqi,
  });
}
