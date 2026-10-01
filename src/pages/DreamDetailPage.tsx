import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Heart, SearchX, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { MOODS } from '../lib/moods';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useConfirm } from '../components/ui/Confirm';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import Avatar from '../components/ui/Avatar';
import MoodBadge from '../components/ui/MoodBadge';
import PrivacyBadge from '../components/ui/PrivacyBadge';
import TagBadge from '../components/ui/TagBadge';
import CommentSection from '../components/CommentSection';
import ContentMenu from '../components/moderation/ContentMenu';
import RelativeTime from '../components/dream/RelativeTime';
import ShareButton from '../components/dream/ShareButton';

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
      <div className="mx-auto max-w-3xl space-y-4" role="status" aria-label="Loading dream">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
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

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-3 mb-4">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Button>

      <Card as="article" className="relative overflow-hidden p-6 sm:p-8">
        <span className={`absolute inset-x-0 top-0 h-1 ${MOODS[dream.mood].stripe}`} aria-hidden />

        <header className="mb-6">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <MoodBadge mood={dream.mood} />
              <PrivacyBadge privacy={dream.privacyLevel} />
            </div>
            {isAuthenticated && !dream.isOwner && (
              <ContentMenu kind="dream" dreamId={dream._id} className="-mr-2 -mt-2" onBlocked={() => navigate('/', { replace: true })} />
            )}
          </div>
          <h1 className="mb-4 font-serif text-3xl font-bold leading-tight">{dream.title}</h1>
          <div className="flex items-center gap-3">
            <Avatar src={dream.userId?.avatarUrl} name={dream.userId ? dream.userName : 'Anonymous'} size="md" />
            <div className="text-sm text-muted">
              <p className="font-medium text-fg">{dream.userName}</p>
              <RelativeTime date={dream.createdAt} />
            </div>
          </div>
        </header>

        <div className="mb-6 max-w-prose whitespace-pre-line text-lg leading-relaxed">{dream.content}</div>

        {dream.tags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {dream.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleLike}
              aria-pressed={dream.likedByMe}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 transition-colors sm:min-h-9 ${
                dream.likedByMe ? 'text-red-500' : 'text-muted hover:text-red-500'
              }`}
            >
              <Heart className="h-5 w-5" fill={dream.likedByMe ? 'currentColor' : 'none'} aria-hidden />
              <span className="tabular-nums">{dream.likesCount}</span>
              <span className="sr-only">likes</span>
            </button>
            {dream.privacyLevel !== 'private' && <ShareButton dreamId={dream._id} title={dream.title} withLabel />}
          </div>

          {dream.isOwner && (
            <div className="flex gap-2">
              <ButtonLink to={`/dream/${dream._id}/edit`} variant="secondary" size="sm">
                <Edit className="h-4 w-4" aria-hidden />
                Edit
              </ButtonLink>
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-danger-text hover:bg-danger/10">
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <CommentSection dreamId={dream._id} comments={dream.comments} />
      </Card>
    </div>
  );
};

export default DreamDetailPage;
