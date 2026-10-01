/**
 * End-to-end tests (real MongoDB, throwaway database) for the admin panel API: access control, the report queue,
 * case details, resolution actions, suspension, and the audit log.  Run with `npm run test:e2e`.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import AuditLog from '../../models/AuditLog.js';
import Report from '../../models/Report.js';
import { setRole } from '../../scripts/make-admin.js';
import { config, dreamBody, startE2E } from './helpers.js';

let env;
before(async () => {
  env = await startE2E('admin');
});
after(async () => env?.stop());

const feedIds = async (user) => (await user.c.get('/dreams/feed?limit=50')).body.dreams.map((d) => d._id);

const makeAdmin = async (name) => {
  const user = await env.signUp(name);
  await setRole(`${name.toLowerCase()}@example.com`, 'admin');
  // sign in again: the role is read from the database on every request, but the session cookie lifetime depends on it
  const admin = env.client();
  const res = await admin.post('/auth/login', { email: `${name.toLowerCase()}@example.com`, password: 'password123' });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.role, 'admin');
  return { ...user, c: admin };
};

const report = (user, dreamId, reason = 'spam', commentId) =>
  user.c.post(commentId ? `/dreams/${dreamId}/comments/${commentId}/report` : `/dreams/${dreamId}/report`, { reason, details: `because ${reason}` });

test('admin panel', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');

  const admin = await makeAdmin('Moderator');
  const alice = await env.signUp('Admin-Alice');
  const bob = await env.signUp('Admin-Bobby');
  const cara = await env.signUp('Admin-Cara');

  await t.test('only administrators can reach the admin API (everyone else sees a 404)', async () => {
    const anonymous = env.client();
    for (const path of ['/admin/summary', '/admin/reports', '/admin/users/suspended', '/admin/audit']) {
      assert.equal((await anonymous.get(path)).status, 401, `${path} signed out`);
      assert.equal((await alice.c.get(path)).status, 404, `${path} as a user`);
      assert.equal((await admin.c.get(path)).status, 200, `${path} as admin`);
    }
    assert.equal((await alice.c.post('/admin/reports/resolve', { dreamId: '65f000000000000000000001', resolution: 'dismissed' })).status, 404);
    assert.equal((await alice.c.post(`/admin/users/${bob.id}/unsuspend`)).status, 404);
  });

  await t.test('the role cannot be set through the public API', async () => {
    const sneaky = await env.client().post('/auth/register', {
      name: 'Sneaky',
      email: 'sneaky@example.com',
      password: 'password123',
      role: 'admin'
    });
    assert.equal(sneaky.body.user.role, 'user');
    const me = env.client();
    await me.post('/auth/login', { email: 'sneaky@example.com', password: 'password123' });
    await me.put('/users/profile', { name: 'Sneaky', role: 'admin', bio: '' });
    assert.equal((await me.get('/admin/summary')).status, 404);
    assert.equal((await me.get('/auth/me')).body.user.role, 'user');
  });

  await t.test('admin sessions are shorter than normal ones', async () => {
    const cookieOf = async (email) => {
      const res = await fetch(`${env.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: config.clientOrigin },
        body: JSON.stringify({ email, password: 'password123' })
      });
      return res.headers.get('set-cookie');
    };
    assert.match(await cookieOf('moderator@example.com'), /Max-Age=43200/i);
    assert.match(await cookieOf('admin-alice@example.com'), /Max-Age=604800/i);
  });

  await t.test('revoking admin rights takes effect immediately, even for an open session', async () => {
    const temp = await makeAdmin('Temp-Admin');
    assert.equal((await temp.c.get('/admin/summary')).status, 200);
    await setRole('temp-admin@example.com', 'user');
    assert.equal((await temp.c.get('/admin/summary')).status, 404);
  });

  // ---- shared fixtures for the next tests ----
  const dream = (await alice.c.post('/dreams', dreamBody('public', { title: 'Reported dream', content: 'Something reportable happened.' }))).body;
  const comment = (await bob.c.post(`/dreams/${dream._id}/comments`, { content: 'a rude comment' })).body.comments[0];

  await t.test('the queue groups reports by content and puts the most reported first', async () => {
    await report(bob, dream._id, 'spam');
    await report(cara, dream._id, 'harassment');
    await report(cara, dream._id, 'spam', comment._id);

    const queue = (await admin.c.get('/admin/reports')).body;
    assert.equal(queue.total, 2);
    const [first, second] = queue.cases;
    assert.equal(first.targetType, 'dream');
    assert.equal(first.reportCount, 2);
    assert.deepEqual(first.reasons, { spam: 1, harassment: 1 });
    assert.equal(first.authorName, 'Admin-Alice');
    assert.equal(first.title, 'Reported dream');
    assert.equal(first.contentExists, true);
    assert.equal(second.targetType, 'comment');
    assert.equal(second.authorName, 'Admin-Bobby');
    assert.match(second.excerpt, /rude comment/);

    assert.equal((await admin.c.get('/admin/reports?type=comment')).body.total, 1);
    assert.equal((await admin.c.get('/admin/reports?reason=harassment')).body.total, 1);
    assert.equal((await admin.c.get('/admin/reports?status=reviewed')).body.total, 0);
    assert.equal((await admin.c.get('/admin/reports?status=all')).body.total, 2);
    assert.equal((await admin.c.get('/admin/reports?status=bogus')).status, 400);
    assert.equal((await admin.c.get('/admin/reports?limit=500')).status, 400);

    const paged = (await admin.c.get('/admin/reports?limit=1')).body;
    assert.equal(paged.cases.length, 1);
    assert.equal(paged.hasMore, true);
    assert.notEqual((await admin.c.get('/admin/reports?limit=1&page=2')).body.cases[0].key, paged.cases[0].key);

    assert.equal((await admin.c.get('/admin/summary')).body.open, 2);
  });

  await t.test('a case shows the reports, the author and their history', async () => {
    const detail = (await admin.c.get(`/admin/reports/case?dreamId=${dream._id}`)).body;
    assert.equal(detail.target.type, 'dream');
    assert.equal(detail.target.content, 'Something reportable happened.');
    assert.equal(detail.target.anonymous, false);
    assert.equal(detail.author.name, 'Admin-Alice');
    assert.equal(detail.author.email, 'admin-alice@example.com');
    assert.equal(detail.author.suspended, false);
    assert.deepEqual(detail.reports.map((r) => r.reporter.name).sort(), ['Admin-Bobby', 'Admin-Cara']);
    assert.ok(detail.reports.every((r) => r.status === 'open'));

    const forComment = (await admin.c.get(`/admin/reports/case?dreamId=${dream._id}&commentId=${comment._id}`)).body;
    assert.equal(forComment.target.type, 'comment');
    assert.equal(forComment.target.content, 'a rude comment');
    assert.equal(forComment.author.name, 'Admin-Bobby');

    assert.equal((await admin.c.get('/admin/reports/case?dreamId=65f000000000000000000001')).status, 404);
    assert.equal((await admin.c.get('/admin/reports/case')).status, 400);
    assert.equal((await alice.c.get(`/admin/reports/case?dreamId=${dream._id}`)).status, 404);
  });

  await t.test('opening the real author of an anonymous dream is recorded in the audit log', async () => {
    const anon = (await alice.c.post('/dreams', dreamBody('anonymous', { title: 'Hidden author' }))).body;
    await report(bob, anon._id, 'other');

    // the community never sees the author...
    assert.equal((await bob.c.get(`/dreams/${anon._id}`)).body.userId, null);
    // ...moderators can, and it is logged
    const before = await AuditLog.countDocuments({ action: 'viewed_anonymous_author' });
    const detail = (await admin.c.get(`/admin/reports/case?dreamId=${anon._id}`)).body;
    assert.equal(detail.target.anonymous, true);
    assert.equal(detail.author.name, 'Admin-Alice');
    assert.equal(await AuditLog.countDocuments({ action: 'viewed_anonymous_author' }), before + 1);

    await admin.c.post('/admin/reports/resolve', { dreamId: anon._id, resolution: 'dismissed' });
  });

  await t.test('dismissing closes the case without touching the content', async () => {
    const res = await admin.c.post('/admin/reports/resolve', {
      dreamId: dream._id,
      commentId: comment._id,
      resolution: 'dismissed',
      note: 'just an opinion'
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { resolvedReports: 1, removed: false, restored: false, suspended: false });

    assert.equal((await admin.c.get('/admin/reports')).body.total, 1);
    const dismissed = (await admin.c.get('/admin/reports?status=dismissed')).body;
    assert.equal(dismissed.total >= 1, true);
    assert.equal((await alice.c.get(`/dreams/${dream._id}`)).body.comments.length, 1, 'the comment is still there');

    const detail = (await admin.c.get(`/admin/reports/case?dreamId=${dream._id}&commentId=${comment._id}`)).body;
    assert.equal(detail.reports[0].status, 'dismissed');
    assert.equal(detail.reports[0].resolvedBy, 'Moderator');
    assert.equal(detail.reports[0].resolutionNote, 'just an opinion');

    // nothing left to resolve
    assert.equal((await admin.c.post('/admin/reports/resolve', { dreamId: dream._id, commentId: comment._id, resolution: 'dismissed' })).status, 404);
  });

  await t.test('invalid resolutions are rejected', async () => {
    const body = { dreamId: dream._id, resolution: 'dismissed' };
    assert.equal((await admin.c.post('/admin/reports/resolve', { ...body, removeContent: true })).status, 400);
    assert.equal((await admin.c.post('/admin/reports/resolve', { ...body, suspendAuthor: true })).status, 400);
    assert.equal((await admin.c.post('/admin/reports/resolve', { dreamId: dream._id, resolution: 'reviewed', suspendAuthor: true })).status, 400, 'a reason is required');
    assert.equal((await admin.c.post('/admin/reports/resolve', { dreamId: 'nope', resolution: 'reviewed' })).status, 400);
    assert.equal((await admin.c.post('/admin/reports/resolve', { dreamId: dream._id, resolution: 'archived' })).status, 400);
    assert.equal((await admin.c.get('/admin/reports?status=open')).body.total, 1, 'nothing changed');
  });

  await t.test('removing a comment keeps the thread readable and records what was removed', async () => {
    const thread = (await alice.c.post('/dreams', dreamBody('public', { title: 'Thread dream' }))).body;
    const parent = (await bob.c.post(`/dreams/${thread._id}/comments`, { content: 'offensive parent' })).body.comments[0];
    await cara.c.post(`/dreams/${thread._id}/comments`, { content: 'innocent reply', parentId: parent._id });
    await report(cara, thread._id, 'hate', parent._id);

    const res = await admin.c.post('/admin/reports/resolve', {
      dreamId: thread._id,
      commentId: parent._id,
      resolution: 'reviewed',
      removeContent: true,
      note: 'hate speech'
    });
    assert.deepEqual(res.body, { resolvedReports: 1, removed: true, restored: false, suspended: false });

    const after = (await alice.c.get(`/dreams/${thread._id}`)).body;
    const placeholder = after.comments.find((c) => c._id === parent._id);
    assert.equal(placeholder.deleted, true, 'a placeholder keeps the reply attached');
    assert.equal(after.comments.length, 2);
    assert.equal(JSON.stringify(after).includes('offensive parent'), false);

    const entry = await AuditLog.findOne({ action: 'content_removed', commentId: parent._id });
    assert.equal(entry.snapshot.content, 'offensive parent');
    assert.equal(entry.note, 'hate speech');
    assert.equal(String(entry.targetUserId), bob.id);
  });

  await t.test('removing a dream and suspending its author', async () => {
    const own = (await alice.c.post('/dreams', dreamBody('public', { title: 'Still fine' }))).body;
    assert.ok((await feedIds(bob)).includes(own._id));

    const res = await admin.c.post('/admin/reports/resolve', {
      dreamId: dream._id,
      resolution: 'reviewed',
      removeContent: true,
      suspendAuthor: true,
      suspensionReason: 'Repeated harassment',
      note: 'second strike'
    });
    assert.deepEqual(res.body, { resolvedReports: 2, removed: true, restored: false, suspended: true });
    assert.equal((await bob.c.get(`/dreams/${dream._id}`)).status, 404, 'the dream was deleted');

    // the suspended user is locked out immediately, even with an open session
    const locked = await alice.c.get('/auth/me');
    assert.equal(locked.status, 401);
    assert.equal(locked.body.code, 'suspended');
    assert.equal((await alice.c.post('/dreams', dreamBody('public'))).status, 401);

    // and cannot sign in again (only someone who knows the password learns why)
    const login = await env.client().post('/auth/login', { email: 'admin-alice@example.com', password: 'password123' });
    assert.equal(login.status, 403);
    assert.equal(login.body.code, 'suspended');
    assert.equal(login.body.reason, 'Repeated harassment');
    assert.equal((await env.client().post('/auth/login', { email: 'admin-alice@example.com', password: 'wrong-password1' })).status, 401);

    // their remaining content disappears for everybody, signed in or not
    assert.equal((await bob.c.get(`/dreams/${own._id}`)).status, 404);
    assert.equal((await feedIds(bob)).includes(own._id), false);
    assert.equal((await feedIds({ c: env.client() })).includes(own._id), false);

    const suspended = (await admin.c.get('/admin/users/suspended')).body;
    assert.deepEqual(suspended.users.map((u) => [u.name, u.suspensionReason]), [['Admin-Alice', 'Repeated harassment']]);
    assert.equal((await admin.c.get('/admin/summary')).body.suspendedUsers, 1);

    // unsuspending restores access and visibility
    assert.equal((await admin.c.post(`/admin/users/${alice.id}/unsuspend`)).status, 200);
    assert.equal((await admin.c.post(`/admin/users/${alice.id}/unsuspend`)).status, 404, 'already active');
    assert.equal((await env.client().post('/auth/login', { email: 'admin-alice@example.com', password: 'password123' })).status, 200);
    assert.ok((await feedIds(bob)).includes(own._id));
    assert.equal((await admin.c.get('/admin/summary')).body.suspendedUsers, 0);
  });

  await t.test('administrators cannot be removed or suspended through reports', async () => {
    const other = await makeAdmin('Other-Admin');
    const adminDream = (await other.c.post('/dreams', dreamBody('public', { title: 'Admin dream' }))).body;
    await report(bob, adminDream._id, 'spam');

    const res = await admin.c.post('/admin/reports/resolve', {
      dreamId: adminDream._id,
      resolution: 'reviewed',
      suspendAuthor: true,
      suspensionReason: 'power grab'
    });
    assert.equal(res.status, 400);
    assert.equal((await other.c.get('/auth/me')).status, 200);
    // dismissing is still fine
    assert.equal((await admin.c.post('/admin/reports/resolve', { dreamId: adminDream._id, resolution: 'dismissed' })).status, 200);
  });

  await t.test('the evidence survives the author deleting the content', async () => {
    const doomed = (await cara.c.post('/dreams', dreamBody('public', { title: 'Soon deleted', content: 'evidence of something' }))).body;
    await report(bob, doomed._id, 'violence');
    await cara.c.del(`/dreams/${doomed._id}`);

    const queue = (await admin.c.get('/admin/reports')).body;
    const entry = queue.cases.find((c) => c.dreamId === doomed._id);
    assert.equal(entry.contentExists, false);
    assert.equal(entry.title, 'Soon deleted');
    assert.match(entry.excerpt, /evidence of something/);

    const detail = (await admin.c.get(`/admin/reports/case?dreamId=${doomed._id}`)).body;
    assert.equal(detail.target.exists, false);
    assert.equal(detail.target.content, 'evidence of something');
    assert.equal(detail.author.name, 'Admin-Cara');

    // removing something that is already gone is harmless
    const res = await admin.c.post('/admin/reports/resolve', { dreamId: doomed._id, resolution: 'reviewed', removeContent: true });
    assert.deepEqual(res.body, { resolvedReports: 1, removed: false, restored: false, suspended: false });
  });

  await t.test('every action is in the append-only audit log', async () => {
    const log = (await admin.c.get('/admin/audit?limit=50')).body;
    const actions = log.entries.map((e) => e.action);
    for (const expected of ['report_dismissed', 'report_reviewed', 'content_removed', 'user_suspended', 'user_unsuspended', 'viewed_anonymous_author']) {
      assert.ok(actions.includes(expected), `missing ${expected}`);
    }
    assert.ok(log.entries.every((e) => e.admin === 'Moderator' || e.admin === 'Other-Admin'));
    const suspension = log.entries.find((e) => e.action === 'user_suspended');
    assert.equal(suspension.targetUser, 'Admin-Alice');
    assert.equal(suspension.note, 'Repeated harassment');
    // newest first
    const dates = log.entries.map((e) => new Date(e.createdAt).getTime());
    assert.deepEqual(dates, [...dates].sort((a, b) => b - a));

    assert.equal((await admin.c.get('/admin/audit?limit=2')).body.hasMore, true);
    // there is no way to change or delete an entry through the API
    for (const method of ['put', 'del']) {
      assert.equal((await admin.c[method](`/admin/audit/${log.entries[0]._id}`)).status, 404);
    }
  });

  assert.ok((await Report.countDocuments()) > 0);
});

test('moderator role', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');

  const staff = async (name, role) => {
    const user = await env.signUp(name);
    await setRole(`${name.toLowerCase()}@example.com`, role);
    const c = env.client();
    assert.equal((await c.post('/auth/login', { email: `${name.toLowerCase()}@example.com`, password: 'password123' })).body.user.role, role);
    return { ...user, c };
  };

  const chief = await staff('Role-Chief', 'admin');
  const mia = await staff('Role-Mia', 'moderator');
  const max = await staff('Role-Max', 'moderator');
  const rita = await env.signUp('Role-Rita');
  const sam = await env.signUp('Role-Sam');

  const samsDream = (await sam.c.post('/dreams', dreamBody('public', { title: 'Sam dream', content: 'content that gets reported' }))).body;
  await report(rita, samsDream._id, 'spam');

  await t.test('moderators reach the queue and cases, but not the admin-only screens', async () => {
    for (const path of ['/admin/summary', '/admin/reports']) assert.equal((await mia.c.get(path)).status, 200, path);
    for (const path of ['/admin/users/suspended', '/admin/audit']) {
      assert.equal((await mia.c.get(path)).status, 404, `${path} is for administrators`);
      assert.equal((await chief.c.get(path)).status, 200);
    }
    assert.equal((await mia.c.post(`/admin/users/${sam.id}/unsuspend`)).status, 404);
  });

  await t.test('moderators do not see contact details, administrators do', async () => {
    const asMod = (await mia.c.get(`/admin/reports/case?dreamId=${samsDream._id}`)).body;
    assert.equal(asMod.author.name, 'Role-Sam');
    assert.equal(asMod.author.email, null);
    assert.equal(JSON.stringify(asMod).includes('role-sam@example.com'), false);
    assert.equal((await chief.c.get(`/admin/reports/case?dreamId=${samsDream._id}`)).body.author.email, 'role-sam@example.com');
  });

  await t.test('moderators cannot suspend, but can remove content', async () => {
    const suspend = await mia.c.post('/admin/reports/resolve', {
      dreamId: samsDream._id,
      resolution: 'reviewed',
      suspendAuthor: true,
      suspensionReason: 'not allowed'
    });
    assert.equal(suspend.status, 403);
    assert.equal((await sam.c.get('/auth/me')).status, 200, 'nobody was suspended');
    assert.equal((await chief.c.get('/admin/reports?status=open')).body.cases.some((c) => c.dreamId === samsDream._id), true, 'and the case is still open');

    const remove = await mia.c.post('/admin/reports/resolve', { dreamId: samsDream._id, resolution: 'reviewed', removeContent: true, note: 'spam' });
    assert.deepEqual(remove.body, { resolvedReports: 1, removed: true, restored: false, suspended: false });
    assert.equal((await rita.c.get(`/dreams/${samsDream._id}`)).status, 404);
  });

  await t.test('moderators cannot act on staff content (administrators can act on moderators)', async () => {
    const adminDream = (await chief.c.post('/dreams', dreamBody('public', { title: 'Chief dream' }))).body;
    const modDream = (await mia.c.post('/dreams', dreamBody('public', { title: 'Mia dream' }))).body;
    await report(rita, adminDream._id);
    await report(rita, modDream._id);

    assert.equal((await max.c.post('/admin/reports/resolve', { dreamId: adminDream._id, resolution: 'reviewed', removeContent: true })).status, 400, 'admins are untouchable');
    assert.equal((await max.c.post('/admin/reports/resolve', { dreamId: modDream._id, resolution: 'reviewed', removeContent: true })).status, 403, 'a moderator cannot remove a moderator');
    assert.equal((await max.c.post('/admin/reports/resolve', { dreamId: modDream._id, resolution: 'dismissed' })).status, 200, 'but can dismiss');
    await report(sam, modDream._id, 'hate'); // a new report reopens it
    assert.equal((await chief.c.post('/admin/reports/resolve', { dreamId: modDream._id, resolution: 'reviewed', removeContent: true })).body.removed, true);
  });

  await t.test('staff sessions are short, and the log names the moderator', async () => {
    const res = await fetch(`${env.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: config.clientOrigin },
      body: JSON.stringify({ email: 'role-mia@example.com', password: 'password123' })
    });
    assert.match(res.headers.get('set-cookie'), /Max-Age=43200/i);

    const log = (await chief.c.get('/admin/audit?limit=50')).body.entries;
    assert.ok(log.some((e) => e.admin === 'Role-Mia' && e.action === 'content_removed'));
  });

  await t.test('revoking the moderator role is immediate', async () => {
    await setRole('role-max@example.com', 'user');
    assert.equal((await max.c.get('/admin/reports')).status, 404);
    assert.equal((await max.c.get('/auth/me')).body.user.role, 'user');
  });
});
