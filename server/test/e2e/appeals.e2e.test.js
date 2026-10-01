/**
 * End-to-end tests (real MongoDB, throwaway database) for what authors are told, appeals, auto-hiding and staff
 * management.  Run with `npm run test:e2e`.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import Appeal from '../../models/Appeal.js';
import AuditLog from '../../models/AuditLog.js';
import User from '../../models/User.js';
import { setRole } from '../../scripts/make-admin.js';
import { dreamBody, inbox, startE2E } from './helpers.js';

let env;
before(async () => {
  env = await startE2E('appeals');
});
after(async () => env?.stop());

const feedIds = async (user) => (await user.c.get('/dreams/feed?limit=50')).body.dreams.map((d) => d._id);
const report = (user, dreamId, reason = 'spam', commentId) =>
  user.c.post(commentId ? `/dreams/${dreamId}/comments/${commentId}/report` : `/dreams/${dreamId}/report`, { reason });

const staff = async (name, role) => {
  const user = await env.signUp(name);
  await setRole(`${name.toLowerCase()}@example.com`, role);
  const c = env.client();
  await c.post('/auth/login', { email: `${name.toLowerCase()}@example.com`, password: 'password123' });
  return { ...user, c };
};

const moderationNotice = async (user, event) =>
  (await inbox(user)).notifications.find((n) => n.type === 'moderation' && n.moderation.event === event);

test('moderator decisions, notices and appeals', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');

  const chief = await staff('Appeal-Chief', 'admin');
  const mia = await staff('Appeal-Mia', 'moderator');
  const max = await staff('Appeal-Max', 'moderator');
  const author = await env.signUp('Appeal-Author');
  const reporter = await env.signUp('Appeal-Reporter');
  const bystander = await env.signUp('Appeal-Bystander');

  const dream = (await author.c.post('/dreams', dreamBody('public', { title: 'Taken down', content: 'text that gets removed' }))).body;

  await t.test('removing content tells the author why, without revealing who reported it', async () => {
    await report(reporter, dream._id, 'harassment');
    const res = await mia.c.post('/admin/reports/resolve', {
      dreamId: dream._id,
      resolution: 'reviewed',
      removeContent: true,
      authorMessage: 'It targets another member.',
      note: 'internal: clear violation'
    });
    assert.equal(res.body.removed, true);

    // nobody else can see it any more, but nothing was deleted
    assert.equal((await bystander.c.get(`/dreams/${dream._id}`)).status, 404);
    assert.equal((await feedIds(bystander)).includes(dream._id), false);
    assert.equal((await author.c.post(`/dreams/${dream._id}/comments`, { content: 'talking to myself' })).status, 400);

    // the author still sees it, marked as removed
    const own = (await author.c.get(`/dreams/${dream._id}`)).body;
    assert.equal(own.moderation.state, 'removed');
    assert.equal(own.moderation.message, 'It targets another member.');

    const notice = await moderationNotice(author, 'removed');
    assert.equal(notice.moderation.kind, 'dream');
    assert.equal(notice.moderation.title, 'Taken down');
    assert.match(notice.moderation.excerpt, /text that gets removed/);
    assert.equal(notice.moderation.message, 'It targets another member.');
    assert.deepEqual(notice.moderation.reasons, ['harassment']);
    assert.equal(notice.moderation.canAppeal, true);
    const raw = JSON.stringify(notice);
    assert.equal(raw.includes('Appeal-Reporter'), false, 'the reporter is never named');
    assert.equal(raw.includes('internal: clear violation'), false, 'the internal note stays internal');
    assert.equal((await author.c.get('/notifications/unread-count')).body.unreadCount >= 1, true);
  });

  await t.test('an appeal can only be made by the author, once, with a real message', async () => {
    const notice = await moderationNotice(author, 'removed');
    const appeal = (body, who = author) => who.c.post('/appeals', body);
    assert.equal((await appeal({ notificationId: notice._id, message: 'short' })).status, 400);
    assert.equal((await appeal({ notificationId: notice._id, message: 'a long enough explanation' }, bystander)).status, 404);
    assert.equal((await appeal({ notificationId: 'nope', message: 'a long enough explanation' })).status, 400);
    assert.equal((await env.client().post('/appeals', { notificationId: notice._id, message: 'a long enough explanation' })).status, 401);

    const ok = await appeal({ notificationId: notice._id, message: 'This was a dream about my own fears, not about a person.' });
    assert.equal(ok.status, 201);
    assert.equal((await appeal({ notificationId: notice._id, message: 'trying a second time please' })).status, 409);

    const after = await moderationNotice(author, 'removed');
    assert.equal(after.moderation.canAppeal, false);
    assert.equal(after.moderation.appeal.status, 'open');
  });

  await t.test('staff are notified of the appeal, except the moderator whose decision it is, and can filter their inbox', async () => {
    const appealsOf = async (u, query = '') => (await u.c.get(`/notifications?group=appeals${query}`)).body;

    const forMax = await appealsOf(max);
    assert.equal(forMax.notifications.length, 1);
    const n = forMax.notifications[0];
    assert.equal(n.type, 'appeal');
    assert.equal(n.appeal.authorName, 'Appeal-Author');
    assert.equal(n.appeal.targetType, 'dream');
    assert.equal(n.appeal.title, 'Taken down');
    assert.equal(n.appeal.status, 'open');
    assert.equal(forMax.unreadAppeals, 1);
    assert.equal((await appealsOf(chief)).notifications.length, 1, 'administrators are told too');
    assert.equal((await appealsOf(mia)).notifications.length, 0, 'not the moderator who decided');

    // filters: activity excludes appeals, unread narrows, ordinary people never see appeal notices
    assert.equal((await max.c.get('/notifications?group=activity')).body.notifications.some((x) => x.type === 'appeal'), false);
    assert.equal((await appealsOf(max, '&unread=1')).notifications.length, 1);
    assert.equal((await inbox(author)).notifications.some((x) => x.type === 'appeal'), false);
    assert.equal((await author.c.get('/notifications?group=appeals')).body.notifications.length, 0);
    assert.equal((await max.c.get('/notifications?group=nope')).status, 400);
  });

  await t.test('staff see open appeals; the moderator who decided cannot decide it, another one can', async () => {
    assert.equal((await chief.c.get('/admin/summary')).body.openAppeals, 1);
    const list = (await max.c.get('/admin/appeals')).body;
    assert.equal(list.total, 1);
    assert.equal(list.appeals[0].authorName, 'Appeal-Author');
    assert.equal(list.appeals[0].title, 'Taken down');
    const id = list.appeals[0]._id;

    const detail = (await mia.c.get(`/admin/appeals/${id}`)).body;
    assert.equal(detail.appeal.decidedBy, 'Appeal-Mia');
    assert.equal(detail.appeal.decidedByMe, true);
    assert.equal(detail.content.moderationState, 'removed');
    assert.deepEqual(detail.target, { dreamId: dream._id, commentId: null }, 'staff can open the concerned content as a case');
    assert.equal(detail.context, null);
    const theCase = (await mia.c.get(`/admin/reports/case?dreamId=${dream._id}`)).body;
    assert.equal(theCase.appeal.status, 'open', 'the case shows the appeal');
    assert.deepEqual(detail.reasons, ['harassment']);
    assert.equal(detail.author.email, null, 'moderators do not see emails');
    assert.equal((await chief.c.get(`/admin/appeals/${id}`)).body.author.email, 'appeal-author@example.com');

    assert.equal((await mia.c.post(`/admin/appeals/${id}/decide`, { decision: 'overturned' })).status, 403, 'not your own decision');
    assert.equal((await author.c.get('/admin/appeals')).status, 404);

    const res = await max.c.post(`/admin/appeals/${id}/decide`, {
      decision: 'overturned',
      note: 'context makes it fine',
      message: 'Sorry about that, it is visible again.'
    });
    assert.deepEqual(res.body, { status: 'overturned', restored: true, unsuspended: false });
    const done = (await max.c.get('/notifications?group=appeals')).body;
    assert.equal(done.unreadAppeals, 0, 'deciding clears the staff notification');
    assert.equal(done.notifications[0].appeal.status, 'overturned');
    assert.equal((await max.c.post(`/admin/appeals/${id}/decide`, { decision: 'upheld' })).status, 404, 'decided already');

    // restored: visible to everyone again, and the author is told
    assert.equal((await bystander.c.get(`/dreams/${dream._id}`)).status, 200);
    assert.ok((await feedIds(bystander)).includes(dream._id));
    assert.equal((await author.c.get(`/dreams/${dream._id}`)).body.moderation, null);
    const notice = await moderationNotice(author, 'appeal_overturned');
    assert.equal(notice.moderation.message, 'Sorry about that, it is visible again.');
    assert.equal((await chief.c.get('/admin/summary')).body.openAppeals, 0);

    const logged = await AuditLog.find({ action: { $in: ['appeal_overturned', 'content_removed'] } });
    assert.equal(logged.length, 2);
  });

  await t.test('an upheld appeal leaves the content removed and says so', async () => {
    const other = (await author.c.post('/dreams', dreamBody('public', { title: 'Second one', content: 'another removed text' }))).body;
    await report(reporter, other._id, 'hate');
    await mia.c.post('/admin/reports/resolve', { dreamId: other._id, resolution: 'reviewed', removeContent: true });
    const notice = await moderationNotice(author, 'removed');
    assert.equal(notice.moderation.message, 'It breaks our community guidelines.', 'a default message when none is given');
    await author.c.post('/appeals', { notificationId: notice._id, message: 'I really think this is a misunderstanding.' });

    const id = (await chief.c.get('/admin/appeals')).body.appeals[0]._id;
    const res = await chief.c.post(`/admin/appeals/${id}/decide`, { decision: 'upheld' });
    assert.deepEqual(res.body, { status: 'upheld', restored: false, unsuspended: false });
    assert.equal((await bystander.c.get(`/dreams/${other._id}`)).status, 404);
    assert.equal((await moderationNotice(author, 'appeal_upheld')).moderation.message, 'The original decision stands.');
    assert.equal((await chief.c.get('/admin/appeals?status=upheld')).body.total, 1);
    assert.equal((await chief.c.get('/admin/appeals?status=all')).body.total, 2);
  });

  await t.test('removed comments are explained to their author and can be appealed too', async () => {
    const d = (await bystander.c.post('/dreams', dreamBody('public', { title: 'Comment host' }))).body;
    const c = (await author.c.post(`/dreams/${d._id}/comments`, { content: 'a comment that gets removed' })).body.comments[0];
    await report(reporter, d._id, 'spam', c._id);
    await mia.c.post('/admin/reports/resolve', { dreamId: d._id, commentId: c._id, resolution: 'reviewed', removeContent: true });

    // everyone else sees nothing; the author still sees it, flagged
    assert.equal((await bystander.c.get(`/dreams/${d._id}`)).body.comments.length, 0);
    const mine = (await author.c.get(`/dreams/${d._id}`)).body.comments[0];
    assert.equal(mine.moderation.state, 'removed');

    const notice = await moderationNotice(author, 'removed');
    assert.equal(notice.moderation.kind, 'comment');
    assert.equal((await author.c.post('/appeals', { notificationId: notice._id, message: 'It was a genuine compliment, honestly.' })).status, 201);
    const id = (await chief.c.get('/admin/appeals')).body.appeals[0]._id;
    assert.equal((await max.c.post(`/admin/appeals/${id}/decide`, { decision: 'overturned' })).body.restored, true);
    assert.equal((await bystander.c.get(`/dreams/${d._id}`)).body.comments.length, 1);
  });

  await t.test('content deleted by its author can no longer be appealed', async () => {
    const d = (await author.c.post('/dreams', dreamBody('public', { title: 'Will be deleted' }))).body;
    await report(reporter, d._id, 'spam');
    await mia.c.post('/admin/reports/resolve', { dreamId: d._id, resolution: 'reviewed', removeContent: true });
    const notice = await moderationNotice(author, 'removed');
    await author.c.del(`/dreams/${d._id}`);
    assert.equal((await author.c.post('/appeals', { notificationId: notice._id, message: 'appealing something I deleted' })).status, 400);
  });
});

test('suspension appeals', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');
  const chief = await staff('Susp-Chief', 'admin');
  const mod = await staff('Susp-Mod', 'moderator');
  const victim = await env.signUp('Susp-Victim');
  const dream = (await victim.c.post('/dreams', dreamBody('public'))).body;
  const reporter = await env.signUp('Susp-Reporter');
  await reporter.c.post(`/dreams/${dream._id}/report`, { reason: 'hate' });
  await chief.c.post('/admin/reports/resolve', { dreamId: dream._id, resolution: 'reviewed', suspendAuthor: true, suspensionReason: 'Hate speech' });

  const login = (password = 'password123') => env.client().post('/auth/login', { email: 'susp-victim@example.com', password });
  const appeal = (body) => env.client().post('/auth/appeal-suspension', { email: 'susp-victim@example.com', password: 'password123', ...body });

  const first = await login();
  assert.equal(first.status, 403);
  assert.equal(first.body.appealStatus, null);

  assert.equal((await appeal({ password: 'wrong-password1', message: 'I should not be suspended.' })).status, 401);
  assert.equal((await appeal({ message: 'short' })).status, 400);
  assert.equal(
    (await env.client().post('/auth/appeal-suspension', { email: 'susp-reporter@example.com', password: 'password123', message: 'I am not suspended at all' })).status,
    400
  );

  assert.equal((await appeal({ message: 'I was quoting a film, not meaning it.' })).status, 201);
  const adminNotice = (await chief.c.get('/notifications?group=appeals')).body.notifications[0];
  assert.equal(adminNotice.appeal.targetType, 'account');
  assert.equal((await mod.c.get('/notifications?group=appeals')).body.notifications.length, 0, 'moderators cannot decide these, so they are not asked');
  assert.equal((await appeal({ message: 'one more time to be sure' })).status, 409, 'one open appeal at a time');
  assert.equal((await login()).body.appealStatus, 'open');

  const id = (await chief.c.get('/admin/appeals')).body.appeals.find((a) => a.targetType === 'account')._id;
  assert.equal((await mod.c.post(`/admin/appeals/${id}/decide`, { decision: 'overturned' })).status, 403, 'only administrators decide these');
  assert.equal((await mod.c.get(`/admin/appeals/${id}`)).status, 200);
  assert.equal((await chief.c.post(`/admin/appeals/${id}/decide`, { decision: 'upheld', note: 'stands' })).body.status, 'upheld');
  assert.equal((await login()).body.appealStatus, 'upheld');
  assert.equal((await appeal({ message: 'appealing again right away' })).status, 409, 'cooldown after a declined appeal');

  // after the cooldown a new appeal can be made, and overturning it unsuspends the account
  await Appeal.updateOne({ _id: id }, { resolvedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) });
  assert.equal((await appeal({ message: 'Thirty days later: I have learned from this.' })).status, 201);
  const second = (await chief.c.get('/admin/appeals')).body.appeals[0]._id;
  const res = await chief.c.post(`/admin/appeals/${second}/decide`, { decision: 'overturned' });
  assert.deepEqual(res.body, { status: 'overturned', restored: false, unsuspended: true });
  assert.equal((await login()).status, 200);
  assert.equal((await User.findOne({ email: 'susp-victim@example.com' })).suspendedAt, null);
});

test('auto-hiding after many reports', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');
  const chief = await staff('Hide-Chief', 'admin');
  const author = await env.signUp('Hide-Author');
  const [one, two, three, four] = await Promise.all(['One', 'Two', 'Three', 'Four'].map((n) => env.signUp(`Hide-${n}`)));
  const dream = (await author.c.post('/dreams', dreamBody('public', { title: 'Heavily reported' }))).body;

  await t.test('stays visible until the threshold (3 in tests, 10 by default) is reached', async () => {
    await report(one, dream._id);
    await report(two, dream._id);
    assert.equal((await four.c.get(`/dreams/${dream._id}`)).status, 200);
    assert.equal((await inbox(author)).notifications.some((n) => n.type === 'moderation'), false);
  });

  await t.test('is hidden automatically by the last report, and the author is told', async () => {
    await report(three, dream._id);
    assert.equal((await four.c.get(`/dreams/${dream._id}`)).status, 404);
    assert.equal((await feedIds(four)).includes(dream._id), false);
    assert.equal((await author.c.get(`/dreams/${dream._id}`)).body.moderation.state, 'hidden');

    const notice = await moderationNotice(author, 'hidden');
    assert.equal(notice.moderation.canAppeal, false, 'a hidden dream is already waiting for review');
    assert.deepEqual(notice.moderation.reasons, ['spam']);

    // further reports are impossible (nobody can see it) and the case is flagged for moderators
    assert.equal((await report(four, dream._id)).status, 404);
    const queue = (await chief.c.get('/admin/reports')).body.cases.find((c) => c.dreamId === dream._id);
    assert.equal(queue.moderationState, 'hidden');
    assert.equal((await chief.c.get(`/admin/reports/case?dreamId=${dream._id}`)).body.target.moderationState, 'hidden');

    const entry = await AuditLog.findOne({ action: 'auto_hidden', dreamId: dream._id });
    assert.equal(entry.system, true);
    assert.equal(entry.adminId, null);
    assert.equal(entry.reportCount, 3);
  });

  await t.test('a moderator who finds nothing wrong brings it back', async () => {
    const res = await chief.c.post('/admin/reports/resolve', { dreamId: dream._id, resolution: 'dismissed' });
    assert.deepEqual(res.body, { resolvedReports: 3, removed: false, restored: true, suspended: false });
    assert.equal((await four.c.get(`/dreams/${dream._id}`)).status, 200);
    assert.equal((await author.c.get(`/dreams/${dream._id}`)).body.moderation, null);
    assert.ok(await moderationNotice(author, 'restored'));
    assert.ok(await AuditLog.findOne({ action: 'content_restored', dreamId: dream._id }));
  });

  await t.test('a decision to remove makes the hiding permanent', async () => {
    const d2 = (await author.c.post('/dreams', dreamBody('public', { title: 'Reported and removed' }))).body;
    for (const p of [one, two, three]) await report(p, d2._id, 'violence');
    assert.equal((await four.c.get(`/dreams/${d2._id}`)).status, 404);
    const res = await chief.c.post('/admin/reports/resolve', { dreamId: d2._id, resolution: 'reviewed', removeContent: true });
    assert.equal(res.body.removed, true);
    assert.equal((await author.c.get(`/dreams/${d2._id}`)).body.moderation.state, 'removed');
  });

  await t.test('staff are exempt, and a single comment can be hidden without hiding its dream', async () => {
    const adminDream = (await chief.c.post('/dreams', dreamBody('public', { title: 'Admin dream' }))).body;
    for (const p of [one, two, three]) await report(p, adminDream._id);
    assert.equal((await four.c.get(`/dreams/${adminDream._id}`)).status, 200, 'staff cannot be silenced by mass reports');

    const host = (await four.c.post('/dreams', dreamBody('public', { title: 'Host' }))).body;
    const comment = (await author.c.post(`/dreams/${host._id}/comments`, { content: 'popular complaint target' })).body.comments[0];
    for (const p of [one, two, three]) await report(p, host._id, 'harassment', comment._id);
    assert.equal((await four.c.get(`/dreams/${host._id}`)).status, 200, 'the dream itself is fine');
    assert.equal((await four.c.get(`/dreams/${host._id}`)).body.comments.length, 0, 'the comment is hidden');
    assert.equal((await author.c.get(`/dreams/${host._id}`)).body.comments[0].moderation.state, 'hidden');
  });
});

test('staff management', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');
  const chief = await staff('Staff-Chief', 'admin');
  const second = await staff('Staff-Second', 'admin');
  const mod = await staff('Staff-Mod', 'moderator');
  const person = await env.signUp('Staff-Person');

  await t.test('only administrators can see and change staff', async () => {
    for (const u of [mod, person]) {
      assert.equal((await u.c.get('/admin/staff')).status, 404);
      assert.equal((await u.c.get('/admin/users/search?q=Staff')).status, 404);
      assert.equal((await u.c.put(`/admin/users/${person.id}/role`, { role: 'admin' })).status, 404);
    }
    const list = (await chief.c.get('/admin/staff')).body.staff;
    const rows = list.map((s) => `${s.role}:${s.name}`).sort();
    assert.ok(['admin:Staff-Chief', 'admin:Staff-Second', 'moderator:Staff-Mod'].every((r) => rows.includes(r)));
    assert.ok(list.every((s) => typeof s.email === 'string'));
  });

  await t.test('search finds accounts by name or email', async () => {
    assert.deepEqual((await chief.c.get('/admin/users/search?q=Staff-Per')).body.users.map((u) => u.name), ['Staff-Person']);
    assert.equal((await chief.c.get('/admin/users/search?q=staff-person@example')).body.users.length, 1);
    assert.equal((await chief.c.get('/admin/users/search?q=a')).status, 400);
    assert.equal((await chief.c.get('/admin/users/search?q=(.*)%2B')).body.users.length, 0, 'regex characters are escaped');
  });

  await t.test('promoting and demoting takes effect immediately and is logged', async () => {
    assert.equal((await person.c.get('/admin/reports')).status, 404);
    const promoted = await chief.c.put(`/admin/users/${person.id}/role`, { role: 'moderator' });
    assert.equal(promoted.body.user.role, 'moderator');
    assert.equal((await person.c.get('/admin/reports')).status, 200, 'the open session gets access at once');
    assert.equal((await person.c.get('/admin/audit')).status, 404, 'but only moderator access');

    await chief.c.put(`/admin/users/${person.id}/role`, { role: 'user' });
    assert.equal((await person.c.get('/admin/reports')).status, 404);

    const roles = await AuditLog.find({ action: 'role_changed', targetUserId: person.id }).sort({ createdAt: 1 });
    assert.deepEqual(roles.map((e) => e.note), ['user → moderator', 'moderator → user']);
  });

  await t.test('guard rails', async () => {
    assert.equal((await chief.c.put(`/admin/users/${chief.id}/role`, { role: 'user' })).status, 400, 'not your own role');
    assert.equal((await chief.c.put(`/admin/users/${person.id}/role`, { role: 'owner' })).status, 400);
    assert.equal((await chief.c.put('/admin/users/65f000000000000000000099/role', { role: 'user' })).status, 404);
    assert.equal((await chief.c.put('/admin/users/nope/role', { role: 'user' })).status, 400);

    // a suspended account cannot be promoted
    await User.updateOne({ _id: person.id }, { suspendedAt: new Date(), suspensionReason: 'x' });
    assert.equal((await chief.c.put(`/admin/users/${person.id}/role`, { role: 'moderator' })).status, 400);
    await User.updateOne({ _id: person.id }, { suspendedAt: null, suspensionReason: '' });

    // demoting another admin works, and the demoted admin loses access at once
    assert.equal((await chief.c.put(`/admin/users/${second.id}/role`, { role: 'user' })).status, 200);
    assert.equal((await second.c.get('/admin/staff')).status, 404);
  });

  await t.test('the last administrator cannot be demoted', async () => {
    // make the test database's only other admins regular users, leaving chief + a newly promoted admin
    await User.updateMany({ role: 'admin', _id: { $ne: chief.id } }, { role: 'user' });
    assert.equal(await User.countDocuments({ role: 'admin' }), 1);
    await chief.c.put(`/admin/users/${mod.id}/role`, { role: 'admin' });
    assert.equal((await mod.c.put(`/admin/users/${chief.id}/role`, { role: 'user' })).status, 200, 'two admins: one may demote the other');
    // mod is now the only administrator and cannot be demoted by anyone else (nobody else is an admin)
    assert.equal(await User.countDocuments({ role: 'admin' }), 1);
    await User.updateOne({ _id: chief.id }, { role: 'admin' });
    assert.equal((await chief.c.put(`/admin/users/${mod.id}/role`, { role: 'user' })).status, 200);
    assert.equal((await mod.c.get('/admin/staff')).status, 404);
  });
});
