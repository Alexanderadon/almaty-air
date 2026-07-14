'use client';

/**
 * Пилюли с числом AQI в центроидах восьми районов (стиль лучших карт
 * качества воздуха): цвет фона — категория AQI, при отсутствии данных —
 * серая пилюля с «—». Клик/Enter открывает попап с деталями района
 * и ссылкой на его страницу.
 *
 * Маркер — L.divIcon с фиксированным iconSize и якорем ровно по центру,
 * поэтому пилюля не «плывёт» относительно центроида при зуме. HTML иконки
 * собирается только из наших данных (badgeHtml экранирует nameRu).
 * zIndexOffset поднимает пилюли над возможными соседними маркерами;
 * над полигонами районов они и так выше — markerPane поверх overlayPane.
 */

import { divIcon } from 'leaflet';
import { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { aqiCategory } from '@/lib/aqi';
import { DISTRICTS } from '@/lib/districts';
import type { DistrictAir } from '@/lib/types';
import { BADGE_HEIGHT, BADGE_WIDTH, badgeHtml } from './helpers';

const CONCENTRATION_FMT = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 1,
});

export interface DistrictAqiBadgesProps {
  districts: DistrictAir[];
}

export default function DistrictAqiBadges({ districts }: DistrictAqiBadgesProps) {
  const airBySlug = useMemo(
    () => new Map(districts.map((d) => [d.slug, d])),
    [districts],
  );

  return (
    <>
      {DISTRICTS.map((district) => {
        const air = airBySlug.get(district.slug) ?? null;
        const aqi = air?.aqi ?? null;
        const icon = divIcon({
          // Пустой className убирает дефолтную белую рамку .leaflet-div-icon.
          className: '',
          html: badgeHtml(aqi, district.nameRu),
          iconSize: [BADGE_WIDTH, BADGE_HEIGHT],
          iconAnchor: [BADGE_WIDTH / 2, BADGE_HEIGHT / 2],
          popupAnchor: [0, -(BADGE_HEIGHT / 2 + 4)],
        });
        return (
          <Marker
            key={district.slug}
            position={district.centroid}
            icon={icon}
            zIndexOffset={200}
            keyboard
          >
            <Popup>
              <div className="text-[13px] leading-snug">
                <p className="font-semibold">{district.nameRu}</p>
                {aqi !== null ? (
                  <p>
                    AQI {aqi} · {aqiCategory(aqi).labelRu}
                  </p>
                ) : (
                  <p>Данных пока нет</p>
                )}
                {air?.pm25 != null && (
                  <p>PM2.5: {CONCENTRATION_FMT.format(air.pm25)} мкг/м³</p>
                )}
                <p className="mt-1">
                  <a className="underline" href={`/district/${district.slug}`}>
                    Подробнее →
                  </a>
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
