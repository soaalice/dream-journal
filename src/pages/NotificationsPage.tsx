import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, CloudOff } from 'lucide-react';
import { api } from '../lib/api';
import { AppNotification } from '../types';
import { useNotifications } from '../context/NotificationsContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import NotificationItem from '../components/notifications/NotificationItem';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';

interface NotificationPage {
  notifications: AppNotification[];
  hasMore: boolean;
  nextCursor: string | null;
  unreadCount: number;
}

/** A row remembers whether it was unread when loaded, so groups do not reshuffle while you read. */
type Row = AppNotification & { wasUnread: boolean };

const toRows = (list: AppNotification[]): Row[] => list.map((n) => ({ ...n, wasUnread: !n.read }));

const NotificationsPage: React.FC = () => {
  useDocumentTitle('Notifications');
  const toast = useToast();
  const { unreadCount, setUnreadCount } = useNotifications();

  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async (before: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const page = await api<NotificationPage>('/notifications', { query: { limit: 20, before: before ?? undefined } });
      setRows((prev) => (before ? [...prev, ...toRows(page.notifications)] : toRows(page.notifications)));
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setUnreadCount(page.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [setUnreadCount]);

  useEffect(() => {
    load(null);
  }, [load, attempt]);

  const sentinelRef = useInfiniteScroll(() => load(cursor), hasMore && !loading && !error);

  const markRead = async (ids?: string[]) => {
    const result = await api<{ unreadCount: number }>('/notifications/read', { method: 'POST', body: ids ? { ids } : {} });
    setUnreadCount(result.unreadCount);
  };

  const handleOpen = (n: AppNotification) => {
    if (n.read) return;
    setRows((prev) => prev.map((r) => (r._id === n._id ? { ...r, read: true } : r)));
    markRead([n._id]).catch(() => {
      /* the badge corrects itself on the next poll */
    });
  };

  const handleMarkAll = async () => {
    const previous = rows;
    setRows((prev) => prev.map((r) => ({ ...r, read: true })));
    try {
      await markRead();
    } catch {
      setRows(previous);
      toast.error('Could not mark notifications as read');
    }
  };

  const handleDismiss = async (n: AppNotification) => {
    const previous = rows;
    setRows((prev) => prev.filter((r) => r._id !== n._id));
    try {
      const result = await api<{ unreadCount: number }>(`/notifications/${n._id}`, { method: 'DELETE' });
      setUnreadCount(result.unreadCount);
    } catch {
      setRows(previous);
      toast.error('Could not dismiss this notification');
    }
  };

  const fresh = rows.filter((r) => r.wasUnread);
  const earlier = rows.filter((r) => !r.wasUnread);

  const renderGroup = (title: string, list: Row[]) =>
    list.length > 0 && (
      <section aria-label={title} className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
        <ul className="space-y-3">
          {list.map((n) => (
            <NotificationItem key={n._id} notification={n} onOpen={handleOpen} onDismiss={handleDismiss} />
          ))}
        </ul>
      </section>
    );

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">Notifications</h1>
          <p className="text-muted">{unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleMarkAll} disabled={unreadCount === 0}>
          <CheckCheck className="h-4 w-4" aria-hidden />
          Mark all as read
        </Button>
      </div>

      {error && rows.length === 0 ? (
        <EmptyState
          tone="error"
          icon={<CloudOff className="h-12 w-12" />}
          title="Could not load notifications"
          description={error}
          action={<Button onClick={() => setAttempt((a) => a + 1)}>Retry</Button>}
        />
      ) : (
        <>
          {renderGroup('New', fresh)}
          {renderGroup('Earlier', earlier)}

          {loading && (
            <div className="space-y-3" role="status" aria-label="Loading notifications">
              {Array.from({ length: rows.length ? 2 : 4 }, (_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          )}

          {!loading && rows.length === 0 && (
            <EmptyState
              icon={<Bell className="h-12 w-12" />}
              title="No notifications yet"
              description="You will see comments, mentions, likes and new followers here."
            />
          )}

          {error && rows.length > 0 && (
            <div className="text-center">
              <Button variant="secondary" onClick={() => load(cursor)}>
                Retry loading more
              </Button>
            </div>
          )}
          <div ref={sentinelRef} aria-hidden className="h-1" />
        </>
      )}
    </div>
  );
};

export default NotificationsPage;
