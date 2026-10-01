/**
 * Notification service. Routes call these after their main action succeeds.
 *
 * Rules, enforced here so no route can forget them:
 * - never notify about private dreams or drafts;
 * - never notify someone about their own action;
 * - never notify across a block (`blocked` is the set of users blocked in either direction with the actor);
 * - if the actor is the author of an anonymous dream, the actor is NOT stored (`actorId: null`).
 *
 * Every function swallows its own errors: a failed notification must never fail the comment or like.
 */
import Dream from '../models/Dream.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

const idOf = (value) => String(value?._id ?? value);

const safely = (name, fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (error) {
    console.error(`Notification "${name}" failed:`, error.message);
  }
};

const isHidden = (dream) => dream.privacyLevel === 'private' || dream.status === 'draft';

/** Minimal dream shape needed here: { _id, userId, privacyLevel, status } (userId may be populated). */
const actorFor = (dream, actorId) =>
  dream.privacyLevel === 'anonymous' && idOf(dream.userId) === idOf(actorId) ? null : actorId;

const recipientsFor = (ids, actorId, blocked) =>
  [...new Set(ids.filter(Boolean).map(idOf))].filter((id) => id !== idOf(actorId) && !blocked.has(id));

export const notifyMentions = safely('mentions', async ({ dream, actorId, commentId, mentionIds, blocked = new Set() }) => {
  if (isHidden(dream)) return;
  const recipients = recipientsFor(mentionIds, actorId, blocked);
  if (recipients.length === 0) return;

  const actor = actorFor(dream, actorId);
  await Notification.insertMany(
    recipients.map((userId) => ({ userId, type: 'mention', actorId: actor, dreamId: dream._id, commentId }))
  );
});

/**
 * A new comment or reply. Each person gets at most one notification for it, in this order of priority:
 * mention > reply (to their comment) > comment (on their dream).
 */
export const notifyComment = safely(
  'comment',
  async ({ dream, actorId, commentId, mentionIds = [], parentAuthorId = null, blocked = new Set() }) => {
    if (isHidden(dream)) return;
    const ownerId = idOf(dream.userId);
    const mentioned = new Set(mentionIds.map(idOf));
    const actor = actorFor(dream, actorId);

    const rows = [];
    const parent = parentAuthorId ? idOf(parentAuthorId) : null;
    if (parent && !mentioned.has(parent) && recipientsFor([parent], actorId, blocked).length) {
      rows.push({ userId: parent, type: 'reply' });
    }
    if (ownerId !== parent && !mentioned.has(ownerId) && recipientsFor([ownerId], actorId, blocked).length) {
      rows.push({ userId: ownerId, type: 'comment' });
    }

    if (rows.length) {
      await Notification.insertMany(rows.map((r) => ({ ...r, actorId: actor, dreamId: dream._id, commentId })));
    }
    await notifyMentions({ dream, actorId, commentId, mentionIds, blocked });
  }
);

/** `liked` is the state after the toggle: true = a like was added, false = it was removed. */
export const notifyLike = safely('like', async ({ dream, actorId, liked, blocked = new Set() }) => {
  if (isHidden(dream)) return;
  const ownerId = idOf(dream.userId);
  if (ownerId === idOf(actorId) || blocked.has(ownerId)) return;

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

/**
 * Tells an author what moderators did with their content. These are kept when the content is deleted or hidden (they
 * carry their own copy of the text), so the cleanup helpers below never touch them.
 * `event`: removed | hidden | restored | appeal_upheld | appeal_overturned
 */
export const notifyModeration = safely('moderation', async ({ userId, event, kind, dreamId, commentId, title, excerpt, message, reasons }) => {
  await Notification.create({
    userId,
    type: 'moderation',
    actorId: null,
    dreamId: dreamId ?? undefined,
    commentId: commentId ?? undefined,
    moderation: { event, kind, title, excerpt, message, reasons }
  });
});

/**
 * An author appealed: moderators and administrators are told so the appeal does not sit unseen. Appeals against a
 * suspension go to administrators only (moderators cannot decide them), and a moderator is not asked to review an
 * appeal against their own decision. Suspended staff are skipped.
 */
export const notifyStaffOfAppeal = safely('staffAppeal', async ({ appeal, authorName, excludeUserId = null }) => {
  const roles = appeal.targetType === 'account' ? ['admin'] : ['moderator', 'admin'];
  const staff = await User.find({ role: { $in: roles }, suspendedAt: null }).select('_id role');
  const recipients = staff.filter((u) => u.role === 'admin' || idOf(u) !== idOf(excludeUserId));
  if (recipients.length === 0) return;

  const staffInfo = {
    targetType: appeal.targetType,
    title: appeal.snapshot?.title ?? '',
    excerpt: (appeal.targetType === 'account' ? appeal.message : appeal.snapshot?.content ?? '').slice(0, 300),
    authorName
  };
  await Notification.insertMany(
    recipients.map((u) => ({ userId: u._id, type: 'appeal', actorId: null, appealId: appeal._id, staff: staffInfo }))
  );
});

/** Once an appeal is decided, the staff notifications about it are done with. */
export const markAppealNotificationsRead = safely('markAppealRead', (appealId) =>
  Notification.updateMany({ type: 'appeal', appealId, readAt: null }, { $set: { readAt: new Date() } }, { timestamps: false })
);

const NOT_MODERATION = { type: { $nin: ['moderation', 'appeal'] } };

export const removeForDream = safely('removeForDream', (dreamId) => Notification.deleteMany({ dreamId, ...NOT_MODERATION }));

export const removeForComment = safely('removeForComment', (commentId) => Notification.deleteMany({ commentId, ...NOT_MODERATION }));

export const removeForComments = safely('removeForComments', (commentIds) =>
  Notification.deleteMany({ commentId: { $in: commentIds }, ...NOT_MODERATION })
);

/** When a dream becomes private, everyone but its author loses the notifications about it. */
export const removeForDreamExceptOwner = safely('removeForDreamExceptOwner', ({ dreamId, ownerId }) =>
  Notification.deleteMany({ dreamId, userId: { $ne: ownerId }, ...NOT_MODERATION })
);

/**
 * A new block: drop every notification each side received that came from, or is about, the other
 * (including hidden-actor ones, which are matched through the dreams).
 */
export const removeBetween = safely('removeBetween', async ({ a, b }) => {
  const [dreamsOfA, dreamsOfB] = await Promise.all([Dream.find({ userId: a }).distinct('_id'), Dream.find({ userId: b }).distinct('_id')]);
  await Notification.deleteMany({
    $or: [
      { userId: a, actorId: b },
      { userId: b, actorId: a },
      { userId: a, dreamId: { $in: dreamsOfB } },
      { userId: b, dreamId: { $in: dreamsOfA } }
    ]
  });
});

/**
 * Account deletion: the notifications the user received, the ones they caused, and anything about
 * their dreams (this also catches hidden-actor notifications, which have no `actorId`).
 */
export const removeForUser = safely('removeForUser', ({ userId, dreamIds = [] }) =>
  Notification.deleteMany({ $or: [{ userId }, { actorId: userId }, { dreamId: { $in: dreamIds } }] })
);
