import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { BlockedUser, BlocksPage } from '../../types';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import BlockedRow from './BlockedRow';

const PREVIEW_SIZE = 3;

/** "Blocked users" section of the profile settings: the most recent few, with a link to the full list. */
const BlockedPreview: React.FC = () => {
  const toast = useToast();
  const { reloadDreams } = useApp();
  const [data, setData] = useState<BlocksPage | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<BlocksPage>('/blocks', { query: { limit: PREVIEW_SIZE } })
      .then((page) => !cancelled && setData(page))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const unblock = useCallback(
    async (block: BlockedUser) => {
      try {
        await api(`/blocks/${block._id}`, { method: 'DELETE' });
        // Refetch so the list refills with the next most recent block.
        setData(await api<BlocksPage>('/blocks', { query: { limit: PREVIEW_SIZE } }));
        reloadDreams();
        toast.success(`${block.user?.name ?? 'User'} was unblocked`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not unblock this user');
      }
    },
    [reloadDreams, toast]
  );

  return (
    <Card as="section" aria-labelledby="blocked-title" className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="blocked-title" className="font-serif text-xl font-bold">
            Blocked users
          </h2>
          <p className="text-sm text-muted">You and blocked people cannot see each other&apos;s dreams or comments.</p>
        </div>
        {data && data.total > PREVIEW_SIZE && (
          <Link to="/blocked" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
            View all ({data.total}) <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-danger-text">
          Could not load your blocked users.
        </p>
      ) : !data ? (
        <div className="space-y-3" role="status" aria-label="Loading blocked users">
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : data.blocks.length === 0 ? (
        <p className="text-muted">You have not blocked anyone.</p>
      ) : (
        <>
          <p className="mb-2 text-sm font-medium text-muted">Recently blocked</p>
          <ul className="space-y-3">
            {data.blocks.map((b) => (
              <BlockedRow key={b._id} block={b} onUnblock={unblock} />
            ))}
          </ul>
          {data.total <= PREVIEW_SIZE && (
            <Link to="/blocked" className="mt-3 inline-block text-sm font-medium text-accent-text hover:underline">
              Open the blocked users page
            </Link>
          )}
        </>
      )}
    </Card>
  );
};

export default BlockedPreview;
