export interface UpdatedAtProps {
  /** Метка времени ISO 8601 (UTC). */
  iso: string;
  className?: string;
}

const TIME_FMT = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty',
  hour: '2-digit',
  minute: '2-digit',
});

const FULL_FMT = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Время последнего обновления: «Обновлено 14:05» в часовом поясе Asia/Almaty. */
export function UpdatedAt({ iso, className = '' }: UpdatedAtProps) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return (
    <p className={`text-xs text-muted ${className}`}>
      Обновлено{' '}
      <time dateTime={iso} title={FULL_FMT.format(date)} className="tabular-nums">
        {TIME_FMT.format(date)}
      </time>
    </p>
  );
}
