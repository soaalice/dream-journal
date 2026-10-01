/**
 * Security headers for the frontend. One definition used by:
 *  - the Express server when it serves the built client (SERVE_CLIENT=true),
 *  - `vite preview`,
 *  - the `_headers` file emitted at build time (Netlify, Cloudflare Pages),
 *  - docs/ (nginx example).
 *
 * The Content-Security-Policy allows exactly what the app uses: its own scripts and styles, Google Fonts, avatar images
 * from the allowed hosts, and its own API. There is no inline script and no eval. React's inline `style` attributes are
 * permitted through `style-src-attr` only.
 */

/** Hosts avatars may come from (same list the server validates, see AVATAR_HOSTS). */
const DEFAULT_AVATAR_HOSTS = ['api.dicebear.com'];

/**
 * @param {object} [options]
 * @param {string} [options.apiOrigin]   extra origin the app may call (when the API is on another domain)
 * @param {string[]} [options.avatarHosts]
 * @param {boolean} [options.production] adds HSTS and upgrade-insecure-requests (only when served over HTTPS)
 */
export const buildCsp = ({ apiOrigin = '', avatarHosts = DEFAULT_AVATAR_HOSTS, production = true } = {}) =>
  [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: ${avatarHosts.map((h) => `https://${h}`).join(' ')}`.trim(),
    `connect-src ${["'self'", apiOrigin].filter(Boolean).join(' ')}`,
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(production ? ['upgrade-insecure-requests'] : [])
  ].join('; ');

export const securityHeaders = (options = {}) => {
  const { production = true } = options;
  return {
    'Content-Security-Policy': buildCsp(options),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // The microphone is allowed for this site only (voice input); everything else is off.
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    ...(production ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {})
  };
};

/** The origin of an API URL such as "https://api.example.com/api", or "" for a relative URL like "/api". */
export const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
};

/** Netlify / Cloudflare Pages `_headers` file: security headers plus long-lived caching for hashed assets. */
export const renderHeadersFile = (options = {}) => {
  const lines = Object.entries(securityHeaders(options)).map(([name, value]) => `  ${name}: ${value}`);
  return ['/*', ...lines, '', '/assets/*', '  Cache-Control: public, max-age=31536000, immutable', ''].join('\n');
};
