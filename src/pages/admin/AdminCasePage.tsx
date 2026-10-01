import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CloudOff, EyeOff, ShieldAlert } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { reasonLabel } from '../../lib/reports';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { AdminCaseDetail, ResolveCaseInput } from '../../types/admin';
import RelativeTime from '../../components/dream/RelativeTime';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useConfirm } from '../../components/ui/Confirm';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../utils/date';
import { AdminOutletContext } from './AdminLayout';

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <dt className="text-sm text-muted">{label}</dt>
    <dd className="font-medium">{value}</dd>
  </div>
);

/** One reported dream or comment: the content, who wrote it, every report, and the actions a moderator can take. */
const AdminCasePage: React.FC = () => {
  useDocumentTitle('Review report');
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { refreshSummary } = useOutletContext<AdminOutletContext>();
  const isAdmin = useAuth().user?.role === 'admin';
  const [params] = useSearchParams();
  const dreamId = params.get('dream');
  const commentId = params.get('comment');

  const [detail, setDetail] = useState<AdminCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [note, setNote] = useState('');
  const [removeContent, setRemoveContent] = useState(false);
  const [suspendAuthor, setSuspendAuthor] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [authorMessage, setAuthorMessage] = useState('');
  const [submitting, setSubmitting] = useState<'dismissed' | 'reviewed' | null>(null);

  useEffect(() => {
    if (!dreamId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    api<AdminCaseDetail>('/admin/reports/case', { query: { dreamId, commentId: commentId ?? undefined } })
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load this case'));
    return () => {
      cancelled = true;
    };
  }, [dreamId, commentId, attempt]);

  if (!dreamId) return <Navigate to="/admin/reports" replace />;

  if (error) {
    return (
      <EmptyState
        tone="error"
        icon={<CloudOff className="h-12 w-12" />}
        title="Could not load this case"
        description={error}
        action={<Button onClick={() => setAttempt((a) => a + 1)}>Retry</Button>}
      />
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading case">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const { target, author, reports, appeal } = detail;
  const openReports = reports.filter((r) => r.status === 'open');
  const isOpen = openReports.length > 0;
  const authorIsStaff = author?.role === 'admin' || (author?.role === 'moderator' && !isAdmin);
  const canSuspend = isAdmin && Boolean(author) && author?.role !== 'admin' && !author?.suspended;

  const resolve = async (resolution: 'dismissed' | 'reviewed') => {
    const destructive = resolution === 'reviewed' && (removeContent || suspendAuthor);
    if (destructive) {
      const parts = [removeContent && `permanently remove this ${target.type}`, suspendAuthor && `suspend ${author?.name}`].filter(Boolean);
      const ok = await confirm({
        title: 'Apply moderation action?',
        description: `You are about to ${parts.join(' and ')}. This is recorded in the audit log.`,
        confirmLabel: 'Apply',
        danger: true
      });
      if (!ok) return;
    }

    const body: ResolveCaseInput = {
      dreamId,
      commentId: commentId ?? undefined,
      resolution,
      removeContent: resolution === 'reviewed' && removeContent,
      suspendAuthor: resolution === 'reviewed' && suspendAuthor,
      suspensionReason: suspendAuthor ? suspensionReason : undefined,
      authorMessage: resolution === 'reviewed' && removeContent && authorMessage ? authorMessage : undefined,
      note: note || undefined
    };

    setSubmitting(resolution);
    try {
      await api('/admin/reports/resolve', { method: 'POST', body });
      toast.success(resolution === 'dismissed' ? 'Reports dismissed' : 'Case resolved');
      refreshSummary();
      navigate('/admin/reports');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resolve this case');
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/admin/reports" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to the queue
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {appeal && (
            <p role="status" className="flex flex-wrap items-center gap-x-2 rounded-xl bg-accent-soft p-4 text-accent-text">
              <span>
                {appeal.status === 'open'
                  ? 'The author appealed the decision on this content.'
                  : `The author appealed this decision. The appeal was ${appeal.status === 'overturned' ? 'accepted' : 'declined'}.`}
              </span>
              <Link to={`/admin/appeals/${appeal._id}`} className="font-medium underline">
                {appeal.status === 'open' ? 'Review the appeal' : 'See the appeal'}
              </Link>
            </p>
          )}

          <Card as="section" aria-labelledby="content-title">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <h2 id="content-title" className="font-serif text-xl font-bold">
                {target.type === 'comment' ? 'Reported comment' : target.title || 'Reported dream'}
              </h2>
              {target.privacyLevel && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-muted">{target.privacyLevel}</span>}
              {target.draft && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-muted">draft</span>}
              {!target.exists && <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-danger-text">no longer exists</span>}
            </div>

            {target.anonymous && (
              <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">
                <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                This content is anonymous. The author is hidden from the community; opening this page was recorded in the audit log.
                Keep their identity confidential.
              </p>
            )}

            {target.moderationState === 'hidden' && (
              <p role="status" className="mb-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">
                Hidden automatically after enough reports. Only the author can see it. Dismissing, or marking reviewed without removing,
                brings it back; removing it keeps it hidden and lets the author appeal.
              </p>
            )}
            {target.moderationState === 'removed' && (
              <p role="status" className="mb-3 rounded-lg bg-surface-2 p-3 text-sm">
                This content was already removed. Only the author can see it.
              </p>
            )}
            {!target.exists && (
              <p className="mb-3 text-sm text-muted">The author deleted it. This is the text that was saved when it was reported.</p>
            )}
            <p className="whitespace-pre-line break-words text-lg leading-relaxed">{target.content || 'No text available.'}</p>
            {target.exists && target.reportedText && target.reportedText !== target.content && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-accent-text">It was edited after it was reported. Show the reported version</summary>
                <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-2 p-3">{target.reportedText}</p>
              </details>
            )}
          </Card>

          <Card as="section" aria-labelledby="reports-title">
            <h2 id="reports-title" className="mb-3 font-serif text-xl font-bold">
              Reports <span className="text-muted">({reports.length})</span>
            </h2>
            <ul className="divide-y divide-line">
              {reports.map((r) => (
                <li key={r._id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{reasonLabel(r.reason)}</span>
                    <span className="text-muted">
                      by {r.reporter?.name ?? 'a deleted user'} · <RelativeTime date={r.createdAt} />
                    </span>
                    <span
                      className={`ml-auto rounded-full px-2.5 py-0.5 ${
                        r.status === 'open' ? 'bg-danger/10 text-danger-text' : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  {r.details && <p className="mt-1 whitespace-pre-line text-muted">{r.details}</p>}
                  {r.status !== 'open' && (
                    <p className="mt-1 text-sm text-muted">
                      {r.status === 'dismissed' ? 'Dismissed' : 'Reviewed'} by {r.resolvedBy ?? 'an admin'}
                      {r.resolvedAt && <> on {formatDate(r.resolvedAt)}</>}
                      {r.resolutionNote && <>: “{r.resolutionNote}”</>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card as="section" aria-labelledby="author-title">
            <h2 id="author-title" className="mb-3 font-serif text-xl font-bold">
              Author
            </h2>
            {author ? (
              <dl className="space-y-3">
                <Stat label="Name" value={author.name} />
                {author.email && <Stat label="Email" value={<span className="break-all">{author.email}</span>} />}
                <Stat label="Member since" value={formatDate(author.joinedAt)} />
                <Stat label="Reported items" value={author.reportedCases} />
                <Stat label="Removed by moderators" value={author.removals} />
                <Stat label="Past suspensions" value={author.suspensions} />
                {author.role !== 'user' && (
                  <p className="rounded-lg bg-surface-2 p-2 text-sm">
                    This person is {author.role === 'admin' ? 'an administrator' : 'a moderator'}.
                  </p>
                )}
                {author.suspended && (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-100 p-2 text-sm text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    Suspended{author.suspensionReason && `: ${author.suspensionReason}`}
                  </p>
                )}
              </dl>
            ) : (
              <p className="text-muted">This account no longer exists.</p>
            )}
          </Card>

          <Card as="section" aria-labelledby="actions-title">
            <h2 id="actions-title" className="mb-3 font-serif text-xl font-bold">
              Decision
            </h2>

            {!isOpen ? (
              <p className="text-muted">All reports about this content were already resolved.</p>
            ) : (
              <div className="space-y-4">
                <Field label="Note" optional hint="Visible to other moderators in the audit log." counter={{ value: note.length, max: 500 }}>
                  {({ id, describedBy }) => (
                    <Textarea id={id} aria-describedby={describedBy} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="resize-none" />
                  )}
                </Field>

                <fieldset className="space-y-3">
                  <legend className="mb-1 text-sm font-medium">If the report is justified</legend>
                  <label className={`flex items-start gap-2 ${target.exists && !authorIsStaff ? '' : 'opacity-50'}`}>
                    <input
                      type="checkbox"
                      checked={removeContent}
                      disabled={!target.exists || authorIsStaff || target.moderationState === 'removed'}
                      onChange={(e) => setRemoveContent(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-purple-600"
                    />
                    <span>
                      Remove this {target.type}
                      <span className="block text-sm text-muted">
                        {target.type === 'comment' ? 'Replies stay under a placeholder.' : 'Its comments go with it.'}
                      </span>
                    </span>
                  </label>
                  {removeContent && (
                    <Field label="Message to the author" optional hint="Shown in their notification. Leave empty for the standard message." counter={{ value: authorMessage.length, max: 300 }}>
                      {({ id, describedBy }) => (
                        <Textarea id={id} aria-describedby={describedBy} rows={2} maxLength={300} value={authorMessage} onChange={(e) => setAuthorMessage(e.target.value)} className="resize-none" />
                      )}
                    </Field>
                  )}
                  <label className={`flex items-start gap-2 ${canSuspend ? '' : 'opacity-50'}`}>
                    <input
                      type="checkbox"
                      checked={suspendAuthor}
                      disabled={!canSuspend}
                      onChange={(e) => setSuspendAuthor(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-purple-600"
                    />
                    <span>
                      Suspend the author
                      <span className="block text-sm text-muted">
                        {!isAdmin
                          ? 'Only administrators can suspend accounts.'
                          : author?.role === 'admin'
                            ? 'Administrators cannot be suspended here.'
                            : author?.suspended
                              ? 'Already suspended.'
                              : 'They are signed out and all their content is hidden.'}
                      </span>
                    </span>
                  </label>
                  {suspendAuthor && (
                    <Field label="Reason for the suspension" hint="Shown to the person when they try to sign in." counter={{ value: suspensionReason.length, max: 300 }}>
                      {({ id, describedBy, invalid }) => (
                        <Input id={id} aria-describedby={describedBy} invalid={invalid} maxLength={300} value={suspensionReason} onChange={(e) => setSuspensionReason(e.target.value)} />
                      )}
                    </Field>
                  )}
                </fieldset>

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => resolve('reviewed')}
                    loading={submitting === 'reviewed'}
                    disabled={submitting !== null || (suspendAuthor && suspensionReason.trim().length < 3)}
                    variant={removeContent || suspendAuthor ? 'danger' : 'primary'}
                  >
                    {removeContent || suspendAuthor ? 'Apply and resolve' : target.moderationState === 'hidden' ? 'Restore and mark reviewed' : 'Mark as reviewed'}
                  </Button>
                  <Button variant="secondary" onClick={() => resolve('dismissed')} loading={submitting === 'dismissed'} disabled={submitting !== null}>
                    {target.moderationState === 'hidden' ? 'Dismiss and restore' : 'Dismiss reports'}
                  </Button>
                  <p className="text-sm text-muted">
                    Resolving closes all {openReports.length} open {openReports.length === 1 ? 'report' : 'reports'} about this content.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default AdminCasePage;
