import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { securityHeaders } from '../security/headers.js';

/**
 * Serves the built frontend (`npm run build` -> dist/) from the API server, so one process and one origin serve both
 * (cookies stay first-party and CORS is not needed). Every page gets the security headers (strict CSP, no framing,
 * nosniff, ...); hashed assets are cached for a year, `index.html` never is, and unknown paths fall back to the SPA.
 *
 * Build the client with `VITE_API_URL=/api` so it calls the same origin.
 */
export const mountClient = (app, config) => {
  const dir = path.resolve(config.clientDir ?? 'dist');
  const indexFile = path.join(dir, 'index.html');
  if (!fs.existsSync(indexFile)) {
    throw new Error(`SERVE_CLIENT is on but ${indexFile} does not exist. Run "npm run build" first.`);
  }

  const headers = securityHeaders({ apiOrigin: config.apiOrigin, avatarHosts: config.avatarHosts, production: config.isProd });

  // The API has its own, stricter policy (see app.js).
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
    next();
  });

  app.use(
    express.static(dir, {
      index: false,
      dotfiles: 'ignore',
      setHeaders: (res, file) => {
        const hashed = file.split(path.sep).includes('assets');
        res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
      }
    })
  );

  // Single-page app: any other page request gets index.html and the router takes over.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || !req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });
};
