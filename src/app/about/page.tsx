import type { Metadata } from 'next';
import Link from 'next/link';
import { aboutPageJsonLd, JsonLd } from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Как мы считаем качество воздуха',
  description:
    'Методология «Воздух Алматы»: станции OpenAQ, посты Казгидромета (WAQI), модель CAMS Copernicus; AQI по шкале US EPA 2024, модельные значения помечены честно.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'Как мы считаем качество воздуха — Воздух Алматы',
    description:
      'Три слоя данных, расчёт AQI по шкале US EPA (ревизия 2024) и честная маркировка модельных значений.',
    url: '/about',
    siteName: 'Воздух Алматы',
    locale: 'ru_RU',
    type: 'website',
  },
};

const LINK_CLASS =
  'underline decoration-border underline-offset-2 transition-colors hover:decoration-current';

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={LINK_CLASS}>
      {children}
    </a>
  );
}

/** Страница методологии: откуда данные, как считается AQI, как часто обновляется. */
export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 md:py-10">
      {/* Структурированные данные: страница «о проекте» с автором. */}
      <JsonLd data={aboutPageJsonLd()} />

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted transition-colors hover:text-foreground"
      >
        <span aria-hidden="true">←</span>
        На главную
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
        Как мы считаем качество воздуха
      </h1>
      <p className="mt-3 leading-relaxed text-muted">
        «Воздух Алматы» показывает только реальные данные и всегда честно
        сообщает их происхождение: измерение станции — это измерение станции,
        модельная оценка — это модельная оценка. Ниже — вся методология.
      </p>

      <section aria-labelledby="layers-heading" className="mt-10">
        <h2 id="layers-heading" className="text-lg font-semibold tracking-tight">
          Три слоя данных
        </h2>
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Станции мониторинга</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Сеть сенсоров AirGradient по всему городу — данные приходят через
              платформу <ExternalLink href="https://openaq.org/">OpenAQ</ExternalLink>.
              Это измерения концентраций PM2.5 в конкретных точках Алматы.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Официальные посты</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Посты наблюдений Казгидромета и монитор посольства США — через
              сервис <ExternalLink href="https://aqicn.org/">WAQI</ExternalLink>.
              Дополнительный независимый слой измерений.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Модель CAMS (Copernicus)</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Глобальная модель атмосферы{' '}
              <ExternalLink href="https://atmosphere.copernicus.eu/">
                CAMS
              </ExternalLink>{' '}
              программы Copernicus, данные через{' '}
              <ExternalLink href="https://open-meteo.com/">Open-Meteo</ExternalLink>.
              Модель закрывает районы без станций и используется как запасной
              слой для истории. Сетка модели — порядка 40 км, поэтому локальные
              пики она сглаживает. Модельные значения в интерфейсе всегда
              помечены как модельные и никогда не выдаются за измерения.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="scale-heading" className="mt-10">
        <h2 id="scale-heading" className="text-lg font-semibold tracking-tight">
          Шкала US EPA 2024 — и почему мы считаем AQI сами
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Индекс AQI мы вычисляем в приложении из концентраций PM2.5 и PM10 по
          шкале US EPA в ревизии 2024 года — в ней граница категории «хорошо»
          для PM2.5 снижена до 9,0 мкг/м³. Готовым композитным индексам чужих
          сервисов мы не доверяем: у разных провайдеров разные шкалы и разные
          правила округления, и «AQI 80» у них может означать разное. Считая
          сами, мы получаем одинаковую, проверяемую шкалу для всех источников;
          расчёт покрыт юнит-тестами, включая точные границы сегментов и правила
          усечения EPA. Как устроена шкала — можно прочитать у первоисточника:{' '}
          <ExternalLink href="https://www.airnow.gov/aqi/aqi-basics/">
            AirNow (US EPA)
          </ExternalLink>
          .
        </p>
      </section>

      <section aria-labelledby="updates-heading" className="mt-10">
        <h2 id="updates-heading" className="text-lg font-semibold tracking-tight">
          Как часто обновляются данные
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Страницы пересобираются примерно раз в час; ответы источников
          кэшируются на 30–60 минут, чтобы оставаться в пределах их бесплатных
          лимитов. Время последнего обновления показано рядом с каждым
          значением — мы не делаем вид, что данные «прямо сейчас», если это не
          так.
        </p>
      </section>

      <section aria-labelledby="history-heading" className="mt-10">
        <h2 id="history-heading" className="text-lg font-semibold tracking-tight">
          Собственная история измерений
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Раз в час сервис сохраняет срез по всем восьми районам в собственную
          базу — из неё строятся графики за 24 часа, 7 и 30 дней; история
          хранится 92 дня. Если по какому-то окну накопленных данных
          недостаточно, график честно переключается на модель CAMS и сообщает об
          этом.
        </p>
      </section>

      <section aria-labelledby="sources-heading" className="mt-10">
        <h2 id="sources-heading" className="text-lg font-semibold tracking-tight">
          Первоисточники
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
          <li>
            <ExternalLink href="https://openaq.org/">OpenAQ</ExternalLink> —
            открытая платформа данных о качестве воздуха (сенсоры AirGradient)
          </li>
          <li>
            <ExternalLink href="https://aqicn.org/">WAQI</ExternalLink> —
            World Air Quality Index (Казгидромет, посольство США)
          </li>
          <li>
            <ExternalLink href="https://open-meteo.com/">Open-Meteo</ExternalLink>{' '}
            — API модельных данных (CC-BY 4.0), содержит модифицированные данные
            Copernicus Atmosphere Monitoring Service
          </li>
          <li>
            <ExternalLink href="https://atmosphere.copernicus.eu/">
              Copernicus CAMS
            </ExternalLink>{' '}
            — модель атмосферы Европейской программы Copernicus
          </li>
          <li>
            <ExternalLink href="https://www.airnow.gov/aqi/aqi-basics/">
              AirNow (US EPA)
            </ExternalLink>{' '}
            — методология шкалы AQI
          </li>
          <li>
            ©{' '}
            <ExternalLink href="https://www.openstreetmap.org/copyright">
              участники OpenStreetMap
            </ExternalLink>{' '}
            — карта и границы районов
          </li>
        </ul>
      </section>

      <section aria-labelledby="author-heading" className="mt-10">
        <h2 id="author-heading" className="text-lg font-semibold tracking-tight">
          Кто это сделал
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Сервис сделал Alexander Kurchakov — фронтенд-разработчик и
          UI/UX-дизайнер из Алматы. Проект открытый и бесплатный, без рекламы;
          код доступен на{' '}
          <ExternalLink href="https://github.com/Alexanderadon/almaty-air">
            GitHub
          </ExternalLink>
          . Замечания и предложения — туда же, в issues.
        </p>
      </section>
    </main>
  );
}
