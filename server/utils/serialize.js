/**
 * Serialization layer. All privacy rules that depend on *who is asking* live here
 * and in `visibilityFilter`, so routes never leak raw documents.
 */
import Dream from '../models/Dream.js';
import User from '../models/User.js';

const idOf = (value) => String(value?._id ?? value);

/** Mongo filter matching every dream the viewer may read. */
export const visibilityFilter = (viewerId) =>
  viewerId
    ? { $or: [{ privacyLevel: { $in: ['public', 'anonymous'] } }, { userId: viewerId }] }
    : { privacyLevel: { $in: ['public', 'anonymous'] } };

export const canView = (dream, viewerId) =>
  dream.privacyLevel !== 'private' || (viewerId && idOf(dream.userId) === String(viewerId));

export const populateDream = (query) =>
  query.populate('userId', 'name avatarUrl').populate('comments.userId', 'name avatarUrl');

const ANON = { name: 'Anonymous', avatarUrl: '' };

export const serializeDream = (dream, viewerId) => {
  const ownerId = idOf(dream.userId);
  const isOwner = Boolean(viewerId) && ownerId === String(viewerId);
  const hideAuthor = dream.privacyLevel === 'anonymous' && !isOwner;
  const owner = dream.userId?.name ? dream.userId : null;

  return {
    _id: String(dream._id),
    title: dream.title,
    content: dream.content,
    createdAt: dream.createdAt,
    updatedAt: dream.updatedAt,
    userId: hideAuthor || !owner ? null : { _id: ownerId, name: owner.name, avatarUrl: owner.avatarUrl },
    userName: hideAuthor ? ANON.name : owner?.name ?? 'Deleted user',
    isOwner,
    privacyLevel: dream.privacyLevel,
    tags: dream.tags,
    mood: dream.mood,
    likesCount: dream.likes.length,
    likedByMe: Boolean(viewerId) && dream.likes.some((id) => String(id) === String(viewerId)),
    mentions: dream.mentions.map(String),
    comments: dream.comments.map((c) => {
      const author = c.userId?.name ? c.userId : null;
      const authorId = idOf(c.userId);
      // The owner commenting on their own anonymous dream must stay anonymous too.
      const hide = dream.privacyLevel === 'anonymous' && authorId === ownerId && !isOwner;
      const isCommentOwner = Boolean(viewerId) && authorId === String(viewerId);
      return {
        _id: String(c._id),
        content: c.content,
        userId: hide ? null : authorId,
        userName: hide ? ANON.name : author?.name ?? 'Deleted user',
        userAvatar: hide ? ANON.avatarUrl : author?.avatarUrl ?? '',
        createdAt: c.createdAt,
        mentions: c.mentions.map(String),
        canDelete: isCommentOwner || isOwner
      };
    })
  };
};

export const serializeUser = async (user, viewerId) => {
  const id = String(user._id);
  const isSelf = Boolean(viewerId) && id === String(viewerId);
  const [dreamCount, followersCount, followingEntry] = await Promise.all([
    Dream.countDocuments(isSelf ? { userId: id } : { userId: id, privacyLevel: 'public' }),
    User.countDocuments({ following: id }),
    viewerId && !isSelf ? User.exists({ _id: viewerId, following: id }) : null
  ]);

  return {
    _id: id,
    name: user.name,
    ...(isSelf ? { email: user.email } : {}),
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    location: user.location,
    website: user.website,
    dreamCount,
    followersCount,
    followingCount: user.following.length,
    isFollowing: Boolean(followingEntry),
    joinedAt: user.joinedAt
  };
};
