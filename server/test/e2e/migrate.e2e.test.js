import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { migrate } from '../../scripts/migrate.js';
import { startE2E } from './helpers.js';

let env;
before(async () => {
  env = await startE2E('migrate');
});
after(async () => env?.stop());

test('migration removes follows, marks old dreams published, and is safe to repeat', async (t) => {
  if (!env.available) return t.skip('MongoDB is not reachable');
  const db = mongoose.connection.db;
  const id = () => new mongoose.Types.ObjectId();

  // documents as the old version of the app stored them
  const [alice, bob] = [id(), id()];
  await db.collection('users').insertMany([
    { _id: alice, name: 'Alice', email: 'a@x.io', following: [bob], followersCount: 1 },
    { _id: bob, name: 'Bob', email: 'b@x.io' }
  ]);
  await db.collection('notifications').insertMany([
    { userId: bob, type: 'follow', actorId: alice },
    { userId: alice, type: 'comment', actorId: bob }
  ]);
  await db.collection('dreams').insertMany([
    { userId: alice, title: 'Old', content: 'a dream written before drafts existed', mood: 'happy', privacyLevel: 'public', comments: [] },
    { userId: alice, title: 'Draft', content: 'x', mood: 'happy', status: 'draft', comments: [] }
  ]);

  const first = await migrate(db);
  assert.equal(first.usersCleaned, 1);
  assert.equal(first.followNotificationsDeleted, 1);
  assert.equal(first.dreamsMarkedPublished, 1, 'only the dream without a status is touched');

  assert.equal((await db.collection('users').findOne({ _id: alice })).following, undefined);
  assert.equal(await db.collection('notifications').countDocuments({ type: 'follow' }), 0);
  assert.equal(await db.collection('notifications').countDocuments({ type: 'comment' }), 1, 'other notifications stay');
  assert.equal((await db.collection('dreams').findOne({ title: 'Old' })).status, 'published');
  assert.equal((await db.collection('dreams').findOne({ title: 'Draft' })).status, 'draft');

  const second = await migrate(db);
  assert.deepEqual(
    [second.usersCleaned, second.followNotificationsDeleted, second.dreamsMarkedPublished],
    [0, 0, 0]
  );
});
