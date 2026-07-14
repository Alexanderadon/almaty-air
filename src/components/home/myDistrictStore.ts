/**
 * Хранилище выбора «мой район»: один слаг района в localStorage браузера.
 * Чтение всегда валидируется по DISTRICT_SLUGS — мусор в хранилище
 * (правка руками, старые версии) не попадает в UI. Ошибки localStorage
 * (приватный режим, запрет хранилища) молча гасятся: выбор — удобство,
 * а не данные.
 *
 * Общий модуль для MyDistrict (главная) и MyDistrictToggle (страница района):
 * оба подключаются через useSyncExternalStore (subscribeMyDistrict +
 * readMyDistrict) — на сервере и при гидрации serverSnapshot даёт null/false,
 * рассинхрона разметки нет, а смена выбора в другой вкладке подхватывается
 * через событие storage.
 */

import { DISTRICT_SLUGS, type DistrictSlug } from '@/lib/types';

/** Ключ localStorage: слаг района, выбранного пользователем как «мой». */
export const MY_DISTRICT_KEY = 'almaty-air-my-district';

type Listener = () => void;

/** Подписчики этой вкладки (событие storage срабатывает только в чужих). */
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Сырое значение из хранилища → валидный слаг района либо null. */
export function parseMyDistrict(value: string | null): DistrictSlug | null {
  return value !== null && (DISTRICT_SLUGS as readonly string[]).includes(value)
    ? (value as DistrictSlug)
    : null;
}

/** «Мой район» из localStorage; null — не выбран, невалиден или хранилище недоступно. */
export function readMyDistrict(): DistrictSlug | null {
  try {
    return parseMyDistrict(window.localStorage.getItem(MY_DISTRICT_KEY));
  } catch {
    return null;
  }
}

/** Сохранить «мой район»; null — снять выбор. Сбои хранилища не бросают. */
export function writeMyDistrict(slug: DistrictSlug | null): void {
  try {
    if (slug === null) window.localStorage.removeItem(MY_DISTRICT_KEY);
    else window.localStorage.setItem(MY_DISTRICT_KEY, slug);
  } catch {
    // Приватный режим без localStorage — выбор не переживёт перезагрузку.
  }
  // Подписчики перечитывают хранилище сами (readMyDistrict) — UI всегда
  // отражает фактическое состояние, даже если запись не удалась.
  notify();
}

/**
 * Подписка на смену «моего района» (для useSyncExternalStore): изменения
 * в этой вкладке — через writeMyDistrict, в других вкладках — через
 * событие storage. Возвращает отписку.
 */
export function subscribeMyDistrict(listener: Listener): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}
