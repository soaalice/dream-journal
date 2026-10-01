/**
 * Comment deletion, shared by the author/owner route and by moderators.
 *
 * A comment that still has replies becomes an empty "deleted" placeholder so the thread stays readable; one
 * without replies is removed, together with deleted ancestors that are left childless.
 *
 * Takes a Dream document (not populated) and mutates it; the caller saves.
 * Returns the ids of every comment that was removed or turned into a placeholder.
 */
export const deleteCommentFromDream = (dream, commentId) => {
  const comment = dream.comments.id(commentId);
  if (!comment || comment.deleted) return [];

  const hasReplies = (c) => dream.comments.some((other) => String(other.parentId) === String(c._id));
  const affected = [String(commentId)];

  if (hasReplies(comment)) {
    comment.deleted = true;
    comment.content = '[deleted]';
    comment.mentions = [];
    return affected;
  }

  let current = comment;
  while (current) {
    const parent = current.parentId ? dream.comments.id(current.parentId) : null;
    dream.comments.pull(current._id);
    current = parent && parent.deleted && !hasReplies(parent) ? parent : null;
    if (current) affected.push(String(current._id));
  }
  return affected;
};
