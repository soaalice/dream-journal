import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import Dream from '../../models/Dream.js';
import User from '../../models/User.js';
import { removeDemo, renderDemoCredentials, seedDemo } from '../../scripts/seed-demo.js';
import { MOODS, PRIVACY_LEVELS } from '../../utils/validation.js';
import { startE2E } from './helpers.js';

let env;
before(async () => {
  env = await startE2E('seed-demo');
});
after(async () => env?.stop());

test('demo data: 10 users with 5 to 15 dreams each, valid and usable', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');

  // a real user that must survive everything below
  const real = await env.signUp('Real-Person');
  await real.c.post('/dreams', { title: 'Mine', content: 'my own real dream, not demo data', privacyLevel: 'public', mood: 'happy', tags: [] });

  const result = await seedDemo();
  assert.equal(result.created, true);
  assert.equal(result.accounts.length, 10);

  await t.test('every user has 5 to 15 dreams, and the totals add up', async () => {
    for (const a of result.accounts) assert.ok(a.dreams >= 5 && a.dreams <= 15, `${a.name} has ${a.dreams}`);
    assert.equal(result.dreams, result.accounts.reduce((n, a) => n + a.dreams, 0));
    assert.equal(await Dream.countDocuments({ status: 'published', userId: { $in: (await User.find({ email: /@demo\./ })).map((u) => u._id) } }), result.dreams);
    assert.ok(result.drafts >= 1 && result.drafts <= 10);
    assert.ok(result.comments > 20 && result.likes > 20, 'enough interaction to make the feed and notifications interesting');
  });

  await t.test('every generated dream satisfies the same rules as dreams made through the app', async () => {
    const demoIds = (await User.find({ email: /@demo\./ })).map((u) => u._id);
    const dreams = await Dream.find({ userId: { $in: demoIds }, status: 'published' });
    const moods = new Set();
    for (const d of dreams) {
      assert.ok(MOODS.includes(d.mood), d.mood);
      assert.ok(PRIVACY_LEVELS.includes(d.privacyLevel));
      assert.ok(d.title.length >= 1 && d.title.length <= 120, d.title);
      assert.ok(d.content.length >= 10 && d.content.length <= 10000);
      assert.ok(d.tags.length >= 1 && d.tags.length <= 10 && d.tags.every((tag) => tag === tag.toLowerCase() && tag.length <= 30));
      assert.ok(d.createdAt <= new Date() && d.createdAt > new Date(Date.now() - 366 * 24 * 3600 * 1000), 'within the last year');
      moods.add(d.mood);
      // threaded comments: parents exist, replies come after their parent, nobody answers themselves as a top-level commenter
      for (const c of d.comments) {
        assert.ok(c.content.length >= 1 && c.content.length <= 1000);
        if (c.parentId) {
          const parent = d.comments.id(c.parentId);
          assert.ok(parent, 'reply has a parent');
          assert.ok(c.createdAt >= parent.createdAt);
        } else {
          assert.notEqual(String(c.userId), String(d.userId), 'authors only reply under comments');
        }
      }
      assert.equal(new Set(d.likes.map(String)).size, d.likes.length, 'no duplicate likes');
      assert.equal(d.likes.some((id) => String(id) === String(d.userId)), false, 'nobody likes their own dream');
      if (d.privacyLevel === 'private') assert.equal(d.comments.length + d.likes.length, 0, 'private dreams get no interaction');
    }
    assert.ok(moods.size >= 6, `a varied mix of moods (${moods.size})`);
  });

  await t.test('the demo accounts can sign in and use the app', async () => {
    const first = env.client();
    const login = await first.post('/auth/login', { email: result.accounts[0].email, password: result.password });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.name, result.accounts[0].name);

    // the shared feed now contains demo dreams, with their authors
    const anyone = env.client();
    const feed = (await anyone.get('/dreams/feed?limit=50')).body;
    assert.ok(feed.total > 20);
    assert.ok(feed.dreams.some((d) => d.userName === result.accounts[1].name || d.userName === 'Anonymous'));

    // the first account is on a streak, and its stats make sense
    const stats = (await first.get('/stats/me?range=365')).body;
    assert.ok(stats.streaks.current >= 6, `streak ${stats.streaks.current}`);
    assert.equal(stats.totals.dreams, result.accounts[0].dreams);
    assert.ok(stats.moods[0].count > 0);
    assert.ok(stats.tags.length > 0);
    assert.ok(stats.heatmap.days.length > 0);
  });

  await t.test('seeding again does nothing, and the same seed gives the same dreams', async () => {
    const again = await seedDemo();
    assert.deepEqual(again, { created: false, existing: 10 });

    const titles = async () => (await Dream.find({ status: 'published', userId: { $in: (await User.find({ email: /@demo\./ })).map((u) => u._id) } })).map((d) => d.title).sort();
    const before = await titles();
    await removeDemo();
    await seedDemo();
    assert.deepEqual(await titles(), before, 'deterministic');
  });

  await t.test('removing demo data leaves real users and their dreams untouched', async () => {
    const removed = await removeDemo();
    assert.equal(removed.users, 10);
    assert.ok(removed.dreams > 50);
    assert.equal(await User.countDocuments({ email: /@demo\./ }), 0);
    assert.equal(await User.countDocuments({ email: 'real-person@example.com' }), 1);
    assert.equal(await Dream.countDocuments({ title: 'Mine' }), 1);
    assert.deepEqual(await removeDemo(), { users: 0, dreams: 0 }, 'safe to repeat');
  });

  await t.test('the credentials file lists every account and the shared password', async () => {
    const fresh = await seedDemo({ users: 3 });
    assert.equal(fresh.accounts.length, 3);
    const md = renderDemoCredentials(fresh);
    assert.ok(md.includes(fresh.password));
    for (const a of fresh.accounts) assert.ok(md.includes(a.email));
    assert.match(md, /6-day streak/);
    await removeDemo();
  });
});
