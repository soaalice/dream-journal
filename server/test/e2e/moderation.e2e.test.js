/**
 * End-to-end tests (real MongoDB, throwaway database) for: removed follow/profile endpoints, threaded replies,
 * blocking, reporting and drafts.  Run with `npm run test:e2e`.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import Report from '../../models/Report.js';
import { dreamBody, inbox, startE2E } from './helpers.js';

let env;
before(async () => {
  env = await startE2E('moderation');
});
after(async () => env?.stop());

const idsOf = (list) => list.map((d) => d._id);
const feedIds = async (user) => idsOf((await user.c.get('/dreams/feed?limit=50')).body.dreams);

test('follows and public profiles are gone', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');
  const alice = await env.signUp('Alice');
  const bob = await env.signUp('Bobby');

  const me = await alice.c.get('/auth/me');
  assert.equal('followersCount' in me.body.user, false);
  assert.equal('followingCount' in me.body.user, false);

  assert.equal((await bob.c.get(`/users/${alice.id}`)).status, 404, 'no public profile');
  assert.equal((await bob.c.post(`/users/${alice.id}/follow`)).status, 404, 'no follow');
  assert.equal((await bob.c.get(`/dreams/user/${alice.id}`)).status, 404, 'no per-user dream list');
});

test('threaded replies', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');
  const { signUp } = env;
  const alice = await signUp('Thread-Alice');
  const bob = await signUp('Thread-Bob');
  const cara = await signUp('Thread-Cara');

  const dream = (await alice.c.post('/dreams', dreamBody('public'))).body;
  const comment = (author, content, parentId) => author.c.post(`/dreams/${dream._id}/comments`, { content, parentId });

  await t.test('replies are linked to their parent and notify the right people', async () => {
    const first = (await comment(bob, 'top level')).body.comments[0];
    assert.equal(first.parentId, null);

    const withReply = (await comment(cara, 'a reply', first._id)).body;
    const reply = withReply.comments.find((c) => c.parentId === first._id);
    assert.ok(reply);
    assert.equal(reply.isOwn, true);

    const forBob = (await inbox(bob)).notifications.find((n) => n.type === 'reply');
    assert.equal(forBob.actor.name, 'Thread-Cara');
    assert.equal(forBob.commentId, reply._id);
    // the dream's author hears about the reply as a comment, once
    const forAlice = (await inbox(alice)).notifications.filter((n) => n.commentId === reply._id);
    assert.deepEqual(forAlice.map((n) => n.type), ['comment']);
    // the replier is not notified about themselves
    assert.equal((await inbox(cara)).notifications.length, 0);
  });

  await t.test('invalid parents are rejected', async () => {
    assert.equal((await comment(bob, 'x', '65f000000000000000000099')).status, 404);
    const other = (await alice.c.post('/dreams', dreamBody('public'))).body;
    const foreign = (await bob.c.post(`/dreams/${other._id}/comments`, { content: 'elsewhere' })).body.comments[0];
    assert.equal((await comment(bob, 'cross-dream reply', foreign._id)).status, 404);
    assert.equal((await comment(bob, 'x', 'not-an-id')).status, 400);
  });

  await t.test('threads stop at the maximum depth', async () => {
    const d = (await alice.c.post('/dreams', dreamBody('public'))).body;
    let parentId;
    for (let depth = 0; depth <= 4; depth += 1) {
      const res = await bob.c.post(`/dreams/${d._id}/comments`, { content: `level ${depth}`, parentId });
      assert.equal(res.status, 201, `depth ${depth}`);
      parentId = res.body.comments.find((c) => c.content === `level ${depth}`)._id;
    }
    const tooDeep = await bob.c.post(`/dreams/${d._id}/comments`, { content: 'level 5', parentId });
    assert.equal(tooDeep.status, 400);
  });

  await t.test('deleting keeps a placeholder while replies exist, and prunes when the last reply goes', async () => {
    const d = (await alice.c.post('/dreams', dreamBody('public'))).body;
    const top = (await bob.c.post(`/dreams/${d._id}/comments`, { content: 'parent' })).body.comments[0];
    const child = (await cara.c.post(`/dreams/${d._id}/comments`, { content: 'child', parentId: top._id })).body.comments[1];

    // somebody else cannot delete it, the author can
    assert.equal((await cara.c.del(`/dreams/${d._id}/comments/${top._id}`)).status, 403);
    const afterParentDelete = (await bob.c.del(`/dreams/${d._id}/comments/${top._id}`)).body;
    const placeholder = afterParentDelete.comments.find((c) => c._id === top._id);
    assert.equal(placeholder.deleted, true);
    assert.equal(placeholder.content, '');
    assert.equal(placeholder.userName, '');
    assert.equal(afterParentDelete.commentsCount, 1);

    // replying to a deleted comment is not allowed
    assert.equal((await cara.c.post(`/dreams/${d._id}/comments`, { content: 'late', parentId: top._id })).status, 400);

    // deleting the last reply also removes the placeholder above it
    const afterChildDelete = (await cara.c.del(`/dreams/${d._id}/comments/${child._id}`)).body;
    assert.equal(afterChildDelete.comments.length, 0);
  });

  await t.test('the dream owner can delete any comment', async () => {
    const d = (await alice.c.post('/dreams', dreamBody('public'))).body;
    const c1 = (await bob.c.post(`/dreams/${d._id}/comments`, { content: 'rude' })).body.comments[0];
    assert.equal((await cara.c.get(`/dreams/${d._id}`)).body.comments[0].canDelete, false, 'a bystander cannot delete it');
    const asOwner = (await alice.c.get(`/dreams/${d._id}`)).body.comments[0];
    assert.equal(asOwner.canDelete, true);
    assert.equal((await alice.c.del(`/dreams/${d._id}/comments/${c1._id}`)).body.comments.length, 0);
  });
});

test('blocking hides people from each other, in both directions', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');
  const { signUp } = env;
  const alice = await signUp('Block-Alice');
  const bob = await signUp('Block-Bobby');
  const cara = await signUp('Block-Cara');

  const dreamA = (await alice.c.post('/dreams', dreamBody('public', { title: 'Alice dream' }))).body;
  const dreamB = (await bob.c.post('/dreams', dreamBody('public', { title: 'Bobby dream' }))).body;
  await bob.c.post(`/dreams/${dreamA._id}/comments`, { content: 'bob on alice' });
  await bob.c.post(`/dreams/${dreamA._id}/like`);
  assert.ok((await inbox(alice)).notifications.length >= 2, 'Alice was notified before blocking');

  await t.test('blocking removes the dreams, comments and notifications between the two', async () => {
    assert.equal((await alice.c.post(`/dreams/${dreamB._id}/block-author`)).status, 200);

    // feeds
    assert.equal((await feedIds(alice)).includes(dreamB._id), false);
    assert.equal((await feedIds(bob)).includes(dreamA._id), false);
    assert.equal((await feedIds(cara)).includes(dreamA._id) && (await feedIds(cara)).includes(dreamB._id), true);

    // direct access looks like the dream does not exist, for both sides
    assert.equal((await alice.c.get(`/dreams/${dreamB._id}`)).status, 404);
    assert.equal((await bob.c.get(`/dreams/${dreamA._id}`)).status, 404);
    assert.equal((await bob.c.post(`/dreams/${dreamA._id}/like`)).status, 404);
    assert.equal((await bob.c.post(`/dreams/${dreamA._id}/comments`, { content: 'hello?' })).status, 404);

    // Bobby's comment is gone for Alice, but still there for Cara
    const seenByAlice = (await alice.c.get(`/dreams/${dreamA._id}`)).body;
    assert.equal(seenByAlice.comments.length, 0);
    const seenByCara = (await cara.c.get(`/dreams/${dreamA._id}`)).body;
    assert.equal(seenByCara.comments.length, 1);

    // notifications between them were deleted
    assert.equal((await inbox(alice)).notifications.length, 0);
    assert.equal((await alice.c.get('/notifications/unread-count')).body.unreadCount, 0);
  });

  await t.test('blocked people cannot be mentioned, searched, or notified', async () => {
    assert.equal((await alice.c.get('/users/search?q=Block-Bob')).body.length, 0);
    assert.equal((await bob.c.get('/users/search?q=Block-Ali')).body.length, 0);
    assert.equal((await cara.c.get('/users/search?q=Block-Bob')).body.length, 1);

    const mention = (await alice.c.post('/dreams', dreamBody('public', { mentions: [bob.id] }))).body;
    assert.deepEqual(mention.mentions, []);
    assert.equal((await inbox(bob)).notifications.length, 0);

    // Cara replying where Bobby cannot see is fine; a reply to Bobby's own comment by Alice is impossible
    const bobsComment = (await cara.c.get(`/dreams/${dreamA._id}`)).body.comments[0];
    assert.equal((await alice.c.post(`/dreams/${dreamA._id}/comments`, { content: 'reply', parentId: bobsComment._id })).status, 404);
  });

  await t.test('the block list shows the person, and only its owner can remove it', async () => {
    const list = (await alice.c.get('/blocks')).body;
    assert.equal(list.total, 1);
    assert.equal(list.blocks[0].user.name, 'Block-Bobby');
    assert.equal(list.blocks[0].anonymous, false);
    assert.equal(JSON.stringify(list).includes(bob.id), false, 'ids of blocked users are never sent');
    assert.equal((await bob.c.get('/blocks')).body.total, 0, 'the blocked person is not told');

    assert.equal((await bob.c.del(`/blocks/${list.blocks[0]._id}`)).status, 404);
    assert.equal((await alice.c.post(`/dreams/${dreamB._id}/block-author`)).status, 404, 'cannot act on hidden content');

    assert.equal((await alice.c.del(`/blocks/${list.blocks[0]._id}`)).body.total, 0);
    assert.equal((await alice.c.get(`/dreams/${dreamB._id}`)).status, 200);
    assert.equal((await bob.c.get(`/dreams/${dreamA._id}`)).status, 200);
  });

  await t.test('blocking from anonymous content keeps the author anonymous', async () => {
    const anon = (await alice.c.post('/dreams', dreamBody('anonymous'))).body;
    assert.equal((await cara.c.post(`/dreams/${anon._id}/block-author`)).status, 200);

    const list = (await cara.c.get('/blocks')).body;
    assert.equal(list.blocks.length, 1);
    assert.equal(list.blocks[0].anonymous, true);
    assert.equal(list.blocks[0].user, null);
    const raw = JSON.stringify(list);
    assert.equal(raw.includes(alice.id), false);
    assert.equal(raw.includes('Block-Alice'), false);

    // and the block really works: they no longer see each other
    assert.equal((await cara.c.get(`/dreams/${anon._id}`)).status, 404);
    assert.equal((await cara.c.get(`/dreams/${dreamA._id}`)).status, 404);
    assert.equal((await alice.c.get(`/dreams/${dreamB._id}`)).status, 200, 'other blocks are unaffected');
  });

  await t.test('blocking from the hidden author\'s comment is anonymous too', async () => {
    const anon = (await alice.c.post('/dreams', dreamBody('anonymous'))).body;
    await alice.c.post(`/dreams/${anon._id}/comments`, { content: 'author note' });
    const note = (await bob.c.get(`/dreams/${anon._id}`)).body.comments[0];
    assert.equal(note.userName, 'Anonymous');
    assert.equal((await bob.c.post(`/dreams/${anon._id}/comments/${note._id}/block-author`)).status, 200);
    const entry = (await bob.c.get('/blocks')).body.blocks[0];
    assert.equal(entry.anonymous, true);
    assert.equal(entry.user, null);
  });

  await t.test('you cannot block yourself, and blocking twice is harmless', async () => {
    assert.equal((await alice.c.post(`/dreams/${dreamA._id}/block-author`)).status, 400);
    const d = (await bob.c.post('/dreams', dreamBody('public'))).body;
    assert.equal((await cara.c.post(`/dreams/${d._id}/block-author`)).status, 200);
    const before = (await cara.c.get('/blocks')).body.total;
    assert.equal((await cara.c.post(`/dreams/${d._id}/block-author`)).status, 404, 'now hidden, so it cannot be repeated');
    assert.equal((await cara.c.get('/blocks')).body.total, before);
  });

  await t.test('the block list is paginated, newest first', async () => {
    const victims = [];
    for (const n of ['One', 'Two', 'Three']) {
      const v = await signUp(`Victim-${n}`);
      const d = (await v.c.post('/dreams', dreamBody('public'))).body;
      await alice.c.post(`/dreams/${d._id}/block-author`);
      victims.push(d);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const page1 = (await alice.c.get('/blocks?limit=2')).body;
    assert.equal(page1.blocks.length, 2);
    assert.equal(page1.hasMore, true);
    assert.equal(page1.blocks[0].user.name, 'Victim-Three');
    const page2 = (await alice.c.get(`/blocks?limit=2&before=${encodeURIComponent(page1.nextCursor)}`)).body;
    assert.equal(page2.blocks.length, 1);
    assert.equal(page2.hasMore, false);
  });
});

test('reporting dreams and comments', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');
  const { signUp } = env;
  const alice = await signUp('Report-Alice');
  const bob = await signUp('Report-Bobby');
  const cara = await signUp('Report-Cara');

  const dream = (await alice.c.post('/dreams', dreamBody('public'))).body;
  const bobsComment = (await bob.c.post(`/dreams/${dream._id}/comments`, { content: 'spam spam' })).body.comments[0];

  await t.test('a dream can be reported once per person', async () => {
    assert.equal((await bob.c.post(`/dreams/${dream._id}/report`, { reason: 'spam', details: 'looks like an ad' })).status, 201);
    assert.equal((await bob.c.post(`/dreams/${dream._id}/report`, { reason: 'spam' })).status, 409);
    assert.equal((await cara.c.post(`/dreams/${dream._id}/report`, { reason: 'other' })).status, 201);

    const stored = await Report.find({ dreamId: dream._id, targetType: 'dream' });
    assert.equal(stored.length, 2);
    assert.equal(String(stored[0].reportedUserId), alice.id);
    assert.equal(stored[0].status, 'open');
  });

  await t.test('invalid reports and your own content are refused', async () => {
    assert.equal((await alice.c.post(`/dreams/${dream._id}/report`, { reason: 'spam' })).status, 400);
    assert.equal((await cara.c.post(`/dreams/${dream._id}/report`, { reason: 'because' })).status, 400);
    assert.equal((await cara.c.post(`/dreams/${dream._id}/report`, {})).status, 400);
    assert.equal((await bob.c.post(`/dreams/${dream._id}/comments/${bobsComment._id}/report`, { reason: 'spam' })).status, 400);
  });

  await t.test('comments can be reported, and hidden content cannot', async () => {
    assert.equal((await cara.c.post(`/dreams/${dream._id}/comments/${bobsComment._id}/report`, { reason: 'harassment' })).status, 201);
    assert.equal((await cara.c.post(`/dreams/${dream._id}/comments/${bobsComment._id}/report`, { reason: 'harassment' })).status, 409);
    const saved = await Report.findOne({ commentId: bobsComment._id });
    assert.equal(String(saved.reportedUserId), bob.id);

    const secret = (await alice.c.post('/dreams', dreamBody('private'))).body;
    assert.equal((await cara.c.post(`/dreams/${secret._id}/report`, { reason: 'spam' })).status, 404);

    await alice.c.post(`/dreams/${dream._id}/block-author`).catch(() => {});
    assert.equal((await alice.c.post(`/dreams/${dream._id}/comments/${bobsComment._id}/report`, { reason: 'spam' })).status, 201);
  });

  await t.test('reports are never exposed by the API', async () => {
    for (const path of ['/reports', '/dreams/reports', '/users/reports']) {
      assert.ok([404, 400].includes((await alice.c.get(path)).status));
    }
  });
});

test('drafts', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');
  const { signUp } = env;
  const alice = await signUp('Draft-Alice');
  const bob = await signUp('Draft-Bobby');

  await t.test('a draft is private to its author, whatever its privacy level', async () => {
    const draft = (await alice.c.post('/dreams', { status: 'draft', content: 'half a dream', privacyLevel: 'public' })).body;
    assert.equal(draft.status, 'draft');
    assert.equal(draft.title, 'Untitled draft');
    assert.equal(draft.mood, 'peaceful');

    assert.equal((await bob.c.get(`/dreams/${draft._id}`)).status, 404);
    assert.equal(await feedIds(bob).then((ids) => ids.includes(draft._id)), false);
    assert.equal(await feedIds(alice).then((ids) => ids.includes(draft._id)), false, 'not even in the author\'s public feed');

    const mine = (await alice.c.get('/dreams/mine?status=draft')).body;
    assert.deepEqual(idsOf(mine.dreams), [draft._id]);
    assert.equal(mine.counts.draft, 1);
    const published = (await alice.c.get('/dreams/mine')).body;
    assert.equal(published.dreams.length, 0);
    assert.equal(published.counts.all, 0);
    assert.equal((await alice.c.get('/auth/me')).body.user.dreamCount, 0, 'drafts do not count as dreams');

    assert.equal((await bob.c.post(`/dreams/${draft._id}/comments`, { content: 'peek' })).status, 404);
    assert.equal((await alice.c.post(`/dreams/${draft._id}/comments`, { content: 'self' })).status, 400);
    assert.equal((await bob.c.post(`/dreams/${draft._id}/report`, { reason: 'spam' })).status, 404);
  });

  await t.test('drafts autosave through updates and publishing validates completeness', async () => {
    const draft = (await alice.c.post('/dreams', { status: 'draft', content: 'a', mentions: [bob.id] })).body;
    const saved = (await alice.c.put(`/dreams/${draft._id}`, { content: 'a longer text now', status: 'draft' })).body;
    assert.equal(saved.content, 'a longer text now');
    assert.equal(saved.status, 'draft');
    assert.equal((await inbox(bob)).notifications.length, 0, 'drafts never notify');

    const tooShort = await alice.c.put(`/dreams/${draft._id}`, { content: 'short', status: 'published', privacyLevel: 'public' });
    assert.equal(tooShort.status, 400);
    assert.ok(tooShort.body.errors.some((e) => e.path === 'content'));
    assert.equal((await alice.c.get(`/dreams/${draft._id}`)).body.status, 'draft', 'a failed publish leaves the draft alone');

    const published = await alice.c.put(`/dreams/${draft._id}`, {
      status: 'published',
      title: 'Finally written',
      content: 'a complete dream that is long enough',
      privacyLevel: 'public'
    });
    assert.equal(published.status, 200);
    assert.equal(published.body.status, 'published');

    // now it is public, searchable, and the mention goes out exactly once
    assert.equal((await bob.c.get(`/dreams/${draft._id}`)).status, 200);
    assert.equal(await feedIds(bob).then((ids) => ids.includes(draft._id)), true);
    assert.deepEqual((await inbox(bob)).notifications.map((n) => n.type), ['mention']);
    assert.equal((await alice.c.get('/auth/me')).body.user.dreamCount, 1);

    // a published dream cannot go back to draft, but can be edited
    assert.equal((await alice.c.put(`/dreams/${draft._id}`, { status: 'draft' })).status, 400);
    assert.equal((await alice.c.put(`/dreams/${draft._id}`, { title: 'Renamed' })).status, 200);
    assert.equal((await inbox(bob)).notifications.length, 1, 'editing does not notify again');
  });

  await t.test('own dreams are paginated with counts per level', async () => {
    for (const level of ['public', 'private', 'anonymous', 'public']) {
      await alice.c.post('/dreams', dreamBody(level));
    }
    const page1 = (await alice.c.get('/dreams/mine?limit=2')).body;
    assert.equal(page1.dreams.length, 2);
    assert.equal(page1.hasMore, true);
    const page3 = (await alice.c.get('/dreams/mine?limit=2&page=3')).body;
    assert.equal(page3.dreams.length, 1);
    assert.equal(page3.hasMore, false);
    assert.deepEqual(
      { all: page1.counts.all, public: page1.counts.public, private: page1.counts.private, anonymous: page1.counts.anonymous },
      { all: 5, public: 3, private: 1, anonymous: 1 }
    );
    const onlyPrivate = (await alice.c.get('/dreams/mine?privacyLevel=private')).body;
    assert.equal(onlyPrivate.dreams.length, 1);
    assert.equal((await alice.c.get('/dreams/mine?limit=500')).status, 400);
    assert.equal((await env.client().get('/dreams/mine')).status, 401);
  });

  await t.test('drafts can be deleted, and the number of drafts is limited', async () => {
    const d = (await alice.c.post('/dreams', { status: 'draft', content: 'to delete' })).body;
    assert.equal((await alice.c.del(`/dreams/${d._id}`)).status, 200);
    assert.equal((await alice.c.get(`/dreams/${d._id}`)).status, 404);

    const drafter = await signUp('Draft-Hoarder');
    for (let i = 0; i < 50; i += 1) {
      const res = await drafter.c.post('/dreams', { status: 'draft', content: `draft ${i}` });
      assert.equal(res.status, 201, `draft ${i}`);
    }
    assert.equal((await drafter.c.post('/dreams', { status: 'draft', content: 'one too many' })).status, 400);
  });
});
