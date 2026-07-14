// @vitest-environment jsdom
/**
 * Тесты кнопки «Сделать моим районом» и карточки «Мой район»: переключение
 * пишет/чистит localStorage (aria-pressed), карточка на главной рендерится
 * только при сохранённом валидном слаге и показывает AQI своего района.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MY_DISTRICT_KEY } from '../../home/myDistrictStore';
import { MyDistrict } from '../../home/MyDistrict';
import type { DistrictAir } from '../../../lib/types';
import { MyDistrictToggle } from '../MyDistrictToggle';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

const MEDEU_AIR: DistrictAir = {
  slug: 'medeu',
  aqi: 57,
  pm25: 12.3,
  dominant: 'pm25',
  stationCount: 2,
  dataOrigin: 'stations',
  observedAt: '2026-07-14T08:00:00.000Z',
};

describe('MyDistrictToggle', () => {
  it('без сохранённого выбора — не нажата, «Сделать моим районом»', () => {
    render(<MyDistrictToggle slug="medeu" />);
    const button = screen.getByRole('button', { name: 'Сделать моим районом' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('клик сохраняет район и переводит кнопку в нажатое состояние', () => {
    render(<MyDistrictToggle slug="medeu" />);
    act(() => {
      screen.getByRole('button').click();
    });
    expect(window.localStorage.getItem(MY_DISTRICT_KEY)).toBe('medeu');
    const button = screen.getByRole('button', { name: /Мой район/ });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('повторный клик снимает выбор', () => {
    window.localStorage.setItem(MY_DISTRICT_KEY, 'medeu');
    render(<MyDistrictToggle slug="medeu" />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
    act(() => {
      screen.getByRole('button').click();
    });
    expect(window.localStorage.getItem(MY_DISTRICT_KEY)).toBeNull();
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false');
  });

  it('на странице другого района кнопка не нажата, клик переключает выбор', () => {
    window.localStorage.setItem(MY_DISTRICT_KEY, 'medeu');
    render(<MyDistrictToggle slug="auezov" />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false');
    act(() => {
      screen.getByRole('button').click();
    });
    expect(window.localStorage.getItem(MY_DISTRICT_KEY)).toBe('auezov');
  });
});

describe('MyDistrict', () => {
  it('без сохранённого выбора не рендерится', () => {
    const { container } = render(<MyDistrict districts={[MEDEU_AIR]} />);
    expect(container.innerHTML).toBe('');
  });

  it('мусор в хранилище — не рендерится', () => {
    window.localStorage.setItem(MY_DISTRICT_KEY, 'narnia');
    const { container } = render(<MyDistrict districts={[MEDEU_AIR]} />);
    expect(container.innerHTML).toBe('');
  });

  it('с сохранённым районом — ссылка на его страницу, название и AQI', () => {
    window.localStorage.setItem(MY_DISTRICT_KEY, 'medeu');
    render(<MyDistrict districts={[MEDEU_AIR]} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/district/medeu');
    expect(screen.getByText('Мой район')).toBeTruthy();
    expect(screen.getByText('Медеуский район')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Индекс качества воздуха 57 — Умеренно' }),
    ).toBeTruthy();
  });

  it('район без текущих данных — бейдж «Нет данных»', () => {
    window.localStorage.setItem(MY_DISTRICT_KEY, 'auezov');
    render(<MyDistrict districts={[MEDEU_AIR]} />);
    expect(
      screen.getByRole('img', { name: 'Индекс качества воздуха: нет данных' }),
    ).toBeTruthy();
  });
});
