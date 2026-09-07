// @vitest-environment jsdom
/**
 * Рендер-тесты спарклайна и списка районов с ним: SVG скрыт от скринридеров
 * (декор), линия и область присутствуют, короткая серия не рендерит ничего;
 * список сортирует районы от худшего к лучшему, ссылка на каждый район ровно
 * одна (e2e считает восемь), спарклайн — внутри ссылки строки.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { DistrictAir, DistrictSlug, HourlyPoint } from '../../../lib/types';
import { DistrictList, shortDistrictName, sortByAqiDesc } from '../DistrictList';
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

function district(slug: DistrictSlug, aqi: number | null): DistrictAir {
  return {
    slug,
    aqi,
    pm25: aqi === null ? null : 12.3,
    dominant: aqi === null ? null : 'pm25',
    stationCount: aqi === null ? 0 : 2,
    dataOrigin: 'stations',
    observedAt: '2026-07-14T08:00:00.000Z',
  };
}

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

describe('DistrictList', () => {
  const districts = [district('medeu', 13), district('alatau', 115), district('turksib', null)];

  it('sortByAqiDesc: худший первым, без значения — в конец', () => {
    expect(sortByAqiDesc(districts).map((d) => d.slug)).toEqual(['alatau', 'medeu', 'turksib']);
  });

  it('shortDistrictName убирает слово «район»', () => {
    expect(shortDistrictName('alatau')).toBe('Алатауский');
  });

  it('ровно одна ссылка на район, в порядке убывания AQI; сводка без ссылок', () => {
    const { container } = render(<DistrictList districts={districts} />);
    const links = Array.from(container.querySelectorAll('a[href^="/district/"]'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/district/alatau',
      '/district/medeu',
      '/district/turksib',
    ]);
    expect(container.textContent).toContain('Чище всего сейчас — Медеуский');
    expect(container.textContent).toContain('хуже всего — Алатауский');
    // Без пропа sparks — ни одного svg.
    expect(container.querySelector('svg')).toBeNull();
  });

  it('со sparks — спарклайн внутри ссылки строки, без серии строка без svg', () => {
    const sparks = new Map<DistrictSlug, HourlyPoint[] | undefined>([
      ['alatau', hourly([90, 100, null, 115])],
    ]);
    const { container } = render(<DistrictList districts={districts} sparks={sparks} />);
    const alatau = container.querySelector('a[href="/district/alatau"]');
    expect(alatau?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    const medeu = container.querySelector('a[href="/district/medeu"]');
    expect(medeu?.querySelector('svg')).toBeNull();
  });

  it('один район с данными — сводка «чище/хуже» не показывается', () => {
    const { container } = render(<DistrictList districts={[district('medeu', 13)]} />);
    expect(container.textContent).not.toContain('Чище всего');
  });
});
