/**
 * Русская плюрализация: выбирает форму слова по числительному.
 *
 * forms — [одна, две-четыре, пять и более]: например
 * ['станция', 'станции', 'станций'] → 1 станция, 3 станции, 12 станций.
 */
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
