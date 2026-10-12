import { describe, expect, it } from 'vitest';
import { textMentionsDate } from '../src/grounding/dates';
import { createEvidenceVerifier } from '../src/grounding/evidence';
import { numbersIn, textMentionsAmount } from '../src/grounding/numbers';

describe('numbersIn / textMentionsAmount', () => {
  it.each([
    ['12 300,00 zł', 12300],
    ['12\u00A0300,00 zł', 12300],
    ['12.300,00 PLN', 12300],
    ['EUR 2,150.00', 2150],
    ['12 730,50 zł VAT', 12730.5],
    ['226935,00', 226935],
    ['4,2 mln zł', 4200000],
    ['250 tys. zł', 250000],
    ['USD 890', 890],
  ])('finds %s = %d', (text, value) => {
    expect(textMentionsAmount(text, value)).toBe(true);
  });

  it('does not glue separate numbers into one', () => {
    expect(numbersIn('w 2026 12 osób')).not.toContain(202612);
  });

  it('rejects an amount that is not in the text', () => {
    expect(textMentionsAmount('wartość umowy 184 500,00 zł', 1)).toBe(false);
  });
});

describe('textMentionsDate', () => {
  it.each([
    ['zawarta w dniu 12.03.2026 r.', '2026-03-12'],
    ['dnia 1.4.2027', '2027-04-01'],
    ['od 01-04-2027', '2027-04-01'],
    ['z dnia 12 marca 2026 roku', '2026-03-12'],
    ['signed on March 12, 2026', '2026-03-12'],
    ['on 12th March 2026', '2026-03-12'],
    ['termin 2026-10-01', '2026-10-01'],
  ])('finds %s', (text, iso) => {
    expect(textMentionsDate(text, iso)).toBe(true);
  });

  it.each([
    ['11.03.2026', '2026-03-01'],
    ['FZ/2026/03/007', '2026-03-07'],
    ['12.03.2025', '2026-03-12'],
  ])('does not confuse %s with %s', (text, iso) => {
    expect(textMentionsDate(text, iso)).toBe(false);
  });
});

describe('createEvidenceVerifier', () => {
  const verify = createEvidenceVerifier(
    [
      { page: 1, text: 'Strona tytułowa' },
      { page: 2, text: 'Wynagrodzenie wynosi 184 500,00 zł netto, płatne w dwóch ratach.' },
    ],
    [3],
  );
  const mentions184500 = (quote: string) => textMentionsAmount(quote, 184500);

  it('confirms a quote found on the cited page', () => {
    expect(verify({ page: 2, quote: 'Wynagrodzenie  wynosi 184 500,00 zł' }, mentions184500).verification).toBe('text');
  });

  it('corrects a wrong page number when the quote exists elsewhere', () => {
    expect(verify({ page: 1, quote: 'wynosi 184 500,00 zł netto' }, mentions184500)).toEqual({
      source: { page: 2, quote: 'wynosi 184 500,00 zł netto' },
      verification: 'text',
    });
  });

  it('accepts quotes shortened with an ellipsis', () => {
    expect(verify({ page: 2, quote: 'Wynagrodzenie … 184 500,00 zł' }, mentions184500).verification).toBe('text');
  });

  it('marks values read from scanned pages as such', () => {
    expect(verify({ page: 3, quote: '13 100,00 zł' }, () => true).verification).toBe('scan');
  });

  it('flags a quote that does not occur in the document', () => {
    expect(verify({ page: 2, quote: 'wartość umowy 1 PLN' }, () => true).verification).toBe('unconfirmed');
  });

  it('flags a quote that exists but does not contain the value', () => {
    expect(verify({ page: 2, quote: 'płatne w dwóch ratach' }, mentions184500).verification).toBe('unconfirmed');
  });
});
