import { AnalyzeRequestSchema, LIMITS } from '@pdf-insight/shared';
import { analyzeDocument } from './analyze';
import { createAnthropicClient, type CompleteStructured } from './anthropic';
import { readConfig, type Config, type Env } from './config';
import { AppError, toAppError } from './errors';
import { corsHeaders, emptyResponse, jsonResponse, readJsonBody } from './http';
import { logEvent } from './log';

export type { Env } from './config';

export interface Dependencies {
  createClient: (config: Config) => CompleteStructured;
}

const defaultDependencies: Dependencies = {
  createClient: (config) =>
    createAnthropicClient({ apiKey: config.apiKey, model: config.model, effort: config.effort }),
};

export async function handleRequest(
  request: Request,
  env: Env,
  deps: Dependencies = defaultDependencies,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');

  const configResult = readConfig(env);
  if (!configResult.ok) {
    logEvent('config_invalid', { keys: configResult.invalidKeys.join(',') });
    return errorResponse(new AppError('internal'), requestId, {});
  }
  const config = configResult.config;
  const cors = origin !== null && config.allowedOrigins.has(origin) ? corsHeaders(origin) : null;
  const headers = { ...cors, 'X-Request-Id': requestId };

  try {
    if (url.pathname === '/health' && request.method === 'GET') {
      return jsonResponse({ status: 'ok' }, 200, headers);
    }
    if (url.pathname !== '/analyze') throw new AppError('not_found');
    if (!cors) throw new AppError('forbidden_origin');
    if (request.method === 'OPTIONS') return emptyResponse(204, headers);
    if (request.method !== 'POST') throw new AppError('method_not_allowed');

    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (config.rateLimiter && !(await config.rateLimiter.limit({ key: clientIp })).success) {
      throw new AppError('rate_limited');
    }

    const parsed = AnalyzeRequestSchema.safeParse(await readJsonBody(request, LIMITS.maxRequestBytes));
    if (!parsed.success) {
      logEvent('request_invalid', { requestId, issues: parsed.error.issues.length });
      throw new AppError('bad_request');
    }

    const insight = await analyzeDocument(parsed.data, {
      complete: deps.createClient(config),
      model: config.model,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    logEvent('analysis_done', {
      requestId,
      pages: parsed.data.pageCount,
      scans: parsed.data.scans.length,
      ms: Date.now() - started,
    });
    return jsonResponse(insight, 200, headers);
  } catch (error) {
    const appError = toAppError(error);
    logEvent('request_failed', {
      requestId,
      code: appError.code,
      cause: appError.cause instanceof Error ? appError.cause.name : null,
      ms: Date.now() - started,
    });
    return errorResponse(appError, requestId, headers);
  }
}

function errorResponse(error: AppError, requestId: string, headers: Record<string, string>): Response {
  const retryAfter: Record<string, string> = error.code === 'rate_limited' ? { 'Retry-After': '60' } : {};
  return jsonResponse({ error: { code: error.code, message: error.message, requestId } }, error.status, {
    ...headers,
    ...retryAfter,
  });
}

export default {
  fetch: (request, env) => handleRequest(request, env),
} satisfies ExportedHandler<Env>;
