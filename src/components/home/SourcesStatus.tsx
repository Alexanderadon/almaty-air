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

const TONE_DOT: Record<Tone, string> = {
  ok: 'bg-emerald-500',
  error: 'bg-amber-500',
  off: 'bg-zinc-400',
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
 * Статус источников данных: одна понятная строка на источник.
 * Активные — зелёная точка («Модель CAMS (Copernicus) — работает, 8 точек»),
 * неподключённые — нейтрально и приглушённо, без алармизма.
 */
export function SourcesStatus({ sources, className = '' }: SourcesStatusProps) {
  return (
    <ul className={`space-y-3 rounded-2xl border border-border bg-card p-4 ${className}`}>
      {sources.map((source) => {
        const meta = SOURCE_META[source.id];
        const { tone, text } = describe(source);
        const off = tone === 'off';
        return (
          <li key={source.id} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone]}`}
            />
            <div className="min-w-0">
              <p className={`text-sm ${off ? 'text-muted' : ''}`}>
                <span className={off ? undefined : 'font-medium'}>{meta.name}</span>
                {' — '}
                {text}
              </p>
              <p className="text-xs text-muted">{meta.note}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
