import React, { useState } from 'react';
import { Bell, CheckCheck, CloudOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Chip } from '../components/ui/Chip';
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
import { Page, PageHeader } from '../components/ui/Page';

type Group = 'all' | 'activity' | 'moderation' | 'appeals';

interface NotificationPage {
  unreadAppeals: number;
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
  const role = useAuth().user?.role;
  const isStaff = role === 'admin' || role === 'moderator';
  const [group, setGroup] = useState<Group>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unreadAppeals, setUnreadAppeals] = useState(0);

  const list = useInfiniteList<Row>(async (cursor, signal) => {
    const page = await api<NotificationPage>('/notifications', { query: { limit: 20, before: cursor ?? undefined, group, unread: unreadOnly ? '1' : '0' }, signal });
    setUnreadCount(page.unreadCount);
    setUnreadAppeals(page.unreadAppeals);
    return {
      items: page.notifications.map((n) => ({ ...n, wasUnread: !n.read })),
      hasMore: page.hasMore,
      next: page.nextCursor
    };
  }, [group, unreadOnly]);

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

  const handleAppealed = (n: AppNotification) =>
    list.setItems((prev) =>
      prev.map((r) =>
        r._id === n._id && r.moderation ? { ...r, moderation: { ...r.moderation, canAppeal: false, appeal: { status: 'open' as const } } } : r
      )
    );

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
        <h2 className="eyebrow mb-3">{title}</h2>
        <ul className="space-y-3">
          {group.map((n) => (
            <NotificationItem key={n._id} notification={n} onOpen={handleOpen} onDismiss={handleDismiss} onAppealed={handleAppealed} />
          ))}
        </ul>
      </section>
    );

  return (
    <Page width="narrow">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
        actions={
          <Button variant="secondary" size="sm" onClick={handleMarkAll} disabled={unreadCount === 0}>
            <CheckCheck className="h-4 w-4" aria-hidden />
            Mark all as read
          </Button>
        }
      />

      {isStaff && (
        <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter notifications">
          {(
            [
              ['all', 'All'],
              ['appeals', 'Appeals'],
              ['activity', 'Activity'],
              ['moderation', 'Decisions on my content']
            ] as Array<[Group, string]>
          ).map(([value, label]) => (
            <Chip key={value} selected={group === value} onClick={() => setGroup(value)}>
              {label}
              {value === 'appeals' && unreadAppeals > 0 && (
                <span className="ml-1.5 rounded-full bg-accent px-1.5 text-xs text-white tabular-nums" aria-label={`${unreadAppeals} unread`}>
                  {unreadAppeals}
                </span>
              )}
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <Chip selected={unreadOnly} onClick={() => setUnreadOnly((v) => !v)}>
            Unread only
          </Chip>
        </div>
      )}

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
              description={group === 'appeals' ? 'No appeals to show.' : unreadOnly ? 'Nothing unread here.' : 'You will see comments, replies, mentions and likes here.'}
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
    </Page>
  );
};

export default NotificationsPage;
