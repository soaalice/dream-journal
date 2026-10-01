import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { CloudOff, UserCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useInfiniteList } from '../../hooks/useInfiniteList';
import { SuspendedUser } from '../../types/admin';
import RelativeTime from '../../components/dream/RelativeTime';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/Confirm';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { AdminOutletContext } from './AdminLayout';

interface Page {
  users: SuspendedUser[];
  page: number;
  total: number;
  hasMore: boolean;
}

const AdminSuspendedPage: React.FC = () => {
  useDocumentTitle('Suspended users');
  const toast = useToast();
  const confirm = useConfirm();
  const { refreshSummary } = useOutletContext<AdminOutletContext>();

  const list = useInfiniteList<SuspendedUser>(async (cursor, signal) => {
    const page = await api<Page>('/admin/users/suspended', { query: { page: typeof cursor === 'number' ? cursor : 1, limit: 20 }, signal });
    return { items: page.users, hasMore: page.hasMore, next: page.page + 1, total: page.total };
  }, []);

  const unsuspend = async (user: SuspendedUser) => {
    const ok = await confirm({
      title: `Unsuspend ${user.name}?`,
      description: 'They can sign in again and their dreams and comments become visible.',
      confirmLabel: 'Unsuspend'
    });
    if (!ok) return;
    try {
      await api(`/admin/users/${user._id}/unsuspend`, { method: 'POST' });
      list.setItems((prev) => prev.filter((u) => u._id !== user._id));
      refreshSummary();
      toast.success(`${user.name} was unsuspended`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not unsuspend this user');
    }
  };

  return (
    <div>
      {list.error && list.items.length === 0 ? (
        <EmptyState
          tone="error"
          icon={<CloudOff className="h-12 w-12" />}
          title="Could not load suspended users"
          description={list.error}
          action={<Button onClick={list.reload}>Retry</Button>}
        />
      ) : (
        <>
          {list.items.length > 0 && (
            <ul className="space-y-3">
              {list.items.map((u) => (
                <li key={u._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{u.name}</p>
                    <p className="break-all text-sm text-muted">{u.email}</p>
                    <p className="mt-1 text-sm">
                      <span className="text-muted">Suspended </span>
                      <RelativeTime date={u.suspendedAt} />
                      {u.suspensionReason && <span className="text-muted">: {u.suspensionReason}</span>}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => unsuspend(u)} aria-label={`Unsuspend ${u.name}`}>
                    <UserCheck className="h-4 w-4" aria-hidden />
                    Unsuspend
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {list.loading && (
            <div className="mt-3 space-y-3" role="status" aria-label="Loading suspended users">
              {Array.from({ length: list.items.length ? 1 : 3 }, (_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          )}

          {!list.loading && list.items.length === 0 && (
            <EmptyState icon={<UserCheck className="h-12 w-12" />} title="Nobody is suspended" description="Suspended accounts will be listed here." />
          )}
          <div ref={list.sentinelRef} aria-hidden className="h-1" />
        </>
      )}
    </div>
  );
};

export default AdminSuspendedPage;
