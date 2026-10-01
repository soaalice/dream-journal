import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Notification from '../models/Notification.js';
import {
  notifyComment,
  notifyFollow,
  notifyLike,
  notifyMentions,
  removeForUser
} from '../services/notifications.js';
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
  assert.equal(calls.create.length, 1);
  assert.equal(calls.create[0][0].userId, OWNER);
  assert.equal(calls.create[0][0].type, 'comment');

  mock.restoreAll();
  calls = spy();
  await notifyComment({ dream: dream('public'), actorId: ALICE, commentId: COMMENT_ID, mentionIds: [OWNER, BOB] });
  assert.equal(calls.create.length, 0, 'owner is mentioned, so no separate comment notice');
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

test('follow and unfollow create and remove the same row', async () => {
  let calls = spy();
  await notifyFollow({ targetId: OWNER, actorId: ALICE, following: true });
  assert.deepEqual(calls.findOneAndUpdate[0][0], { userId: OWNER, type: 'follow', actorId: ALICE });

  mock.restoreAll();
  calls = spy();
  await notifyFollow({ targetId: OWNER, actorId: ALICE, following: false });
  assert.deepEqual(calls.deleteOne[0][0], { userId: OWNER, type: 'follow', actorId: ALICE });
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

test('follow notifications need no dream', () => {
  const out = serializeNotification(row({ type: 'follow', dreamId: undefined, commentId: undefined }), OWNER);
  assert.equal(out.type, 'follow');
  assert.equal(out.dream, null);
});
