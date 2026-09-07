// @vitest-environment jsdom
/** Виджет погоды: формат температуры, подпись, отсутствие при null. */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { formatTemperature, WeatherChip } from '../WeatherChip';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(cleanup);

describe('formatTemperature', () => {
  it('округляет, минус типографский, ноль без знака', () => {
    expect(formatTemperature(27.4)).toBe('27°');
    expect(formatTemperature(-3.6)).toBe('−4°');
    expect(formatTemperature(0.2)).toBe('0°');
    expect(formatTemperature(-0.4)).toBe('0°');
  });
});

describe('WeatherChip', () => {
  it('null — ничего не рендерит', () => {
    const { container } = render(<WeatherChip weather={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('температура, состояние и ветер словами; иконка декоративная', () => {
    const { container } = render(
      <WeatherChip
        weather={{
          temperatureC: -2.7,
          weatherCode: 71,
          windSpeedMs: 3.4,
          isDay: false,
          observedAt: '2026-01-10T03:00:00.000Z',
        }}
      />,
    );
    expect(container.textContent).toContain('−3°');
    expect(container.textContent).toContain('небольшой снег · ветер 3 м/с');
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toContain(
      'Погода в Алматы: −3°',
    );
  });

  it('без ветра — только состояние', () => {
    const { container } = render(
      <WeatherChip
        weather={{
          temperatureC: 18,
          weatherCode: 0,
          windSpeedMs: null,
          isDay: true,
          observedAt: '2026-06-10T09:00:00.000Z',
        }}
      />,
    );
    expect(container.textContent).toContain('18°');
    expect(container.textContent).toContain('ясно');
    expect(container.textContent).not.toContain('ветер');
  });
});
