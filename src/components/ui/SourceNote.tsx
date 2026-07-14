export interface SourceNoteProps {
  /**
   * stations — реальные сенсоры; model — модель CAMS для центроида района;
   * mixed — часть значений по станциям, остальные по модели CAMS.
   */
  origin: 'stations' | 'model' | 'mixed';
  /** Число станций, реально вошедших в агрегаты (для origin "stations"/"mixed"). */
  stationCount?: number;
  className?: string;
}

/** «станции» для 1/21/31…, иначе «станций» (родительный падеж после числительного). */
function stationsWord(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? 'станции' : 'станций';
}

function noteText(origin: SourceNoteProps['origin'], stationCount?: number): string {
  if (origin === 'model') {
    return 'По модели CAMS (Copernicus), сетка ~40 км — может сглаживать локальные пики';
  }
  const stations =
    stationCount != null && stationCount > 0
      ? `${stationCount} ${stationsWord(stationCount)}`
      : 'станций';
  if (origin === 'mixed') {
    return `По данным ${stations} мониторинга и модели CAMS для районов без станций`;
  }
  return `По данным ${stations} мониторинга`;
}

/** Пометка происхождения данных: станции мониторинга, модель CAMS или их сочетание. */
export function SourceNote({ origin, stationCount, className = '' }: SourceNoteProps) {
  const text = noteText(origin, stationCount);

  return (
    <p className={`inline-flex items-start gap-1.5 text-xs text-muted ${className}`}>
      {origin === 'model' ? (
        /* Сетка модели */
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
      ) : (
        /* Антенна станции */
        <svg
          viewBox="0 0 16 16"
          className="mt-0.5 h-3.5 w-3.5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
          <path d="M4.8 11.2a4.5 4.5 0 0 1 0-6.4M11.2 4.8a4.5 4.5 0 0 1 0 6.4" />
          <path d="M2.7 13.3a7.5 7.5 0 0 1 0-10.6M13.3 2.7a7.5 7.5 0 0 1 0 10.6" />
        </svg>
      )}
      <span>{text}</span>
    </p>
  );
}
