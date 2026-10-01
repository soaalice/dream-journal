import React from 'react';
import { Bell, CheckCheck, CloudOff } from 'lucide-react';
import { api } from '../lib/api';
import { AppNotification } from '../types';
import { useNotifications } from '../context/NotificationsContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useInfiniteList } from '../hooks/useInfiniteList';
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

const NotificationsPage: React.FC = () => {
  useDocumentTitle('Notifications');
  const toast = useToast();
  const { unreadCount, setUnreadCount } = useNotifications();

  const list = useInfiniteList<Row>(async (cursor, signal) => {
    const page = await api<NotificationPage>('/notifications', { query: { limit: 20, before: cursor ?? undefined }, signal });
    setUnreadCount(page.unreadCount);
    return {
      items: page.notifications.map((n) => ({ ...n, wasUnread: !n.read })),
      hasMore: page.hasMore,
      next: page.nextCursor
    };
  }, []);

  const rows = list.items;

  const markRead = async (ids?: string[]) => {
    const result = await api<{ unreadCount: number }>('/notifications/read', { method: 'POST', body: ids ? { ids } : {} });
    setUnreadCount(result.unreadCount);
  };

  const handleOpen = (n: AppNotification) => {
    if (n.read) return;
    list.setItems((prev) => prev.map((r) => (r._id === n._id ? { ...r, read: true } : r)));
    markRead([n._id]).catch(() => {
      /* the badge corrects itself on the next poll */
    });
  };

  const handleMarkAll = async () => {
    const previous = rows;
    list.setItems((prev) => prev.map((r) => ({ ...r, read: true })));
    try {
      await markRead();
    } catch {
      list.setItems(previous);
      toast.error('Could not mark notifications as read');
    }
  };

  const handleDismiss = async (n: AppNotification) => {
    const previous = rows;
    list.setItems((prev) => prev.filter((r) => r._id !== n._id));
    try {
      const result = await api<{ unreadCount: number }>(`/notifications/${n._id}`, { method: 'DELETE' });
      setUnreadCount(result.unreadCount);
    } catch {
      list.setItems(previous);
      toast.error('Could not dismiss this notification');
    }
  };

  const fresh = rows.filter((r) => r.wasUnread);
  const earlier = rows.filter((r) => !r.wasUnread);

  const renderGroup = (title: string, group: Row[]) =>
    group.length > 0 && (
      <section aria-label={title} className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
        <ul className="space-y-3">
          {group.map((n) => (
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

      {list.error && rows.length === 0 ? (
        <EmptyState
          tone="error"
          icon={<CloudOff className="h-12 w-12" />}
          title="Could not load notifications"
          description={list.error}
          action={<Button onClick={list.reload}>Retry</Button>}
        />
      ) : (
        <>
          {renderGroup('New', fresh)}
          {renderGroup('Earlier', earlier)}

          {list.loading && (
            <div className="space-y-3" role="status" aria-label="Loading notifications">
              {Array.from({ length: rows.length ? 2 : 4 }, (_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          )}

          {!list.loading && rows.length === 0 && (
            <EmptyState
              icon={<Bell className="h-12 w-12" />}
              title="No notifications yet"
              description="You will see comments, replies, mentions and likes here."
            />
          )}

          {list.error && rows.length > 0 && (
            <div className="text-center">
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

export default NotificationsPage;
