export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

/** Provider-neutral input: the prompt is built once and each client translates it to its own API format. */
export type InputBlock =
  { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

/** Blocks returned by the model (text, thinking, ...), passed back verbatim when the request is retried. */
export type OutputBlock = { type: string } & Record<string, unknown>;

export type ModelMessage = { role: 'user'; content: InputBlock[] } | { role: 'assistant'; content: OutputBlock[] };

export interface StructuredRequest {
  system: string;
  messages: ModelMessage[];
  schema: Record<string, unknown>;
  maxTokens: number;
  signal: AbortSignal;
}

export interface StructuredResponse {
  /** Parsed JSON, or undefined when the output was cut off or is not JSON. */
  json: unknown;
  content: OutputBlock[];
}

export type CompleteStructured = (request: StructuredRequest) => Promise<StructuredResponse>;

export interface ModelSettings {
  apiKey: string;
  model: string;
  effort: Effort;
}

export function textOf(blocks: readonly OutputBlock[]): string {
  return blocks
    .filter((block) => block.type === 'text')
    .map((block) => (typeof block.text === 'string' ? block.text : ''))
    .join('');
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
