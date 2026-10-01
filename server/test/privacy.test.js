import test from 'node:test';
import assert from 'node:assert/strict';
import { canView, serializeDream, visibilityFilter } from '../utils/serialize.js';

const OWNER = '65f000000000000000000001';
const OTHER = '65f000000000000000000002';

const makeDream = (privacyLevel, overrides = {}) => ({
  _id: '65f0000000000000000000aa',
  title: 'Flying',
  content: 'I was flying over the sea.',
  createdAt: new Date(),
  updatedAt: new Date(),
  userId: { _id: OWNER, name: 'Alice', avatarUrl: 'https://api.dicebear.com/a.svg' },
  privacyLevel,
  tags: ['sea'],
  mood: 'peaceful',
  likes: [OTHER],
  mentions: [],
  comments: [
    {
      _id: 'c1',
      content: 'owner reply',
      userId: { _id: OWNER, name: 'Alice', avatarUrl: 'x' },
      createdAt: new Date(),
      mentions: []
    },
    {
      _id: 'c2',
      content: 'other reply',
      userId: { _id: OTHER, name: 'Bob', avatarUrl: 'y' },
      createdAt: new Date(),
      mentions: []
    }
  ],
  ...overrides
});

test('private dreams are only viewable by their owner', () => {
  const dream = makeDream('private');
  assert.equal(Boolean(canView(dream, OWNER)), true);
  assert.equal(Boolean(canView(dream, OTHER)), false);
  assert.equal(Boolean(canView(dream, undefined)), false);
});

test('public and anonymous dreams are viewable by everyone', () => {
  assert.equal(Boolean(canView(makeDream('public'), undefined)), true);
  assert.equal(Boolean(canView(makeDream('anonymous'), OTHER)), true);
});

test('anonymous dreams hide the author from non-owners', () => {
  const out = serializeDream(makeDream('anonymous'), OTHER);
  assert.equal(out.userId, null);
  assert.equal(out.userName, 'Anonymous');
  assert.equal(out.isOwner, false);
  assert.equal(JSON.stringify(out).includes(OWNER), false, 'owner id must not appear anywhere');
  assert.equal(JSON.stringify(out).includes('Alice'), false);
});

test('anonymous dreams reveal the author to the owner', () => {
  const out = serializeDream(makeDream('anonymous'), OWNER);
  assert.equal(out.userId._id, OWNER);
  assert.equal(out.isOwner, true);
});

test('owner comments on an anonymous dream stay anonymous for others', () => {
  const out = serializeDream(makeDream('anonymous'), OTHER);
  assert.equal(out.comments[0].userName, 'Anonymous');
  assert.equal(out.comments[0].userId, null);
  assert.equal(out.comments[1].userName, 'Bob');
});

test('public dreams expose the author', () => {
  const out = serializeDream(makeDream('public'), undefined);
  assert.equal(out.userName, 'Alice');
});

test('likes are exposed as a count plus likedByMe, never as user ids', () => {
  const out = serializeDream(makeDream('public'), OTHER);
  assert.equal(out.likesCount, 1);
  assert.equal(out.likedByMe, true);
  assert.equal('likes' in out, false);
});

test('comment deletion rights: comment author or dream owner', () => {
  const asOther = serializeDream(makeDream('public'), OTHER);
  assert.deepEqual(asOther.comments.map((c) => c.canDelete), [false, true]);
  const asOwner = serializeDream(makeDream('public'), OWNER);
  assert.deepEqual(asOwner.comments.map((c) => c.canDelete), [true, true]);
});

test('visibilityFilter never matches other users private dreams', () => {
  assert.deepEqual(visibilityFilter(undefined), { privacyLevel: { $in: ['public', 'anonymous'] } });
  assert.deepEqual(visibilityFilter(OWNER).$or[1], { userId: OWNER });
});
