/**
 * Moderation state changes shared by the report queue, appeals and auto-hiding.
 *
 * Content is never deleted by moderators: it is switched to `hidden` (automatic, pending review) or `removed`
 * (a moderator's decision) and can be switched back. Hidden and removed content is invisible to everyone except its
 * author, who is told and can appeal.
 */
import Dream from '../models/Dream.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import { audit } from './audit.js';
import { notifyModeration, removeForComments, removeForDreamExceptOwner } from './notifications.js';

const idOf = (value) => String(value?._id ?? value);
const clip = (text = '', n = 280) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

/** Finds the dream and (for comments) the comment document a case is about, or nulls if they are gone. */
const locate = async ({ dreamId, commentId }) => {
  const dream = await Dream.findById(dreamId);
  const comment = commentId ? dream?.comments.id(commentId) ?? null : null;
  return { dream, comment, exists: commentId ? Boolean(comment) : Boolean(dream) };
};

/** The reasons people gave, most common first (what the author is told, without who reported). */
export const reasonsFor = async ({ dreamId, commentId, status = 'open' }) => {
  const reports = await Report.find({ dreamId, commentId: commentId ?? null, status }).select('reason');
  const counts = new Map();
  for (const r of reports) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([reason]) => reason);
};

/**
 * Sets the moderation state of a dream or comment. Returns `{ changed, authorId, title, content }`;
 * `changed` is false when the content is gone or already in that state.
 */
export const setModerationState = async ({ dreamId, commentId, state, by = null, message = '' }) => {
  const { dream, comment, exists } = await locate({ dreamId, commentId });
  if (!exists) return { changed: false };

  const target = comment ?? dream;
  const current = target.moderationState ?? 'visible';
  const authorId = idOf(target.userId);
  const info = { authorId, title: dream.title, content: comment ? comment.content : dream.content };
  if (current === state) return { changed: false, ...info };

  target.moderationState = state;
  target.moderatedAt = state === 'visible' ? null : new Date();
  target.moderatedBy = state === 'removed' ? by : null;
  target.moderationMessage = state === 'visible' ? '' : message;
  await dream.save();

  // Removing hides the content from everybody, so notifications other people got about it no longer apply.
  if (state !== 'visible') {
    if (comment) await removeForComments([String(comment._id)]);
    else await removeForDreamExceptOwner({ dreamId: dream._id, ownerId: dream.userId });
  }
  return { changed: true, previous: current, ...info };
};

/**
 * Tells the author what happened to their content.
 * `event`: removed | hidden | restored | appeal_upheld | appeal_overturned
 */
export const tellAuthor = ({ event, authorId, dreamId, commentId, title, content, message = '', reasons = [] }) =>
  notifyModeration({
    userId: authorId,
    event,
    kind: commentId ? 'comment' : 'dream',
    dreamId,
    commentId,
    title,
    excerpt: clip(content),
    message,
    reasons
  });

/**
 * Called after a report is filed: hides the content automatically once enough different people reported it.
 * Staff are exempt (so a mass-report cannot silence a moderator), and `threshold` 0 switches this off.
 */
export const maybeAutoHide = async ({ threshold, dreamId, commentId = null }) => {
  if (!threshold || threshold < 1) return false;

  const open = await Report.countDocuments({ dreamId, commentId, status: 'open' });
  if (open < threshold) return false;

  const { dream, comment, exists } = await locate({ dreamId, commentId });
  if (!exists || (comment ?? dream).moderationState !== 'visible') return false;

  const author = await User.findById((comment ?? dream).userId).select('role');
  if (author && author.role !== 'user') return false;

  const result = await setModerationState({
    dreamId,
    commentId,
    state: 'hidden',
    message: 'Hidden while moderators review reports about it.'
  });
  if (!result.changed) return false;

  await audit(null, {
    action: 'auto_hidden',
    targetType: commentId ? 'comment' : 'dream',
    dreamId,
    commentId,
    targetUserId: result.authorId,
    reportCount: open,
    note: `Hidden automatically after ${open} reports (threshold ${threshold})`,
    snapshot: { title: result.title, content: clip(result.content, 2000) }
  });
  await tellAuthor({
    event: 'hidden',
    authorId: result.authorId,
    dreamId,
    commentId,
    title: result.title,
    content: result.content,
    message: 'It will come back if moderators find nothing wrong.',
    reasons: await reasonsFor({ dreamId, commentId })
  });
  return true;
};
