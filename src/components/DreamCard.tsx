import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, MessageSquare } from 'lucide-react';
import { Dream } from '../types';
import { MOODS } from '../lib/moods';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useToast } from './ui/Toast';
import Avatar from './ui/Avatar';
import MoodBadge from './ui/MoodBadge';
import PrivacyBadge from './ui/PrivacyBadge';
import TagBadge from './ui/TagBadge';
import RelativeTime from './dream/RelativeTime';
import ShareButton from './dream/ShareButton';

interface DreamCardProps {
  dream: Dream;
  showPrivacy?: boolean;
}

/**
 * The whole card is clickable through a "stretched link" on the title (a real <a>, so it can be
 * tabbed to and opened in a new tab). Other interactive elements sit above it with `relative z-10`.
 */
const DreamCard: React.FC<DreamCardProps> = ({ dream, showPrivacy = true }) => {
  const { _id, title, content, createdAt, userId, userName, privacyLevel, tags, mood, likedByMe, likesCount, comments } = dream;

  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  const { likeDream } = useApp();

  const handleLike = async () => {
    if (!isAuthenticated) {
      toast.info('Sign in to like dreams');
      navigate('/auth', { state: { from: location.pathname + location.search } });
      return;
    }
    try {
      await likeDream(_id);
    } catch {
      toast.error('Could not update your like. Please try again.');
    }
  };

  return (
    <article className="group relative overflow-hidden rounded-xl border border-line bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-pop motion-reduce:transform-none">
      <span className={`absolute inset-y-0 left-0 w-1 ${MOODS[mood].stripe}`} aria-hidden />

      <div className="p-5 pl-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {userId ? (
              <Link to={`/profile/${userId._id}`} className="relative z-10 rounded-full" aria-label={`${userName}'s profile`}>
                <Avatar src={userId.avatarUrl} name={userName} size="md" />
              </Link>
            ) : (
              <Avatar name="Anonymous" size="md" />
            )}
            <div className="min-w-0 text-sm text-muted">
              <span className="font-medium text-fg">{userName}</span>
              <span className="mx-1" aria-hidden>
                ·
              </span>
              <RelativeTime date={createdAt} />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <MoodBadge mood={mood} size="sm" />
            {showPrivacy && <PrivacyBadge privacy={privacyLevel} size="sm" />}
          </div>
        </div>

        <h2 className="mb-2 font-serif text-lg font-bold leading-snug">
          <Link to={`/dream/${_id}`} className="rounded after:absolute after:inset-0 after:content-['']">
            {title}
          </Link>
        </h2>

        <p className="mb-4 line-clamp-3 whitespace-pre-line text-muted">{content}</p>

        {tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <TagBadge key={tag} tag={tag} size="sm" />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line pt-2">
          <button
            type="button"
            onClick={handleLike}
            aria-pressed={likedByMe}
            aria-label={`${likedByMe ? 'Unlike' : 'Like'} (${likesCount})`}
            className={`relative z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 transition-colors sm:min-h-9 ${
              likedByMe ? 'text-red-500' : 'text-muted hover:text-red-500'
            }`}
          >
            <Heart className="h-5 w-5" fill={likedByMe ? 'currentColor' : 'none'} aria-hidden />
            <span className="tabular-nums">{likesCount}</span>
          </button>

          <Link
            to={`/dream/${_id}#comments`}
            aria-label={`${comments.length} comments`}
            className="relative z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-muted transition-colors hover:text-accent-text sm:min-h-9"
          >
            <MessageSquare className="h-5 w-5" aria-hidden />
            <span className="tabular-nums">{comments.length}</span>
          </Link>

          {privacyLevel !== 'private' ? <ShareButton dreamId={_id} title={title} /> : <span className="w-11" />}
        </div>
      </div>
    </article>
  );
};

export default DreamCard;
