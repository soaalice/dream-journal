import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../app.js';
import { loadConfig } from '../config.js';
import { buildCsp, originOf, renderHeadersFile, securityHeaders } from '../../security/headers.js';

// ---------- the policy itself ----------

test('the CSP allows only what the app needs and forbids inline scripts, eval, framing and plugins', () => {
  const csp = buildCsp();
  const directive = (name) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

  assert.equal(directive('script-src'), "script-src 'self'");
  assert.equal(csp.includes("'unsafe-eval'"), false);
  assert.equal(directive('script-src').includes('unsafe-inline'), false, 'no inline scripts');
  assert.match(directive('style-src-attr'), /'unsafe-inline'/, 'React style attributes only');
  assert.equal(directive('style-src').includes('unsafe-inline'), false, 'no inline style blocks');
  assert.match(directive('style-src'), /https:\/\/fonts\.googleapis\.com/);
  assert.match(directive('font-src'), /https:\/\/fonts\.gstatic\.com/);
  assert.match(directive('img-src'), /https:\/\/api\.dicebear\.com/);
  assert.equal(directive('connect-src'), "connect-src 'self'");
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /upgrade-insecure-requests/);
});

test('avatar hosts and the API origin come from configuration', () => {
  const csp = buildCsp({ avatarHosts: ['cdn.example.com', 'img.example.org'], apiOrigin: 'https://api.example.com' });
  assert.match(csp, /img-src 'self' data: https:\/\/cdn\.example\.com https:\/\/img\.example\.org/);
  assert.match(csp, /connect-src 'self' https:\/\/api\.example\.com/);
  assert.equal(originOf('https://api.example.com/api'), 'https://api.example.com');
  assert.equal(originOf('/api'), '', 'a relative API url needs nothing extra');
});

test('HSTS and upgrade-insecure-requests are only for production (HTTPS)', () => {
  const dev = securityHeaders({ production: false });
  assert.equal('Strict-Transport-Security' in dev, false);
  assert.equal(dev['Content-Security-Policy'].includes('upgrade-insecure-requests'), false);
  assert.match(securityHeaders({ production: true })['Strict-Transport-Security'], /max-age=31536000/);
});

test('every response also forbids sniffing, framing and unneeded browser features', () => {
  const h = securityHeaders();
  assert.equal(h['X-Content-Type-Options'], 'nosniff');
  assert.equal(h['X-Frame-Options'], 'DENY');
  assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.match(h['Permissions-Policy'], /microphone=\(self\)/, 'voice input needs the microphone');
  assert.match(h['Permissions-Policy'], /camera=\(\)/);
  assert.equal(h['Cross-Origin-Opener-Policy'], 'same-origin');
});

test('the _headers file carries the same policy and long caching for hashed assets', () => {
  const file = renderHeadersFile({ apiOrigin: 'https://api.example.com' });
  assert.match(file, /^\/\*\n {2}Content-Security-Policy: /);
  assert.match(file, /connect-src 'self' https:\/\/api\.example\.com/);
  assert.match(file, /\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
});

test('AUTO_HIDE_REPORT_THRESHOLD: default 10, configurable, 0 disables, junk falls back', () => {
  const base = { MONGODB_URI: 'mongodb://x', JWT_SECRET: 'x'.repeat(32) };
  assert.equal(loadConfig(base).autoHideThreshold, 10);
  assert.equal(loadConfig({ ...base, AUTO_HIDE_REPORT_THRESHOLD: '25' }).autoHideThreshold, 25);
  assert.equal(loadConfig({ ...base, AUTO_HIDE_REPORT_THRESHOLD: '0' }).autoHideThreshold, 0);
  assert.equal(loadConfig({ ...base, AUTO_HIDE_REPORT_THRESHOLD: 'many' }).autoHideThreshold, 10);
  assert.equal(loadConfig({ ...base, AUTO_HIDE_REPORT_THRESHOLD: '-3' }).autoHideThreshold, 10);
  assert.equal(loadConfig({ ...base, AUTO_HIDE_REPORT_THRESHOLD: '2.5' }).autoHideThreshold, 10);
});

// ---------- serving the built client ----------

let dir;
let server;
let base;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dj-client-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>app</title><div id="root"></div>');
  fs.writeFileSync(path.join(dir, 'assets', 'index-abc123.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dir, 'theme-init.js'), '// theme');
  fs.writeFileSync(path.join(dir, '.secret'), 'nope');

  const config = {
    isProd: true,
    clientOrigin: 'https://app.example.com',
    jwtSecret: 'x'.repeat(40),
    avatarHosts: ['api.dicebear.com'],
    trustProxy: false,
    serveClient: true,
    clientDir: dir
  };
  server = createApp(config).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const get = (p, headers = {}) => fetch(`${base}${p}`, { headers: { Accept: 'text/html', ...headers } });

test('pages are served with the full set of security headers', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /id="root"/);
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.match(res.headers.get('permissions-policy'), /microphone=\(self\)/);
  assert.match(res.headers.get('strict-transport-security'), /max-age=31536000/);
  assert.equal(res.headers.get('cache-control'), 'no-cache', 'index.html is never cached');
});

test('client-side routes fall back to the app, but only for page requests', async () => {
  const deep = await get('/dream/65f000000000000000000001');
  assert.equal(deep.status, 200);
  assert.match(await deep.text(), /id="root"/);
  assert.match(deep.headers.get('content-security-policy'), /default-src 'self'/);

  const asJson = await get('/dream/1', { Accept: 'application/json' });
  assert.equal(asJson.status, 404, 'a data request for a missing file is a real 404');
});

test('hashed assets are cached for a year, other files are not', async () => {
  const asset = await get('/assets/index-abc123.js');
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal((await get('/theme-init.js')).headers.get('cache-control'), 'no-cache');
});

test('the API keeps its own locked-down policy and is never replaced by the app page', async () => {
  const res = await get('/api/nope');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { message: 'Not found' });
  assert.equal(res.headers.get('content-security-policy'), "default-src 'none'; frame-ancestors 'none'");
});

test('dotfiles and path traversal are not served', async () => {
  assert.notEqual((await get('/.secret')).headers.get('content-type')?.includes('octet'), true);
  const hidden = await get('/.secret');
  assert.equal((await hidden.text()).includes('nope'), false, 'dotfiles are ignored');
  for (const p of ['/..%2f..%2fpackage.json', '/%2e%2e/%2e%2e/package.json', '/assets/..%2f..%2f.env']) {
    const res = await get(p);
    assert.equal((await res.text()).includes('"name": "dream-journal"'), false, p);
  }
});

test('the server refuses to start in client mode without a build', () => {
  const config = { isProd: false, clientOrigin: 'http://x', jwtSecret: 'x'.repeat(40), avatarHosts: [], serveClient: true, clientDir: path.join(dir, 'missing') };
  assert.throws(() => createApp(config), /npm run build/);
});
