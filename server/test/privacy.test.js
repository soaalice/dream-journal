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

test('visibilityFilter never matches other users private dreams or drafts', () => {
  const published = {
    status: { $ne: 'draft' },
    moderationState: { $nin: ['hidden', 'removed'] },
    privacyLevel: { $in: ['public', 'anonymous'] }
  };
  assert.deepEqual(visibilityFilter(undefined), published);
  assert.deepEqual(visibilityFilter(OWNER).$or, [published, { userId: OWNER }]);
});

test('visibilityFilter excludes blocked authors', () => {
  const filter = visibilityFilter(OTHER, new Set([OWNER]));
  assert.deepEqual(filter.$and[1], { userId: { $nin: [OWNER] } });
});

test('drafts are visible to their author only, whatever their privacy level', () => {
  const draft = makeDream('public', { status: 'draft' });
  assert.equal(Boolean(canView(draft, OWNER)), true);
  assert.equal(Boolean(canView(draft, OTHER)), false);
  assert.equal(Boolean(canView(draft, undefined)), false);
});

test('a blocked author is invisible, in both directions, but never to themselves', () => {
  const dream = makeDream('public');
  assert.equal(Boolean(canView(dream, OTHER, new Set([OWNER]))), false);
  assert.equal(Boolean(canView(dream, OWNER, new Set([OTHER]))), true, 'the owner always sees their own dream');
  assert.equal(Boolean(canView(makeDream('anonymous'), OTHER, new Set([OWNER]))), false);
});

test('serialized dreams expose status and a comment count without likers', () => {
  const out = serializeDream(makeDream('public', { status: 'draft' }), OWNER);
  assert.equal(out.status, 'draft');
  assert.equal(out.commentsCount, 2);
  assert.equal(serializeDream(makeDream('public', { status: undefined }), OWNER).status, 'published');
});

// ---------- threaded comments ----------

const comment = (id, userId, parentId = null, extra = {}) => ({
  _id: id,
  content: `comment ${id}`,
  userId: { _id: userId, name: userId === OWNER ? 'Alice' : 'Bob', avatarUrl: 'x' },
  parentId,
  deleted: false,
  createdAt: new Date(),
  mentions: [],
  ...extra
});

const withComments = (comments, privacyLevel = 'public') => makeDream(privacyLevel, { comments });

test('replies keep their parentId so the client can build the thread', () => {
  const out = serializeDream(withComments([comment('c1', OWNER), comment('c2', OTHER, 'c1')]), OTHER);
  assert.deepEqual(out.comments.map((c) => [c._id, c.parentId]), [['c1', null], ['c2', 'c1']]);
  assert.equal(out.comments[1].isOwn, true);
  assert.equal(out.comments[0].isOwn, false);
});

test('a deleted comment with replies becomes an empty placeholder; without replies it disappears', () => {
  const thread = [comment('c1', OTHER, null, { deleted: true, content: '[deleted]' }), comment('c2', OWNER, 'c1'), comment('c3', OTHER, null, { deleted: true })];
  const out = serializeDream(withComments(thread), OWNER);
  assert.deepEqual(out.comments.map((c) => c._id), ['c1', 'c2']);
  assert.equal(out.comments[0].deleted, true);
  assert.equal(out.comments[0].content, '');
  assert.equal(out.comments[0].userName, '');
  assert.equal(out.commentsCount, 1);
});

test('comments by blocked users are hidden, keeping a placeholder only if others replied to them', () => {
  const thread = [comment('c1', OTHER), comment('c2', OWNER, 'c1'), comment('c3', OTHER)];
  const out = serializeDream(withComments(thread), OWNER, new Set([OTHER]));
  assert.deepEqual(out.comments.map((c) => [c._id, c.deleted]), [['c1', true], ['c2', false]]);
  assert.equal(JSON.stringify(out).includes('Bob'), false, 'the blocked user\'s name must not leak through placeholders');
});

test('placeholders for deep threads stay linked through the whole chain', () => {
  const thread = [comment('c1', OTHER, null, { deleted: true }), comment('c2', OTHER, 'c1', { deleted: true }), comment('c3', OWNER, 'c2')];
  const out = serializeDream(withComments(thread), OWNER);
  assert.deepEqual(out.comments.map((c) => c._id), ['c1', 'c2', 'c3']);
});

test('corrupt cyclic threads do not hang the serializer', () => {
  const thread = [comment('c1', OTHER, 'c2', { deleted: true }), comment('c2', OTHER, 'c1', { deleted: true })];
  assert.doesNotThrow(() => serializeDream(withComments(thread), OWNER));
});

// ---------- moderation state ----------

test('dreams hidden or removed by moderators are visible to their author only', () => {
  for (const moderationState of ['hidden', 'removed']) {
    const dream = makeDream('public', { moderationState });
    assert.equal(Boolean(canView(dream, OWNER)), true, `${moderationState}: the author still sees it`);
    assert.equal(Boolean(canView(dream, OTHER)), false);
    assert.equal(Boolean(canView(dream, undefined)), false);
  }
  assert.equal(Boolean(canView(makeDream('public', { moderationState: 'visible' }), OTHER)), true);
  assert.equal(Boolean(canView(makeDream('public', { moderationState: undefined }), OTHER)), true, 'old dreams count as visible');
});

test('only the author is told that their dream was moderated', () => {
  const removed = makeDream('public', { moderationState: 'removed', moderationMessage: 'Breaks the rules' });
  assert.deepEqual(serializeDream(removed, OWNER).moderation, { state: 'removed', message: 'Breaks the rules' });
  assert.equal(serializeDream(makeDream('public'), OWNER).moderation, null);
  assert.equal(serializeDream(makeDream('public', { moderationState: 'visible' }), OWNER).moderation, null);
});

test('moderated comments become placeholders for everyone but their author', () => {
  const thread = [
    comment('c1', OTHER, null, { moderationState: 'removed', moderationMessage: 'rude' }),
    comment('c2', OWNER, 'c1')
  ];
  const forOwner = serializeDream(withComments(thread), OWNER);
  assert.equal(forOwner.comments[0].deleted, true, 'the dream owner sees a placeholder');
  assert.equal(JSON.stringify(forOwner).includes('comment c1'), false, 'and not the text');

  const forAuthor = serializeDream(withComments(thread), OTHER);
  assert.equal(forAuthor.comments[0].deleted, false, 'the author still sees their own comment');
  assert.deepEqual(forAuthor.comments[0].moderation, { state: 'removed', message: 'rude' });

  // without replies a moderated comment disappears for everybody else
  const alone = serializeDream(withComments([comment('c9', OTHER, null, { moderationState: 'hidden' })]), OWNER);
  assert.equal(alone.comments.length, 0);
  assert.equal(alone.commentsCount, 0);
});
