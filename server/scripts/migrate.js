/**
 * One-off data migration for databases created before:
 *   - follows were removed (drops `users.following`, the follow notifications and their indexes);
 *   - dreams got a `status` (existing dreams become `published`).
 *
 * Safe to run more than once. Run it with:  npm run migrate
 */
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { loadConfig } from '../config.js';

const dropIndex = async (collection, name) => {
  try {
    await collection.dropIndex(name);
    return true;
  } catch {
    return false; // already gone
  }
};

/** Works on any connection, so tests can run it against a throwaway database. */
export const migrate = async (db) => {
  const users = db.collection('users');
  const notifications = db.collection('notifications');
  const dreams = db.collection('dreams');

  const unsetFollowing = await users.updateMany({ following: { $exists: true } }, { $unset: { following: '' } });
  const followNotifications = await notifications.deleteMany({ type: 'follow' });
  const droppedIndexes = [
    await dropIndex(users, 'following_1'),
    await dropIndex(notifications, 'userId_1_actorId_1'),
    await dropIndex(dreams, 'userId_1_createdAt_-1')
  ].filter(Boolean).length;
  const statusSet = await dreams.updateMany({ status: { $exists: false } }, { $set: { status: 'published' } });

  return {
    usersCleaned: unsetFollowing.modifiedCount,
    followNotificationsDeleted: followNotifications.deletedCount,
    dreamsMarkedPublished: statusSet.modifiedCount,
    indexesDropped: droppedIndexes
  };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const { mongoUri } = loadConfig();
  await mongoose.connect(mongoUri);
  console.log('Migrating', mongoose.connection.name);
  console.log(await migrate(mongoose.connection.db));
  await mongoose.disconnect();
}
