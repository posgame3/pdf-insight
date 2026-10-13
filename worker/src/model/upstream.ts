import { z } from 'zod';
import { AppError } from '../errors';
import { logEvent } from '../log';

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504, 529]);
const MAX_RETRY_DELAY_MS = 4_000;

export interface Transport {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

export const defaultTransport: Transport = {
  fetch: (input, init) => fetch(input, init),
  sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};

/** Both providers report errors as { error: { type | code } }; only that code is logged, never the message. */
const ErrorBodySchema = z.object({
  error: z.object({ type: z.string().optional(), code: z.union([z.string(), z.number()]).optional() }),
});

/**
 * POSTs JSON to a model API with one retry on overload or rate limiting (honouring Retry-After, capped so the
 * request stays within its deadline) and maps failures to user-safe AppErrors.
 */
export async function postJson(
  transport: Transport,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  const send = async () => {
    try {
      return await transport.fetch(url, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new AppError('ai_unavailable', { cause: error });
    }
  };

  let response = await send();
  if (RETRYABLE_STATUSES.has(response.status)) {
    await transport.sleep(retryDelayMs(response));
    response = await send();
  }
  if (!response.ok) throw await toUpstreamError(response);
  return response.json<unknown>();
}

function retryDelayMs(response: Response): number {
  const seconds = Number(response.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, MAX_RETRY_DELAY_MS) : 1_000;
}

async function toUpstreamError(response: Response): Promise<AppError> {
  const parsed = ErrorBodySchema.safeParse(await response.json().catch(() => null));
  const code = parsed.success ? String(parsed.data.error.type ?? parsed.data.error.code ?? 'unknown') : 'unknown';
  logEvent('upstream_error', { status: response.status, code });
  if (response.status === 413) return new AppError('payload_too_large');
  if (response.status === 400) return new AppError('bad_request');
  if (RETRYABLE_STATUSES.has(response.status) || response.status === 402) return new AppError('ai_unavailable');
  return new AppError('internal');
}

export function refusal(): AppError {
  logEvent('model_refusal', {});
  return new AppError('ai_invalid_response');
}
