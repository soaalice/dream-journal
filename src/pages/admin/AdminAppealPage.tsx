import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, CloudOff } from 'lucide-react';
import { api } from '../../lib/api';
import { reasonLabel } from '../../lib/reports';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { AppealDetail } from '../../types/admin';
import RelativeTime from '../../components/dream/RelativeTime';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useConfirm } from '../../components/ui/Confirm';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field, Textarea } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../utils/date';
import { AdminOutletContext } from './AdminLayout';

/** One appeal: what the author says, what was decided before, and the choice to accept or decline it. */
const AdminAppealPage: React.FC = () => {
  useDocumentTitle('Review appeal');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { refreshSummary } = useOutletContext<AdminOutletContext>();
  const isAdmin = useAuth().user?.role === 'admin';

  const [detail, setDetail] = useState<AppealDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState<'upheld' | 'overturned' | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    api<AppealDetail>(`/admin/appeals/${id}`)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load this appeal'));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (error) {
    return (
      <EmptyState
        tone="error"
        icon={<CloudOff className="h-12 w-12" />}
        title="Could not load this appeal"
        description={error}
        action={<Button onClick={() => setAttempt((a) => a + 1)}>Retry</Button>}
      />
    );
  }
  if (!detail) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading appeal">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const { appeal, author, content, reasons } = detail;
  const isAccount = appeal.targetType === 'account';
  const open = appeal.status === 'open';
  const blockedReason = isAccount && !isAdmin
    ? 'Only administrators decide appeals against a suspension.'
    : appeal.decidedByMe && !isAdmin
      ? 'You made the original decision. Another moderator must review this appeal.'
      : null;

  const decide = async (decision: 'upheld' | 'overturned') => {
    const ok = await confirm({
      title: decision === 'overturned' ? 'Accept this appeal?' : 'Decline this appeal?',
      description:
        decision === 'overturned'
          ? isAccount
            ? 'The account is unsuspended and the person can sign in again.'
            : 'The content becomes visible again and the author is told.'
          : 'The original decision stands and the author is told.',
      confirmLabel: decision === 'overturned' ? 'Accept appeal' : 'Decline appeal'
    });
    if (!ok) return;

    setSubmitting(decision);
    try {
      await api(`/admin/appeals/${id}/decide`, { method: 'POST', body: { decision, note: note || undefined, message: message || undefined } });
      toast.success(decision === 'overturned' ? 'Appeal accepted' : 'Appeal declined');
      refreshSummary();
      navigate('/admin/appeals');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not decide this appeal');
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/admin/appeals" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to appeals
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card as="section" aria-labelledby="says-title">
            <h2 id="says-title" className="mb-2 font-serif text-xl font-bold">
              What {author?.name ?? 'the author'} says
            </h2>
            <p className="whitespace-pre-line break-words text-lg leading-relaxed">{appeal.message}</p>
            <p className="mt-2 text-sm text-muted">
              Sent <RelativeTime date={appeal.createdAt} />
            </p>
          </Card>

          <Card as="section" aria-labelledby="decision-title">
            <h2 id="decision-title" className="mb-3 font-serif text-xl font-bold">
              {isAccount ? 'The suspension' : `The ${appeal.targetType} that was removed`}
            </h2>
            {isAccount ? (
              <p>
                Reason given: <strong>{author?.suspensionReason || content.moderationMessage || 'none'}</strong>
              </p>
            ) : (
              <>
                {content.title && appeal.targetType === 'dream' && <p className="mb-1 font-medium">{content.title}</p>}
                <p className="whitespace-pre-line break-words rounded-lg bg-surface-2 p-3">{content.text || 'No text available.'}</p>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Told to the author</dt>
                    <dd>{content.moderationMessage || '–'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Decided by</dt>
                    <dd>{appeal.decidedBy ?? 'unknown'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Reported for</dt>
                    <dd>{reasons.length ? reasons.map(reasonLabel).join(', ') : '–'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">State now</dt>
                    <dd>{content.exists ? content.moderationState : 'deleted by the author'}</dd>
                  </div>
                </dl>
              </>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          {author && (
            <Card as="section" aria-labelledby="who-title">
              <h2 id="who-title" className="mb-3 font-serif text-xl font-bold">
                Author
              </h2>
              <p className="font-medium">{author.name}</p>
              {author.email && <p className="break-all text-sm text-muted">{author.email}</p>}
              <p className="text-sm text-muted">Member since {formatDate(author.joinedAt)}</p>
            </Card>
          )}

          <Card as="section" aria-labelledby="verdict-title">
            <h2 id="verdict-title" className="mb-3 font-serif text-xl font-bold">
              Decision
            </h2>
            {!open ? (
              <p className="text-muted">
                {appeal.status === 'overturned' ? 'Accepted' : 'Declined'} by {appeal.resolvedBy ?? 'an admin'}
                {appeal.resolvedAt && <> on {formatDate(appeal.resolvedAt)}</>}
                {appeal.resolutionNote && <>: &ldquo;{appeal.resolutionNote}&rdquo;</>}
              </p>
            ) : blockedReason ? (
              <p role="status" className="rounded-lg bg-surface-2 p-3 text-sm">
                {blockedReason}
              </p>
            ) : (
              <div className="space-y-4">
                {!isAccount && (
                  <Field label="Message to the author" optional hint="Shown in their notification." counter={{ value: message.length, max: 300 }}>
                    {({ id: fid, describedBy }) => (
                      <Textarea id={fid} aria-describedby={describedBy} rows={2} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className="resize-none" />
                    )}
                  </Field>
                )}
                <Field label="Internal note" optional counter={{ value: note.length, max: 500 }}>
                  {({ id: fid, describedBy }) => (
                    <Textarea id={fid} aria-describedby={describedBy} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="resize-none" />
                  )}
                </Field>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => decide('overturned')} loading={submitting === 'overturned'} disabled={submitting !== null}>
                    {isAccount ? 'Accept and unsuspend' : 'Accept and restore'}
                  </Button>
                  <Button variant="secondary" onClick={() => decide('upheld')} loading={submitting === 'upheld'} disabled={submitting !== null}>
                    Decline (decision stands)
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default AdminAppealPage;
