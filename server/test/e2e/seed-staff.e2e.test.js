import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { generatePassword, renderCredentials, seedStaff, STAFF } from '../../scripts/seed-staff.js';
import { startE2E } from './helpers.js';

let env;
before(async () => {
  env = await startE2E('seed-staff');
});
after(async () => env?.stop());

test('generated passwords are strong and satisfy the app rules', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const p = generatePassword();
    assert.equal(p.length, 20);
    assert.match(p, /[A-Za-z]/);
    assert.match(p, /\d/);
    assert.equal(/[IlO01]/.test(p), false, 'no look-alike characters');
    seen.add(p);
  }
  assert.equal(seen.size, 200, 'passwords are unique');
});

test('seeding creates the staff, is idempotent, and only resets passwords on request', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');
  const login = (email, password) => env.client().post('/auth/login', { email, password });

  const first = await seedStaff();
  assert.equal(first.length, STAFF.length);
  assert.ok(first.every((r) => r.status === 'created' && r.password));
  assert.deepEqual(first.map((r) => r.role), ['admin', 'admin', 'moderator', 'moderator']);

  // every generated credential really signs in, with the right role
  for (const r of first) {
    const res = await login(r.email, r.password);
    assert.equal(res.status, 200, r.email);
    assert.equal(res.body.user.role, r.role);
  }
  // staff can reach the panel; the admin-only screens are admin-only
  const admin = env.client();
  await admin.post('/auth/login', { email: first[0].email, password: first[0].password });
  const moderator = env.client();
  await moderator.post('/auth/login', { email: first[2].email, password: first[2].password });
  assert.equal((await admin.get('/admin/audit')).status, 200);
  assert.equal((await moderator.get('/admin/reports')).status, 200);
  assert.equal((await moderator.get('/admin/audit')).status, 404);

  // running again changes nothing and generates no passwords
  const second = await seedStaff();
  assert.ok(second.every((r) => r.status === 'existing' && !r.password));
  assert.equal((await login(first[0].email, first[0].password)).status, 200, 'the old password still works');

  // it repairs a demoted or suspended account without touching its password
  const User = (await import('../../models/User.js')).default;
  await User.updateOne({ email: first[2].email }, { role: 'user', suspendedAt: new Date(), suspensionReason: 'x' });
  await seedStaff();
  assert.equal((await login(first[2].email, first[2].password)).body.user.role, 'moderator');

  // --reset gives new working passwords and kills the old ones
  const reset = await seedStaff({ reset: true });
  assert.ok(reset.every((r) => r.status === 'reset' && r.password));
  assert.equal((await login(first[0].email, first[0].password)).status, 401);
  assert.equal((await login(reset[0].email, reset[0].password)).status, 200);
});

test('the credentials file lists new passwords only', () => {
  const md = renderCredentials([
    { role: 'admin', name: 'Admin One', email: 'a@x.test', status: 'created', password: 'Secret123Secret123ab' },
    { role: 'moderator', name: 'Mod', email: 'm@x.test', status: 'existing' }
  ]);
  assert.match(md, /Secret123Secret123ab/);
  assert.match(md, /Already existed, password unchanged/);
  assert.equal(md.includes('m@x.test` |'), false, 'existing accounts get no table row');
});
