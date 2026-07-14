'use client';

import { useSyncExternalStore } from 'react';
import {
  readMyDistrict,
  subscribeMyDistrict,
  writeMyDistrict,
} from '@/components/home/myDistrictStore';
import type { DistrictSlug } from '@/lib/types';

export interface MyDistrictToggleProps {
  slug: DistrictSlug;
  className?: string;
}

/** Снимок для сервера и гидрации: localStorage там нет — район не выбран. */
const serverSnapshot = () => false;

/**
 * Кнопка-призрак «Сделать моим районом» для шапки страницы района
 * (рядом с ShareButton, те же габариты). Выбор хранится в localStorage —
 * один район на браузер: повторный клик снимает выбор, клик на другом
 * районе переключает его. Состояние читается через useSyncExternalStore:
 * на сервере и при гидрации кнопка детерминированно ненажата
 * (aria-pressed=false), фактическое состояние подтягивается после гидрации.
 */
export function MyDistrictToggle({ slug, className = '' }: MyDistrictToggleProps) {
  const mine = useSyncExternalStore(
    subscribeMyDistrict,
    () => readMyDistrict() === slug,
    serverSnapshot,
  );

  const toggle = () => {
    writeMyDistrict(mine ? null : slug);
  };

  return (
    <button
      type="button"
      aria-pressed={mine}
      onClick={toggle}
      className={
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border ' +
        'px-3.5 py-2 text-sm font-medium transition-colors ' +
        (mine ? 'text-foreground ' : 'text-muted hover:text-foreground ') +
        className
      }
    >
      {mine ? (
        <>
          Мой район <span aria-hidden="true">✓</span>
        </>
      ) : (
        'Сделать моим районом'
      )}
    </button>
  );
}
