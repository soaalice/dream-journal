import React from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CloudOff } from 'lucide-react';
import { api } from '../../lib/api';
import { REPORT_REASONS } from '../../lib/reports';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useInfiniteList } from '../../hooks/useInfiniteList';
import { AdminCasesPage, AdminCaseSummary } from '../../types/admin';
import CaseCard from '../../components/admin/CaseCard';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { AdminOutletContext } from './AdminLayout';

const PAGE_SIZE = 15;

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' }
] as const;

const TYPES = [
  { value: '', label: 'Everything' },
  { value: 'dream', label: 'Dreams' },
  { value: 'comment', label: 'Comments' }
] as const;

const Tile: React.FC<{ label: string; value?: number; tone?: 'alert' }> = ({ label, value, tone }) => (
  <div className="rounded-xl border border-line bg-surface p-4">
    <p className="text-sm text-muted">{label}</p>
    <p className={`text-2xl font-bold tabular-nums ${tone === 'alert' && value ? 'text-danger-text' : ''}`}>{value ?? '–'}</p>
  </div>
);

/** The report queue. Reports about the same content are grouped into one case, most reported first. */
const AdminReportsPage: React.FC = () => {
  useDocumentTitle('Reports');
  const { summary } = useOutletContext<AdminOutletContext>();
  const [params, setParams] = useSearchParams();

  const status = (params.get('status') as (typeof STATUSES)[number]['value']) || 'open';
  const type = params.get('type') ?? '';
  const reason = params.get('reason') ?? '';

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const list = useInfiniteList<AdminCaseSummary>(
    async (cursor, signal) => {
      const page = await api<AdminCasesPage>('/admin/reports', {
        query: { page: typeof cursor === 'number' ? cursor : 1, limit: PAGE_SIZE, status, type: type || undefined, reason: reason || undefined },
        signal
      });
      return { items: page.cases, hasMore: page.hasMore, next: page.page + 1, total: page.total };
    },
    [status, type, reason]
  );

  const filtered = status !== 'open' || Boolean(type) || Boolean(reason);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Open cases" value={summary?.open} tone="alert" />
        <Tile label="Reviewed (7 days)" value={summary?.reviewedLast7Days} />
        <Tile label="Dismissed (7 days)" value={summary?.dismissedLast7Days} />
        <Tile label="Suspended users" value={summary?.suspendedUsers} />
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
          {STATUSES.map((s) => (
            <Chip key={s.value} selected={status === s.value} onClick={() => update('status', s.value === 'open' ? '' : s.value)}>
              {s.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Type">
            {TYPES.map((t) => (
              <Chip key={t.value} selected={type === t.value} onClick={() => update('type', t.value)}>
                {t.label}
              </Chip>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted">Reason</span>
            <select
              value={reason}
              onChange={(e) => update('reason', e.target.value)}
              className="min-h-9 rounded-lg border border-line bg-surface px-3 text-fg"
            >
              <option value="">Any</option>
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-sm text-muted" aria-live="polite">
          {list.loading && list.items.length === 0 ? 'Loading…' : `${list.total ?? 0} ${list.total === 1 ? 'case' : 'cases'}`}
        </p>
      </div>

      {list.error && list.items.length === 0 ? (
        <EmptyState
          tone="error"
          icon={<CloudOff className="h-12 w-12" />}
          title="Could not load reports"
          description={list.error}
          action={<Button onClick={list.reload}>Retry</Button>}
        />
      ) : (
        <>
          {list.items.length > 0 && (
            <ul className="space-y-3">
              {list.items.map((item) => (
                <CaseCard key={item.key} item={item} />
              ))}
            </ul>
          )}

          {list.loading && (
            <div className="mt-3 space-y-3" role="status" aria-label="Loading reports">
              {Array.from({ length: list.items.length ? 1 : 3 }, (_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          )}

          {!list.loading && list.items.length === 0 && (
            <EmptyState
              icon={<CheckCircle2 className="h-12 w-12" />}
              title={filtered ? 'No cases match these filters' : 'All caught up'}
              description={filtered ? 'Try another status, type or reason.' : 'There are no open reports.'}
            />
          )}

          {list.error && list.items.length > 0 && (
            <div className="mt-4 text-center">
              <Button variant="secondary" onClick={list.loadMore}>
                Retry loading more
              </Button>
            </div>
          )}
          <div ref={list.sentinelRef} aria-hidden className="h-1" />
        </>
      )}
    </div>
  );
};

export default AdminReportsPage;
