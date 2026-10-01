import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import Notification from '../../models/Notification.js';
import { dreamBody, inbox, startE2E } from './helpers.js';

let env;
before(async () => {
  env = await startE2E('notifications');
});
after(async () => env?.stop());

test('notification flow', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');

  const { signUp } = env;
  const alice = await signUp('Alice');
  const bob = await signUp('Bobby');
  const cara = await signUp('Carla');

  await t.test('an anonymous dream: comments, mentions and likes notify without leaking the author', async () => {
    const dream = (await alice.c.post('/dreams', dreamBody('anonymous'))).body;

    // Bob comments and mentions Cara
    const mention = `@[Carla](${cara.id}) look at this`;
    const commented = await bob.c.post(`/dreams/${dream._id}/comments`, { content: mention, mentions: [cara.id] });
    assert.equal(commented.status, 201);

    const forAlice = await inbox(alice);
    assert.deepEqual(forAlice.notifications.map((n) => n.type), ['comment']);
    assert.equal(forAlice.notifications[0].actor.name, 'Bobby');
    assert.equal(forAlice.unreadCount, 1);

    const forCara = await inbox(cara);
    assert.deepEqual(forCara.notifications.map((n) => n.type), ['mention']);
    assert.equal(forCara.notifications[0].actor.name, 'Bobby');

    // Alice (the hidden author) replies and mentions Cara: her identity must not reach Cara
    await alice.c.post(`/dreams/${dream._id}/comments`, { content: `@[Carla](${cara.id}) thanks`, mentions: [cara.id] });
    const caraAfter = await inbox(cara);
    assert.equal(caraAfter.notifications.length, 2);
    const hidden = caraAfter.notifications.find((n) => n.actor === null);
    assert.ok(hidden, 'the author mention has no actor');
    const raw = JSON.stringify(caraAfter);
    assert.equal(raw.includes(alice.id), false, 'author id must not appear in Cara\'s notifications');
    assert.equal(raw.includes('Alice'), false);
    const stored = await Notification.find({ userId: cara.id, actorId: null });
    assert.equal(stored.length, 1, 'the hidden actor is not even stored');

    // Likes are grouped, and unliking shrinks then removes the row
    await bob.c.post(`/dreams/${dream._id}/like`);
    await cara.c.post(`/dreams/${dream._id}/like`);
    let likes = (await inbox(alice)).notifications.filter((n) => n.type === 'like');
    assert.equal(likes.length, 1);
    assert.equal(likes[0].count, 2);

    await bob.c.post(`/dreams/${dream._id}/like`); // unlike
    likes = (await inbox(alice)).notifications.filter((n) => n.type === 'like');
    assert.equal(likes[0].count, 1);
    await cara.c.post(`/dreams/${dream._id}/like`); // unlike
    likes = (await inbox(alice)).notifications.filter((n) => n.type === 'like');
    assert.equal(likes.length, 0);

    // Alice never notifies herself
    await alice.c.post(`/dreams/${dream._id}/like`);
    assert.equal((await inbox(alice)).notifications.filter((n) => n.type === 'like').length, 0);
  });

  await t.test('read state, mark all, dismiss, and ownership', async () => {
    const list = await inbox(alice);
    assert.ok(list.unreadCount > 0);
    assert.equal((await alice.c.get('/notifications/unread-count')).body.unreadCount, list.unreadCount);

    const first = list.notifications[0];
    const readOne = await alice.c.post('/notifications/read', { ids: [first._id] });
    assert.equal(readOne.body.unreadCount, list.unreadCount - 1);

    // somebody else cannot delete my notification
    assert.equal((await cara.c.del(`/notifications/${first._id}`)).status, 404);
    assert.equal((await bob.c.post('/notifications/read', { ids: [first._id] })).body.unreadCount, 0);
    assert.equal((await alice.c.get('/notifications')).body.notifications.length, list.notifications.length);

    assert.equal((await alice.c.post('/notifications/read')).body.unreadCount, 0);
    assert.equal((await alice.c.del(`/notifications/${first._id}`)).status, 200);
    assert.equal((await alice.c.del(`/notifications/${first._id}`)).status, 404);
    assert.equal((await alice.c.del('/notifications/not-an-id')).status, 400);
  });

  await t.test('pagination uses a keyset cursor', async () => {
    const dream = (await alice.c.post('/dreams', dreamBody('public'))).body;
    for (const text of ['one', 'two', 'three']) {
      await bob.c.post(`/dreams/${dream._id}/comments`, { content: text });
      await new Promise((resolve) => setTimeout(resolve, 5)); // distinct timestamps
    }

    const page1 = (await alice.c.get('/notifications?limit=2')).body;
    assert.equal(page1.notifications.length, 2);
    assert.equal(page1.hasMore, true);

    const page2 = (await alice.c.get(`/notifications?limit=2&before=${encodeURIComponent(page1.nextCursor)}`)).body;
    assert.equal(page2.notifications.length, 1);
    assert.equal(page2.hasMore, false);
    const ids = [...page1.notifications, ...page2.notifications].map((n) => n._id);
    assert.equal(new Set(ids).size, 3, 'no duplicates across pages');

    assert.equal((await alice.c.get('/notifications?limit=1000')).status, 400);
  });

  await t.test('private dreams never notify, and going private clears other people\'s notifications', async () => {
    const priv = (await alice.c.post('/dreams', dreamBody('private', { mentions: [bob.id] }))).body;
    assert.equal((await inbox(bob)).notifications.some((n) => n.dream?._id === priv._id), false);
    assert.equal((await bob.c.post(`/dreams/${priv._id}/comments`, { content: 'hi' })).status, 404);

    const pub = (await alice.c.post('/dreams', dreamBody('public', { mentions: [bob.id] }))).body;
    assert.ok((await inbox(bob)).notifications.some((n) => n.type === 'mention' && n.dream._id === pub._id));
    // re-saving does not notify the same person twice
    await alice.c.put(`/dreams/${pub._id}`, { title: 'Renamed dream' });
    assert.equal((await inbox(bob)).notifications.filter((n) => n.dream?._id === pub._id).length, 1);

    await alice.c.put(`/dreams/${pub._id}`, { privacyLevel: 'private' });
    assert.equal((await inbox(bob)).notifications.some((n) => n.dream?._id === pub._id), false);
  });

  await t.test('deleting a comment, a dream or an account cleans notifications up', async () => {
    const dream = (await alice.c.post('/dreams', dreamBody('public'))).body;
    const withComment = (await bob.c.post(`/dreams/${dream._id}/comments`, { content: 'nice' })).body;
    const commentId = withComment.comments[0]._id;
    assert.ok((await inbox(alice)).notifications.some((n) => n.commentId === commentId));
    await bob.c.del(`/dreams/${dream._id}/comments/${commentId}`);
    assert.equal((await inbox(alice)).notifications.some((n) => n.commentId === commentId), false);

    await cara.c.post(`/dreams/${dream._id}/like`);
    assert.ok((await inbox(alice)).notifications.some((n) => n.type === 'like' && n.dream._id === dream._id));
    await alice.c.del(`/dreams/${dream._id}`);
    assert.equal(await Notification.countDocuments({ dreamId: dream._id }), 0);

    const bobsDream = (await bob.c.post('/dreams', dreamBody('public'))).body;
    await cara.c.post(`/dreams/${bobsDream._id}/comments`, { content: 'hello' });
    await cara.c.del('/users/me', { password: 'password123' });
    assert.equal(await Notification.countDocuments({ $or: [{ userId: cara.id }, { actorId: cara.id }] }), 0);
    assert.equal((await inbox(bob)).notifications.length, 0);
  });

  await t.test('endpoints require a session', async () => {
    const anonymous = env.client();
    assert.equal((await anonymous.get('/notifications')).status, 401);
    assert.equal((await anonymous.get('/notifications/unread-count')).status, 401);
    assert.equal((await anonymous.post('/notifications/read')).status, 401);
  });
});
