import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CloudOff } from 'lucide-react';
import { api } from '../../lib/api';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useInfiniteList } from '../../hooks/useInfiniteList';
import { AppealStatus, AppealSummary } from '../../types/admin';
import RelativeTime from '../../components/dream/RelativeTime';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';

interface Page {
  appeals: AppealSummary[];
  page: number;
  total: number;
  hasMore: boolean;
}

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'overturned', label: 'Accepted' },
  { value: 'upheld', label: 'Declined' },
  { value: 'all', label: 'All' }
] as const;

const STATUS_LABEL: Record<AppealStatus, string> = { open: 'Open', overturned: 'Accepted', upheld: 'Declined' };
const TARGET_LABEL = { dream: 'Dream', comment: 'Comment', account: 'Suspension' } as const;

/** Authors asking for a second look at a removal or a suspension. Oldest first, so nobody waits forever. */
const AdminAppealsPage: React.FC = () => {
  useDocumentTitle('Appeals');
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as (typeof FILTERS)[number]['value']) || 'open';

  const list = useInfiniteList<AppealSummary>(
    async (cursor, signal) => {
      const page = await api<Page>('/admin/appeals', { query: { page: typeof cursor === 'number' ? cursor : 1, limit: 15, status }, signal });
      return { items: page.appeals, hasMore: page.hasMore, next: page.page + 1, total: page.total };
    },
    [status]
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Status">
        {FILTERS.map((f) => (
          <Chip key={f.value} selected={status === f.value} onClick={() => setParams(f.value === 'open' ? {} : { status: f.value }, { replace: true })}>
            {f.label}
          </Chip>
        ))}
      </div>
      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {list.loading && list.items.length === 0 ? 'Loading…' : `${list.total ?? 0} ${list.total === 1 ? 'appeal' : 'appeals'}`}
      </p>

      {list.error && list.items.length === 0 ? (
        <EmptyState
          tone="error"
          icon={<CloudOff className="h-12 w-12" />}
          title="Could not load appeals"
          description={list.error}
          action={<Button onClick={list.reload}>Retry</Button>}
        />
      ) : (
        <>
          {list.items.length > 0 && (
            <ul className="space-y-3">
              {list.items.map((a) => (
                <li key={a._id} className="relative rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:bg-surface-2/60 sm:p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-medium text-accent-text">{TARGET_LABEL[a.targetType]}</span>
                    <span className={`rounded-full px-2.5 py-0.5 ${a.status === 'open' ? 'bg-danger/10 text-danger-text' : 'bg-surface-2 text-muted'}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                    <span className="ml-auto text-muted">
                      <RelativeTime date={a.status === 'open' ? a.createdAt : a.resolvedAt ?? a.createdAt} />
                    </span>
                  </div>
                  <h2 className="mb-1 font-serif text-lg font-bold leading-snug">
                    <Link to={`/admin/appeals/${a._id}`} className="rounded after:absolute after:inset-0 after:content-['']">
                      {a.targetType === 'account' ? `${a.authorName} appeals a suspension` : a.title || 'Untitled'}
                    </Link>
                  </h2>
                  <p className="line-clamp-2 text-muted">&ldquo;{a.message}&rdquo;</p>
                  <p className="mt-2 text-sm text-muted">
                    {a.targetType !== 'account' && <>by {a.authorName}</>}
                    {a.resolvedBy && <> · decided by {a.resolvedBy}</>}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {list.loading && (
            <div className="mt-3 space-y-3" role="status" aria-label="Loading appeals">
              {Array.from({ length: list.items.length ? 1 : 3 }, (_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          )}

          {!list.loading && list.items.length === 0 && (
            <EmptyState icon={<CheckCircle2 className="h-12 w-12" />} title={status === 'open' ? 'No open appeals' : 'Nothing here'} description="Appeals from authors will appear here." />
          )}
          <div ref={list.sentinelRef} aria-hidden className="h-1" />
        </>
      )}
    </div>
  );
};

export default AdminAppealsPage;
