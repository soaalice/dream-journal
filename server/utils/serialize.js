/**
 * Serialization layer. All privacy rules that depend on *who is asking* live here
 * and in `visibilityFilter`, so routes never leak raw documents.
 */
import Dream from '../models/Dream.js';

const idOf = (value) => String(value?._id ?? value);
const NO_BLOCKS = new Set();
/** moderation states that hide content from everyone but its author */
export const HIDDEN_BY_MODERATION = ['hidden', 'removed'];
const isModerated = (item) => HIDDEN_BY_MODERATION.includes(item?.moderationState);

const isOwnerOf = (dream, viewerId) => Boolean(viewerId) && idOf(dream.userId) === String(viewerId);

/**
 * Mongo filter matching every dream the viewer may read: published public/anonymous ones plus their own
 * (drafts and private dreams included), minus anything by someone blocked in either direction.
 */
export const visibilityFilter = (viewerId, blocked = NO_BLOCKS) => {
  const published = {
    status: { $ne: 'draft' },
    moderationState: { $nin: HIDDEN_BY_MODERATION },
    privacyLevel: { $in: ['public', 'anonymous'] }
  };
  const base = viewerId ? { $or: [published, { userId: viewerId }] } : published;
  return blocked.size > 0 ? { $and: [base, { userId: { $nin: [...blocked] } }] } : base;
};

/**
 * Drafts, private dreams and dreams hidden or removed by moderators are visible to their author only;
 * blocked authors are invisible to the viewer.
 */
export const canView = (dream, viewerId, blocked = NO_BLOCKS) => {
  if (isOwnerOf(dream, viewerId)) return true;
  if (dream.status === 'draft' || dream.privacyLevel === 'private' || isModerated(dream)) return false;
  return !blocked.has(idOf(dream.userId));
};

export const populateDream = (query) =>
  query.populate('userId', 'name avatarUrl').populate('comments.userId', 'name avatarUrl');

const ANON = { name: 'Anonymous', avatarUrl: '' };

/**
 * Comments are stored flat (with `parentId`); the client builds the tree. Comments that are deleted or written by
 * a blocked user are dropped, unless they still have visible replies, in which case an empty placeholder keeps
 * the thread readable.
 */
const serializeComments = (dream, viewerId, blocked, isOwner) => {
  const ownerId = idOf(dream.userId);
  const comments = dream.comments;

  const childrenOf = new Map();
  for (const c of comments) {
    if (!c.parentId) continue;
    const key = String(c.parentId);
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), c]);
  }

  const isMine = (c) => Boolean(viewerId) && idOf(c.userId) === String(viewerId);
  // moderated comments are still shown to the person who wrote them, so they know what was acted on
  const isHidden = (c) => c.deleted || blocked.has(idOf(c.userId)) || (isModerated(c) && !isMine(c));
  const memo = new Map();
  const hasVisibleDescendant = (c) => {
    const key = String(c._id);
    if (!memo.has(key)) {
      memo.set(key, false); // guards against cycles in corrupt data
      memo.set(key, (childrenOf.get(key) ?? []).some((child) => !isHidden(child) || hasVisibleDescendant(child)));
    }
    return memo.get(key);
  };

  return comments
    .filter((c) => !isHidden(c) || hasVisibleDescendant(c))
    .map((c) => {
      const base = { _id: String(c._id), parentId: c.parentId ? String(c.parentId) : null, createdAt: c.createdAt };

      if (isHidden(c)) {
        return { ...base, content: '', userId: null, userName: '', userAvatar: '', mentions: [], canDelete: false, isOwn: false, deleted: true };
      }

      const author = c.userId?.name ? c.userId : null;
      const authorId = idOf(c.userId);
      // The author commenting on their own anonymous dream must stay anonymous to everyone else.
      const hide = dream.privacyLevel === 'anonymous' && authorId === ownerId && !isOwner;
      const isOwn = Boolean(viewerId) && authorId === String(viewerId);

      return {
        ...base,
        content: c.content,
        userId: hide ? null : authorId,
        userName: hide ? ANON.name : author?.name ?? 'Deleted user',
        userAvatar: hide ? ANON.avatarUrl : author?.avatarUrl ?? '',
        mentions: c.mentions.map(String),
        canDelete: isOwn || isOwner,
        isOwn,
        deleted: false,
        moderation: isOwn && isModerated(c) ? { state: c.moderationState, message: c.moderationMessage } : null
      };
    });
};

export const serializeDream = (dream, viewerId, blocked = NO_BLOCKS) => {
  const ownerId = idOf(dream.userId);
  const isOwner = isOwnerOf(dream, viewerId);
  const hideAuthor = dream.privacyLevel === 'anonymous' && !isOwner;
  const owner = dream.userId?.name ? dream.userId : null;
  const comments = serializeComments(dream, viewerId, blocked, isOwner);

  return {
    _id: String(dream._id),
    title: dream.title,
    content: dream.content,
    createdAt: dream.createdAt,
    updatedAt: dream.updatedAt,
    userId: hideAuthor || !owner ? null : { _id: ownerId, name: owner.name, avatarUrl: owner.avatarUrl },
    userName: hideAuthor ? ANON.name : owner?.name ?? 'Deleted user',
    isOwner,
    status: dream.status ?? 'published',
    // only the author is told their dream was hidden or removed
    moderation: isOwner && isModerated(dream) ? { state: dream.moderationState, message: dream.moderationMessage } : null,
    privacyLevel: dream.privacyLevel,
    tags: dream.tags,
    mood: dream.mood,
    likesCount: dream.likes.length,
    likedByMe: Boolean(viewerId) && dream.likes.some((id) => String(id) === String(viewerId)),
    mentions: dream.mentions.map(String),
    commentsCount: comments.filter((c) => !c.deleted).length,
    comments
  };
};

/** The signed-in user's own account. There are no public profiles, so this is never shown to anyone else. */
export const serializeUser = async (user) => {
  const id = String(user._id);
  const dreamCount = await Dream.countDocuments({ userId: id, status: { $ne: 'draft' } });

  return {
    _id: id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    location: user.location,
    website: user.website,
    dreamCount,
    joinedAt: user.joinedAt,
    role: user.role ?? 'user'
  };
};
