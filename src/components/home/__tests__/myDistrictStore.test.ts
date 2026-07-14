// @vitest-environment jsdom
/**
 * Тесты хранилища «мой район»: валидация слага по DISTRICT_SLUGS при чтении,
 * запись/снятие выбора, устойчивость к недоступному localStorage
 * (приватный режим — функции не бросают, чтение отдаёт null).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DISTRICT_SLUGS } from '../../../lib/types';
import {
  MY_DISTRICT_KEY,
  parseMyDistrict,
  readMyDistrict,
  subscribeMyDistrict,
  writeMyDistrict,
} from '../myDistrictStore';

const originalLocalStorage = window.localStorage;

function breakLocalStorage() {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('localStorage запрещён');
    },
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: originalLocalStorage,
  });
});

describe('parseMyDistrict', () => {
  it('принимает каждый из восьми слагов района', () => {
    for (const slug of DISTRICT_SLUGS) {
      expect(parseMyDistrict(slug)).toBe(slug);
    }
  });

  it('отклоняет мусор: чужие строки, регистр, пустую строку и null', () => {
    expect(parseMyDistrict('moscow')).toBeNull();
    expect(parseMyDistrict('MEDEU')).toBeNull();
    expect(parseMyDistrict(' medeu ')).toBeNull();
    expect(parseMyDistrict('')).toBeNull();
    expect(parseMyDistrict(null)).toBeNull();
  });
});

describe('readMyDistrict / writeMyDistrict', () => {
  it('пустое хранилище → null', () => {
    expect(readMyDistrict()).toBeNull();
  });

  it('запись и чтение — круговой путь', () => {
    writeMyDistrict('medeu');
    expect(window.localStorage.getItem(MY_DISTRICT_KEY)).toBe('medeu');
    expect(readMyDistrict()).toBe('medeu');
  });

  it('повторная запись переключает район', () => {
    writeMyDistrict('medeu');
    writeMyDistrict('auezov');
    expect(readMyDistrict()).toBe('auezov');
  });

  it('writeMyDistrict(null) снимает выбор', () => {
    writeMyDistrict('medeu');
    writeMyDistrict(null);
    expect(window.localStorage.getItem(MY_DISTRICT_KEY)).toBeNull();
    expect(readMyDistrict()).toBeNull();
  });

  it('невалидное значение в хранилище (правка руками) читается как null', () => {
    window.localStorage.setItem(MY_DISTRICT_KEY, 'narnia');
    expect(readMyDistrict()).toBeNull();
  });

  it('недоступный localStorage: чтение → null, запись не бросает', () => {
    breakLocalStorage();
    expect(readMyDistrict()).toBeNull();
    expect(() => writeMyDistrict('medeu')).not.toThrow();
    expect(() => writeMyDistrict(null)).not.toThrow();
  });
});

describe('subscribeMyDistrict', () => {
  it('запись уведомляет подписчика, после отписки уведомлений нет', () => {
    let calls = 0;
    const unsubscribe = subscribeMyDistrict(() => {
      calls += 1;
    });

    writeMyDistrict('medeu');
    expect(calls).toBe(1);
    expect(readMyDistrict()).toBe('medeu');

    writeMyDistrict(null);
    expect(calls).toBe(2);

    unsubscribe();
    writeMyDistrict('auezov');
    expect(calls).toBe(2);
  });
});
