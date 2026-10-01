import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CloudOff, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { BlockedUser, BlocksPage } from '../types';
import BlockedRow from '../components/moderation/BlockedRow';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';

const PAGE_SIZE = 20;

/** Everyone you blocked, most recent first, with a quick unblock. Loads more as you scroll. */
const BlockedUsersPage: React.FC = () => {
  useDocumentTitle('Blocked users');
  const toast = useToast();
  const { reloadDreams } = useApp();

  const list = useInfiniteList<BlockedUser>(async (cursor, signal) => {
    const page = await api<BlocksPage>('/blocks', { query: { limit: PAGE_SIZE, before: cursor ?? undefined }, signal });
    return { items: page.blocks, hasMore: page.hasMore, next: page.nextCursor, total: page.total };
  }, []);

  const unblock = async (block: BlockedUser) => {
    try {
      await api(`/blocks/${block._id}`, { method: 'DELETE' });
      list.setItems((prev) => prev.filter((b) => b._id !== block._id));
      reloadDreams();
      toast.success(`${block.user?.name ?? 'User'} was unblocked`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not unblock this user');
    }
  };

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <Link to="/profile/edit" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Profile settings
      </Link>

      <h1 className="font-serif text-3xl font-bold">Blocked users</h1>
      <p className="mb-6 text-muted">
        Blocked people cannot see your dreams or comments, and you cannot see theirs. They are not told they were blocked.
      </p>

      {list.error && list.items.length === 0 ? (
        <EmptyState
          tone="error"
          icon={<CloudOff className="h-12 w-12" />}
          title="Could not load your blocked users"
          description={list.error}
          action={<Button onClick={list.reload}>Retry</Button>}
        />
      ) : (
        <>
          {list.items.length > 0 && (
            <ul className="space-y-3">
              {list.items.map((block) => (
                <BlockedRow key={block._id} block={block} onUnblock={unblock} />
              ))}
            </ul>
          )}

          {list.loading && (
            <div className="mt-3 space-y-3" role="status" aria-label="Loading blocked users">
              {Array.from({ length: list.items.length ? 2 : 3 }, (_, i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
              ))}
            </div>
          )}

          {!list.loading && list.items.length === 0 && (
            <EmptyState
              icon={<ShieldCheck className="h-12 w-12" />}
              title="You have not blocked anyone"
              description="To block someone, open the menu on one of their dreams or comments and choose “Block user”."
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

export default BlockedUsersPage;
