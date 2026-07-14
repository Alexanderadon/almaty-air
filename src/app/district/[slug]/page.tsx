import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChartTabs } from '@/components/charts/ChartTabs';
import { AdviceCard } from '@/components/ui/AdviceCard';
import { AqiBadge } from '@/components/ui/AqiBadge';
import { SourceNote } from '@/components/ui/SourceNote';
import { UpdatedAt } from '@/components/ui/UpdatedAt';
import { assertSourcesUpDuringBuild } from '@/lib/build-guard';
import { DISTRICTS } from '@/lib/districts';
import { getCityAir, getDistrictHistory } from '@/lib/sources';
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

export async function generateMetadata({
  params,
}: DistrictPageProps): Promise<Metadata> {
  const { slug } = await params;
  const district = DISTRICTS.find((d) => d.slug === slug);
  if (!district) return { title: 'Район не найден' };
  const description =
    `${district.nameRu} Алматы: текущий индекс качества воздуха AQI, ` +
    'концентрации PM2.5 и PM10, история за 24 часа, 7 и 30 дней ' +
    'и рекомендации жителям.';
  return {
    // Шаблон в layout добавляет суффикс «— Воздух Алматы» к <title>, но не
    // к og:title, а вложенный openGraph из layout заменяется целиком
    // (не сливается по полям) — поэтому общие поля повторяем явно.
    title: district.nameRu,
    description,
    openGraph: {
      title: `${district.nameRu} — Воздух Алматы`,
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

  const [city, history24h, history7d, history30d] = await Promise.all([
    getCityAir(),
    getDistrictHistory(slug, '24h'),
    getDistrictHistory(slug, '7d'),
    getDistrictHistory(slug, '30d'),
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

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted transition-colors hover:text-foreground"
      >
        <span aria-hidden="true">←</span>
        Все районы
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {district.nameRu}
      </h1>

      <section
        aria-label="Текущее качество воздуха"
        className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start"
      >
        <div className="flex shrink-0 flex-col items-start gap-2">
          <AqiBadge aqi={air?.aqi ?? null} size="lg" />
          {air?.observedAt && <UpdatedAt iso={air.observedAt} />}
          {/* Без данных (aqi null) происхождение не заявляем: рядом уже честное
              «Нет данных», а подпись «По модели CAMS» ему бы противоречила. */}
          {air && air.aqi !== null && (
            <SourceNote
              origin={air.dataOrigin}
              stationCount={air.stationCount}
              className="max-w-60"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <AdviceCard aqi={air?.aqi ?? null} />
          {air?.pm25 != null && (
            <p className="text-sm text-muted">
              PM2.5 сейчас:{' '}
              <span className="font-semibold text-foreground tabular-nums">
                {CONCENTRATION_FMT.format(air.pm25)}
              </span>{' '}
              мкг/м³
            </p>
          )}
          {(air === null || air.aqi === null) && (
            <p className="text-sm text-muted">
              Текущих данных по району нет — источники временно недоступны.
              Попробуйте обновить страницу позже.
            </p>
          )}
        </div>
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
