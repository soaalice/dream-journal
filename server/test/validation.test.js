import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchemas, escapeRegex } from '../utils/validation.js';
import { loadConfig } from '../config.js';
import { originGuard } from '../middleware/auth.js';

const schemas = buildSchemas(['api.dicebear.com']);

test('register rejects weak passwords', () => {
  const base = { name: 'Alice', email: 'A@Example.com' };
  assert.equal(schemas.register.safeParse({ ...base, password: 'short1' }).success, false);
  assert.equal(schemas.register.safeParse({ ...base, password: 'onlyletters' }).success, false);
  assert.equal(schemas.register.safeParse({ ...base, password: '12345678' }).success, false);
  const ok = schemas.register.safeParse({ ...base, password: 'goodpass123' });
  assert.equal(ok.success, true);
  assert.equal(ok.data.email, 'a@example.com');
});

test('avatar urls must be https on an allowed host', () => {
  const parse = (avatarUrl) =>
    schemas.profile.safeParse({ name: 'Alice', avatarUrl }).success;
  assert.equal(parse('https://api.dicebear.com/8.x/fun-emoji/svg?eyes=plain'), true);
  assert.equal(parse(''), true);
  assert.equal(parse('http://api.dicebear.com/x.svg'), false);
  assert.equal(parse('javascript:alert(1)'), false);
  assert.equal(parse('https://evil.example/track.png'), false);
});

test('website must be http(s)', () => {
  const parse = (website) => schemas.profile.safeParse({ name: 'Alice', website }).success;
  assert.equal(parse('https://example.com'), true);
  assert.equal(parse('javascript:alert(1)'), false);
});

test('dream schema strips unknown fields (mass assignment) and dedupes tags', () => {
  const result = schemas.dreamCreate.parse({
    title: 'T',
    content: 'long enough content',
    privacyLevel: 'public',
    mood: 'happy',
    tags: ['A', 'a', 'b'],
    userId: 'attacker',
    likes: ['x']
  });
  assert.equal('userId' in result, false);
  assert.equal('likes' in result, false);
  assert.deepEqual(result.tags, ['a', 'b']);
});

test('dream schema rejects too many tags and bad mentions', () => {
  const base = { title: 'T', content: 'long enough content', privacyLevel: 'public', mood: 'happy' };
  assert.equal(schemas.dreamCreate.safeParse({ ...base, tags: Array(11).fill('x').map((t, i) => t + i) }).success, false);
  assert.equal(schemas.dreamCreate.safeParse({ ...base, mentions: ['not-an-id'] }).success, false);
});

test('feed query is coerced and bounded; operator objects are rejected', () => {
  assert.equal(schemas.feedQuery.parse({}).limit, 10);
  assert.equal(schemas.feedQuery.safeParse({ limit: '100000' }).success, false);
  assert.equal(schemas.feedQuery.safeParse({ tag: { $ne: 'x' } }).success, false);
  assert.deepEqual(schemas.feedQuery.parse({ tag: 'Sea, sky' }).tag, ['sea', 'sky']);
  assert.deepEqual(schemas.feedQuery.parse({ mood: 'happy,sad' }).mood, ['happy', 'sad']);
  assert.equal(schemas.feedQuery.safeParse({ mood: 'nope' }).success, false);
});

test('escapeRegex neutralises regex metacharacters', () => {
  assert.equal(escapeRegex('(a+)+$'), '\\(a\\+\\)\\+\\$');
});

test('config refuses to start without a strong JWT secret', () => {
  assert.throws(() => loadConfig({ MONGODB_URI: 'mongodb://x' }));
  assert.throws(() => loadConfig({ MONGODB_URI: 'mongodb://x', JWT_SECRET: 'short' }));
  assert.ok(loadConfig({ MONGODB_URI: 'mongodb://x', JWT_SECRET: 'x'.repeat(32) }));
});

test('originGuard blocks cross-origin state changes only', () => {
  const guard = originGuard('http://localhost:5173');
  const run = (method, origin) => {
    let status = 200;
    let nexted = false;
    const res = { status: (s) => ((status = s), { json: () => {} }) };
    guard({ method, headers: { origin } }, res, () => (nexted = true));
    return { status, nexted };
  };
  assert.equal(run('POST', 'https://evil.example').nexted, false);
  assert.equal(run('POST', 'https://evil.example').status, 403);
  assert.equal(run('POST', 'http://localhost:5173').nexted, true);
  assert.equal(run('GET', 'https://evil.example').nexted, true);
});
