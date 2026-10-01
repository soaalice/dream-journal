/**
 * Shared setup for the end-to-end tests. Each test file calls `startE2E(name)`, which connects to a throwaway
 * database (dropped by `stop`), starts the real app on a random port and returns small cookie-aware clients.
 *
 *   MONGODB_TEST_URI=mongodb://host:port npm run test:e2e    # default: mongodb://127.0.0.1:27017
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createApp } from '../../app.js';

const BASE_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017';

export const config = {
  isProd: false,
  clientOrigin: 'http://localhost:5173',
  jwtSecret: 'e2e-secret-'.padEnd(40, 'x'),
  avatarHosts: ['api.dicebear.com'],
  trustProxy: false
};

export const startE2E = async (name) => {
  const dbName = `dream-journal-e2e-${name}-${Date.now()}`;
  try {
    await mongoose.connect(BASE_URI, { dbName, serverSelectionTimeoutMS: 2000 });
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  } catch {
    return { available: false, stop: async () => {} };
  }

  const server = createApp(config).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  /** Minimal client that keeps the httpOnly session cookie, like a browser would. */
  const client = () => {
    let cookie = '';
    const call = async (method, path, body) => {
      const res = await fetch(`${baseUrl}/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: config.clientOrigin, ...(cookie && { Cookie: cookie }) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      return { status: res.status, body: await res.json().catch(() => null) };
    };
    return {
      get: (p) => call('GET', p),
      post: (p, b) => call('POST', p, b ?? {}),
      del: (p, b) => call('DELETE', p, b),
      put: (p, b) => call('PUT', p, b)
    };
  };

  const signUp = async (userName) => {
    const c = client();
    const res = await c.post('/auth/register', {
      name: userName,
      email: `${userName.toLowerCase()}@example.com`,
      password: 'password123'
    });
    assert.equal(res.status, 201, `register ${userName}`);
    return { c, id: res.body.user._id, name: userName };
  };

  return {
    available: true,
    client,
    signUp,
    stop: async () => {
      server.close();
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  };
};

export const dreamBody = (privacyLevel, extra = {}) => ({
  title: 'Flying over the sea',
  content: 'I was flying over a very calm sea.',
  privacyLevel,
  mood: 'peaceful',
  tags: ['sea'],
  ...extra
});

export const inbox = async (user) => (await user.c.get('/notifications')).body;
