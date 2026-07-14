'use client';

/**
 * График AQI района: area + line (visx), фоновые зоны категорий EPA,
 * градиентная заливка, тултип с кроссхейром. Полностью адаптивный
 * (ParentSize), без библиотек анимации.
 *
 * Точки с aqi === null разрывают линию (defined) — пропуски данных честно
 * видны как разрывы, а не интерполируются.
 *
 * Доступность (WCAG 1.1.1, 2.1.1): рядом с SVG рендерится скрытая визуально
 * (sr-only) текстовая альтернатива — сводка «минимум/максимум/последнее»
 * и таблица значений (для 7/30 дней — худший час каждого дня, конвенция EPA
 * для сводок); график фокусируем с клавиатуры, стрелки перемещают точку
 * тултипа, текущее значение объявляется через aria-live.
 */

import { useCallback, useId, useMemo, useState } from 'react';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { curveMonotoneX } from '@visx/curve';
import { LinearGradient } from '@visx/gradient';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { scaleLinear, scaleTime } from '@visx/scale';
import { AreaClosed, Bar, Line, LinePath } from '@visx/shape';
import { TooltipWithBounds, useTooltip } from '@visx/tooltip';
import { AQI_CATEGORIES, aqiCategory } from '@/lib/aqi';
import type { HistoryWindow, HourlyPoint } from '@/lib/types';
import { dailyWorstPoints, summarizeAqi } from './summary';

export interface AqiAreaChartProps {
  series: HourlyPoint[];
  window: HistoryWindow;
  /**
   * forecast — прогнозная серия: пунктирная линия, тики «HH:mm» с метками
   * дней на местной полуночи, aria-label «Прогноз AQI на 48 часов».
   * По умолчанию history — поведение исторического графика не меняется.
   */
  variant?: 'history' | 'forecast';
}

export type AqiChartVariant = NonNullable<AqiAreaChartProps['variant']>;

/** Точка серии с предвычисленной датой (парсим ISO один раз). */
interface ChartPoint extends HourlyPoint {
  date: Date;
  ms: number;
}

const MARGIN = { top: 12, right: 12, bottom: 30, left: 40 } as const;

const WINDOW_LABEL: Record<HistoryWindow, string> = {
  '24h': 'за 24 часа',
  '7d': 'за 7 дней',
  '30d': 'за 30 дней',
};

/** Верхние границы категорий AQI: 50, 100, 150, 200, 300, 500. */
const CATEGORY_TOPS = AQI_CATEGORIES.map((c) => c.aqiRange[1]);

/** Часовой пояс отображения — как во всём приложении. */
const DISPLAY_TZ = 'Asia/Almaty';

const HOUR_FMT = new Intl.DateTimeFormat('ru-RU', {
  timeZone: DISPLAY_TZ,
  hour: '2-digit',
  minute: '2-digit',
});

const DAY_FMT = new Intl.DateTimeFormat('ru-RU', {
  timeZone: DISPLAY_TZ,
  day: 'numeric',
  month: 'short',
});

const TOOLTIP_FULL_FMT = new Intl.DateTimeFormat('ru-RU', {
  timeZone: DISPLAY_TZ,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const CONCENTRATION_FMT = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 1,
});

/** Час точки в местном времени (метки дней на тиках прогноза). h23 — чтобы полночь была «00», а не «24». */
const LOCAL_HOUR_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: DISPLAY_TZ,
  hour: '2-digit',
  hourCycle: 'h23',
});

function localHour(date: Date): number {
  return Number(LOCAL_HOUR_FMT.format(date));
}

/**
 * Цвет категории, подмешанный к цвету текста темы: светлые категории
 * («Хорошо» #F5F0BB) в чистом виде неразличимы на светлом фоне,
 * подмес --foreground даёт видимую линию в обеих темах.
 * На тёмной теме доля --foreground выше (38% против 28%): тёмным категориям
 * («Опасно» #4A1D4F) 28% светлого подмеса не хватает на тёмной поверхности.
 * light-dark() работает благодаря color-scheme: light dark на :root.
 */
function contrastCategoryColor(aqi: number): string {
  const base = aqiCategory(aqi).color;
  return (
    `light-dark(color-mix(in srgb, ${base} 72%, var(--foreground) 28%), ` +
    `color-mix(in srgb, ${base} 62%, var(--foreground) 38%))`
  );
}

/**
 * Заливка фоновой зоны категории. На светлой теме 8% цвета достаточно,
 * на тёмной те же 8% сливаются в неразличимую тёмную кашу — берём 13%.
 */
function bandFill(color: string): string {
  return (
    `light-dark(color-mix(in srgb, ${color} 8%, transparent), ` +
    `color-mix(in srgb, ${color} 13%, transparent))`
  );
}

/** Ближайшая по времени точка (бинарный поиск по отсортированному массиву). */
function nearestPoint(points: ChartPoint[], ms: number): ChartPoint | null {
  if (points.length === 0) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].ms < ms) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(points[lo - 1].ms - ms) <= Math.abs(points[lo].ms - ms)) {
    return points[lo - 1];
  }
  return points[lo];
}

/** Текст точки для aria-live: время, AQI и категория (или «нет данных»). */
function describePoint(point: ChartPoint, fmt: Intl.DateTimeFormat): string {
  const time = fmt.format(point.date);
  if (point.aqi === null) return `${time}: нет данных`;
  return `${time}: AQI ${point.aqi} — ${aqiCategory(point.aqi).shortRu}`;
}

const TOOLTIP_STYLES: React.CSSProperties = {
  position: 'absolute',
  backgroundColor: 'var(--card)',
  color: 'var(--foreground)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.75rem',
  lineHeight: 1.5,
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.15)',
  pointerEvents: 'none',
};

interface ChartInnerProps {
  points: ChartPoint[];
  win: HistoryWindow;
  variant: AqiChartVariant;
  width: number;
  height: number;
  /** id sr-only сводки — связывается с SVG через aria-describedby. */
  describedBy?: string;
}

function ChartInner({ points, win, variant, width, height, describedBy }: ChartInnerProps) {
  const rawId = useId();
  // useId может содержать «:» — недопустимо в url(#…)-ссылках SVG.
  const gradientId = `aqi-area-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const innerWidth = Math.max(10, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(10, height - MARGIN.top - MARGIN.bottom);

  const { xScale, yScale, yMax } = useMemo(() => {
    let minMs = points[0].ms;
    let maxMs = points[points.length - 1].ms;
    if (minMs === maxMs) {
      // Вырожденный домен (все точки в один час) — растягиваем на ±30 минут.
      minMs -= 30 * 60 * 1000;
      maxMs += 30 * 60 * 1000;
    }
    const maxAqi = points.reduce(
      (acc, p) => (p.aqi !== null && p.aqi > acc ? p.aqi : acc),
      0,
    );
    // Верх шкалы — ближайшая граница категории с запасом ~8%, чтобы линия
    // не упиралась в край, а зоны заканчивались ровно на границе.
    const top = CATEGORY_TOPS.find((b) => b >= maxAqi * 1.08) ?? 500;
    return {
      yMax: top,
      xScale: scaleTime<number>({
        domain: [new Date(minMs), new Date(maxMs)],
        range: [0, innerWidth],
      }),
      yScale: scaleLinear<number>({
        domain: [0, top],
        range: [innerHeight, 0],
      }),
    };
  }, [points, innerWidth, innerHeight]);

  const isForecast = variant === 'forecast';
  /** Формат времени точки (aria-live и тултип): прогноз и 7/30д — с датой. */
  const pointTimeFmt = !isForecast && win === '24h' ? HOUR_FMT : TOOLTIP_FULL_FMT;

  /** Фоновые зоны категорий — только до видимого максимума шкалы. */
  const bands = useMemo(() => {
    const result: { key: string; y: number; height: number; color: string }[] = [];
    let lower = 0;
    for (const cat of AQI_CATEGORIES) {
      if (lower >= yMax) break;
      const upper = Math.min(cat.aqiRange[1], yMax);
      result.push({
        key: cat.key,
        y: yScale(upper),
        height: yScale(lower) - yScale(upper),
        color: cat.color,
      });
      lower = cat.aqiRange[1];
    }
    return result;
  }, [yScale, yMax]);

  /** Внутренние границы категорий (без верха шкалы) — тонкие направляющие. */
  const boundaries = useMemo(() => CATEGORY_TOPS.filter((b) => b < yMax), [yMax]);

  const yTickValues = useMemo(
    () => [0, ...CATEGORY_TOPS.filter((b) => b <= yMax)],
    [yMax],
  );

  const lastDefined = useMemo(() => {
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].aqi !== null) return points[i];
    }
    return null;
  }, [points]);

  const strokeColor =
    lastDefined !== null && lastDefined.aqi !== null
      ? contrastCategoryColor(lastDefined.aqi)
      : 'var(--accent)';
  const gradientColor =
    lastDefined !== null && lastDefined.aqi !== null
      ? aqiCategory(lastDefined.aqi).color
      : 'var(--accent)';

  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<ChartPoint>();

  /*
   * Клавиатурный курсор по точкам (WCAG 2.1.1): индекс текущей точки;
   * null — навигация не начата. Смена окна 24ч/7д/30д размонтирует ChartInner
   * (key={win} снаружи) — курсор и тултип сбрасываются без эффектов.
   */
  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  const focusPoint = useCallback(
    (index: number) => {
      const clamped = Math.min(Math.max(index, 0), points.length - 1);
      const point = points[clamped];
      setFocusIdx(clamped);
      showTooltip({
        tooltipData: point,
        tooltipLeft: MARGIN.left + xScale(point.date),
        tooltipTop:
          MARGIN.top + (point.aqi !== null ? yScale(point.aqi) : innerHeight / 2),
      });
    },
    [points, xScale, yScale, innerHeight, showTooltip],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Старт навигации — с последней (самой свежей) точки.
      const current = focusIdx ?? points.length - 1;
      const started = focusIdx !== null;
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          focusPoint(started ? current + 1 : current);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          focusPoint(started ? current - 1 : current);
          break;
        case 'PageUp':
          event.preventDefault();
          focusPoint(started ? current + 24 : current);
          break;
        case 'PageDown':
          event.preventDefault();
          focusPoint(started ? current - 24 : current);
          break;
        case 'Home':
          event.preventDefault();
          focusPoint(0);
          break;
        case 'End':
          event.preventDefault();
          focusPoint(points.length - 1);
          break;
        case 'Escape':
          setFocusIdx(null);
          hideTooltip();
          break;
      }
    },
    [focusIdx, points.length, focusPoint, hideTooltip],
  );

  const handleBlur = useCallback(() => {
    setFocusIdx(null);
    hideTooltip();
  }, [hideTooltip]);

  const handlePointer = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      // Аналог localPoint из @visx/event (пакет не в зависимостях):
      // координата относительно оверлея, svg рендерится 1:1 без масштабирования.
      const rect = event.currentTarget.getBoundingClientRect();
      const x = Math.min(Math.max(event.clientX - rect.left, 0), innerWidth);
      const point = nearestPoint(points, xScale.invert(x).getTime());
      if (!point) return;
      const px = xScale(point.date);
      const py = point.aqi !== null ? yScale(point.aqi) : innerHeight / 2;
      showTooltip({
        tooltipData: point,
        tooltipLeft: MARGIN.left + px,
        tooltipTop: MARGIN.top + py,
      });
    },
    [points, xScale, yScale, innerWidth, innerHeight, showTooltip],
  );

  const formatXTick = useCallback(
    (value: Date | { valueOf(): number }): string => {
      const date = value instanceof Date ? value : new Date(value.valueOf());
      if (isForecast) {
        // Местная полночь — метка дня («15 июл.»), остальные тики — «HH:mm».
        return localHour(date) === 0 ? DAY_FMT.format(date) : HOUR_FMT.format(date);
      }
      return (win === '24h' ? HOUR_FMT : DAY_FMT).format(date);
    },
    [win, isForecast],
  );

  /**
   * Тики прогноза — каждые 6 часов по местному времени (на узких экранах —
   * каждые 12): полуночи попадают в сетку и получают метку дня.
   */
  const forecastTickValues = useMemo(() => {
    if (!isForecast) return undefined;
    const step = width < 480 ? 12 : 6;
    return points.filter((p) => localHour(p.date) % step === 0).map((p) => p.date);
  }, [isForecast, points, width]);

  const numTicksX = win === '7d' ? (width < 480 ? 4 : 7) : width < 480 ? 4 : 6;

  const crossX = tooltipData ? xScale(tooltipData.date) : 0;

  const announcement =
    focusIdx !== null && focusIdx < points.length
      ? describePoint(points[focusIdx], pointTimeFmt)
      : '';

  const chartTitle = isForecast
    ? 'Прогноз AQI на 48 часов'
    : `График изменения AQI ${WINDOW_LABEL[win]}`;

  return (
    <div
      className="relative"
      tabIndex={0}
      role="application"
      aria-roledescription="интерактивный график"
      aria-label={
        `${isForecast ? 'Прогноз AQI на 48 часов' : `График AQI ${WINDOW_LABEL[win]}`}. ` +
        'Стрелки влево и вправо — по точкам, PageUp и PageDown — на сутки, ' +
        'Home и End — к краям, Escape — скрыть значение.'
      }
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={chartTitle}
        aria-describedby={describedBy}
      >
        <LinearGradient
          id={gradientId}
          from={gradientColor}
          to={gradientColor}
          fromOpacity={0.45}
          toOpacity={0.03}
        />
        <Group left={MARGIN.left} top={MARGIN.top}>
          {bands.map((band) => (
            <rect
              key={band.key}
              x={0}
              y={band.y}
              width={innerWidth}
              height={band.height}
              fill={bandFill(band.color)}
            />
          ))}

          {/* Тонкие направляющие на границах категорий — читаются на обеих темах. */}
          {boundaries.map((b) => (
            <line
              key={b}
              className="category-gridline"
              x1={0}
              x2={innerWidth}
              y1={yScale(b)}
              y2={yScale(b)}
              stroke="color-mix(in srgb, var(--border) 50%, transparent)"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
          ))}

          <AreaClosed<ChartPoint>
            data={points}
            x={(d) => xScale(d.date)}
            y={(d) => yScale(d.aqi ?? 0)}
            yScale={yScale}
            defined={(d) => d.aqi !== null}
            curve={curveMonotoneX}
            fill={`url(#${gradientId})`}
          />
          <LinePath<ChartPoint>
            data={points}
            x={(d) => xScale(d.date)}
            y={(d) => yScale(d.aqi ?? 0)}
            defined={(d) => d.aqi !== null}
            curve={curveMonotoneX}
            stroke={strokeColor}
            strokeWidth={2}
            strokeDasharray={isForecast ? '6,4' : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            numTicks={numTicksX}
            tickValues={forecastTickValues}
            tickFormat={formatXTick}
            stroke="var(--border)"
            tickStroke="var(--border)"
            tickLabelProps={{
              fill: 'var(--muted)',
              fontSize: 11,
              textAnchor: 'middle',
            }}
          />
          <AxisLeft
            scale={yScale}
            tickValues={yTickValues}
            tickFormat={(value) => String(Number(value))}
            hideAxisLine
            hideTicks
            tickLabelProps={{
              fill: 'var(--muted)',
              fontSize: 11,
              textAnchor: 'end',
              dx: '-0.35em',
              dy: '0.3em',
            }}
          />

          {tooltipOpen && tooltipData && (
            <g pointerEvents="none">
              <Line
                from={{ x: crossX, y: 0 }}
                to={{ x: crossX, y: innerHeight }}
                stroke="var(--muted)"
                strokeWidth={1}
                strokeDasharray="4,3"
              />
              {tooltipData.aqi !== null && (
                <circle
                  cx={crossX}
                  cy={yScale(tooltipData.aqi)}
                  r={4}
                  fill={contrastCategoryColor(tooltipData.aqi)}
                  stroke="var(--card)"
                  strokeWidth={1.5}
                />
              )}
            </g>
          )}

          <Bar
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
            onPointerLeave={hideTooltip}
          />
        </Group>
      </svg>

      {/* Объявление точки клавиатурного курсора для скринридеров. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          key={tooltipData.time}
          left={tooltipLeft}
          top={tooltipTop}
          style={TOOLTIP_STYLES}
        >
          <p className="font-semibold tabular-nums">
            {pointTimeFmt.format(tooltipData.date)}
          </p>
          <p className="tabular-nums">
            AQI:{' '}
            {tooltipData.aqi !== null
              ? `${tooltipData.aqi} — ${aqiCategory(tooltipData.aqi).shortRu}`
              : 'нет данных'}
          </p>
          {tooltipData.pm25 !== null && (
            <p className="tabular-nums">
              PM2.5: {CONCENTRATION_FMT.format(tooltipData.pm25)} мкг/м³
            </p>
          )}
          {tooltipData.pm10 !== null && (
            <p className="tabular-nums">
              PM10: {CONCENTRATION_FMT.format(tooltipData.pm10)} мкг/м³
            </p>
          )}
        </TooltipWithBounds>
      )}
    </div>
  );
}

/** Скрытая визуально таблица значений — текстовая альтернатива графика. */
function SrOnlyTable({
  rows,
  win,
  variant,
}: {
  rows: ChartPoint[];
  win: HistoryWindow;
  variant: AqiChartVariant;
}) {
  return (
    <table className="sr-only">
      {/* sr-only на самой таблице caption не прячет: overflow/clip применяются
          к table box, а caption живёт в table wrapper box снаружи — без
          собственного sr-only подпись всплывала поверх подписи под графиком. */}
      <caption className="sr-only">
        {variant === 'forecast'
          ? 'Прогноз AQI по часам на 48 часов'
          : win === '24h'
            ? 'Значения AQI по часам за 24 часа'
            : `Худший час каждого дня ${WINDOW_LABEL[win]}`}
      </caption>
      <thead>
        <tr>
          <th scope="col">Время</th>
          <th scope="col">AQI</th>
          <th scope="col">Категория</th>
          <th scope="col">PM2.5, мкг/м³</th>
          <th scope="col">PM10, мкг/м³</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.time}>
            <th scope="row">{TOOLTIP_FULL_FMT.format(p.date)}</th>
            <td>{p.aqi !== null ? p.aqi : 'нет данных'}</td>
            <td>{p.aqi !== null ? aqiCategory(p.aqi).labelRu : '—'}</td>
            <td>{p.pm25 !== null ? CONCENTRATION_FMT.format(p.pm25) : '—'}</td>
            <td>{p.pm10 !== null ? CONCENTRATION_FMT.format(p.pm10) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Переиспользуемый график AQI по часовым точкам.
 * Меньше двух точек со значением — честная заглушка «Недостаточно данных».
 */
export function AqiAreaChart({
  series,
  window: win,
  variant = 'history',
}: AqiAreaChartProps) {
  const summaryId = useId();

  const points = useMemo<ChartPoint[]>(
    () =>
      series
        .map((p) => {
          const ms = Date.parse(p.time);
          return Number.isFinite(ms) ? { ...p, date: new Date(ms), ms } : null;
        })
        .filter((p): p is ChartPoint => p !== null)
        .sort((a, b) => a.ms - b.ms),
    [series],
  );

  const definedCount = useMemo(
    () => points.reduce((acc, p) => (p.aqi !== null ? acc + 1 : acc), 0),
    [points],
  );

  const summary = useMemo(() => summarizeAqi(points), [points]);

  /** Строки текстовой таблицы: 24ч и прогноз — все часы, 7/30д — худший час каждого дня. */
  const tableRows = useMemo(
    () =>
      variant === 'forecast' || win === '24h'
        ? points
        : dailyWorstPoints(points, DISPLAY_TZ),
    [points, win, variant],
  );

  if (definedCount < 2 || summary === null) {
    return (
      <div
        role="status"
        className="flex min-h-[260px] w-full items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6"
      >
        <p className="text-sm text-muted">
          Недостаточно данных для построения графика
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative h-[280px] min-h-[260px] w-full min-w-0 overflow-hidden">
        <ParentSize debounceTime={60}>
          {({ width, height }) =>
            width < 60 ? null : (
              <ChartInner
                /* Смена окна — новый инстанс: сброс клавиатурного курсора и тултипа. */
                key={win}
                points={points}
                win={win}
                variant={variant}
                width={width}
                height={Math.max(height, 260)}
                describedBy={summaryId}
              />
            )
          }
        </ParentSize>
      </div>

      {/* Текстовая альтернатива для скринридеров: сводка + таблица значений. */}
      <p id={summaryId} className="sr-only">
        {`${variant === 'forecast' ? 'Прогноз AQI на 48 часов' : `AQI ${WINDOW_LABEL[win]}`}: ` +
          `минимум ${summary.minAqi} (${TOOLTIP_FULL_FMT.format(summary.min.ms)}), ` +
          `максимум ${summary.maxAqi} (${TOOLTIP_FULL_FMT.format(summary.max.ms)}), ` +
          `последнее значение ${summary.lastAqi} — ${aqiCategory(summary.lastAqi).labelRu.toLowerCase()} ` +
          `(${TOOLTIP_FULL_FMT.format(summary.last.ms)}).`}
      </p>
      <SrOnlyTable rows={tableRows} win={win} variant={variant} />
    </>
  );
}
