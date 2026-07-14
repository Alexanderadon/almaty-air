import type { SourceId, SourceStatus } from '@/lib/types';
import { pluralRu } from './plural';

export interface SourcesStatusProps {
  sources: SourceStatus[];
  className?: string;
}

const SOURCE_META: Record<SourceId, { name: string; note: string }> = {
  openaq: { name: 'OpenAQ', note: 'сеть сенсоров AirGradient' },
  waqi: { name: 'WAQI', note: 'Казгидромет и посольство США' },
  openmeteo: { name: 'Open-Meteo', note: 'модель CAMS (Copernicus)' },
};

type Tone = 'ok' | 'error' | 'off';

const TONE_DOT: Record<Tone, string> = {
  ok: 'bg-emerald-500',
  error: 'bg-red-500',
  off: 'bg-zinc-400',
};

const TONE_LABEL: Record<Tone, string> = {
  ok: 'работает',
  error: 'ошибка',
  off: 'не настроен',
};

/** Честный статус источника: не настроен / ошибка (с причиной) / N станций. */
function describe(source: SourceStatus): { tone: Tone; text: string } {
  if (!source.configured) {
    return { tone: 'off', text: 'Не настроен: нужен ключ API.' };
  }
  if (!source.ok) {
    return {
      tone: 'error',
      text: source.detail ? `Ошибка: ${source.detail}.` : 'Ошибка запроса.',
    };
  }
  const n = source.stations;
  const unit =
    source.id === 'openmeteo'
      ? pluralRu(n, ['точка модели', 'точки модели', 'точек модели'])
      : pluralRu(n, ['станция', 'станции', 'станций']);
  return { tone: 'ok', text: `Работает: ${n} ${unit}.` };
}

/** Блок статуса источников данных: по карточке на провайдера, без приукрашивания. */
export function SourcesStatus({ sources, className = '' }: SourcesStatusProps) {
  return (
    <ul className={`grid gap-3 sm:grid-cols-3 ${className}`}>
      {sources.map((source) => {
        const meta = SOURCE_META[source.id];
        const status = describe(source);
        return (
          <li key={source.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <span
                aria-label={TONE_LABEL[status.tone]}
                role="img"
                className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[status.tone]}`}
              />
              <h3 className="text-sm font-semibold">{meta.name}</h3>
            </div>
            <p className="mt-0.5 text-xs text-muted">{meta.note}</p>
            <p className="mt-2 text-sm">{status.text}</p>
          </li>
        );
      })}
    </ul>
  );
}
