import type { WeatherKind } from '@/lib/weather-codes';

export interface WeatherIconProps {
  kind: WeatherKind;
  /** Для «ясно» и «малооблачно»: солнце днём, луна ночью. */
  isDay: boolean;
  className?: string;
}

/* Контуры по мотивам Feather Icons (MIT): облако, солнце, луна, осадки. */
const CLOUD = 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z';
const CLOUD_RAISED = 'M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25';
const SUN_RAYS =
  'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42';
const MOON = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';

function Glyph({ kind, isDay }: { kind: WeatherKind; isDay: boolean }) {
  switch (kind) {
    case 'clear':
      return isDay ? (
        <>
          <circle cx="12" cy="12" r="5" />
          <path d={SUN_RAYS} />
        </>
      ) : (
        <path d={MOON} />
      );
    case 'partly':
      return (
        <>
          {isDay ? (
            <>
              <circle cx="7.5" cy="7" r="2.6" />
              <path d="M7.5 1.5V3M7.5 11v1.5M2 7h1.5M12 7h1.5M3.6 3.1l1.06 1.06M10.34 9.84l1.06 1.06M3.6 10.9l1.06-1.06M10.34 4.16l1.06-1.06" />
            </>
          ) : (
            <path d="M12.5 8.6A4.6 4.6 0 1 1 7.5 3.6a3.6 3.6 0 0 0 5 5z" />
          )}
          <path d="M18.6 13.6h-.95A6 6 0 1 0 11.9 21h6.7a3.7 3.7 0 0 0 0-7.4z" />
        </>
      );
    case 'cloudy':
      return <path d={CLOUD} />;
    case 'fog':
      return (
        <>
          <path d={CLOUD_RAISED} />
          <path d="M6 19h12M8 22.5h8" />
        </>
      );
    case 'drizzle':
      return (
        <>
          <path d={CLOUD_RAISED} />
          <path d="M8 19v2M8 13v2M16 19v2M16 13v2M12 21v2M12 15v2" />
        </>
      );
    case 'rain':
      return (
        <>
          <path d={CLOUD_RAISED} />
          <path d="M16 13v8M8 13v8M12 15v8" />
        </>
      );
    case 'snow':
      return (
        <>
          <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
          <path d="M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01" />
        </>
      );
    case 'thunder':
      return (
        <>
          <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
          <path d="M13 11l-4 6h6l-4 6" />
        </>
      );
  }
}

/** Контурная иконка погоды 24×24, currentColor. Декоративная (aria-hidden): подпись рядом словами. */
export function WeatherIcon({ kind, isDay, className = '' }: WeatherIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <Glyph kind={kind} isDay={isDay} />
    </svg>
  );
}
