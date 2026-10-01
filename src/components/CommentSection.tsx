import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Comment } from '../types';
import Avatar from './ui/Avatar';
import { Button } from './ui/Button';
import { useConfirm } from './ui/Confirm';
import { useToast } from './ui/Toast';
import MentionsInput from './MentionsInput';
import RelativeTime from './dream/RelativeTime';

interface CommentSectionProps {
  dreamId: string;
  comments: Comment[];
}

const MENTION_TOKEN = /@\[([^\]]+)\]\(([^)]+)\)/g;

/** Mentions are stored as @[name](id) tokens; show them as plain @name. */
const renderCommentContent = (content: string) => content.replace(MENTION_TOKEN, (_match, name) => `@${name}`);

const CommentSection: React.FC<CommentSectionProps> = ({ dreamId, comments }) => {
  const { user } = useAuth();
  const { addComment, deleteComment } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const location = useLocation();

  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await addComment(dreamId, text, mentions);
      setText('');
      setMentions([]);
      toast.success('Comment added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    const ok = await confirm({
      title: 'Delete comment?',
      description: 'This comment will be removed for everyone.',
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

  return (
    <section id="comments" aria-labelledby="comments-title" className="scroll-mt-24">
      <h2 id="comments-title" className="mb-4 text-lg font-semibold">
        Comments <span className="text-muted">({comments.length})</span>
      </h2>

      {user ? (
        <form onSubmit={handleSubmit} className="mb-6 flex gap-3">
          <Avatar src={user.avatarUrl} name={user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <MentionsInput
              value={text}
              onChange={(value, ids) => {
                setText(value);
                setMentions(ids);
              }}
              aria-label="Write a comment"
              placeholder="Share your thoughts… type @ to mention someone"
              rows={3}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm tabular-nums text-muted">{text.length}/1000</span>
              <Button type="submit" size="sm" loading={submitting} disabled={!text.trim()}>
                Comment
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <p className="mb-6 rounded-lg bg-surface-2 p-4 text-sm text-muted">
          <Link to="/auth" state={{ from: location.pathname }} className="font-medium text-accent-text hover:underline">
            Sign in
          </Link>{' '}
          to join the conversation.
        </p>
      )}

      <ul className="space-y-4">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <li key={comment._id} className="flex gap-3">
              <Avatar src={comment.userAvatar} name={comment.userName} size="sm" />
              <div className="min-w-0 flex-1 rounded-lg bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{comment.userName}</span>
                  <span className="flex items-center gap-2 text-muted">
                    <RelativeTime date={comment.createdAt} />
                    {comment.canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comment._id)}
                        aria-label={`Delete comment by ${comment.userName}`}
                        className="rounded p-1 hover:text-danger-text"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line break-words text-fg/90">{renderCommentContent(comment.content)}</p>
              </div>
            </li>
          ))
        ) : (
          <li className="py-4 text-center text-muted">No comments yet. Be the first to comment!</li>
        )}
      </ul>
    </section>
  );
};

export default CommentSection;
