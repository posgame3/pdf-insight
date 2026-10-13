import { z } from 'zod';
import { parseOrigins } from './http';
import { DEFAULT_MODELS, PROVIDERS, type Provider } from './model';
import { EFFORTS, type Effort } from './model/types';

export interface Env {
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  AI_EFFORT?: string;
  OPENROUTER_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  ANALYZE_RATE_LIMITER?: RateLimit;
}

const API_KEY_VARIABLE: Record<Provider, 'OPENROUTER_API_KEY' | 'ANTHROPIC_API_KEY'> = {
  openrouter: 'OPENROUTER_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

const ConfigSchema = z
  .object({
    AI_PROVIDER: z.enum(PROVIDERS).default('openrouter'),
    AI_MODEL: z.string().min(1).optional(),
    AI_EFFORT: z.enum(EFFORTS).default('medium'),
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    ALLOWED_ORIGINS: z.string().min(1),
  })
  .superRefine((env, context) => {
    const keyVariable = API_KEY_VARIABLE[env.AI_PROVIDER];
    if (!env[keyVariable]) context.addIssue({ code: 'custom', path: [keyVariable], message: 'missing' });
  });

export interface Config {
  provider: Provider;
  apiKey: string;
  model: string;
  effort: Effort;
  allowedOrigins: ReadonlySet<string>;
  rateLimiter: RateLimit | undefined;
  /** Kept below the browser's own timeout so the user gets a clear message instead of a dropped connection. */
  timeoutMs: number;
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; invalidKeys: string[] };

export function readConfig(env: Env): ConfigResult {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    return { ok: false, invalidKeys: parsed.error.issues.map((issue) => issue.path.join('.')) };
  }
  const provider = parsed.data.AI_PROVIDER;
  return {
    ok: true,
    config: {
      provider,
      apiKey: parsed.data[API_KEY_VARIABLE[provider]] ?? '',
      model: parsed.data.AI_MODEL ?? DEFAULT_MODELS[provider],
      effort: parsed.data.AI_EFFORT,
      allowedOrigins: parseOrigins(parsed.data.ALLOWED_ORIGINS),
      rateLimiter: env.ANALYZE_RATE_LIMITER,
      timeoutMs: 85_000,
    },
  };
}
