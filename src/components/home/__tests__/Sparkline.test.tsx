// @vitest-environment jsdom
/**
 * Рендер-тесты спарклайна и карточки района с ним: SVG скрыт от скринридеров
 * (декор), линия и область присутствуют, короткая серия не рендерит ничего,
 * а карточка без пропа spark остаётся ровно прежней.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { DistrictAir, HourlyPoint } from '../../../lib/types';
import { DistrictCard } from '../DistrictCard';
import { Sparkline } from '../Sparkline';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(cleanup);

function hourly(values: (number | null)[]): HourlyPoint[] {
  return values.map((aqi, i) => ({
    time: new Date(Date.UTC(2026, 6, 14, i)).toISOString(),
    pm25: null,
    pm10: null,
    aqi,
  }));
}

const DISTRICT: DistrictAir = {
  slug: 'medeu',
  aqi: 57,
  pm25: 12.3,
  dominant: 'pm25',
  stationCount: 2,
  dataOrigin: 'stations',
  observedAt: '2026-07-14T08:00:00.000Z',
};

describe('Sparkline', () => {
  it('рендерит скрытый от скринридеров SVG с областью и линией', () => {
    const { container } = render(<Sparkline points={hourly([10, 40, 25, 60])} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 120 28');
    expect(svg?.querySelector('title')?.textContent).toBe('Динамика за 24 часа');
    // Две path: область (заливка) и линия (stroke по цвету категории).
    const paths = svg?.querySelectorAll('path') ?? [];
    expect(paths).toHaveLength(2);
    expect(paths[1].getAttribute('stroke')).toContain('color-mix');
    expect(paths[1].getAttribute('stroke-width')).toBe('1.5');
  });

  it('меньше двух значений — не рендерится вовсе', () => {
    const { container } = render(<Sparkline points={hourly([42, null, null])} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('DistrictCard со спарклайном', () => {
  it('без пропа spark — ни одного svg, разметка прежняя', () => {
    const { container } = render(
      <DistrictCard district={DISTRICT} nameRu="Медеуский район" />,
    );
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/district/medeu');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('со spark — спарклайн внутри той же ссылки карточки', () => {
    const { container } = render(
      <DistrictCard
        district={DISTRICT}
        nameRu="Медеуский район"
        spark={hourly([30, 45, null, 57])}
      />,
    );
    expect(container.querySelector('a svg[aria-hidden="true"]')).not.toBeNull();
  });
});
