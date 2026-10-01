import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, MessageSquare } from 'lucide-react';
import { Dream } from '../types';
import { MOODS, PRIVACY } from '../lib/moods';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useToast } from './ui/Toast';
import Avatar from './ui/Avatar';
import MoodBadge from './ui/MoodBadge';
import TagBadge from './ui/TagBadge';
import ContentMenu from './moderation/ContentMenu';
import RelativeTime from './dream/RelativeTime';
import ShareButton from './dream/ShareButton';

interface DreamCardProps {
  dream: Dream;
  /** show who can see it (useful on your own lists) */
  showPrivacy?: boolean;
  /** show the author in the footer; hide it on lists that are all by the same person (your own dreams) */
  showAuthor?: boolean;
}

const statusPill = (classes: string, label: string) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>{label}</span>
);

/**
 * Hierarchy, top to bottom: mood + privacy (small), the title (what you scan for), a taste of the dream, tags, and a
 * footer with who/when on the left and the actions on the right. The footer is pinned to the bottom so cards in a row
 * line up whatever their content.
 *
 * The whole card is clickable through a "stretched link" on the title (a real <a>, so it can be tabbed to and opened in a
 * new tab). Other interactive elements sit above it with `relative z-10`.
 */
const DreamCard: React.FC<DreamCardProps> = ({ dream, showPrivacy = true, showAuthor = true }) => {
  const { _id, title, content, createdAt, userId, userName, privacyLevel, tags, mood, likedByMe, likesCount, commentsCount, isOwner, status } = dream;
  const isDraft = status === 'draft';
  const moderation = dream.moderation;

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

  const privacy = PRIVACY[privacyLevel];
  const PrivacyIcon = privacy.Icon;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-pop motion-reduce:transform-none">
      <span className={`absolute inset-y-0 left-0 w-1 ${MOODS[mood].stripe}`} aria-hidden />

      <div className="flex flex-1 flex-col p-5 pl-6">
        {/* what kind of dream it is: small, so the title can lead */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <MoodBadge mood={mood} size="sm" />
            {showPrivacy && (
              <span title={privacy.label} className="inline-flex items-center gap-1 text-xs text-muted">
                <PrivacyIcon className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only sm:not-sr-only">{privacy.label}</span>
              </span>
            )}
            {isDraft && statusPill('bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200', 'Draft')}
            {moderation &&
              statusPill(
                'bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-200',
                moderation.state === 'removed' ? 'Removed by moderators' : 'Hidden, under review'
              )}
          </div>
          {isAuthenticated && !isOwner && <ContentMenu kind="dream" dreamId={_id} className="-mr-2 -mt-2 shrink-0" />}
        </div>

        <h2 className="font-serif text-xl font-bold leading-snug tracking-tight">
          <Link to={isDraft ? `/dream/${_id}/edit` : `/dream/${_id}`} className="rounded after:absolute after:inset-0 after:content-['']">
            {title}
          </Link>
        </h2>

        <p className="mt-2 line-clamp-3 whitespace-pre-line font-reading text-base leading-relaxed text-muted">{content}</p>

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((tag) => (
              <TagBadge key={tag} tag={tag} size="sm" />
            ))}
            {tags.length > 4 && <span className="self-center text-xs text-muted">+{tags.length - 4}</span>}
          </div>
        )}

        {isDraft ? (
          <p className="meta mt-auto border-t border-line pt-3">Only you can see this. Open it to keep writing or to publish.</p>
        ) : (
          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
              {showAuthor && <Avatar src={userId?.avatarUrl} name={userId ? userName : 'Anonymous'} size="sm" />}
              <span className="min-w-0 truncate">
                {showAuthor && <span className="font-medium text-fg">{userName}</span>}
                {showAuthor && (
                  <span className="mx-1" aria-hidden>
                    ·
                  </span>
                )}
                <RelativeTime date={createdAt} />
              </span>
            </div>

            <div className="-mr-2 flex shrink-0 items-center">
              <button
                type="button"
                onClick={handleLike}
                aria-pressed={likedByMe}
                aria-label={`${likedByMe ? 'Unlike' : 'Like'} (${likesCount})`}
                className={`relative z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors sm:min-h-9 ${
                  likedByMe ? 'text-red-500' : 'text-muted hover:text-red-500'
                }`}
              >
                <Heart className="h-[1.15rem] w-[1.15rem]" fill={likedByMe ? 'currentColor' : 'none'} aria-hidden />
                <span className="tabular-nums">{likesCount}</span>
              </button>
              <Link
                to={`/dream/${_id}#comments`}
                aria-label={`${commentsCount} comments`}
                className="relative z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-sm text-muted transition-colors hover:text-accent-text sm:min-h-9"
              >
                <MessageSquare className="h-[1.15rem] w-[1.15rem]" aria-hidden />
                <span className="tabular-nums">{commentsCount}</span>
              </Link>
              {privacyLevel !== 'private' && <ShareButton dreamId={_id} title={title} className="!px-2.5" />}
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

export default DreamCard;
