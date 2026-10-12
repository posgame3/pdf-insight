import { API_ERROR_MESSAGES, type ApiErrorCode } from '@pdf-insight/shared';

const HTTP_STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  forbidden_origin: 403,
  not_found: 404,
  method_not_allowed: 405,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  internal: 500,
  ai_invalid_response: 502,
  ai_unavailable: 503,
  timeout: 504,
};

/** An error that is safe to show to the user: it carries only a code and a fixed Polish message. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ApiErrorCode,
    options?: ErrorOptions,
  ) {
    super(API_ERROR_MESSAGES[code], options);
    this.name = 'AppError';
    this.status = HTTP_STATUS[code];
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return new AppError('timeout', { cause: error });
  }
  return new AppError('internal', { cause: error });
}
