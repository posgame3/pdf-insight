import { ModelAnalysisSchema } from '@pdf-insight/shared';
import { describe, expect, it } from 'vitest';
import { toStructuredOutputSchema } from '../src/structuredOutput';

function collectKeys(node: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(node)) node.forEach((item) => collectKeys(item, keys));
  else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      keys.add(key);
      collectKeys(value, keys);
    }
  }
  return keys;
}

function collectObjects(node: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) node.forEach((item) => collectObjects(item, found));
  else if (node !== null && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (record.type === 'object') found.push(record);
    Object.values(record).forEach((value) => collectObjects(value, found));
  }
  return found;
}

describe('toStructuredOutputSchema', () => {
  const schema = toStructuredOutputSchema(ModelAnalysisSchema);

  it('drops keywords the structured-outputs API rejects', () => {
    const keys = collectKeys(schema);
    for (const keyword of [
      'minLength',
      'maxLength',
      'minItems',
      'maxItems',
      'minimum',
      'maximum',
      'pattern',
      '$schema',
    ]) {
      expect(keys).not.toContain(keyword);
    }
  });

  it('closes every object with additionalProperties: false', () => {
    const objects = collectObjects(schema);
    expect(objects.length).toBeGreaterThan(5);
    expect(objects.every((object) => object.additionalProperties === false)).toBe(true);
  });

  it('keeps property names that merely look like keywords', () => {
    expect(collectKeys(schema)).toContain('summary');
    expect(JSON.stringify(schema)).toContain('"enum":["faktura","umowa","oferta","raport","inne"]');
  });
});
