const NUMBER_TOKEN = /\d(?:[\d.,'\u2019]|[ \u00A0\u202F](?=\d{3}(?!\d)))*/gu;
const MULTIPLIERS: readonly (readonly [RegExp, number])[] = [
  [/^\s*(?:tys\.?|tysiąc\p{L}*|thousand|k)(?!\p{L})/iu, 1e3],
  [/^\s*(?:mln\.?|milion\p{L}*|million\p{L}*|m)(?!\p{L})/iu, 1e6],
  [/^\s*(?:mld\.?|miliard\p{L}*|billion\p{L}*|bn)(?!\p{L})/iu, 1e9],
];

/**
 * Every value a number written in the text could mean. "12 300,00", "12.300,00" and "12,300.00" all yield
 * 12300; an ambiguous "1.500" yields both 1.5 and 1500, and "4,2 mln" also yields 4200000.
 */
export function numbersIn(text: string): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(NUMBER_TOKEN)) {
    const token = match[0].replace(/[.,'\u2019]+$/u, '').replace(/[ \u00A0\u202F'\u2019]/gu, '');
    const multiplier = MULTIPLIERS.find(([pattern]) => pattern.test(text.slice(match.index + match[0].length)))?.[1];
    for (const value of interpretations(token)) {
      values.push(value);
      if (multiplier) values.push(value * multiplier);
    }
  }
  return values;
}

function interpretations(token: string): number[] {
  const lastSeparator = Math.max(token.lastIndexOf(','), token.lastIndexOf('.'));
  if (lastSeparator === -1) return [Number(token)];
  const integerPart = token.slice(0, lastSeparator).replace(/[.,]/g, '');
  const asDecimal = Number(`${integerPart}.${token.slice(lastSeparator + 1)}`);
  const asGrouped = Number(token.replace(/[.,]/g, ''));
  return [asDecimal, asGrouped].filter(Number.isFinite);
}

export function textMentionsAmount(text: string, value: number): boolean {
  const target = Math.abs(value);
  return numbersIn(text).some((candidate) => Math.abs(candidate - target) < 0.005);
}
