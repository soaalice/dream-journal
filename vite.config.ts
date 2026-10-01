import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { originOf, renderHeadersFile, securityHeaders } from './security/headers.js';

/** Emits dist/_headers (Netlify, Cloudflare Pages) with the same policy the Express server applies. */
const emitHeadersFile = (apiOrigin: string): Plugin => ({
  name: 'emit-security-headers',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: renderHeadersFile({ apiOrigin, production: true }) });
  }
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // A relative VITE_API_URL ("/api") means same origin: nothing extra to allow.
  const apiOrigin = originOf(env.VITE_API_URL);

  return {
    plugins: [react(), emitHeadersFile(apiOrigin)],
    // The dev server needs inline scripts for hot reloading, so it only gets the harmless headers.
    server: { headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } },
    // `vite preview` serves the production build, so it gets the full policy (without HSTS: it runs over http).
    preview: { headers: securityHeaders({ apiOrigin, production: false }) }
  };
});
