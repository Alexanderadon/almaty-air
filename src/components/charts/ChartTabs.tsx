'use client';

/**
 * Переключатель окон истории «24 часа / 7 дней / 30 дней».
 * Доступность: role=tablist, роуминг-фокус, стрелки/Home/End,
 * выбор следует за фокусом (вкладок мало, активация автоматическая).
 */

import { useId, useRef, useState } from 'react';
import { AqiAreaChart } from './AqiAreaChart';
import type { DistrictHistory, HistoryWindow } from '@/lib/types';

export interface ChartTabsProps {
  /** История района по всем трём окнам (получена на сервере). */
  histories: Record<HistoryWindow, DistrictHistory>;
  className?: string;
}

const TABS: { window: HistoryWindow; label: string }[] = [
  { window: '24h', label: '24 часа' },
  { window: '7d', label: '7 дней' },
  { window: '30d', label: '30 дней' },
];

export function ChartTabs({ histories, className = '' }: ChartTabsProps) {
  const [active, setActive] = useState<HistoryWindow>('24h');
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeIndex = TABS.findIndex((t) => t.window === active);
  const current = histories[active];

  function selectTab(index: number) {
    const next = (index + TABS.length) % TABS.length;
    setActive(TABS[next].window);
    tabRefs.current[next]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        selectTab(activeIndex + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        selectTab(activeIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        selectTab(0);
        break;
      case 'End':
        event.preventDefault();
        selectTab(TABS.length - 1);
        break;
    }
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Период графика"
        onKeyDown={onKeyDown}
        className="inline-flex gap-1 rounded-xl border border-border bg-card p-1"
      >
        {TABS.map((tab, i) => {
          const selected = tab.window === active;
          return (
            <button
              key={tab.window}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.window}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.window}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.window)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-accent text-surface shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${active}`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="mt-3"
      >
        <AqiAreaChart series={current.points} window={active} />
        {current.origin === 'model' && (
          /* Единственная видимая подпись под графиком: для 7/30 дней происхождение
             данных и конвенция сводки «худший час каждого дня» — одной строкой,
             чтобы подписи не накладывались друг на друга. */
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
            <svg
              viewBox="0 0 16 16"
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <path d="M8 2v12M2 8h12" />
            </svg>
            <span>
              {active === '24h'
                ? 'График по модели CAMS'
                : 'График по модели CAMS · худший час каждого дня'}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
