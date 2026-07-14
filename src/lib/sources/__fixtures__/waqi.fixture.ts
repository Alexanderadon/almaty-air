/**
 * Фикстуры WAQI: структура по docs (JSON API aqicn.org: /v2/map/bounds и
 * /feed/@{uid}/), значения синтетические — только для тестов.
 *
 * Опорное «сейчас» в тестах: 2026-07-14T09:00:00Z (порог свежести — 3 часа).
 * Состав:
 * - uid 101 — Алмалинский район, iaqi.pm25=62 → stationAqi 62, попадает в выдачу;
 * - uid 102 — Медеуский район, iaqi без PM → берётся композитный aqi 55;
 * - uid 103 — aqi:"-" (нет данных) → /feed не запрашивается;
 * - uid 104 — Турксибский район, фид устарел (>3 ч) → отбрасывается.
 */

export const waqiBoundsResponse = {
  status: 'ok',
  data: [
    {
      lat: 43.2523,
      lon: 76.9089,
      uid: 101,
      aqi: '62',
      station: { name: 'Almaty US Embassy', time: '2026-07-14T13:00:00+05:00' },
    },
    {
      lat: 43.1597,
      lon: 77.0187,
      uid: 102,
      aqi: '55',
      station: { name: 'Medeu, Almaty', time: '2026-07-14T13:00:00+05:00' },
    },
    {
      lat: 43.35,
      lon: 77.05,
      uid: 103,
      aqi: '-',
      station: { name: 'Offline station', time: '2026-07-10T10:00:00+05:00' },
    },
    {
      lat: 43.3409,
      lon: 76.9856,
      uid: 104,
      aqi: '48',
      station: { name: 'Turksib, Almaty', time: '2026-07-14T05:00:00+05:00' },
    },
  ],
};

/** Ответы /feed/@{uid}/, ключ — uid станции. */
export const waqiFeedByUid: Record<number, object> = {
  101: {
    status: 'ok',
    data: {
      aqi: 62,
      idx: 101,
      city: { geo: [43.2523, 76.9089], name: 'Almaty US Embassy, Kazakhstan' },
      time: { s: '2026-07-14 13:00:00', tz: '+05:00', iso: '2026-07-14T13:00:00+05:00' },
      iaqi: { pm25: { v: 62 }, pm10: { v: 28 }, no2: { v: 5 } },
    },
  },
  102: {
    status: 'ok',
    data: {
      aqi: 55,
      idx: 102,
      city: { geo: [43.1597, 77.0187], name: 'Medeu, Almaty, Kazakhstan' },
      time: { s: '2026-07-14 13:00:00', tz: '+05:00', iso: '2026-07-14T13:00:00+05:00' },
      // Композитный AQI без PM-компонент (например, станция только с газами).
      iaqi: { o3: { v: 55 }, no2: { v: 12 } },
    },
  },
  104: {
    status: 'ok',
    data: {
      aqi: 48,
      idx: 104,
      city: { geo: [43.3409, 76.9856], name: 'Turksib, Almaty, Kazakhstan' },
      // Старше трёх часов относительно 2026-07-14T09:00:00Z → отбрасывается.
      time: { s: '2026-07-14 05:00:00', tz: '+05:00', iso: '2026-07-14T05:00:00+05:00' },
      iaqi: { pm25: { v: 48 } },
    },
  },
};
