/**
 * Коды погоды WMO (как отдаёт Open-Meteo `weather_code`) → вид иконки и
 * подпись по-русски, плюс параметры сцены в герое (облака, осадки).
 * Чистая логика без I/O — покрыта тестами.
 */

export type WeatherKind =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunder';

export interface WeatherView {
  kind: WeatherKind;
  labelRu: string;
}

const CODES: Record<number, WeatherView> = {
  0: { kind: 'clear', labelRu: 'ясно' },
  1: { kind: 'partly', labelRu: 'малооблачно' },
  2: { kind: 'partly', labelRu: 'переменная облачность' },
  3: { kind: 'cloudy', labelRu: 'пасмурно' },
  45: { kind: 'fog', labelRu: 'туман' },
  48: { kind: 'fog', labelRu: 'изморозь' },
  51: { kind: 'drizzle', labelRu: 'морось' },
  53: { kind: 'drizzle', labelRu: 'морось' },
  55: { kind: 'drizzle', labelRu: 'сильная морось' },
  56: { kind: 'drizzle', labelRu: 'ледяная морось' },
  57: { kind: 'drizzle', labelRu: 'ледяная морось' },
  61: { kind: 'rain', labelRu: 'небольшой дождь' },
  63: { kind: 'rain', labelRu: 'дождь' },
  65: { kind: 'rain', labelRu: 'сильный дождь' },
  66: { kind: 'rain', labelRu: 'ледяной дождь' },
  67: { kind: 'rain', labelRu: 'ледяной дождь' },
  71: { kind: 'snow', labelRu: 'небольшой снег' },
  73: { kind: 'snow', labelRu: 'снег' },
  75: { kind: 'snow', labelRu: 'сильный снег' },
  77: { kind: 'snow', labelRu: 'снежная крупа' },
  80: { kind: 'rain', labelRu: 'ливень' },
  81: { kind: 'rain', labelRu: 'ливень' },
  82: { kind: 'rain', labelRu: 'сильный ливень' },
  85: { kind: 'snow', labelRu: 'снегопад' },
  86: { kind: 'snow', labelRu: 'сильный снегопад' },
  95: { kind: 'thunder', labelRu: 'гроза' },
  96: { kind: 'thunder', labelRu: 'гроза с градом' },
  99: { kind: 'thunder', labelRu: 'гроза с градом' },
};

/** Неизвестный код — честно «облачно», а не ошибка: виджет декоративный. */
const FALLBACK: WeatherView = { kind: 'cloudy', labelRu: 'облачно' };

export function describeWeatherCode(code: number): WeatherView {
  return CODES[code] ?? FALLBACK;
}

/** Параметры сцены в герое, зависящие от погоды (плотность смога задаёт AQI). */
export interface SceneWeather {
  /** Сколько облаков плывёт по небу, 0…3. */
  clouds: number;
  /** Непрозрачность облаков, 0…1. */
  cloudOpacity: number;
  /** Дождевые штрихи: 0 — нет, иначе число капель в слое. */
  rainDrops: number;
  /** Снежинки: 0 — нет, иначе число в слое. */
  snowFlakes: number;
  /** Добавка к туману от погоды (туман/изморозь), 0…1. */
  fogBoost: number;
}

const SCENE: Record<WeatherKind, SceneWeather> = {
  clear: { clouds: 1, cloudOpacity: 0.3, rainDrops: 0, snowFlakes: 0, fogBoost: 0 },
  partly: { clouds: 2, cloudOpacity: 0.5, rainDrops: 0, snowFlakes: 0, fogBoost: 0 },
  cloudy: { clouds: 3, cloudOpacity: 0.7, rainDrops: 0, snowFlakes: 0, fogBoost: 0 },
  fog: { clouds: 2, cloudOpacity: 0.5, rainDrops: 0, snowFlakes: 0, fogBoost: 0.3 },
  drizzle: { clouds: 3, cloudOpacity: 0.7, rainDrops: 36, snowFlakes: 0, fogBoost: 0.05 },
  rain: { clouds: 3, cloudOpacity: 0.75, rainDrops: 70, snowFlakes: 0, fogBoost: 0.05 },
  snow: { clouds: 3, cloudOpacity: 0.7, rainDrops: 0, snowFlakes: 56, fogBoost: 0.05 },
  thunder: { clouds: 3, cloudOpacity: 0.85, rainDrops: 90, snowFlakes: 0, fogBoost: 0.05 },
};

export function sceneFor(kind: WeatherKind): SceneWeather {
  return SCENE[kind];
}
