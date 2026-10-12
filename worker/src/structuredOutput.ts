import { z } from 'zod';

type JsonSchema = Record<string, unknown>;

/**
 * Keywords the structured-outputs API rejects. They stay enforced by the Zod schema after the response
 * arrives, so dropping them here only moves those checks to the validation-and-retry step.
 */
const UNSUPPORTED_KEYWORDS = new Set([
  '$schema',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'pattern',
  'format',
]);

function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (node === null || typeof node !== 'object') return node;
  const result: JsonSchema = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    result[key] = key === 'properties' ? sanitizeProperties(value) : sanitize(value);
  }
  if (result.type === 'object') result.additionalProperties = false;
  return result;
}

function sanitizeProperties(properties: unknown): unknown {
  if (properties === null || typeof properties !== 'object') return properties;
  return Object.fromEntries(Object.entries(properties).map(([name, schema]) => [name, sanitize(schema)]));
}

/** JSON Schema accepted by `output_config.format`, derived from the same Zod schema that validates the response. */
export function toStructuredOutputSchema(schema: z.ZodType): JsonSchema {
  return sanitize(z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' })) as JsonSchema;
}
