'use client';

import { useEffect } from 'react';

/**
 * Пауза анимаций сцены, когда герой не виден: IntersectionObserver вешает
 * data-paused на контейнер [data-hero-scene], CSS ставит
 * animation-play-state: paused всем слоям. Ниже первого экрана страница
 * не тратит ни кадра на облака и смог. Ничего не рендерит.
 */
export function SceneMotion() {
  useEffect(() => {
    const scene = document.querySelector<HTMLElement>('[data-hero-scene]');
    if (!scene || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        scene.toggleAttribute('data-paused', !entry.isIntersecting);
      },
      { threshold: 0.02 },
    );
    io.observe(scene);
    return () => io.disconnect();
  }, []);

  return null;
}
