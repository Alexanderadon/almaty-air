const LINK_CLASS =
  'underline decoration-border underline-offset-2 transition-colors hover:text-foreground hover:decoration-current';

/** Подвал: обязательные атрибуции источников данных и карты. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="space-y-2 text-xs leading-relaxed text-muted">
          <p>
            Данные:{' '}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className={LINK_CLASS}
            >
              Open-Meteo
            </a>{' '}
            (CC-BY 4.0), содержит модифицированные данные Copernicus Atmosphere
            Monitoring Service.
          </p>
          <p>
            Станционные данные — при подключённых источниках:{' '}
            <a
              href="https://openaq.org/"
              target="_blank"
              rel="noreferrer"
              className={LINK_CLASS}
            >
              OpenAQ
            </a>{' '}
            (сенсоры AirGradient) и{' '}
            <a
              href="https://aqicn.org/"
              target="_blank"
              rel="noreferrer"
              className={LINK_CLASS}
            >
              WAQI
            </a>{' '}
            (Казгидромет, Посольство США).
          </p>
          <p>
            Карта: ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className={LINK_CLASS}
            >
              участники OpenStreetMap
            </a>
            .
          </p>
          <p>
            AQI рассчитывается из концентраций PM2.5 и PM10 по шкале US EPA
            (ревизия 2024).
          </p>
        </div>
        <p className="mt-6 text-xs font-medium">Сделано в Алматы</p>
      </div>
    </footer>
  );
}
