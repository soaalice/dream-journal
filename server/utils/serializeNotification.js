import { canView } from './serialize.js';

const idOf = (value) => String(value?._id ?? value);

/**
 * Turns a notification (with `actorId` and `dreamId` populated) into what the client receives.
 * Returns `null` when the notification must not be shown (dream deleted, no longer visible to the
 * recipient, or involving someone they have a block with), so callers can drop it.
 *
 * Anonymity is enforced twice: the service never stores the author of an anonymous dream as actor,
 * and this function also hides the actor if it ever finds that author on an anonymous dream.
 */
export const serializeNotification = (n, viewerId, blocked = new Set()) => {
  const dream = n.dreamId && n.dreamId.title !== undefined ? n.dreamId : null;

  // Staff are told about appeals: the appeal itself is in the moderation panel.
  if (n.type === 'appeal') {
    const s = n.staff ?? {};
    return {
      _id: String(n._id),
      type: 'appeal',
      read: Boolean(n.readAt),
      createdAt: n.updatedAt ?? n.createdAt,
      count: 1,
      actor: null,
      dream: null,
      commentId: null,
      appeal: {
        _id: idOf(n.appealId),
        targetType: s.targetType,
        title: s.title ?? '',
        excerpt: s.excerpt ?? '',
        authorName: s.authorName ?? '',
        status: n.appealId?.status ?? 'open'
      }
    };
  }

  // Moderation notices are addressed to the author and carry their own copy of the text, so they do not depend
  // on the content still being visible (or existing).
  if (n.type === 'moderation') {
    const m = n.moderation ?? {};
    return {
      _id: String(n._id),
      type: 'moderation',
      read: Boolean(n.readAt),
      createdAt: n.updatedAt ?? n.createdAt,
      count: 1,
      actor: null,
      dream: dream ? { _id: idOf(dream), title: dream.title } : null,
      commentId: n.commentId ? String(n.commentId) : null,
      moderation: {
        event: m.event,
        kind: m.kind,
        title: m.title ?? '',
        excerpt: m.excerpt ?? '',
        message: m.message ?? '',
        reasons: [...(m.reasons ?? [])],
        appeal: n.appealId?.status ? { status: n.appealId.status } : null,
        canAppeal: m.event === 'removed' && !n.appealId
      }
    };
  }

  if (!dream || !canView(dream, viewerId, blocked)) return null;
  if (n.actorId && blocked.has(idOf(n.actorId))) return null;

  const actorIsAnonymousAuthor =
    dream.privacyLevel === 'anonymous' && n.actorId && idOf(n.actorId) === idOf(dream.userId) && idOf(n.actorId) !== String(viewerId);
  const actor = n.actorId?.name && !actorIsAnonymousAuthor ? n.actorId : null;

  return {
    _id: String(n._id),
    type: n.type,
    read: Boolean(n.readAt),
    createdAt: n.updatedAt ?? n.createdAt,
    count: n.count ?? 1,
    actor: actor ? { _id: idOf(actor), name: actor.name, avatarUrl: actor.avatarUrl } : null,
    dream: { _id: idOf(dream), title: dream.title },
    commentId: n.commentId ? String(n.commentId) : null
  };
};
