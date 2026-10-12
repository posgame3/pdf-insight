import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const DEV_API_URL = 'http://localhost:8787';
const PAGES_BASE = '/pdf-insight/';

/**
 * GitHub Pages cannot send response headers, so the Content Security Policy ships as a meta tag. It is added
 * to production builds only, because the dev server relies on inline scripts for hot reload.
 */
function contentSecurityPolicy(apiOrigin: string): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig(({ command }) => {
  const apiUrl = process.env.VITE_API_URL ?? (command === 'serve' ? DEV_API_URL : undefined);
  if (!apiUrl) throw new Error('Set VITE_API_URL (the Cloudflare Worker URL) for production builds.');
  const apiOrigin = new URL(apiUrl).origin;

  return {
    base: PAGES_BASE,
    plugins: [react(), contentSecurityPolicy(apiOrigin)],
    define: { __API_URL__: JSON.stringify(apiUrl.replace(/\/+$/, '')) },
    build: { target: 'es2022', sourcemap: true },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./test/setup.ts'],
    },
  };
});
