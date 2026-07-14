// @vitest-environment jsdom
/**
 * Тесты легенды шкалы AQI: шесть категорий и два представления —
 * вертикальный список на узких экранах (короткие названия, ничего не
 * переносится посреди слова) и горизонтальная полоса на md+ (полные
 * названия). Скрытие — через классы md:hidden / hidden md:block, поэтому
 * в живом дереве доступности всегда одно представление.
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
    // Диапазон присутствует в обоих представлениях (мобильный список и полоса md+)
    expect(within(list).getAllByText('0–50').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('301–500').length).toBeGreaterThan(0);
  });

  it('мобильный список и полоса md+ переключаются брейкпоинтом', () => {
    render(<AqiScale />);
    // Короткое название живёт в мобильной строке — она скрыта на md+.
    // Регресс исходного бага: «Чувствительным» рвалось посреди слова
    // внутри узкой ячейки горизонтальной полосы.
    const shortLabel = screen.getByText('Чувствительным');
    expect(shortLabel.parentElement?.className).toContain('md:hidden');
    // Полное название — только в полосе md+ (обёртка hidden md:block).
    const fullLabel = screen.getByText('Вредно для чувствительных');
    expect(fullLabel.parentElement?.parentElement?.className).toContain(
      'hidden md:block',
    );
  });
});
