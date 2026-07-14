import Link from 'next/link';

const LINK_CLASS =
  'underline decoration-border underline-offset-2 transition-colors hover:text-foreground hover:decoration-current';

/**
 * Подвал: обязательные атрибуции (Open-Meteo CC-BY + Copernicus, OpenStreetMap)
 * в две компактные строки и служебные ссылки. Подробности об источниках —
 * на странице «О данных» (/about), статус — в блоке «Источники данных» на главной.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="space-y-1.5 text-xs leading-relaxed text-muted">
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
            (CC-BY 4.0, содержит модифицированные данные Copernicus Atmosphere
            Monitoring Service), станции —{' '}
            <a
              href="https://openaq.org/"
              target="_blank"
              rel="noreferrer"
              className={LINK_CLASS}
            >
              OpenAQ
            </a>{' '}
            и{' '}
            <a
              href="https://aqicn.org/"
              target="_blank"
              rel="noreferrer"
              className={LINK_CLASS}
            >
              WAQI
            </a>
            .
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
            . AQI — шкала US EPA (ревизия 2024).
          </p>
        </div>
        <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-medium">Сделано в Алматы</span>
          <Link href="/about" className={`text-muted ${LINK_CLASS}`}>
            О данных
          </Link>
          <a
            href="https://github.com/Alexanderadon/almaty-air"
            target="_blank"
            rel="noreferrer"
            className={`text-muted ${LINK_CLASS}`}
          >
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
