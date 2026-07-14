/**
 * Дымовой прогон живого соединения с Supabase (schema almaty_air):
 * insert → select → delete тестовой строки readings за 2000-01-01T00:00Z
 * (заведомо вне периода хранения — с реальными данными не пересекается).
 *
 * Запуск: `pnpm db:smoke` (см. scripts/vitest.smoke.config.ts).
 */
import { expect, it } from 'vitest';

import { getPrisma } from '@/lib/db';

const SMOKE_TS = new Date('2000-01-01T00:00:00.000Z');
const SMOKE_WHERE = { districtSlug: 'almaly', ts: SMOKE_TS };

it('живое соединение: insert → select → delete в almaty_air.readings', async () => {
  const prisma = getPrisma();
  try {
    // Мусор от прерванных прошлых прогонов не должен ронять текущий.
    await prisma.reading.deleteMany({ where: SMOKE_WHERE });

    await prisma.reading.create({
      data: {
        districtSlug: 'almaly',
        ts: SMOKE_TS,
        aqi: 42,
        pm25: 10.5,
        pm10: null,
        dataOrigin: 'stations',
        stationCount: 1,
      },
    });

    const row = await prisma.reading.findUnique({
      where: { districtSlug_ts: SMOKE_WHERE },
    });
    expect(row).not.toBeNull();
    expect(row?.aqi).toBe(42);
    expect(row?.pm25).toBe(10.5);
    expect(row?.dataOrigin).toBe('stations');

    const deleted = await prisma.reading.deleteMany({ where: SMOKE_WHERE });
    expect(deleted.count).toBe(1);

    console.log('OK: живое соединение с Supabase работает (insert/select/delete)');
  } finally {
    await prisma.$disconnect();
  }
});
