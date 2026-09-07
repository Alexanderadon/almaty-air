/** Коды WMO → вид/подпись; параметры сцены согласованы с видом погоды. */

import { describe, expect, it } from 'vitest';

import { describeWeatherCode, sceneFor, type WeatherKind } from '../weather-codes';

describe('describeWeatherCode', () => {
  it('основные коды WMO', () => {
    expect(describeWeatherCode(0)).toEqual({ kind: 'clear', labelRu: 'ясно' });
    expect(describeWeatherCode(2).kind).toBe('partly');
    expect(describeWeatherCode(3)).toEqual({ kind: 'cloudy', labelRu: 'пасмурно' });
    expect(describeWeatherCode(45).kind).toBe('fog');
    expect(describeWeatherCode(53).kind).toBe('drizzle');
    expect(describeWeatherCode(63)).toEqual({ kind: 'rain', labelRu: 'дождь' });
    expect(describeWeatherCode(73).kind).toBe('snow');
    expect(describeWeatherCode(81).kind).toBe('rain');
    expect(describeWeatherCode(85).kind).toBe('snow');
    expect(describeWeatherCode(95)).toEqual({ kind: 'thunder', labelRu: 'гроза' });
  });

  it('неизвестный код — нейтральное «облачно», не исключение', () => {
    expect(describeWeatherCode(42)).toEqual({ kind: 'cloudy', labelRu: 'облачно' });
    expect(describeWeatherCode(-1).kind).toBe('cloudy');
  });
});

describe('sceneFor', () => {
  it('осадки только у дождя, мороси, снега и грозы; облаков не больше трёх', () => {
    const kinds: WeatherKind[] = [
      'clear',
      'partly',
      'cloudy',
      'fog',
      'drizzle',
      'rain',
      'snow',
      'thunder',
    ];
    for (const kind of kinds) {
      const s = sceneFor(kind);
      expect(s.clouds).toBeGreaterThanOrEqual(0);
      expect(s.clouds).toBeLessThanOrEqual(3);
      expect(s.cloudOpacity).toBeGreaterThan(0);
      expect(s.cloudOpacity).toBeLessThanOrEqual(1);
      const wet = kind === 'drizzle' || kind === 'rain' || kind === 'thunder';
      expect(s.rainDrops > 0).toBe(wet);
      expect(s.snowFlakes > 0).toBe(kind === 'snow');
    }
    expect(sceneFor('fog').fogBoost).toBeGreaterThan(sceneFor('clear').fogBoost);
    expect(sceneFor('thunder').rainDrops).toBeGreaterThan(sceneFor('drizzle').rainDrops);
  });
});
