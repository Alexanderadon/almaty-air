'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { AqiBadge } from '@/components/ui/AqiBadge';
import { DISTRICTS } from '@/lib/districts';
import type { DistrictAir } from '@/lib/types';
import { readMyDistrict, subscribeMyDistrict } from './myDistrictStore';

export interface MyDistrictProps {
  /** Текущие значения по районам — главная уже получила их для сетки. */
  districts: DistrictAir[];
  className?: string;
}

const NAME_BY_SLUG = new Map(DISTRICTS.map((d) => [d.slug, d.nameRu]));

/** Снимок для сервера и гидрации: localStorage там нет — выбора нет. */
const serverSnapshot = () => null;

/**
 * Быстрая карточка «Мой район» над сеткой районов: название, текущий AQI
 * и ссылка на страницу выбранного района. Выбор делается кнопкой
 * MyDistrictToggle на странице района и читается из localStorage через
 * useSyncExternalStore: на сервере и при гидрации снимок — null, компонент
 * не рендерится, рассинхрона разметки нет. Появление — мягкий фейд
 * (только opacity, без сдвигов) и только при prefers-reduced-motion:
 * no-preference (motion-safe).
 */
export function MyDistrict({ districts, className = '' }: MyDistrictProps) {
  const slug = useSyncExternalStore(subscribeMyDistrict, readMyDistrict, serverSnapshot);

  if (slug === null) return null;

  const air = districts.find((d) => d.slug === slug) ?? null;

  return (
    <Link
      href={`/district/${slug}`}
      className={
        'flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 ' +
        'hover:border-accent motion-safe:transition-[border-color,opacity] ' +
        'motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.2,0,0,1)] ' +
        `motion-safe:starting:opacity-0 ${className}`
      }
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
          Мой район
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold">
          {NAME_BY_SLUG.get(slug) ?? slug}
        </span>
      </span>
      <AqiBadge aqi={air?.aqi ?? null} size="sm" className="shrink-0" />
    </Link>
  );
}
