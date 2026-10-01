import { Comment } from '../types';

/** Replies may nest this deep (top-level comments are depth 0). Keep in sync with MAX_REPLY_DEPTH on the server. */
export const MAX_REPLY_DEPTH = 4;

export interface CommentNode {
  comment: Comment;
  children: CommentNode[];
}

/**
 * The API returns comments as a flat list with `parentId`. This builds the tree, keeping the original
 * (chronological) order among siblings. A comment whose parent is missing is treated as top-level so it is
 * never lost.
 */
export const buildCommentTree = (comments: Comment[]): CommentNode[] => {
  const nodes = new Map<string, CommentNode>(comments.map((c) => [c._id, { comment: c, children: [] }]));
  const roots: CommentNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.comment.parentId ? nodes.get(node.comment.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
};

/** Number of replies below a node, at any depth, not counting placeholders. */
export const countReplies = (node: CommentNode): number =>
  node.children.reduce((sum, child) => sum + (child.comment.deleted ? 0 : 1) + countReplies(child), 0);
