import type { DistrictAir } from '@/lib/types';

export interface CitySourceSummary {
  origin: 'stations' | 'model' | 'mixed';
  /** Станции, реально вошедшие в медианы районов (сенсоры вне районов не считаются). */
  stationCount: number;
}

/**
 * Происхождение общегородского AQI — по районам, реально давшим значение
 * (aqi !== null), а не по сырому списку станций: сенсоры вне границ восьми
 * районов ни в одну медиану не входят и учитываться в подписи героя не должны.
 *
 * - все районы по станциям → 'stations' + суммарное число станций в медианах;
 * - все районы по модели → 'model';
 * - часть так, часть так → 'mixed' (медиана города смешивает оба происхождения);
 * - ни один район не дал значения → null (подпись не показывается).
 */
export function citySourceSummary(districts: DistrictAir[]): CitySourceSummary | null {
  const withData = districts.filter((d) => d.aqi !== null);
  if (withData.length === 0) return null;

  const stationDistricts = withData.filter((d) => d.dataOrigin === 'stations');
  const stationCount = stationDistricts.reduce((sum, d) => sum + d.stationCount, 0);

  if (stationDistricts.length === 0) return { origin: 'model', stationCount: 0 };
  if (stationDistricts.length === withData.length) {
    return { origin: 'stations', stationCount };
  }
  return { origin: 'mixed', stationCount };
}
