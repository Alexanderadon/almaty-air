import type { SourceId, SourceStatus } from '@/lib/types';
import { pluralRu } from './plural';

export interface SourcesStatusProps {
  sources: SourceStatus[];
  className?: string;
}

type Tone = 'ok' | 'error' | 'off';

interface SourceMeta {
  /** Название источника словами жителя — подлежащее строки статуса. */
  name: string;
  /** Пояснение, что стоит за источником. */
  note: string;
  /** Формы статуса, согласованные с name по числу и роду. */
  status: Record<Tone, string>;
  /** Единица счёта точек данных для pluralRu. */
  unit: readonly [string, string, string];
}

const SOURCE_META: Record<SourceId, SourceMeta> = {
  openaq: {
    name: 'Станции OpenAQ',
    note: 'Сеть городских сенсоров AirGradient',
    status: { ok: 'работают', error: 'временно недоступны', off: 'не подключены' },
    unit: ['станция', 'станции', 'станций'],
  },
  waqi: {
    name: 'Станции WAQI',
    note: 'Казгидромет и посольство США',
    status: { ok: 'работают', error: 'временно недоступны', off: 'не подключены' },
    unit: ['станция', 'станции', 'станций'],
  },
  openmeteo: {
    name: 'Модель CAMS (Copernicus)',
    note: 'Европейская служба мониторинга атмосферы',
    status: { ok: 'работает', error: 'временно недоступна', off: 'не подключена' },
    unit: ['точка', 'точки', 'точек'],
  },
};

/**
 * Тон и строка статуса без внутреннего жаргона: жителю не нужны слова
 * «ключ», «API» или коды HTTP — только работает источник или нет.
 */
function describe(source: SourceStatus): { tone: Tone; text: string } {
  const meta = SOURCE_META[source.id];
  if (!source.configured) return { tone: 'off', text: meta.status.off };
  if (!source.ok) return { tone: 'error', text: meta.status.error };
  const n = source.stations;
  return { tone: 'ok', text: `${meta.status.ok}, ${n} ${pluralRu(n, meta.unit)}` };
}

/**
 * Статус источников данных: строка на источник — название и пояснение слева,
 * статус словами справа. Состояние несут слова, а не цвет: «временно
 * недоступны» выделено весом, неподключённые — приглушены, без алармизма.
 */
export function SourcesStatus({ sources, className = '' }: SourcesStatusProps) {
  return (
    <ul className={`divide-y divide-border border-y border-border ${className}`}>
      {sources.map((source) => {
        const meta = SOURCE_META[source.id];
        const { tone, text } = describe(source);
        const off = tone === 'off';
        return (
          <li
            key={source.id}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
          >
            <div className="min-w-0">
              <p className={`text-sm ${off ? 'text-muted' : 'font-medium'}`}>{meta.name}</p>
              <p className="text-xs text-muted">{meta.note}</p>
            </div>
            <p className={`text-sm tabular-nums ${tone === 'error' ? 'font-medium' : 'text-muted'}`}>
              {text}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
