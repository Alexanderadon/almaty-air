import type { Metadata } from 'next';
import { cache } from 'react';
import { citySourceSummary } from '@/components/home/citySource';
import { DistrictCard } from '@/components/home/DistrictCard';
import { SourcesStatus } from '@/components/home/SourcesStatus';
import { MapPanel } from '@/components/map/MapPanel';
import { AdviceCard } from '@/components/ui/AdviceCard';
import { AqiBadge } from '@/components/ui/AqiBadge';
import { AqiScale } from '@/components/ui/AqiScale';
import { ErrorState } from '@/components/ui/ErrorState';
import { SourceNote } from '@/components/ui/SourceNote';
import { UpdatedAt } from '@/components/ui/UpdatedAt';
import { aqiCategory } from '@/lib/aqi';
import { assertSourcesUpDuringBuild } from '@/lib/build-guard';
import { DISTRICTS } from '@/lib/districts';
import { getCityAir } from '@/lib/sources';

export const revalidate = 3600;

/** Один опрос источников на рендер: generateMetadata и страница делят результат. */
const getCityAirCached = cache(getCityAir);

const PM_FMT = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

const NAME_BY_SLUG = new Map(DISTRICTS.map((d) => [d.slug, d.nameRu]));

export async function generateMetadata(): Promise<Metadata> {
  const air = await getCityAirCached();
  const aqi = air.citywide.aqi;
  if (aqi === null) {
    return {
      title: 'Качество воздуха сейчас',
      description:
        'Карта качества воздуха в Алматы по восьми районам: индекс AQI, концентрации PM2.5 и PM10, практические рекомендации жителям.',
    };
  }
  const cat = aqiCategory(aqi);
  const pm25 = air.citywide.pm25;
  return {
    title: `Сейчас AQI ${aqi} · ${cat.labelRu}`,
    description:
      `Качество воздуха в Алматы сейчас: AQI ${aqi} (${cat.labelRu.toLowerCase()})` +
      (pm25 !== null ? `, PM2.5 ${PM_FMT.format(pm25)} мкг/м³` : '') +
      '. Карта по восьми районам, данные станций мониторинга и модели CAMS, рекомендации жителям.',
  };
}

export default async function Home() {
  const air = await getCityAirCached();
  const allSourcesFailed = air.sources.every((s) => !s.ok);

  // Данных нет и все источники упали — честная ошибка вместо пустого героя и карты.
  if (air.citywide.aqi === null && allSourcesFailed) {
    // Во время `next build` — красная сборка вместо запечённого на час ErrorState.
    assertSourcesUpDuringBuild(air.sources, 'главная страница');
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 md:py-10">
        <ErrorState />
        <section aria-labelledby="sources-heading" className="mt-10">
          <h2 id="sources-heading" className="text-lg font-semibold tracking-tight">
            Источники данных
          </h2>
          <SourcesStatus sources={air.sources} className="mt-4" />
        </section>
      </main>
    );
  }

  const aqi = air.citywide.aqi;
  const category = aqi === null ? null : aqiCategory(aqi);
  // Происхождение общегородского AQI — по районам, вошедшим в медиану,
  // а не по сырому списку станций (сенсоры вне районов в медианы не входят).
  const heroSource = citySourceSummary(air.districts);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 md:py-10">
      {/* Герой: индекс по городу */}
      <section aria-labelledby="hero-heading">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <AqiBadge aqi={aqi} size="lg" className="self-start" />
          <div className="min-w-0 flex-1">
            <h1 id="hero-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Качество воздуха в Алматы
            </h1>
            {category !== null ? (
              <p className="mt-2 text-lg">
                Сейчас — {category.labelRu.toLowerCase()}
                {air.citywide.pm25 !== null && (
                  <span className="text-muted">
                    {' '}
                    · PM2.5 {PM_FMT.format(air.citywide.pm25)} мкг/м³
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-2 text-lg text-muted">Текущих данных по городу пока нет.</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <UpdatedAt iso={air.updatedAt} />
              {heroSource !== null && (
                <SourceNote
                  origin={heroSource.origin}
                  stationCount={heroSource.stationCount}
                />
              )}
            </div>
          </div>
        </div>
        <AdviceCard aqi={aqi} className="mt-6" />
      </section>

      {/* Карта районов и станций */}
      <section aria-labelledby="map-heading" className="mt-10">
        <h2 id="map-heading" className="text-lg font-semibold tracking-tight">
          Карта районов и станций
        </h2>
        <p className="mt-1 text-sm text-muted">
          Заливка района — категория AQI, точки — станции мониторинга. Нажмите на район
          или станцию, чтобы увидеть подробности.
        </p>
        <MapPanel districts={air.districts} stations={air.stations} className="mt-4" />
      </section>

      {/* Районы */}
      <section aria-labelledby="districts-heading" className="mt-10">
        <h2 id="districts-heading" className="text-lg font-semibold tracking-tight">
          Районы
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {air.districts.map((district) => (
            <DistrictCard
              key={district.slug}
              district={district}
              nameRu={NAME_BY_SLUG.get(district.slug) ?? district.slug}
            />
          ))}
        </div>
      </section>

      {/* Легенда шкалы AQI */}
      <section aria-labelledby="scale-heading" className="mt-10">
        <h2 id="scale-heading" className="text-lg font-semibold tracking-tight">
          Шкала AQI
        </h2>
        <p className="mt-1 text-sm text-muted">
          Индекс US EPA (ревизия 2024 года); считается из концентраций PM2.5 и PM10.
        </p>
        <AqiScale className="mt-4" />
      </section>

      {/* Статус источников */}
      <section aria-labelledby="sources-heading" className="mt-10">
        <h2 id="sources-heading" className="text-lg font-semibold tracking-tight">
          Источники данных
        </h2>
        <SourcesStatus sources={air.sources} className="mt-4" />
      </section>
    </main>
  );
}
