// @vitest-environment jsdom
/** Прохожие сцены: четыре персонажа, два кадра походки, траектория по рельефу, очередь. */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { NEAR_VERTICES, SCENE_BOX, silhouetteAt } from '../ridges';
import { SceneWalkers, WALK_SHARE, WALK_CYCLE_S, walkKeyframes } from '../SceneWalkers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(cleanup);

describe('walkKeyframes', () => {
  it('проценты растут, y следует линии гребня, после окна прохода — скрыт', () => {
    const css = walkKeyframes('person', false);
    expect(css.startsWith('@keyframes scene-walk-person{')).toBe(true);
    const frames = [...css.matchAll(/([\d.]+)%\{transform:translate\((-?[\d.]+)px,(-?[\d.]+)px\);visibility:visible\}/g)].map(
      (m) => ({ p: Number(m[1]), x: Number(m[2]), y: Number(m[3]) }),
    );
    expect(frames.length).toBeGreaterThan(8);
    expect(frames[0].p).toBe(0);
    expect(frames[0].x).toBeGreaterThan(SCENE_BOX.width);
    expect(frames[frames.length - 1].p).toBeCloseTo(WALK_SHARE * 100, 1);
    expect(frames[frames.length - 1].x).toBeLessThan(0);
    for (let i = 1; i < frames.length; i += 1) {
      expect(frames[i].p).toBeGreaterThan(frames[i - 1].p);
      expect(frames[i].x).toBeLessThan(frames[i - 1].x);
    }
    // Каждая вершина силуэта — опорная точка траектории со «своим» y.
    for (const v of NEAR_VERTICES.filter((v) => v.x > 0 && v.x < SCENE_BOX.width)) {
      const f = frames.find((fr) => fr.x === Math.round(v.x * 10) / 10);
      expect(f).toBeDefined();
      expect(f?.y).toBeCloseTo(silhouetteAt(NEAR_VERTICES, v.x) + 1, 0);
    }
    expect(css).toContain('visibility:hidden');
  });

  it('идущий вправо стартует слева', () => {
    const css = walkKeyframes('sheep', true);
    const first = css.match(/0\.00%\{transform:translate\((-?[\d.]+)px/);
    expect(Number(first?.[1])).toBeLessThan(0);
  });
});

describe('SceneWalkers', () => {
  it('четыре персонажа с покадровой походкой внутри SVG сцены', () => {
    const { container } = render(<SceneWalkers />);
    const walkers = container.querySelectorAll('[data-walker]');
    expect(Array.from(walkers).map((w) => w.getAttribute('data-walker'))).toEqual([
      'person',
      'sheep',
      'dog',
      'cyclist',
    ]);
    for (const w of walkers) {
      expect(w.closest('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(w.querySelectorAll('.scene-pose').length).toBeGreaterThanOrEqual(2);
      expect(w.querySelector('[data-frame="0"]')).not.toBeNull();
    }
    expect(container.querySelector('style')?.textContent).toContain('scene-walk-cyclist');
  });

  it('задержки разводят персонажей по очереди внутри цикла', () => {
    const { container } = render(<SceneWalkers />);
    const delays = Array.from(container.querySelectorAll<HTMLElement>('[data-walker]')).map((w) =>
      parseFloat(w.style.getPropertyValue('--delay')),
    );
    const window = WALK_SHARE * WALK_CYCLE_S;
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i] - delays[i - 1]).toBeGreaterThanOrEqual(window);
    }
    expect(delays[delays.length - 1] + window).toBeLessThanOrEqual(WALK_CYCLE_S);
  });
});
