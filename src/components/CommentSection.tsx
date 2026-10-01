import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, CornerDownRight, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { buildCommentTree, CommentNode, countReplies, MAX_REPLY_DEPTH } from '../lib/comments';
import { Comment } from '../types';
import Avatar from './ui/Avatar';
import { Button } from './ui/Button';
import { useConfirm } from './ui/Confirm';
import { useToast } from './ui/Toast';
import ContentMenu from './moderation/ContentMenu';
import MentionsInput from './MentionsInput';
import RelativeTime from './dream/RelativeTime';

interface CommentSectionProps {
  dreamId: string;
  comments: Comment[];
}

const MENTION_TOKEN = /@\[([^\]]+)\]\(([^)]+)\)/g;

/** Mentions are stored as @[name](id) tokens; show them as plain @name. */
const renderCommentContent = (content: string) => content.replace(MENTION_TOKEN, (_match, name) => `@${name}`);

/** Beyond this depth replies stop shifting right, so deep threads stay readable on a phone. */
const MAX_VISUAL_DEPTH = 3;

interface ComposerProps {
  placeholder: string;
  label: string;
  autoFocus?: boolean;
  onSubmit: (text: string, mentions: string[]) => Promise<void>;
  onCancel?: () => void;
}

/** Comment box used for both new comments and replies. */
const Composer: React.FC<ComposerProps> = ({ placeholder, label, autoFocus, onSubmit, onCancel }) => {
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(text, mentions);
      setText('');
      setMentions([]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <MentionsInput
        value={text}
        onChange={(value, ids) => {
          setText(value);
          setMentions(ids);
        }}
        aria-label={label}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={onCancel ? 2 : 3}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm tabular-nums text-muted">{text.length}/1000</span>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" loading={submitting} disabled={!text.trim()}>
            {onCancel ? 'Reply' : 'Comment'}
          </Button>
        </div>
      </div>
    </form>
  );
};

interface NodeProps {
  node: CommentNode;
  depth: number;
  dreamId: string;
  signedIn: boolean;
  collapsed: Set<string>;
  replyingTo: string | null;
  onToggle: (id: string) => void;
  onReplyTo: (id: string | null) => void;
  onReply: (parentId: string, text: string, mentions: string[]) => Promise<void>;
  onDelete: (commentId: string) => void;
}

const CommentThread: React.FC<NodeProps> = (props) => {
  const { node, depth, dreamId, signedIn, collapsed, replyingTo, onToggle, onReplyTo, onReply, onDelete } = props;
  const { comment, children } = node;
  const isCollapsed = collapsed.has(comment._id);
  const replyCount = countReplies(node);
  const canReply = signedIn && !comment.deleted && depth < MAX_REPLY_DEPTH;

  return (
    <li id={`comment-${comment._id}`} className="scroll-mt-24">
      {comment.deleted ? (
        <p className="rounded-lg bg-surface-2/60 px-3 py-2 text-sm italic text-muted">This comment is no longer available.</p>
      ) : (
        <div className="flex gap-3">
          <Avatar src={comment.userAvatar} name={comment.userName} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="rounded-lg bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{comment.userName}</span>
                <span className="flex items-center gap-1 text-muted">
                  <RelativeTime date={comment.createdAt} />
                  {comment.canDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(comment._id)}
                      aria-label={`Delete comment by ${comment.userName}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface hover:text-danger-text"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {signedIn && !comment.isOwn && <ContentMenu kind="comment" dreamId={dreamId} commentId={comment._id} />}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line break-words text-fg/90">{renderCommentContent(comment.content)}</p>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1 text-sm">
              {canReply && (
                <button
                  type="button"
                  onClick={() => onReplyTo(replyingTo === comment._id ? null : comment._id)}
                  aria-expanded={replyingTo === comment._id}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 font-medium text-muted hover:bg-surface-2 hover:text-accent-text"
                >
                  <CornerDownRight className="h-4 w-4" aria-hidden />
                  Reply
                </button>
              )}
              {replyCount > 0 && (
                <button
                  type="button"
                  onClick={() => onToggle(comment._id)}
                  aria-expanded={!isCollapsed}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-muted hover:bg-surface-2 hover:text-fg"
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
                  {isCollapsed ? 'Show' : 'Hide'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>

            {replyingTo === comment._id && (
              <div className="mt-2">
                <Composer
                  label={`Reply to ${comment.userName}`}
                  placeholder={`Reply to ${comment.userName}…`}
                  autoFocus
                  onSubmit={async (text, mentions) => {
                    await onReply(comment._id, text, mentions);
                    onReplyTo(null);
                  }}
                  onCancel={() => onReplyTo(null)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {children.length > 0 && !isCollapsed && (
        <ul
          className={`mt-3 space-y-3 ${depth < MAX_VISUAL_DEPTH ? 'ml-3 border-l-2 border-line pl-3 sm:ml-6 sm:pl-4' : ''}`}
        >
          {children.map((child) => (
            <CommentThread key={child.comment._id} {...props} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
};

const CommentSection: React.FC<CommentSectionProps> = ({ dreamId, comments }) => {
  const { user } = useAuth();
  const { addComment, deleteComment } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const tree = useMemo(() => buildCommentTree(comments), [comments]);
  const visibleCount = comments.filter((c) => !c.deleted).length;

  const post = async (text: string, mentions: string[], parentId?: string) => {
    try {
      await addComment(dreamId, text, mentions, parentId);
      toast.success(parentId ? 'Reply added' : 'Comment added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add comment');
      throw err;
    }
  };

  const handleDelete = async (commentId: string) => {
    const ok = await confirm({
      title: 'Delete comment?',
      description: 'If people replied to it, a placeholder stays so their replies keep their context.',
      confirmLabel: 'Delete',
      danger: true
    });
    if (!ok) return;
    try {
      await deleteComment(dreamId, commentId);
      toast.success('Comment deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  };

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <section id="comments" aria-labelledby="comments-title" className="scroll-mt-24">
      <h2 id="comments-title" className="mb-4 text-lg font-semibold">
        Comments <span className="text-muted">({visibleCount})</span>
      </h2>

      {user ? (
        <div className="mb-6 flex gap-3">
          <Avatar src={user.avatarUrl} name={user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <Composer
              label="Write a comment"
              placeholder="Share your thoughts… type @ to mention someone"
              onSubmit={(text, mentions) => post(text, mentions)}
            />
          </div>
        </div>
      ) : (
        <p className="mb-6 rounded-lg bg-surface-2 p-4 text-sm text-muted">
          <Link to="/auth" state={{ from: location.pathname }} className="font-medium text-accent-text hover:underline">
            Sign in
          </Link>{' '}
          to join the conversation.
        </p>
      )}

      {tree.length > 0 ? (
        <ul className="space-y-4">
          {tree.map((node) => (
            <CommentThread
              key={node.comment._id}
              node={node}
              depth={0}
              dreamId={dreamId}
              signedIn={Boolean(user)}
              collapsed={collapsed}
              replyingTo={replyingTo}
              onToggle={toggle}
              onReplyTo={setReplyingTo}
              onReply={(parentId, text, mentions) => post(text, mentions, parentId)}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-muted">No comments yet. Be the first to comment!</p>
      )}
    </section>
  );
};

export default CommentSection;
