import { InsightSchema, type Insight } from '@pdf-insight/shared';
import { z } from 'zod';

const STORAGE_KEY = 'pdf-insight:history:v1';
const MAX_ENTRIES = 10;

const HistoryEntrySchema = z.object({ id: z.string(), savedAt: z.iso.datetime(), insight: InsightSchema });
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

/**
 * Results kept in this browser only (localStorage), never the PDF itself. Stored data is re-validated on
 * read, so a corrupted or tampered entry is dropped instead of crashing the view.
 */
export function readHistory(): HistoryEntry[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry) => {
      const parsed = HistoryEntrySchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

function writeHistory(entries: readonly HistoryEntry[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function saveToHistory(insight: Insight): HistoryEntry[] {
  const entry: HistoryEntry = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), insight };
  let entries = [entry, ...readHistory()].slice(0, MAX_ENTRIES);
  while (!writeHistory(entries) && entries.length > 1) entries = entries.slice(0, -1);
  return readHistory();
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
