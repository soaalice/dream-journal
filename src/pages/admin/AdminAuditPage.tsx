import React from 'react';
import { Link } from 'react-router-dom';
import { CloudOff, Eye, EyeOff, Flag, ScrollText, ShieldAlert, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useInfiniteList } from '../../hooks/useInfiniteList';
import { AuditAction, AuditEntry } from '../../types/admin';
import { caseLink } from '../../components/admin/CaseCard';
import RelativeTime from '../../components/dream/RelativeTime';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';

interface Page {
  entries: AuditEntry[];
  page: number;
  hasMore: boolean;
  total: number;
}

const ACTIONS: Record<AuditAction, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  report_dismissed: { label: 'dismissed reports', Icon: Flag },
  report_reviewed: { label: 'reviewed reports', Icon: ShieldCheck },
  content_removed: { label: 'removed content', Icon: Trash2 },
  user_suspended: { label: 'suspended', Icon: ShieldAlert },
  user_unsuspended: { label: 'unsuspended', Icon: UserCheck },
  viewed_anonymous_author: { label: 'viewed an anonymous author', Icon: EyeOff }
};

const targetOf = (e: AuditEntry) => {
  if (e.targetType === 'user') return e.targetUser ?? 'a user';
  const what = e.targetType === 'comment' ? 'a comment' : 'a dream';
  return e.targetUser ? `${what} by ${e.targetUser}` : what;
};

/** Read-only history of everything moderators did. Entries cannot be edited or deleted. */
const AdminAuditPage: React.FC = () => {
  useDocumentTitle('Audit log');

  const list = useInfiniteList<AuditEntry>(async (cursor, signal) => {
    const page = await api<Page>('/admin/audit', { query: { page: typeof cursor === 'number' ? cursor : 1, limit: 25 }, signal });
    return { items: page.entries, hasMore: page.hasMore, next: page.page + 1, total: page.total };
  }, []);

  return (
    <div>
      {list.error && list.items.length === 0 ? (
        <EmptyState
          tone="error"
          icon={<CloudOff className="h-12 w-12" />}
          title="Could not load the audit log"
          description={list.error}
          action={<Button onClick={list.reload}>Retry</Button>}
        />
      ) : (
        <>
          {list.items.length > 0 && (
            <ol className="space-y-3">
              {list.items.map((e) => {
                const { label, Icon } = ACTIONS[e.action];
                const hasCase = e.dreamId && e.targetType !== 'user';
                return (
                  <li key={e._id} className="rounded-xl border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <p className="min-w-0 flex-1">
                        <strong>{e.admin}</strong> {label} <span className="text-muted">{targetOf(e)}</span>
                        {e.reportCount > 0 && e.action !== 'viewed_anonymous_author' && (
                          <span className="text-muted"> ({e.reportCount} {e.reportCount === 1 ? 'report' : 'reports'})</span>
                        )}
                      </p>
                      <span className="text-sm text-muted">
                        <RelativeTime date={e.createdAt} />
                      </span>
                    </div>
                    {e.note && <p className="mt-2 text-sm text-muted">“{e.note}”</p>}
                    {e.snapshot?.content && (
                      <details className="mt-2 text-sm">
                        <summary className="inline-flex cursor-pointer items-center gap-1 text-accent-text">
                          <Eye className="h-4 w-4" aria-hidden />
                          What was removed
                        </summary>
                        <div className="mt-2 rounded-lg bg-surface-2 p-3">
                          {e.snapshot.title && <p className="mb-1 font-medium">{e.snapshot.title}</p>}
                          <p className="whitespace-pre-line break-words">{e.snapshot.content}</p>
                        </div>
                      </details>
                    )}
                    {hasCase && (
                      <Link to={caseLink({ dreamId: e.dreamId as string, commentId: e.commentId })} className="mt-2 inline-block text-sm text-accent-text hover:underline">
                        Open the case
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {list.loading && (
            <div className="mt-3 space-y-3" role="status" aria-label="Loading audit log">
              {Array.from({ length: list.items.length ? 1 : 4 }, (_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          )}

          {!list.loading && list.items.length === 0 && (
            <EmptyState icon={<ScrollText className="h-12 w-12" />} title="Nothing logged yet" description="Moderator actions will appear here." />
          )}
          <div ref={list.sentinelRef} aria-hidden className="h-1" />
        </>
      )}
    </div>
  );
};

export default AdminAuditPage;
