import { z } from 'zod';
import { EFFORTS } from './anthropic';
import { parseOrigins } from './http';

export interface Env {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_EFFORT?: string;
  ALLOWED_ORIGINS?: string;
  ANALYZE_RATE_LIMITER?: RateLimit;
}

const ConfigSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-opus-5-5'),
  ANTHROPIC_EFFORT: z.enum(EFFORTS).default('medium'),
  ALLOWED_ORIGINS: z.string().min(1),
});

export interface Config {
  apiKey: string;
  model: string;
  effort: (typeof EFFORTS)[number];
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
  return {
    ok: true,
    config: {
      apiKey: parsed.data.ANTHROPIC_API_KEY,
      model: parsed.data.ANTHROPIC_MODEL,
      effort: parsed.data.ANTHROPIC_EFFORT,
      allowedOrigins: parseOrigins(parsed.data.ALLOWED_ORIGINS),
      rateLimiter: env.ANALYZE_RATE_LIMITER,
      timeoutMs: 85_000,
    },
  };
}
