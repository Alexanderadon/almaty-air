import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChartTabs } from '@/components/charts/ChartTabs';
import { CurrentAirCard } from '@/components/district/CurrentAirCard';
import { ForecastSection } from '@/components/district/ForecastSection';
import { MyDistrictToggle } from '@/components/district/MyDistrictToggle';
import { ShareButton } from '@/components/district/ShareButton';
import { computeTrend } from '@/components/district/TrendChip';
import { PushSubscribeCard } from '@/components/pwa/PushSubscribeCard';
import {
  districtBreadcrumbsJsonLd,
  districtPlaceJsonLd,
  JsonLd,
} from '@/components/seo/JsonLd';
import { AdviceCard } from '@/components/ui/AdviceCard';
import { AqiBadge } from '@/components/ui/AqiBadge';
import { UpdatedAt } from '@/components/ui/UpdatedAt';
import { DISTRICT_DESCRIPTIONS } from '@/content/districts';
import { assertSourcesUpDuringBuild } from '@/lib/build-guard';
import { DISTRICTS } from '@/lib/districts';
import { getCityAir, getDistrictForecast, getDistrictHistory } from '@/lib/sources';
import {
  DISTRICT_SLUGS,
  type DistrictSlug,
  type PollutantCode,
  type SourceId,
  type StationReading,
} from '@/lib/types';

export const revalidate = 3600;

interface DistrictPageProps {
  params: Promise<{ slug: string }>;
}

function isDistrictSlug(value: string): value is DistrictSlug {
  return (DISTRICT_SLUGS as readonly string[]).includes(value);
}

export function generateStaticParams(): { slug: DistrictSlug }[] {
  return DISTRICT_SLUGS.map((slug) => ({ slug }));
}

/** Название района в предложном падеже — для «Воздух в …». */
const DISTRICT_LOCATIVE: Record<DistrictSlug, string> = {
  alatau: 'Алатауском районе',
  almaly: 'Алмалинском районе',
  auezov: 'Ауэзовском районе',
  bostandyk: 'Бостандыкском районе',
  zhetysu: 'Жетысуском районе',
  medeu: 'Медеуском районе',
  nauryzbay: 'Наурызбайском районе',
  turksib: 'Турксибском районе',
};

export async function generateMetadata({
  params,
}: DistrictPageProps): Promise<Metadata> {
  const { slug } = await params;
  const district = DISTRICTS.find((d) => d.slug === slug);
  if (!district) return { title: 'Район не найден' };
  const locative = DISTRICT_LOCATIVE[district.slug];
  // С шаблоном layout title вырос бы до ~70 символов и обрезался в выдаче —
  // поэтому absolute (без суффикса «— Воздух Алматы»).
  const title = `Воздух в ${locative} сейчас — AQI, PM2.5, график`;
  const description =
    `Качество воздуха в ${locative} Алматы сейчас: индекс AQI, PM2.5 и PM10, ` +
    'графики за 24 часа, 7 и 30 дней, советы жителям. Данные станций и модели CAMS.';
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/district/${district.slug}` },
    // Вложенный openGraph из layout заменяется целиком (не сливается
    // по полям) — поэтому общие поля повторяем явно.
    openGraph: {
      title,
      description,
      url: `/district/${district.slug}`,
      siteName: 'Воздух Алматы',
      locale: 'ru_RU',
      type: 'website',
    },
  };
}

const CONCENTRATION_FMT = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 1,
});

const POLLUTANT_LABEL: Record<PollutantCode, string> = {
  pm25: 'PM2.5',
  pm10: 'PM10',
};

const SOURCE_LABEL: Record<SourceId, string> = {
  openaq: 'OpenAQ',
  waqi: 'WAQI',
  openmeteo: 'Модель CAMS',
};

/** AQI станции для бейджа: из PM2.5 → из PM10 → композитный AQI источника. */
function stationBadgeAqi(station: StationReading): number | null {
  const pm25 = station.measurements.find((m) => m.pollutant === 'pm25');
  if (pm25?.aqi != null) return pm25.aqi;
  const pm10 = station.measurements.find((m) => m.pollutant === 'pm10');
  if (pm10?.aqi != null) return pm10.aqi;
  return station.stationAqi;
}

function StationCard({ station }: { station: StationReading }) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug">{station.name}</h3>
          <p className="mt-0.5 text-xs text-muted">{SOURCE_LABEL[station.sourceId]}</p>
        </div>
        <AqiBadge aqi={stationBadgeAqi(station)} size="sm" className="shrink-0" />
      </div>
      {station.measurements.length > 0 && (
        <p className="text-sm text-muted tabular-nums">
          {station.measurements
            .map(
              (m) =>
                `${POLLUTANT_LABEL[m.pollutant]}: ${CONCENTRATION_FMT.format(m.value)} мкг/м³`,
            )
            .join(' · ')}
        </p>
      )}
      <UpdatedAt iso={station.observedAt} />
    </li>
  );
}

export default async function DistrictPage({ params }: DistrictPageProps) {
  const { slug } = await params;
  if (!isDistrictSlug(slug)) notFound();

  const district = DISTRICTS.find((d) => d.slug === slug);
  if (!district) notFound();

  const [city, history24h, history7d, history30d, forecast] = await Promise.all([
    getCityAir(),
    getDistrictHistory(slug, '24h'),
    getDistrictHistory(slug, '7d'),
    getDistrictHistory(slug, '30d'),
    getDistrictForecast(slug),
  ]);

  // Во время `next build` полный отказ всех источников роняет сборку —
  // иначе «Текущих данных нет» запечётся в статику на час ISR (см. главную).
  assertSourcesUpDuringBuild(city.sources, `район ${district.nameRu}`);

  const air = city.districts.find((d) => d.slug === slug) ?? null;
  const stations = city.stations.filter((s) => s.districtSlug === slug);
  const historyEmpty =
    history24h.points.length === 0 &&
    history7d.points.length === 0 &&
    history30d.points.length === 0;

  const trend = computeTrend(history24h.points, air?.aqi ?? null);
  const locative = DISTRICT_LOCATIVE[slug];
  const shareTitle =
    air?.aqi != null
      ? `Воздух в ${locative}: AQI ${air.aqi}`
      : `Воздух в ${locative}`;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      {/* Структурированные данные: хлебные крошки и район как место. */}
      <JsonLd data={districtBreadcrumbsJsonLd(district)} />
      <JsonLd data={districtPlaceJsonLd(district)} />

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted transition-colors hover:text-foreground"
      >
        <span aria-hidden="true">←</span>
        Все районы
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {district.nameRu}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <MyDistrictToggle slug={slug} />
          <ShareButton title={shareTitle} />
        </div>
      </div>

      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
        {DISTRICT_DESCRIPTIONS[slug]}
      </p>

      <section aria-label="Текущее качество воздуха" className="mt-6 space-y-3">
        <CurrentAirCard air={air} trend={trend} />
        <AdviceCard aqi={air?.aqi ?? null} />
        <PushSubscribeCard slug={slug} />
      </section>

      <section aria-labelledby="history-heading" className="mt-10">
        <h2 id="history-heading" className="text-xl font-semibold tracking-tight">
          История AQI
        </h2>
        {historyEmpty ? (
          <div
            role="status"
            className="mt-4 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center"
          >
            <p className="text-base font-semibold">История пока недоступна</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Не удалось получить почасовые данные за прошедшие дни. Попробуйте
              обновить страницу через несколько минут.
            </p>
          </div>
        ) : (
          <ChartTabs
            className="mt-4"
            histories={{ '24h': history24h, '7d': history7d, '30d': history30d }}
          />
        )}
      </section>

      <ForecastSection forecast={forecast} className="mt-10" />

      {stations.length > 0 && (
        <section aria-labelledby="stations-heading" className="mt-10">
          <h2
            id="stations-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Станции мониторинга в районе
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {stations.map((station) => (
              <StationCard
                key={`${station.sourceId}-${station.stationId}`}
                station={station}
              />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
