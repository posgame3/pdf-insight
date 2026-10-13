import { createAnthropicClient } from './anthropic';
import { createOpenRouterClient } from './openrouter';
import type { CompleteStructured, ModelSettings } from './types';

export const PROVIDERS = ['openrouter', 'anthropic'] as const;
export type Provider = (typeof PROVIDERS)[number];

export const DEFAULT_MODELS: Record<Provider, string> = {
  openrouter: 'anthropic/claude-sonnet-5.5',
  anthropic: 'claude-opus-5-5',
};

export function createModelClient(provider: Provider, settings: ModelSettings): CompleteStructured {
  return provider === 'openrouter' ? createOpenRouterClient(settings) : createAnthropicClient(settings);
}
