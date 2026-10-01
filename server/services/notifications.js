/**
 * Notification service. Routes call these after their main action succeeds.
 *
 * Rules, enforced here so no route can forget them:
 * - never notify about private dreams;
 * - never notify someone about their own action;
 * - if the actor is the author of an anonymous dream, the actor is NOT stored (`actorId: null`).
 *
 * Every function swallows its own errors: a failed notification must never fail the comment, like or follow.
 */
import Notification from '../models/Notification.js';

const idOf = (value) => String(value?._id ?? value);

const safely = (name, fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (error) {
    console.error(`Notification "${name}" failed:`, error.message);
  }
};

/** Minimal dream shape needed here: { _id, userId, privacyLevel } (userId may be populated). */
const actorFor = (dream, actorId) =>
  dream.privacyLevel === 'anonymous' && idOf(dream.userId) === idOf(actorId) ? null : actorId;

const uniqueRecipients = (ids, actorId) => [...new Set(ids.map(idOf))].filter((id) => id !== idOf(actorId));

export const notifyMentions = safely('mentions', async ({ dream, actorId, commentId, mentionIds }) => {
  if (dream.privacyLevel === 'private') return;
  const recipients = uniqueRecipients(mentionIds, actorId);
  if (recipients.length === 0) return;

  const actor = actorFor(dream, actorId);
  await Notification.insertMany(
    recipients.map((userId) => ({ userId, type: 'mention', actorId: actor, dreamId: dream._id, commentId }))
  );
});

export const notifyComment = safely('comment', async ({ dream, actorId, commentId, mentionIds = [] }) => {
  if (dream.privacyLevel === 'private') return;
  const ownerId = idOf(dream.userId);

  // The owner gets one notification per comment: a mention wins over a plain comment notice.
  const ownerAlreadyMentioned = mentionIds.map(idOf).includes(ownerId);
  if (ownerId !== idOf(actorId) && !ownerAlreadyMentioned) {
    await Notification.create({ userId: ownerId, type: 'comment', actorId, dreamId: dream._id, commentId });
  }
  await notifyMentions({ dream, actorId, commentId, mentionIds });
});

/** `liked` is the state after the toggle: true = a like was added, false = it was removed. */
export const notifyLike = safely('like', async ({ dream, actorId, liked }) => {
  if (dream.privacyLevel === 'private') return;
  const ownerId = idOf(dream.userId);
  if (ownerId === idOf(actorId)) return;

  const key = { userId: ownerId, type: 'like', dreamId: dream._id };
  if (liked) {
    await Notification.findOneAndUpdate(
      key,
      { $inc: { count: 1 }, $set: { actorId, readAt: null } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } else {
    // Do not bump the timestamp for an unlike, so the row does not jump to the top.
    await Notification.updateOne(key, { $inc: { count: -1 } }, { timestamps: false });
    await Notification.deleteOne({ ...key, count: { $lte: 0 } });
  }
});

export const notifyFollow = safely('follow', async ({ targetId, actorId, following }) => {
  const key = { userId: targetId, type: 'follow', actorId };
  if (following) {
    await Notification.findOneAndUpdate(key, { $set: { readAt: null } }, { upsert: true, setDefaultsOnInsert: true });
  } else {
    await Notification.deleteOne(key);
  }
});

export const removeForDream = safely('removeForDream', (dreamId) => Notification.deleteMany({ dreamId }));

export const removeForComment = safely('removeForComment', (commentId) => Notification.deleteMany({ commentId }));

/** When a dream becomes private, everyone but its author loses the notifications about it. */
export const removeForDreamExceptOwner = safely('removeForDreamExceptOwner', ({ dreamId, ownerId }) =>
  Notification.deleteMany({ dreamId, userId: { $ne: ownerId } })
);

/**
 * Account deletion: the notifications the user received, the ones they caused, and anything about
 * their dreams (this also catches hidden-actor notifications, which have no `actorId`).
 */
export const removeForUser = safely('removeForUser', ({ userId, dreamIds = [] }) =>
  Notification.deleteMany({ $or: [{ userId }, { actorId: userId }, { dreamId: { $in: dreamIds } }] })
);
