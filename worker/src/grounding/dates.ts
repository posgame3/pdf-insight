import { toMatchKey } from '@pdf-insight/shared';

const POLISH_MONTHS = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];
const ENGLISH_MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** True when the text writes the given ISO date in a common Polish or English form. */
export function textMentionsDate(text: string, isoDate: string): boolean {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  const monthName = `(?:${POLISH_MONTHS[month - 1]}|${ENGLISH_MONTHS[month - 1]})`;
  const dayPart = `0?${day}(?:st|nd|rd|th)?`;
  const patterns = [
    `(?<!\\d)0?${day}[./-]0?${month}[./-]${year}(?!\\d)`,
    `(?<!\\d)${isoDate}(?!\\d)`,
    `(?<!\\d)${dayPart}${monthName},?${year}(?!\\d)`,
    `${monthName}${dayPart},?${year}(?!\\d)`,
  ];
  const key = toMatchKey(text);
  return patterns.some((pattern) => new RegExp(pattern, 'u').test(key));
}
