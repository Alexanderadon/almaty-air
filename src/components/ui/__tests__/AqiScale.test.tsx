// @vitest-environment jsdom
/**
 * Тесты легенды шкалы AQI: шесть сегментов и защита от наложения подписей
 * на узких экранах — длинные слова («Чувствительным») обязаны переноситься
 * внутри своей ячейки (hyphens-auto + break-words), а не выезжать на соседей.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AqiScale } from '../AqiScale';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(cleanup);

describe('AqiScale', () => {
  it('рендерит шесть категорий с диапазонами', () => {
    render(<AqiScale />);
    const list = screen.getByRole('list', {
      name: 'Шкала индекса качества воздуха AQI (US EPA)',
    });
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(within(list).getByText('0–50')).toBeTruthy();
    expect(within(list).getByText('301–500')).toBeTruthy();
  });

  it('подписи категорий переносятся по словам внутри ячейки (узкие экраны)', () => {
    render(<AqiScale />);
    // Самое длинное неразрывное слово мобильной подписи — регресс наложения
    // подписей на 360px без break-words/hyphens-auto.
    const label = screen.getByText('Чувствительным');
    const wrapper = label.parentElement;
    expect(wrapper?.className).toContain('break-words');
    expect(wrapper?.className).toContain('hyphens-auto');
  });
});
