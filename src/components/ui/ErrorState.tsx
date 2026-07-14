export interface ErrorStateProps {
  title?: string;
  hint?: string;
  className?: string;
}

/** Честное состояние ошибки: источники недоступны, без выдуманных значений. */
export function ErrorState({
  title = 'Источники данных временно недоступны',
  hint = 'Попробуйте обновить страницу через несколько минут.',
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-10 w-10 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path
          d="M6.5 19a4.5 4.5 0 1 1 .84-8.92 6 6 0 0 1 11.32 2.02A3.5 3.5 0 0 1 18.5 19h-12Z"
          strokeLinejoin="round"
        />
        <path d="m4 4 16 16" strokeLinecap="round" />
      </svg>
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted">{hint}</p>
    </div>
  );
}
