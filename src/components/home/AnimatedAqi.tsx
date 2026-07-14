'use client';

import { type ReactNode, useEffect, useRef } from 'react';

export interface AnimatedAqiProps {
  /** Финальное значение AQI — то, что уже стоит в серверном HTML. null — анимировать нечего. */
  value: number | null;
  /** Серверный AqiBadge; обёртка display:contents не меняет его место во flex-макете. */
  children: ReactNode;
}

/** Длительность отсчёта 0 → N. */
const DURATION_MS = 600;

/**
 * Прогрессивное усиление большого числа AQI в герое: серверный HTML содержит
 * финальное значение (SEO и no-JS корректны), а после монтирования — если
 * пользователь не просил reduced motion — число отсчитывается 0 → N за ~600 мс
 * (rAF, ease-out-кубик). Визуальные стили AqiBadge не форкается: компонент
 * лишь мутирует текст готового значения (span с tabular-nums внутри бейджа).
 * React это не ломает: children статичны и после гидрации не пере-рендерятся.
 * Ширина значения на время отсчёта фиксируется (min-width), чтобы смена
 * разрядности 0 → 154 не дёргала макет.
 */
export function AnimatedAqi({ value, children }: AnimatedAqiProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value === null) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const target = Math.round(value);
    // Значение бейджа — единственный span с tabular-nums внутри AqiBadge.
    const el = ref.current?.querySelector<HTMLElement>('.tabular-nums');
    // Защита от рассинхрона с разметкой AqiBadge: не нашли ровно финальное
    // число — тихо оставляем серверный HTML как есть.
    if (!el || el.textContent !== String(target)) return undefined;

    el.style.minWidth = `${el.getBoundingClientRect().width}px`;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = String(Math.round(eased * target));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        el.style.minWidth = '';
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      el.textContent = String(target);
      el.style.minWidth = '';
    };
  }, [value]);

  return (
    <span ref={ref} className="contents">
      {children}
    </span>
  );
}
