import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Edit, Heart, SearchX, ShieldAlert, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { MOODS, PRIVACY } from '../lib/moods';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useConfirm } from '../components/ui/Confirm';
import { EmptyState } from '../components/ui/EmptyState';
import { Page } from '../components/ui/Page';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import Avatar from '../components/ui/Avatar';
import MoodBadge from '../components/ui/MoodBadge';
import TagBadge from '../components/ui/TagBadge';
import CommentSection from '../components/CommentSection';
import ContentMenu from '../components/moderation/ContentMenu';
import RelativeTime from '../components/dream/RelativeTime';
import ShareButton from '../components/dream/ShareButton';

/** About 200 words a minute. */
const readingMinutes = (text: string) => Math.max(1, Math.round(text.trim().split(/\s+/).length / 200));

/**
 * Reading a dream: title, a byline, then the text in a reading face with a generous line height (it is the heart of the
 * app), tags, and the actions. Comments live in their own card below.
 */
const DreamDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const toast = useToast();
  const confirm = useConfirm();
  const { isAuthenticated } = useAuth();
  const { allDreams, fetchDream, deleteDream, likeDream } = useApp();

  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const dream = allDreams.find((d) => d._id === id);

  useDocumentTitle(dream?.title);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setStatus('loading');
    fetchDream(id)
      .then(() => !cancelled && setStatus('ready'))
      .catch(() => !cancelled && setStatus('missing'));
    return () => {
      cancelled = true;
    };
  }, [id, fetchDream]);

  // Jump to the comments, or to one specific comment, when arriving from a card or a notification.
  useEffect(() => {
    if (status === 'ready' && hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' });
    }
  }, [status, hash, dream?.comments.length]);

  if (!dream && status !== 'missing') {
    return (
      <Page width="reading">
        <div className="space-y-4" role="status" aria-label="Loading dream">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Page>
    );
  }

  // A draft is a work in progress: the editor is its only page.
  if (dream?.status === 'draft') return <Navigate to={`/dream/${dream._id}/edit`} replace />;

  if (!dream) {
    return (
      <EmptyState
        icon={<SearchX className="h-12 w-12" />}
        title="Dream not found"
        description="It may have been deleted or made private."
        action={<Button onClick={() => navigate(-1)}>Go back</Button>}
      />
    );
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete this dream?',
      description: 'The dream and all its comments will be permanently removed.',
      confirmLabel: 'Delete dream',
      danger: true
    });
    if (!ok) return;
    try {
      await deleteDream(dream._id);
      toast.success('Dream deleted');
      navigate('/profile', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete dream');
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      toast.info('Sign in to like dreams');
      navigate('/auth', { state: { from: `/dream/${dream._id}` } });
      return;
    }
    try {
      await likeDream(dream._id);
    } catch {
      toast.error('Could not update your like. Please try again.');
    }
  };

  const privacy = PRIVACY[dream.privacyLevel];
  const PrivacyIcon = privacy.Icon;

  return (
    <Page width="reading">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-3 mb-4">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Button>

      <Card as="article" className="relative overflow-hidden p-6 sm:p-10">
        <span className={`absolute inset-x-0 top-0 h-1.5 ${MOODS[dream.mood].stripe}`} aria-hidden />

        {dream.moderation && (
          <div role="status" className="mb-8 flex items-start gap-3 rounded-xl bg-red-100 p-4 text-red-900 dark:bg-red-400/15 dark:text-red-100">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">
                {dream.moderation.state === 'removed'
                  ? 'Moderators removed this dream. Only you can see it.'
                  : 'This dream is hidden while moderators review reports about it. Only you can see it.'}
              </p>
              {dream.moderation.message && <p className="mt-1 text-sm">{dream.moderation.message}</p>}
              {dream.moderation.state === 'removed' && (
                <p className="mt-2 text-sm">
                  Think this is a mistake? Open{' '}
                  <Link to="/notifications" className="font-medium underline">
                    your notifications
                  </Link>{' '}
                  and choose &ldquo;Appeal this decision&rdquo;.
                </p>
              )}
            </div>
          </div>
        )}

        <header className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <MoodBadge mood={dream.mood} />
              <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                <PrivacyIcon className="h-4 w-4" aria-hidden />
                {privacy.label}
              </span>
            </div>
            {isAuthenticated && !dream.isOwner && (
              <ContentMenu kind="dream" dreamId={dream._id} className="-mr-2" onBlocked={() => navigate('/', { replace: true })} />
            )}
          </div>

          <h1 className="page-title">{dream.title}</h1>

          <div className="mt-5 flex items-center gap-3">
            <Avatar src={dream.userId?.avatarUrl} name={dream.userId ? dream.userName : 'Anonymous'} size="md" />
            <div className="meta leading-snug">
              <p className="font-medium text-fg">{dream.userName}</p>
              <p className="flex items-center gap-2">
                <RelativeTime date={dream.createdAt} />
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {readingMinutes(dream.content)} min read
                </span>
              </p>
            </div>
          </div>
        </header>

        <div className="prose-dream">{dream.content}</div>

        {dream.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {dream.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex items-center gap-1">
            {!dream.moderation && (
              <button
                type="button"
                onClick={handleLike}
                aria-pressed={dream.likedByMe}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 transition-colors sm:min-h-10 ${
                  dream.likedByMe ? 'bg-red-50 text-red-500 dark:bg-red-400/10' : 'text-muted hover:bg-surface-2 hover:text-red-500'
                }`}
              >
                <Heart className="h-5 w-5" fill={dream.likedByMe ? 'currentColor' : 'none'} aria-hidden />
                <span className="tabular-nums">{dream.likesCount}</span>
                <span className="sr-only">likes</span>
              </button>
            )}
            {dream.privacyLevel !== 'private' && !dream.moderation && <ShareButton dreamId={dream._id} title={dream.title} withLabel />}
          </div>

          {dream.isOwner && (
            <div className="flex gap-2">
              {!dream.moderation && (
                <ButtonLink to={`/dream/${dream._id}/edit`} variant="secondary" size="sm">
                  <Edit className="h-4 w-4" aria-hidden />
                  Edit
                </ButtonLink>
              )}
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-danger-text hover:bg-danger/10">
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        {dream.moderation ? (
          <p className="text-muted">Comments are closed while this dream is hidden.</p>
        ) : (
          <CommentSection dreamId={dream._id} comments={dream.comments} />
        )}
      </Card>
    </Page>
  );
};

export default DreamDetailPage;
