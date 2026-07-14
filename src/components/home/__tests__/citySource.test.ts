/**
 * Тесты сводки происхождения общегородского AQI для подписи героя:
 * происхождение и число станций считаются по районам, вошедшим в медиану,
 * а не по сырому списку сенсоров (станции вне районов не учитываются).
 */

import { describe, expect, it } from 'vitest';

import type { DistrictAir, DistrictSlug } from '../../../lib/types';
import { citySourceSummary } from '../citySource';

function stationsDistrict(slug: DistrictSlug, stationCount: number): DistrictAir {
  return {
    slug,
    aqi: 60,
    pm25: 15,
    dominant: 'pm25',
    stationCount,
    dataOrigin: 'stations',
    observedAt: '2026-07-14T08:00:00.000Z',
  };
}

function modelDistrict(slug: DistrictSlug): DistrictAir {
  return {
    slug,
    aqi: 68,
    pm25: 18.2,
    dominant: 'pm25',
    stationCount: 0,
    dataOrigin: 'model',
    observedAt: '2026-07-14T08:00:00.000Z',
  };
}

function emptyDistrict(slug: DistrictSlug): DistrictAir {
  return {
    slug,
    aqi: null,
    pm25: null,
    dominant: null,
    stationCount: 0,
    dataOrigin: 'model',
    observedAt: null,
  };
}

describe('citySourceSummary', () => {
  it('все районы по станциям → origin stations и сумма станций из медиан', () => {
    const districts = [
      stationsDistrict('almaly', 2),
      stationsDistrict('bostandyk', 1),
      stationsDistrict('medeu', 3),
    ];

    expect(citySourceSummary(districts)).toEqual({ origin: 'stations', stationCount: 6 });
  });

  it('все районы по модели → origin model без числа станций', () => {
    const districts = [modelDistrict('auezov'), modelDistrict('turksib')];

    expect(citySourceSummary(districts)).toEqual({ origin: 'model', stationCount: 0 });
  });

  it('часть по станциям, часть по модели → mixed, считаются только станции из медиан', () => {
    const districts = [
      stationsDistrict('almaly', 2),
      modelDistrict('auezov'),
      stationsDistrict('medeu', 1),
      modelDistrict('turksib'),
    ];

    expect(citySourceSummary(districts)).toEqual({ origin: 'mixed', stationCount: 3 });
  });

  it('ни один район не дал значения → null (подпись не показывается)', () => {
    const districts = [emptyDistrict('almaly'), emptyDistrict('medeu')];

    expect(citySourceSummary(districts)).toBeNull();
  });

  it('районы без данных (aqi null) не влияют на происхождение: станции + пустые → stations, не mixed', () => {
    const districts = [
      stationsDistrict('almaly', 2),
      emptyDistrict('auezov'),
      emptyDistrict('turksib'),
    ];

    expect(citySourceSummary(districts)).toEqual({ origin: 'stations', stationCount: 2 });
  });

  it('модель + пустые районы → model, не mixed', () => {
    const districts = [modelDistrict('auezov'), emptyDistrict('almaly')];

    expect(citySourceSummary(districts)).toEqual({ origin: 'model', stationCount: 0 });
  });
});
