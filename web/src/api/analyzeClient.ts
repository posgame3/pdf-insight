import {
  API_ERROR_MESSAGES,
  ApiErrorSchema,
  InsightSchema,
  type AnalyzeRequest,
  type ApiErrorCode,
  type Insight,
} from '@pdf-insight/shared';
import { MESSAGES } from '../lib/messages';

/** Longer than the worker's own deadline, so a slow analysis ends with the server's clear timeout message. */
const CLIENT_TIMEOUT_MS = 95_000;
const NOT_RETRYABLE: ReadonlySet<ApiErrorCode> = new Set([
  'bad_request',
  'payload_too_large',
  'unsupported_media_type',
  'forbidden_origin',
]);

export class AnalysisError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export async function requestInsight(
  request: AnalyzeRequest,
  signal: AbortSignal,
  apiUrl: string = __API_URL__,
): Promise<Insight> {
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.any([signal, timeout]),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AnalysisError(timeout.aborted ? MESSAGES.timeout : MESSAGES.network, true);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    if (!parsed.success) throw new AnalysisError(MESSAGES.unexpected, true);
    const { code } = parsed.data.error;
    throw new AnalysisError(API_ERROR_MESSAGES[code], !NOT_RETRYABLE.has(code));
  }

  const insight = InsightSchema.safeParse(body);
  if (!insight.success) throw new AnalysisError(MESSAGES.invalidResult, true);
  return insight.data;
}
