import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import DreamForm from '../components/DreamForm';
import { useApp } from '../context/AppContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Page, PageHeader } from '../components/ui/Page';

const EditDreamPage: React.FC = () => {
  useDocumentTitle('Edit dream');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allDreams, fetchDream } = useApp();
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  const dream = allDreams.find((d) => d._id === id);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchDream(id)
      .then(() => !cancelled && setStatus('ready'))
      .catch(() => !cancelled && setStatus('missing'));
    return () => {
      cancelled = true;
    };
  }, [id, fetchDream]);

  // Only the author may edit; everyone else goes back to the read-only page.
  useEffect(() => {
    if (status === 'ready' && dream && !dream.isOwner) navigate(`/dream/${dream._id}`, { replace: true });
  }, [status, dream, navigate]);

  if (status === 'missing' || (status === 'ready' && !dream)) {
    return (
      <EmptyState
        icon={<SearchX className="h-12 w-12" />}
        title="Dream not found"
        action={<ButtonLink to="/profile">Back to my dreams</ButtonLink>}
      />
    );
  }

  if (!dream || !dream.isOwner) {
    return (
      <div className="mx-auto max-w-2xl space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <Page width="narrow">
      <PageHeader title={dream.status === 'draft' ? 'Continue your draft' : 'Edit dream'} />
      <DreamForm
        editMode
        dreamId={dream._id}
        initialStatus={dream.status}
        initialData={{
          // the server's placeholder for drafts without a title is not something the user typed
          title: dream.status === 'draft' && dream.title === 'Untitled draft' ? '' : dream.title,
          content: dream.content,
          privacyLevel: dream.privacyLevel,
          tags: dream.tags,
          mood: dream.mood
        }}
      />
    </Page>
  );
};

export default EditDreamPage;
