import { InsightSchema, type Insight } from '@pdf-insight/shared';

export function serializeInsight(insight: Insight): string {
  return `${JSON.stringify(InsightSchema.parse(insight), null, 2)}\n`;
}

export function insightFileName(sourceFileName: string): string {
  const stem = sourceFileName
    .replace(/\.pdf$/i, '')
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .slice(0, 100);
  return `${stem || 'dokument'}.insight.json`;
}

/** Downloads the result, validated once more against the schema so the file is always valid JSON. */
export function downloadInsight(insight: Insight): void {
  const url = URL.createObjectURL(new Blob([serializeInsight(insight)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = insightFileName(insight.document.fileName);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
