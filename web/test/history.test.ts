import { describe, expect, it } from 'vitest';
import { clearHistory, readHistory, saveToHistory } from '../src/lib/history';
import { insightFixture } from './fixtures';

describe('history', () => {
  it('stores results newest first and keeps at most ten', () => {
    for (let index = 0; index < 12; index += 1) {
      saveToHistory(insightFixture({ keywords: [`k${index}`] }));
    }
    const entries = readHistory();
    expect(entries).toHaveLength(10);
    expect(entries[0]?.insight.keywords).toEqual(['k11']);
  });

  it('drops tampered entries instead of failing', () => {
    saveToHistory(insightFixture());
    const stored = JSON.parse(localStorage.getItem('pdf-insight:history:v1') ?? '[]') as unknown[];
    localStorage.setItem('pdf-insight:history:v1', JSON.stringify([...stored, { id: 'x', insight: { evil: true } }]));
    expect(readHistory()).toHaveLength(1);
  });

  it('survives corrupted storage and can be cleared', () => {
    localStorage.setItem('pdf-insight:history:v1', '{not json');
    expect(readHistory()).toEqual([]);
    saveToHistory(insightFixture());
    clearHistory();
    expect(readHistory()).toEqual([]);
  });
});
