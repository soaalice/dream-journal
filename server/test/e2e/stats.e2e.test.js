/**
 * End-to-end tests (real MongoDB, throwaway database) for the personal stats endpoint.  Run with `npm run test:e2e`.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import Dream from '../../models/Dream.js';
import { dreamBody, startE2E } from './helpers.js';

let env;
before(async () => {
  env = await startE2E('stats');
});
after(async () => env?.stop());

const DAY = 24 * 60 * 60 * 1000;
/** A moment `days` days ago at the given UTC hour. */
const daysAgo = (days, hour = 12) => {
  const d = new Date(Date.now() - days * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};
const dayKey = (d) => d.toISOString().slice(0, 10);

/** createdAt is immutable through Mongoose, so back-date through the raw collection. */
const backdate = (id, date) => Dream.collection.updateOne({ _id: new (Dream.base.Types.ObjectId)(id) }, { $set: { createdAt: date } });

const make = async (user, body, date) => {
  const res = await user.c.post('/dreams', dreamBody('public', body));
  assert.equal(res.status, 201, `creating "${body.title}": ${JSON.stringify(res.body)}`);
  const dream = res.body;
  if (date) await backdate(dream._id, date);
  return dream;
};

test('personal stats', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');
  const alice = await env.signUp('Stats-Alice');
  const bob = await env.signUp('Stats-Bob');

  await t.test('requires a session and validates its parameters', async () => {
    assert.equal((await env.client().get('/stats/me')).status, 401);
    assert.equal((await alice.c.get('/stats/me?tz=Mars/Base')).status, 400);
    assert.equal((await alice.c.get('/stats/me?range=7')).status, 400);
    assert.equal((await alice.c.get('/stats/me?range=all&tz=Europe/Paris')).status, 200);
  });

  await t.test('an empty journal gets a complete, zeroed report', async () => {
    const s = (await alice.c.get('/stats/me')).body;
    assert.equal(s.totals.dreams, 0);
    assert.equal(s.moods.length, 8);
    assert.deepEqual(s.streaks, { current: 0, longest: 0 });
    assert.deepEqual(s.insights, []);
    assert.equal(s.tz, 'UTC');
  });

  await t.test('counts dreams, words, moods, tags, privacy and a streak', async () => {
    // three days in a row ending today, plus an old one
    await make(alice, { title: 'a', content: 'one two three four five six', mood: 'scary', tags: ['water', 'night'], privacyLevel: 'private' }, daysAgo(0));
    await make(alice, { title: 'b', content: 'seven eight nine', mood: 'scary', tags: ['water'], privacyLevel: 'anonymous' }, daysAgo(1));
    const third = await make(alice, { title: 'c', content: 'ten   eleven\ntwelve', mood: 'happy', tags: ['home'] }, daysAgo(2));
    await make(alice, { title: 'old', content: 'an old dream', mood: 'sad', tags: ['water'] }, daysAgo(200));
    // drafts are counted separately and never as dreams
    await alice.c.post('/dreams', { status: 'draft', content: 'half a dream' });

    // other people's activity on my dream: one like and two comments
    await bob.c.post(`/dreams/${third._id}/like`);
    await bob.c.post(`/dreams/${third._id}/comments`, { content: 'nice' });
    await bob.c.post(`/dreams/${third._id}/comments`, { content: 'really nice' });

    const s = (await alice.c.get('/stats/me')).body;
    assert.equal(s.totals.dreams, 4);
    assert.equal(s.totals.drafts, 1);
    assert.equal(s.totals.words, 6 + 3 + 3 + 3, 'words are split on any whitespace');
    assert.equal(s.totals.activeDays, 4);
    assert.equal(s.totals.firstDreamOn, dayKey(daysAgo(200)));
    assert.equal(s.totals.likesReceived, 1);
    assert.equal(s.totals.commentsReceived, 2);
    assert.deepEqual(s.streaks, { current: 3, longest: 3 });

    // the default range is a year: all four dreams are in
    assert.equal(s.range.dreams, 4);
    const mood = (m) => s.moods.find((x) => x.mood === m);
    assert.deepEqual([mood('scary').count, mood('happy').count, mood('sad').count], [2, 1, 1]);
    assert.equal(s.moods[0].mood, 'scary');
    assert.deepEqual(s.privacy, { public: 2, private: 1, anonymous: 1 });
    assert.deepEqual(s.tags[0], { tag: 'water', count: 3, topMood: 'scary', topMoodPercent: 67 });

    // the heatmap has a cell for each day with dreams
    assert.deepEqual(s.heatmap.days.map((d) => d.date), [dayKey(daysAgo(200)), dayKey(daysAgo(2)), dayKey(daysAgo(1)), dayKey(daysAgo(0))]);
    assert.equal(s.heatmap.to, dayKey(new Date()));
  });

  await t.test('the range narrows the charts but not the all-time numbers', async () => {
    const s30 = (await alice.c.get('/stats/me?range=30')).body;
    assert.equal(s30.range.dreams, 3, 'the 200-day-old dream is outside');
    assert.equal(s30.totals.dreams, 4, 'but still counted in the totals');
    assert.equal(s30.moods.find((m) => m.mood === 'sad').count, 0);
    assert.equal(s30.timeline.unit, 'day');
    assert.equal(s30.timeline.points.length, 30);
    assert.equal((await alice.c.get('/stats/me?range=all')).body.range.dreams, 4);
    assert.equal((await alice.c.get('/stats/me?range=all')).body.timeline.unit, 'month');
  });

  await t.test('days follow the time zone of the person, not the server', async () => {
    // 23:30 UTC ten days ago is already the next morning in Tokyo
    const late = new Date(Date.now() - 10 * DAY);
    late.setUTCHours(23, 30, 0, 0);
    await make(alice, { title: 'late', content: 'a late dream', mood: 'peaceful' }, late);

    const utc = (await alice.c.get('/stats/me?tz=UTC')).body.heatmap.days.map((d) => d.date);
    const tokyo = (await alice.c.get('/stats/me?tz=Asia/Tokyo')).body.heatmap.days.map((d) => d.date);
    const next = new Date(late.getTime() + DAY);
    assert.ok(utc.includes(dayKey(late)) && !utc.includes(dayKey(next)));
    assert.ok(tokyo.includes(dayKey(next)) && !tokyo.includes(dayKey(late)));
  });

  await t.test('weekdays count on the right day, Monday first', async () => {
    const s = (await alice.c.get('/stats/me?range=all')).body;
    const d = daysAgo(0);
    const index = (d.getUTCDay() + 6) % 7;
    assert.ok(s.weekdays[index].count >= 1, `today is ${s.weekdays[index].label}`);
    assert.equal(s.weekdays[0].label, 'Monday');
    assert.equal(s.weekdays.reduce((n, w) => n + w.count, 0), 5);
  });

  await t.test('nobody else\'s dreams are ever included', async () => {
    const before = (await alice.c.get('/stats/me?range=all')).body;
    for (let i = 0; i < 3; i += 1) await make(bob, { title: `bob ${i}`, content: 'bob writes a lot of words here', mood: 'exciting', tags: ['bobs-secret'] }, daysAgo(i));

    const after = (await alice.c.get('/stats/me?range=all')).body;
    assert.deepEqual(after.totals, before.totals);
    assert.equal(after.tags.some((t) => t.tag === 'bobs-secret'), false);
    assert.equal(after.moods.find((m) => m.mood === 'exciting').count, 0);

    const bobs = (await bob.c.get('/stats/me?range=all')).body;
    assert.equal(bobs.totals.dreams, 3);
    assert.equal(bobs.tags[0].tag, 'bobs-secret');
    assert.equal(bobs.totals.drafts, 0);
  });

  await t.test('insights appear once there is enough to say, and describe only this person', async () => {
    const s = (await alice.c.get('/stats/me?range=all')).body;
    const ids = s.insights.map((i) => i.id);
    assert.equal(ids.includes('top-mood'), false, 'two scary dreams out of five is too weak a signal to call a pattern');
    assert.ok(ids.includes('streak'), 'a 3-day streak is worth mentioning');
    assert.equal(JSON.stringify(s).includes('Stats-Bob'), false);
    assert.deepEqual((await bob.c.get('/stats/me?range=30')).body.insights, [], 'three dreams is too few for any insight');
  });

  await t.test('a long journal stays fast and bounded', async () => {
    const docs = Array.from({ length: 1500 }, (_, i) => ({
      userId: alice.id,
      title: `bulk ${i}`,
      content: 'bulk dream words',
      mood: 'happy',
      privacyLevel: 'private',
      tags: ['bulk'],
      status: 'published',
      createdAt: daysAgo(i % 300),
      updatedAt: new Date()
    }));
    await Dream.collection.insertMany(docs.map((d) => ({ ...d, userId: new (Dream.base.Types.ObjectId)(d.userId), likes: [], comments: [], mentions: [] })));
    const start = Date.now();
    const s = (await alice.c.get('/stats/me?range=all')).body;
    assert.ok(Date.now() - start < 3000, 'a 1500-dream journal is summarised in a few seconds at most');
    assert.ok(s.totals.dreams >= 1500);
    assert.equal(s.tags[0].tag, 'bulk');
  });
});
