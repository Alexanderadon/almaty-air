import type { Metadata } from 'next';
import { cache, type CSSProperties } from 'react';
import { AnimatedAqi } from '@/components/home/AnimatedAqi';
import { citySourceSummary } from '@/components/home/citySource';
import { DistrictCard } from '@/components/home/DistrictCard';
import { DistrictRanking } from '@/components/home/DistrictRanking';
import { FaqSection } from '@/components/home/FaqSection';
import { HeroSkyline } from '@/components/home/HeroSkyline';
import { MyDistrict } from '@/components/home/MyDistrict';
import { SourcesStatus } from '@/components/home/SourcesStatus';
import { MapPanel } from '@/components/map/MapPanel';
import {
  faqPageJsonLd,
  JsonLd,
  webApplicationJsonLd,
  websiteJsonLd,
} from '@/components/seo/JsonLd';
import { AdviceCard } from '@/components/ui/AdviceCard';
import { AqiBadge } from '@/components/ui/AqiBadge';
import { AqiScale } from '@/components/ui/AqiScale';
import { ErrorState } from '@/components/ui/ErrorState';
import { SourceNote } from '@/components/ui/SourceNote';
import { UpdatedAt } from '@/components/ui/UpdatedAt';
import { FAQ_ITEMS } from '@/content/faq';
import { aqiCategory } from '@/lib/aqi';
import { assertSourcesUpDuringBuild } from '@/lib/build-guard';
import { DISTRICTS } from '@/lib/districts';
import { getCityAir, getDistrictHistory } from '@/lib/sources';

export const revalidate = 3600;

/** Один опрос источников на рендер: generateMetadata и страница делят результат. */
const getCityAirCached = cache(getCityAir);

const PM_FMT = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

const NAME_BY_SLUG = new Map(DISTRICTS.map((d) => [d.slug, d.nameRu]));

export async function generateMetadata(): Promise<Metadata> {
  // title не задаём: главная использует поисковый title.default из layout
  // («Качество воздуха в Алматы сейчас — AQI по районам, PM2.5»).
  const air = await getCityAirCached();
  const aqi = air.citywide.aqi;
  if (aqi === null) {
    return {
      alternates: { canonical: '/' },
      description:
        'Качество воздуха в Алматы сейчас: карта по восьми районам, индекс AQI, PM2.5 и PM10, практические рекомендации жителям. Данные станций и модели CAMS.',
    };
  }
  const cat = aqiCategory(aqi);
  const pm25 = air.citywide.pm25;
  return {
    alternates: { canonical: '/' },
    description:
      `Качество воздуха в Алматы сейчас: AQI ${aqi} (${cat.labelRu.toLowerCase()})` +
      (pm25 !== null ? `, PM2.5 ${PM_FMT.format(pm25)} мкг/м³` : '') +
      '. Карта по восьми районам, данные станций и модели CAMS, рекомендации жителям.',
  };
}

export default async function Home() {
  // История за 24 часа для спарклайнов — параллельно с текущими значениями.
  // Спарклайн — прогрессивное улучшение: сбой истории района отдаёт
  // undefined, и его карточка рендерится ровно как раньше.
  const [air, sparkEntries] = await Promise.all([
    getCityAirCached(),
    Promise.all(
      DISTRICTS.map(async (d) => {
        try {
          const history = await getDistrictHistory(d.slug, '24h');
          return [d.slug, history.points] as const;
        } catch {
          return [d.slug, undefined] as const;
        }
      }),
    ),
  ]);
  const sparkBySlug = new Map(sparkEntries);
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
          <p className="mt-1 text-sm text-muted">
            Сайт всегда показывает, откуда взято каждое число.
          </p>
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
      {/* Структурированные данные: сайт, веб-приложение и FAQ (тот же
          src/content/faq.ts, что рендерит FaqSection ниже). */}
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={webApplicationJsonLd()} />
      <JsonLd data={faqPageJsonLd(FAQ_ITEMS)} />

      {/* Герой: индекс по городу на фоне силуэта Заилийского Алатау.
          --hero-tint — цвет текущей категории AQI: фон тихо меняется вместе
          с состоянием воздуха. relative + isolate + overflow-hidden держат
          силуэт под текстом и не дают ему создать горизонтальный скролл. */}
      <section aria-labelledby="hero-heading">
        <div
          className="relative isolate overflow-hidden"
          style={{ '--hero-tint': category?.color ?? 'var(--accent)' } as CSSProperties}
        >
          <HeroSkyline />
          <div className="flex flex-col gap-6 pb-10 md:flex-row md:items-center md:pb-12">
            <AnimatedAqi value={aqi}>
              <AqiBadge aqi={aqi} size="lg" className="self-start" />
            </AnimatedAqi>
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

      {/* Быстрый доступ «Мой район» — появляется после выбора района на его
          странице (localStorage). Смонтирован вне секции «Районы», чтобы не
          попадать в подсчёт восьми карточек-ссылок районов. */}
      <MyDistrict districts={air.districts} className="mt-10" />

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
              spark={sparkBySlug.get(district.slug)}
            />
          ))}
        </div>
      </section>

      {/* Рейтинг районов по текущему AQI (сам скрывается, если данных нет) */}
      <DistrictRanking districts={air.districts} className="mt-10" />

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
        <p className="mt-1 text-sm text-muted">
          Сайт всегда показывает, откуда взято каждое число.
        </p>
        <SourcesStatus sources={air.sources} className="mt-4" />
      </section>

      {/* FAQ о воздухе в Алматы */}
      <FaqSection className="mt-10" />
    </main>
  );
}
