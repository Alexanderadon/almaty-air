import type { CurrentWeather } from '@/lib/sources/weather';
import { describeWeatherCode } from '@/lib/weather-codes';
import { WeatherIcon } from './WeatherIcon';

export interface WeatherChipProps {
  /** Текущая погода; null — виджет не рендерится. */
  weather: CurrentWeather | null;
  className?: string;
}

/** «−3°» с типографским минусом; «0°» без знака. */
export function formatTemperature(celsius: number): string {
  const rounded = Math.round(celsius);
  if (rounded === 0) return '0°';
  return `${rounded < 0 ? '−' : ''}${Math.abs(rounded)}°`;
}

/**
 * Компактный виджет погоды в герое: иконка состояния, температура и подпись
 * («пасмурно · ветер 3 м/с»). Данные — Open-Meteo, центр города; это
 * контекст к качеству воздуха (инверсия, безветрие), а не прогноз.
 */
export function WeatherChip({ weather, className = '' }: WeatherChipProps) {
  if (weather === null) return null;
  const view = describeWeatherCode(weather.weatherCode);
  const wind = weather.windSpeedMs !== null ? Math.round(weather.windSpeedMs) : null;
  const windText = wind !== null ? ` · ветер ${wind} м/с` : '';
  const detail = `${view.labelRu}${windText}`;

  return (
    <div
      className={`flex items-center gap-3 md:shrink-0 ${className}`}
      role="group"
      aria-label={`Погода в Алматы: ${formatTemperature(weather.temperatureC)}, ${detail}`}
      title="Погода в центре Алматы по данным Open-Meteo"
    >
      <WeatherIcon kind={view.kind} isDay={weather.isDay} className="h-9 w-9 shrink-0 text-muted" />
      <div className="min-w-0 max-w-44">
        <p className="text-2xl font-semibold leading-none">{formatTemperature(weather.temperatureC)}</p>
        {/* «ветер 3 м/с» не переносится внутри: браузер иначе ломает строку по слэшу. */}
        <p className="mt-1 text-sm leading-snug text-muted">
          {view.labelRu}
          {windText !== '' && <span className="whitespace-nowrap">{windText}</span>}
        </p>
      </div>
    </div>
  );
}
