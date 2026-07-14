// @vitest-environment jsdom
/**
 * Тесты доступности графика AQI (WCAG 1.1.1, 2.1.1):
 * sr-only сводка и таблица значений, клавиатурная навигация по точкам
 * с объявлением через aria-live.
 *
 * ParentSize замокан (jsdom не умеет измерять layout) — ChartInner получает
 * фиксированные размеры и рендерится целиком.
 */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HourlyPoint } from '@/lib/types';
import { AqiAreaChart } from '../AqiAreaChart';

vi.mock('@visx/responsive', () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => ReactNode;
  }) => children({ width: 600, height: 280 }),
}));

// React 19: act() требует явного флага вне «настоящих» тест-раннеров React.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(cleanup);

const HOUR = 3_600_000;

/** Часовая серия с заданными AQI, начиная с startIso (UTC). */
function hourlySeries(
  aqis: (number | null)[],
  startIso = '2026-07-13T00:00:00.000Z',
): HourlyPoint[] {
  const start = Date.parse(startIso);
  return aqis.map((aqi, i) => ({
    time: new Date(start + i * HOUR).toISOString(),
    aqi,
    pm25: aqi !== null ? aqi / 2 : null,
    pm10: null,
  }));
}

describe('AqiAreaChart — текстовая альтернатива', () => {
  it('рендерит sr-only сводку (минимум/максимум/последнее) и связывает её с SVG', () => {
    const { container } = render(
      <AqiAreaChart series={hourlySeries([50, null, 30, 90, 60])} window="24h" />,
    );

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const describedBy = svg?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const summary = document.getElementById(describedBy as string);
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain('минимум 30');
    expect(summary?.textContent).toContain('максимум 90');
    expect(summary?.textContent).toContain('последнее значение 60');
  });

  it('окно 24h: таблица содержит строку на каждую точку', () => {
    const { container } = render(
      <AqiAreaChart series={hourlySeries([50, null, 30, 90, 60])} window="24h" />,
    );

    expect(screen.getByText('Время')).toBeTruthy();
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(5);
    // Точка без значения — честное «нет данных», а не пропуск строки.
    expect(container.querySelector('tbody')?.textContent).toContain('нет данных');
  });

  it('окно 7d: таблица прорежена до худшего часа каждого дня (Asia/Almaty)', () => {
    // 48 часов с 19:00 UTC = ровно два местных дня (00:00–23:00 Asia/Almaty).
    const aqis = Array.from({ length: 48 }, (_, i) => (i === 30 ? 155 : 42));
    const { container } = render(
      <AqiAreaChart
        series={hourlySeries(aqis, '2026-07-10T19:00:00.000Z')}
        window="7d"
      />,
    );

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    const text = container.querySelector('tbody')?.textContent ?? '';
    expect(text).toContain('155'); // худший час второго дня
    expect(text).toContain('42'); // худший час первого дня
  });

  it('меньше двух точек со значением — заглушка без таблицы', () => {
    const { container } = render(
      <AqiAreaChart series={hourlySeries([50, null, null])} window="24h" />,
    );
    expect(
      screen.getByText('Недостаточно данных для построения графика'),
    ).toBeTruthy();
    expect(container.querySelector('table')).toBeNull();
  });

  it('caption таблицы скрыт (sr-only): не всплывает поверх подписи под графиком', () => {
    // Регрессия: sr-only на <table> не прячет <caption> (он живёт в table
    // wrapper box вне table box) — подпись «Худший час…» накладывалась
    // на «График по модели CAMS» под графиком 7/30 дней.
    const { container } = render(
      <AqiAreaChart series={hourlySeries([50, 60, 70])} window="30d" />,
    );
    const caption = container.querySelector('caption');
    expect(caption).not.toBeNull();
    expect(caption?.getAttribute('class') ?? '').toContain('sr-only');
  });
});

describe('AqiAreaChart — оформление зон категорий', () => {
  it('рисует направляющие на внутренних границах категорий', () => {
    // Максимум 90 → верх шкалы 100, внутренняя граница одна (AQI 50).
    const { container } = render(
      <AqiAreaChart series={hourlySeries([50, 60, 90, 80])} window="24h" />,
    );
    expect(container.querySelectorAll('line.category-gridline')).toHaveLength(1);
  });
});

describe('AqiAreaChart — режим прогноза', () => {
  /** 48 часов с местной полуночи: 2026-07-13T19:00Z = 00:00 14 июля Asia/Almaty. */
  function forecastSeries(): ReturnType<typeof hourlySeries> {
    const aqis = Array.from({ length: 48 }, (_, i) => 40 + (i % 7));
    return hourlySeries(aqis, '2026-07-13T19:00:00.000Z');
  }

  it('история: aria-label не меняется (контракт e2e)', () => {
    const { container } = render(
      <AqiAreaChart series={hourlySeries([50, 60, 70])} window="24h" />,
    );
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'График изменения AQI за 24 часа',
    );
  });

  it('прогноз: aria-label «Прогноз AQI на 48 часов»', () => {
    const { container } = render(
      <AqiAreaChart series={forecastSeries()} window="24h" variant="forecast" />,
    );
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Прогноз AQI на 48 часов',
    );
  });

  it('линия прогноза пунктирная, у истории — сплошная', () => {
    const forecast = render(
      <AqiAreaChart series={forecastSeries()} window="24h" variant="forecast" />,
    ).container;
    expect(forecast.querySelector('path[stroke-dasharray]')).not.toBeNull();

    const history = render(
      <AqiAreaChart series={hourlySeries([50, 60, 70])} window="24h" />,
    ).container;
    expect(history.querySelector('path[stroke-dasharray]')).toBeNull();
  });

  it('тики прогноза: «HH:mm» и метка дня на местной полуночи (Asia/Almaty)', () => {
    const { container } = render(
      <AqiAreaChart series={forecastSeries()} window="24h" variant="forecast" />,
    );
    const svgText = container.querySelector('svg')?.textContent ?? '';
    const dayLabel = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Asia/Almaty',
      day: 'numeric',
      month: 'short',
    }).format(Date.parse('2026-07-13T19:00:00.000Z'));
    expect(svgText).toContain(dayLabel); // полночь → «14 июл.»
    expect(svgText).toContain('06:00'); // остальные тики — время
  });

  it('таблица прогноза не прореживается: строка на каждый час', () => {
    const { container } = render(
      <AqiAreaChart series={forecastSeries()} window="24h" variant="forecast" />,
    );
    expect(container.querySelectorAll('tbody tr')).toHaveLength(48);
    expect(container.querySelector('caption')?.textContent).toBe(
      'Прогноз AQI по часам на 48 часов',
    );
  });
});

describe('AqiAreaChart — клавиатурная навигация', () => {
  const LAST_TIME_FMT = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Almaty',
    hour: '2-digit',
    minute: '2-digit',
  });

  function renderChart() {
    return render(
      <AqiAreaChart series={hourlySeries([50, null, 30, 90, 60])} window="24h" />,
    );
  }

  it('стрелка влево начинает с последней точки и объявляет её через aria-live', () => {
    renderChart();
    const app = screen.getByRole('application');

    fireEvent.keyDown(app, { key: 'ArrowLeft' });
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('AQI 60');
    expect(status.textContent).toContain(
      LAST_TIME_FMT.format(Date.parse('2026-07-13T04:00:00.000Z')),
    );

    fireEvent.keyDown(app, { key: 'ArrowLeft' });
    expect(status.textContent).toContain('AQI 90');
  });

  it('Home/End — крайние точки, точка без значения объявляется как «нет данных»', () => {
    renderChart();
    const app = screen.getByRole('application');
    const status = screen.getByRole('status');

    fireEvent.keyDown(app, { key: 'Home' });
    expect(status.textContent).toContain('AQI 50');

    fireEvent.keyDown(app, { key: 'ArrowRight' });
    expect(status.textContent).toContain('нет данных');

    fireEvent.keyDown(app, { key: 'End' });
    expect(status.textContent).toContain('AQI 60');
  });

  it('навигация не выходит за края серии', () => {
    renderChart();
    const app = screen.getByRole('application');
    const status = screen.getByRole('status');

    fireEvent.keyDown(app, { key: 'End' });
    fireEvent.keyDown(app, { key: 'ArrowRight' });
    expect(status.textContent).toContain('AQI 60');

    fireEvent.keyDown(app, { key: 'Home' });
    fireEvent.keyDown(app, { key: 'ArrowLeft' });
    expect(status.textContent).toContain('AQI 50');
  });

  it('Escape сбрасывает курсор и очищает объявление', () => {
    renderChart();
    const app = screen.getByRole('application');
    const status = screen.getByRole('status');

    fireEvent.keyDown(app, { key: 'End' });
    expect(status.textContent).not.toBe('');

    fireEvent.keyDown(app, { key: 'Escape' });
    expect(status.textContent).toBe('');
  });
});
