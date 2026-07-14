/**
 * Чистая геометрия спарклайна AQI: серия значений → d-строки линии и области.
 * Вынесена из Sparkline.tsx, чтобы покрыть масштабирование, разрывы и
 * вырожденные серии юнит-тестами (vitest, node) — по образцу charts/summary.ts.
 */

export interface SparklineBox {
  width: number;
  height: number;
  /** Внутренний отступ, чтобы линия (strokeWidth/2, круглые торцы) не обрезалась краями. */
  pad: number;
}

/** Габариты по умолчанию — компактный спарклайн карточки района. */
export const SPARKLINE_BOX: SparklineBox = { width: 120, height: 28, pad: 2 };

export interface SparklineGeometry {
  /** d ломаной линии; null-значения разрывают её на отдельные M-сегменты. */
  line: string;
  /** d замкнутых областей под сегментами линии — для полупрозрачной заливки. */
  area: string;
  /** Последнее непустое значение серии — им окрашивается линия. */
  last: number;
}

/** Индекс точки и её значение внутри непрерывного отрезка. */
interface RunPoint {
  i: number;
  value: number;
}

/** Число в d-строке: до 2 знаков после запятой, без двоичного шума. */
function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * Геометрия спарклайна по упорядоченной по времени серии значений
 * (null — пропуск данных).
 *
 * Точки распределены по X равномерно (серия почасовая), Y растянут на
 * [min, max] серии; константная серия рисуется линией посередине.
 * null-значения разрывают линию: рисуются только отрезки из двух и более
 * подряд идущих значений. Если рисовать нечего — меньше двух значений или
 * все значения изолированы пропусками — возвращается null (не рендерить).
 */
export function sparklineGeometry(
  values: readonly (number | null)[],
  box: SparklineBox = SPARKLINE_BOX,
): SparklineGeometry | null {
  const defined = values.filter((v): v is number => v !== null);
  if (defined.length < 2) return null;

  // Отрезки — подряд идущие непустые значения; одиночные точки между
  // пропусками линию не образуют и не рисуются.
  const runs: RunPoint[][] = [];
  let run: RunPoint[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value !== null) {
      run.push({ i, value });
      continue;
    }
    if (run.length >= 2) runs.push(run);
    run = [];
  }
  if (run.length >= 2) runs.push(run);
  if (runs.length === 0) return null;

  const { width, height, pad } = box;
  const min = Math.min(...defined);
  const max = Math.max(...defined);
  const stepX = (width - pad * 2) / (values.length - 1);
  const x = (i: number) => pad + i * stepX;
  const y = (value: number) =>
    max === min
      ? height / 2
      : pad + ((max - value) * (height - pad * 2)) / (max - min);
  const yBase = height - pad;

  const line = runs
    .map((r) =>
      r
        .map((p, k) => `${k === 0 ? 'M' : 'L'} ${fmt(x(p.i))} ${fmt(y(p.value))}`)
        .join(' '),
    )
    .join(' ');

  const area = runs
    .map((r) => {
      const path = r.map((p) => `L ${fmt(x(p.i))} ${fmt(y(p.value))}`).join(' ');
      const first = fmt(x(r[0].i));
      const last = fmt(x(r[r.length - 1].i));
      return `M ${first} ${fmt(yBase)} ${path} L ${last} ${fmt(yBase)} Z`;
    })
    .join(' ');

  return { line, area, last: defined[defined.length - 1] };
}
