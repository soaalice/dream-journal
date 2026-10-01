import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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

  if (!dream) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl mb-4">Dream not found</h2>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isOwnDream = user?.id === dream.userId._id;
  const isAnonymous = dream.privacyLevel === 'anonymous';

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-3 mb-4">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Button>

      <div className={`
        rounded-lg overflow-hidden shadow-lg
        ${isDarkMode ? 'bg-gray-800' : 'bg-white'} 
        p-6 md:p-8
      `}>
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center space-x-3">
            {!isAnonymous && (
              <Avatar
                src={dream.userId.avatarUrl}
                alt={dream.userName}
                size="lg"
              />
            )}

            <div>
              <h1 className="text-2xl font-serif font-bold">{dream.title}</h1>
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <span>
                  {isAnonymous ? 'Anonymous' : dream.userName}
                </span>
                <span className="mx-1">•</span>
                <span>{formatDate(new Date(dream.createdAt))}</span>
              </div>
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
