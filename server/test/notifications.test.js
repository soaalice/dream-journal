import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Notification from '../models/Notification.js';
import { notifyComment, notifyLike, notifyMentions, removeForUser } from '../services/notifications.js';
import { serializeNotification } from '../utils/serializeNotification.js';

const OWNER = '65f000000000000000000001';
const ALICE = '65f000000000000000000002';
const BOB = '65f000000000000000000003';
const DREAM_ID = '65f0000000000000000000aa';
const COMMENT_ID = '65f0000000000000000000bb';

const dream = (privacyLevel) => ({ _id: DREAM_ID, userId: OWNER, privacyLevel });

// Replace the database calls with recorders.
const spy = () => {
  const calls = { create: [], insertMany: [], findOneAndUpdate: [], updateOne: [], deleteOne: [], deleteMany: [] };
  for (const method of Object.keys(calls)) {
    mock.method(Notification, method, async (...args) => {
      calls[method].push(args);
      return {};
    });
  }
  return calls;
};

afterEach(() => mock.restoreAll());

// ---------- service rules ----------

test('private dreams never produce notifications', async () => {
  const calls = spy();
  await notifyComment({ dream: dream('private'), actorId: ALICE, commentId: COMMENT_ID, mentionIds: [BOB] });
  await notifyMentions({ dream: dream('private'), actorId: OWNER, mentionIds: [BOB] });
  await notifyLike({ dream: dream('private'), actorId: ALICE, liked: true });
  assert.equal(calls.create.length + calls.insertMany.length + calls.findOneAndUpdate.length, 0);
});

test('nobody is notified about their own actions', async () => {
  const calls = spy();
  await notifyComment({ dream: dream('public'), actorId: OWNER, commentId: COMMENT_ID });
  await notifyLike({ dream: dream('public'), actorId: OWNER, liked: true });
  await notifyMentions({ dream: dream('public'), actorId: OWNER, mentionIds: [OWNER] });
  assert.equal(calls.create.length + calls.insertMany.length + calls.findOneAndUpdate.length, 0);
});

test('a comment notifies the owner once, and a mention replaces the plain comment notice', async () => {
  let calls = spy();
  await notifyComment({ dream: dream('public'), actorId: ALICE, commentId: COMMENT_ID, mentionIds: [] });
  assert.equal(calls.insertMany.length, 1);
  assert.deepEqual(calls.insertMany[0][0].map((n) => [n.userId, n.type]), [[OWNER, 'comment']]);

  mock.restoreAll();
  calls = spy();
  await notifyComment({ dream: dream('public'), actorId: ALICE, commentId: COMMENT_ID, mentionIds: [OWNER, BOB] });
  assert.equal(calls.insertMany.length, 1, 'owner is mentioned, so no separate comment notice');
  const types = calls.insertMany[0][0].map((n) => `${n.userId}:${n.type}`).sort();
  assert.deepEqual(types, [`${OWNER}:mention`, `${BOB}:mention`].sort());
});

test('the author of an anonymous dream is never stored as the actor', async () => {
  const calls = spy();
  await notifyMentions({ dream: dream('anonymous'), actorId: OWNER, commentId: COMMENT_ID, mentionIds: [BOB] });
  const [rows] = calls.insertMany[0];
  assert.equal(rows[0].actorId, null);
});

test('other people mentioning on an anonymous dream keep their identity', async () => {
  const calls = spy();
  await notifyMentions({ dream: dream('anonymous'), actorId: ALICE, mentionIds: [BOB] });
  assert.equal(calls.insertMany[0][0][0].actorId, ALICE);
});

test('likes are grouped into one row and unliking decrements it', async () => {
  let calls = spy();
  await notifyLike({ dream: dream('public'), actorId: ALICE, liked: true });
  const [key, update, options] = calls.findOneAndUpdate[0];
  assert.deepEqual(key, { userId: OWNER, type: 'like', dreamId: DREAM_ID });
  assert.equal(update.$inc.count, 1);
  assert.equal(options.upsert, true);

  mock.restoreAll();
  calls = spy();
  await notifyLike({ dream: dream('public'), actorId: ALICE, liked: false });
  assert.equal(calls.updateOne[0][1].$inc.count, -1);
  assert.equal(calls.updateOne[0][2].timestamps, false, 'unlike must not move the row to the top');
  assert.deepEqual(calls.deleteOne[0][0].count, { $lte: 0 });
});

test('drafts never produce notifications', async () => {
  const calls = spy();
  const draft = { ...dream('public'), status: 'draft' };
  await notifyComment({ dream: draft, actorId: ALICE, commentId: COMMENT_ID, mentionIds: [BOB] });
  await notifyLike({ dream: draft, actorId: ALICE, liked: true });
  await notifyMentions({ dream: draft, actorId: OWNER, mentionIds: [BOB] });
  assert.equal(calls.create.length + calls.insertMany.length + calls.findOneAndUpdate.length, 0);
});

test('a reply notifies the parent comment author, and the owner separately', async () => {
  const calls = spy();
  // Alice replies to Bob's comment on Owner's dream
  await notifyComment({ dream: dream('public'), actorId: ALICE, commentId: COMMENT_ID, parentAuthorId: BOB });
  const rows = calls.insertMany[0][0].map((r) => `${r.userId}:${r.type}`).sort();
  assert.deepEqual(rows, [`${OWNER}:comment`, `${BOB}:reply`].sort());
});

test('when the dream owner is the parent author they get one reply notice, not two', async () => {
  const calls = spy();
  await notifyComment({ dream: dream('public'), actorId: ALICE, commentId: COMMENT_ID, parentAuthorId: OWNER });
  const rows = calls.insertMany[0][0];
  assert.deepEqual(rows.map((r) => [r.userId, r.type]), [[OWNER, 'reply']]);
});

test('replying to yourself notifies nobody extra', async () => {
  const calls = spy();
  await notifyComment({ dream: dream('public'), actorId: ALICE, commentId: COMMENT_ID, parentAuthorId: ALICE });
  assert.deepEqual(calls.insertMany[0][0].map((r) => r.userId), [OWNER]);
});

test('a mention beats a reply for the same person', async () => {
  const calls = spy();
  await notifyComment({ dream: dream('public'), actorId: ALICE, commentId: COMMENT_ID, parentAuthorId: BOB, mentionIds: [BOB] });
  const all = calls.insertMany.flatMap(([rows]) => rows).map((r) => `${r.userId}:${r.type}`).sort();
  assert.deepEqual(all, [`${BOB}:mention`, `${OWNER}:comment`].sort());
});

test('a hidden author replying on an anonymous dream is not stored as the actor', async () => {
  const calls = spy();
  await notifyComment({ dream: dream('anonymous'), actorId: OWNER, commentId: COMMENT_ID, parentAuthorId: BOB });
  assert.equal(calls.insertMany[0][0][0].actorId, null);
  assert.equal(calls.insertMany[0][0][0].type, 'reply');
});

test('nothing crosses a block', async () => {
  let calls = spy();
  const blocked = new Set([OWNER, BOB]);
  await notifyComment({ dream: dream('public'), actorId: ALICE, commentId: COMMENT_ID, parentAuthorId: BOB, mentionIds: [BOB], blocked });
  await notifyLike({ dream: dream('public'), actorId: ALICE, liked: true, blocked });
  await notifyMentions({ dream: dream('public'), actorId: ALICE, mentionIds: [BOB], blocked });
  assert.equal(calls.create.length + calls.insertMany.length + calls.findOneAndUpdate.length, 0);

  // people who are not blocked still get theirs
  mock.restoreAll();
  calls = spy();
  await notifyComment({ dream: dream('public'), actorId: ALICE, commentId: COMMENT_ID, parentAuthorId: BOB, blocked: new Set([BOB]) });
  assert.deepEqual(calls.insertMany[0][0].map((r) => r.userId), [OWNER]);
});

test('a database failure never throws out of the service', async () => {
  mock.method(Notification, 'create', async () => {
    throw new Error('db down');
  });
  mock.method(console, 'error', () => {});
  await assert.doesNotReject(() => notifyComment({ dream: dream('public'), actorId: ALICE, commentId: COMMENT_ID }));
});

test('account deletion also removes notifications about the user\'s dreams', async () => {
  const calls = spy();
  await removeForUser({ userId: OWNER, dreamIds: [DREAM_ID] });
  const filter = calls.deleteMany[0][0];
  assert.deepEqual(filter.$or[2], { dreamId: { $in: [DREAM_ID] } });
});

// ---------- serializer rules ----------

const row = (overrides = {}) => ({
  _id: 'n1',
  type: 'comment',
  actorId: { _id: ALICE, name: 'Alice', avatarUrl: 'a.svg' },
  dreamId: { _id: DREAM_ID, title: 'Flying', privacyLevel: 'public', userId: OWNER },
  commentId: COMMENT_ID,
  count: 1,
  readAt: null,
  updatedAt: new Date('2026-01-01'),
  ...overrides
});

test('serializes the actor and dream the recipient may see', () => {
  const out = serializeNotification(row(), OWNER);
  assert.equal(out.actor.name, 'Alice');
  assert.equal(out.dream.title, 'Flying');
  assert.equal(out.read, false);
});

test('drops notifications whose dream was deleted or became private for the recipient', () => {
  assert.equal(serializeNotification(row({ dreamId: null }), OWNER), null);
  const hidden = row({ dreamId: { _id: DREAM_ID, title: 'Secret', privacyLevel: 'private', userId: OWNER } });
  assert.equal(serializeNotification(hidden, BOB), null);
});

test('a hidden actor stays hidden', () => {
  const out = serializeNotification(row({ type: 'mention', actorId: null }), BOB);
  assert.equal(out.actor, null);
});

test('defence in depth: the author of an anonymous dream is hidden even if stored as actor', () => {
  const leaked = row({
    type: 'mention',
    actorId: { _id: OWNER, name: 'Alice', avatarUrl: 'a.svg' },
    dreamId: { _id: DREAM_ID, title: 'Anon', privacyLevel: 'anonymous', userId: OWNER }
  });
  const out = serializeNotification(leaked, BOB);
  assert.equal(out.actor, null);
  assert.equal(JSON.stringify(out).includes('Alice'), false);
});

test('notifications involving a blocked user, or a dream by one, are dropped', () => {
  assert.equal(serializeNotification(row(), OWNER, new Set([ALICE])), null, 'blocked actor');
  const byBlocked = row({ dreamId: { _id: DREAM_ID, title: 'x', privacyLevel: 'public', userId: BOB } });
  assert.equal(serializeNotification(byBlocked, OWNER, new Set([BOB])), null, 'dream by a blocked author');
  assert.ok(serializeNotification(row(), OWNER, new Set([BOB])), 'unrelated blocks do not matter');
});

test('draft dreams are never shown in notifications to anyone but their author', () => {
  const draft = row({ dreamId: { _id: DREAM_ID, title: 'WIP', privacyLevel: 'public', status: 'draft', userId: OWNER } });
  assert.equal(serializeNotification(draft, BOB), null);
});

test('replies serialize like comments', () => {
  const out = serializeNotification(row({ type: 'reply' }), OWNER);
  assert.equal(out.type, 'reply');
  assert.equal(out.commentId, COMMENT_ID);
});
