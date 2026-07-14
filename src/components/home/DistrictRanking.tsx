import Link from 'next/link';
import { aqiCategory } from '@/lib/aqi';
import { DISTRICTS } from '@/lib/districts';
import type { DistrictAir, DistrictSlug } from '@/lib/types';

export interface DistrictRankingProps {
  districts: DistrictAir[];
  className?: string;
}

type DistrictWithAqi = DistrictAir & { aqi: number };

const NAME_BY_SLUG = new Map(DISTRICTS.map((d) => [d.slug, d.nameRu]));

function nameOf(slug: DistrictSlug): string {
  return NAME_BY_SLUG.get(slug) ?? slug;
}

/** Цветная точка категории AQI; серая — когда значения нет. */
function CategoryDot({ aqi }: { aqi: number | null }) {
  if (aqi === null) {
    return (
      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-400" />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: `var(--aqi-${aqiCategory(aqi).key})` }}
    />
  );
}

/** Строка «Чище всего» / «Хуже всего» над таблицей рейтинга. */
function ExtremeLine({ label, district }: { label: string; district: DistrictWithAqi }) {
  return (
    <p className="flex items-center gap-2">
      <CategoryDot aqi={district.aqi} />
      <span className="min-w-0">
        <span className="text-muted">{label}: </span>
        <Link
          href={`/district/${district.slug}`}
          className="font-medium underline-offset-2 hover:underline"
        >
          {nameOf(district.slug)}
        </Link>
        <span className="text-muted"> · </span>
        <span className="tabular-nums">AQI {district.aqi}</span>
      </span>
    </p>
  );
}

/**
 * Рейтинг районов по текущему AQI: сверху — «Чище всего» / «Хуже всего»,
 * ниже — все восемь районов по убыванию индекса (худший воздух первым).
 * Районы без значения — в конце списка с «—». Если значения нет ни у одного
 * района, блок не рендерится вовсе.
 */
export function DistrictRanking({ districts, className = '' }: DistrictRankingProps) {
  const withAqi = districts.filter((d): d is DistrictWithAqi => d.aqi !== null);
  if (withAqi.length === 0) return null;

  // Худший воздух первым; районы без значения — в конец, в исходном порядке.
  const sorted = [...districts].sort((a, b) => {
    if (a.aqi === null) return b.aqi === null ? 0 : 1;
    if (b.aqi === null) return -1;
    return b.aqi - a.aqi;
  });

  const cleanest = withAqi.reduce((best, d) => (d.aqi < best.aqi ? d : best));
  const worst = withAqi.reduce((most, d) => (d.aqi > most.aqi ? d : most));
  const showExtremes = cleanest.slug !== worst.slug;

  return (
    <section aria-labelledby="ranking-heading" className={className}>
      <h2 id="ranking-heading" className="text-lg font-semibold tracking-tight">
        Районы сейчас
      </h2>
      <p className="mt-1 text-sm text-muted">
        Все районы по текущему индексу — сверху те, где воздух хуже.
      </p>

      {showExtremes && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
          <ExtremeLine label="Чище всего" district={cleanest} />
          <ExtremeLine label="Хуже всего" district={worst} />
        </div>
      )}

      <ol className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {sorted.map((district, index) => {
          const category = district.aqi === null ? null : aqiCategory(district.aqi);
          return (
            <li key={district.slug}>
              <Link
                href={`/district/${district.slug}`}
                className="row-lift flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface"
              >
                <span
                  aria-hidden="true"
                  className="w-4 shrink-0 text-right text-xs tabular-nums text-muted"
                >
                  {index + 1}
                </span>
                <CategoryDot aqi={district.aqi} />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {nameOf(district.slug)}
                </span>
                {category !== null && (
                  <span className="hidden shrink-0 text-xs text-muted sm:inline">
                    {category.shortRu}
                  </span>
                )}
                {district.aqi !== null ? (
                  <span className="w-9 shrink-0 text-right font-semibold tabular-nums">
                    {district.aqi}
                  </span>
                ) : (
                  <span className="w-9 shrink-0 text-right text-muted">
                    —<span className="sr-only"> данных пока нет</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
