// @vitest-environment jsdom
/**
 * Тесты подписи под графиком в ChartTabs: единственная видимая строка
 * «График по модели CAMS», для 7/30 дней — с конвенцией сводки
 * «худший час каждого дня» в той же строке (регрессия наложения подписей).
 */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DistrictHistory, HistoryWindow } from '@/lib/types';
import { ChartTabs } from '../ChartTabs';

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

function history(
  window: HistoryWindow,
  origin: DistrictHistory['origin'],
): DistrictHistory {
  const start = Date.parse('2026-07-13T00:00:00.000Z');
  const points = Array.from({ length: 6 }, (_, i) => ({
    time: new Date(start + i * HOUR).toISOString(),
    aqi: 40 + i,
    pm25: 10,
    pm10: 12,
  }));
  return { slug: 'almaly', window, origin, points };
}

function histories(
  origin: DistrictHistory['origin'],
): Record<HistoryWindow, DistrictHistory> {
  return {
    '24h': history('24h', origin),
    '7d': history('7d', origin),
    '30d': history('30d', origin),
  };
}

describe('ChartTabs — подпись под графиком', () => {
  it('24 часа: только «График по модели CAMS», без прореживания', () => {
    render(<ChartTabs histories={histories('model')} />);
    expect(screen.getByText('График по модели CAMS')).toBeTruthy();
    expect(
      screen.queryByText('График по модели CAMS · худший час каждого дня'),
    ).toBeNull();
  });

  it.each(['7 дней', '30 дней'])(
    '%s: одна объединённая строка «… · худший час каждого дня»',
    (tabName) => {
      render(<ChartTabs histories={histories('model')} />);
      fireEvent.click(screen.getByRole('tab', { name: tabName }));
      expect(
        screen.getByText('График по модели CAMS · худший час каждого дня'),
      ).toBeTruthy();
      expect(screen.queryByText('График по модели CAMS')).toBeNull();
    },
  );

  it('история из собственной БД: подписи о модели нет', () => {
    render(<ChartTabs histories={histories('db')} />);
    expect(screen.queryByText(/График по модели CAMS/)).toBeNull();
  });
});
