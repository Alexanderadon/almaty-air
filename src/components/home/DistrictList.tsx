import Link from 'next/link';
import { aqiCategory } from '@/lib/aqi';
import { DISTRICTS } from '@/lib/districts';
import type { DistrictAir, DistrictSlug, HourlyPoint } from '@/lib/types';
import { pluralRu } from './plural';
import { Sparkline } from './Sparkline';

export interface DistrictListProps {
  districts: DistrictAir[];
  /**
   * Почасовые серии AQI за 24 часа по slug — для спарклайна в строке.
   * Серии нет (undefined) — строка рендерится без спарклайна, остальное
   * не меняется.
   */
  sparks?: ReadonlyMap<DistrictSlug, HourlyPoint[] | undefined>;
  className?: string;
}

type DistrictWithAqi = DistrictAir & { aqi: number };

const NAME_BY_SLUG = new Map(DISTRICTS.map((d) => [d.slug, d.nameRu]));

/** «Алатауский район» → «Алатауский»: в списке районов слово «район» лишнее. */
export function shortDistrictName(slug: DistrictSlug): string {
  const full = NAME_BY_SLUG.get(slug) ?? slug;
  return full.replace(/\s+район$/u, '');
}

/** Худший воздух первым; районы без значения — в конец, в исходном порядке. */
export function sortByAqiDesc(districts: readonly DistrictAir[]): DistrictAir[] {
  return [...districts].sort((a, b) => {
    if (a.aqi === null) return b.aqi === null ? 0 : 1;
    if (b.aqi === null) return -1;
    return b.aqi - a.aqi;
  });
}

/** Откуда число: «3 станции», «модель CAMS» или «данных пока нет». */
function originHint(district: DistrictAir): string {
  if (district.aqi === null) return 'данных пока нет';
  if (district.dataOrigin === 'model') return 'модель CAMS';
  const n = district.stationCount;
  return `${n} ${pluralRu(n, ['станция', 'станции', 'станций'])}`;
}

/** Число AQI на плашке цвета категории; без данных — пустая пунктирная плашка. */
function AqiChip({ aqi }: { aqi: number | null }) {
  if (aqi === null) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex min-w-11 items-center justify-center rounded-lg border border-dashed border-border px-2 py-1 text-sm text-muted"
      >
        —
      </span>
    );
  }
  const cat = aqiCategory(aqi);
  return (
    <span
      className="inline-flex min-w-11 items-center justify-center rounded-lg px-2 py-1 text-sm font-semibold tabular-nums"
      style={{
        backgroundColor: `var(--aqi-${cat.key})`,
        color: `var(--aqi-${cat.key}-text)`,
      }}
    >
      {Math.round(aqi)}
    </span>
  );
}

/**
 * Строка района — вся строка ссылка. Сетка в два ряда: слева название и
 * происхождение данных, справа плашка AQI; на узких экранах спарклайн
 * занимает правый нижний угол, категория дописывается словом в подпись.
 * На sm+ спарклайн и название категории получают свои колонки на всю
 * высоту строки — читается как таблица без линий.
 */
function DistrictRow({ district, spark }: { district: DistrictAir; spark?: HourlyPoint[] }) {
  const category = district.aqi === null ? null : aqiCategory(district.aqi);
  return (
    <li>
      <Link
        href={`/district/${district.slug}`}
        className="row-lift grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-3 py-3 transition-colors hover:bg-card sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:gap-x-6 sm:gap-y-0 sm:px-4"
      >
        <span className="col-start-1 row-start-1 truncate text-[15px] font-medium leading-snug">
          {shortDistrictName(district.slug)}
        </span>
        <span className="col-start-1 row-start-2 truncate text-xs text-muted">
          {originHint(district)}
          {category !== null && <span className="sm:hidden"> · {category.shortRu}</span>}
        </span>
        {spark !== undefined && (
          <Sparkline
            points={spark}
            className="col-start-2 row-start-2 h-6 w-24 justify-self-end sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:h-7 sm:w-30 sm:justify-self-auto"
          />
        )}
        {category !== null && (
          <span className="hidden text-xs text-muted sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:block sm:w-44 sm:text-right">
            {category.labelRu}
          </span>
        )}
        <span className="col-start-2 row-start-1 justify-self-end sm:col-start-4 sm:row-span-2 sm:row-start-1">
          <AqiChip aqi={district.aqi} />
        </span>
      </Link>
    </li>
  );
}

/**
 * Единый список районов по текущему AQI — сверху те, где воздух хуже.
 * Над списком одной фразой — где сейчас чище и где хуже всего (без ссылок:
 * ссылки — сами строки, и e2e считает ровно восемь). Районы без значения —
 * в конце с пустой плашкой; список рендерится всегда, даже если данных нет
 * ни у одного района — ссылки на страницы районов остаются доступными.
 */
export function DistrictList({ districts, sparks, className = '' }: DistrictListProps) {
  const sorted = sortByAqiDesc(districts);
  const withAqi = districts.filter((d): d is DistrictWithAqi => d.aqi !== null);
  const cleanest =
    withAqi.length > 0 ? withAqi.reduce((best, d) => (d.aqi < best.aqi ? d : best)) : null;
  const worst =
    withAqi.length > 0 ? withAqi.reduce((most, d) => (d.aqi > most.aqi ? d : most)) : null;
  const showExtremes = cleanest !== null && worst !== null && cleanest.slug !== worst.slug;

  return (
    <section aria-labelledby="districts-heading" className={className}>
      <h2 id="districts-heading" className="text-xl font-semibold tracking-tight">
        Районы
      </h2>
      {showExtremes ? (
        <p className="mt-1.5 text-sm text-muted">
          Чище всего сейчас —{' '}
          <span className="font-medium text-foreground">{shortDistrictName(cleanest.slug)}</span>{' '}
          <span className="tabular-nums">(AQI {cleanest.aqi})</span>, хуже всего —{' '}
          <span className="font-medium text-foreground">{shortDistrictName(worst.slug)}</span>{' '}
          <span className="tabular-nums">(AQI {worst.aqi})</span>.
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-muted">Все восемь районов по текущему индексу.</p>
      )}
      <p className="mt-1 text-xs text-muted">
        От худшего воздуха к лучшему · линия — AQI за последние 24 часа
      </p>

      <ol className="mt-4 divide-y divide-border border-y border-border">
        {sorted.map((district) => (
          <DistrictRow
            key={district.slug}
            district={district}
            spark={sparks?.get(district.slug)}
          />
        ))}
      </ol>
    </section>
  );
}
