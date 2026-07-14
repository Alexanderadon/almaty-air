import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/** Логотип: две горы Заилийского Алатау и солнце. */
function LogoMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="28"
      height="28"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="8" cy="8" r="3.5" fill="var(--accent)" fillOpacity="0.8" />
      <path d="M2 27 L12 9 L22 27 Z" fill="var(--accent)" fillOpacity="0.45" />
      <path d="M12 27 L21 12 L30 27 Z" fill="var(--accent)" />
    </svg>
  );
}

/** Шапка сайта: логотип-ссылка на главную, подпись о шкале и переключатель темы. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight transition-opacity hover:opacity-80"
        >
          <LogoMark />
          <span className="text-[17px]">Воздух Алматы</span>
        </Link>
        <div className="flex items-center gap-3">
          {/* Подпись скрыта на мобильных (sm:block) — переключатель остаётся. */}
          <p className="hidden text-xs text-muted sm:block">
            AQI по шкале US EPA
          </p>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
