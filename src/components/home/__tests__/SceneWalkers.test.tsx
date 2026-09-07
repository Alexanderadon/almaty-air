// @vitest-environment jsdom
/** Прохожие сцены: четыре персонажа, у каждого две фазы шага, выходят по очереди. */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SceneWalkers } from '../SceneWalkers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(cleanup);

describe('SceneWalkers', () => {
  it('четыре персонажа с двумя кадрами походки, декоративные', () => {
    const { container } = render(<SceneWalkers />);
    const walkers = container.querySelectorAll('[data-walker]');
    expect(Array.from(walkers).map((w) => w.getAttribute('data-walker'))).toEqual([
      'person',
      'sheep',
      'dog',
      'cyclist',
    ]);
    for (const w of walkers) {
      expect(w.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(w.querySelector('.scene-pose-a')).not.toBeNull();
      expect(w.querySelector('.scene-pose-b')).not.toBeNull();
    }
  });

  it('задержки выхода строго возрастают — персонажи не идут одновременно', () => {
    const { container } = render(<SceneWalkers />);
    const delays = Array.from(container.querySelectorAll<HTMLElement>('[data-walker]')).map((w) =>
      parseFloat(w.style.getPropertyValue('--delay')),
    );
    for (let i = 1; i < delays.length; i += 1) {
      // Окно прохода — 22% цикла в 200 с = 44 с; следующий выходит позже.
      expect(delays[i] - delays[i - 1]).toBeGreaterThanOrEqual(44);
    }
  });

  it('чётные персонажи идут в обратную сторону и зеркалятся', () => {
    const { container } = render(<SceneWalkers />);
    const walkers = Array.from(container.querySelectorAll<HTMLElement>('[data-walker]'));
    expect(walkers[0].style.animationDirection).toBe('normal');
    expect(walkers[1].style.animationDirection).toBe('reverse');
    expect(walkers[1].querySelector('.scene-walker-flip')).not.toBeNull();
    expect(walkers[0].querySelector('.scene-walker-flip')).toBeNull();
  });
});
