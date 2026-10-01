import React, { useState } from 'react';
import { UserX } from 'lucide-react';
import { BlockedUser } from '../../types';
import { formatDate } from '../../utils/date';
import Avatar from '../ui/Avatar';
import { Button } from '../ui/Button';

interface BlockedRowProps {
  block: BlockedUser;
  onUnblock: (block: BlockedUser) => Promise<void>;
}

/** One blocked person with a quick "Unblock". Blocks made from anonymous content stay anonymous. */
const BlockedRow: React.FC<BlockedRowProps> = ({ block, onUnblock }) => {
  const [busy, setBusy] = useState(false);
  const name = block.user?.name ?? 'Anonymous user';

  const handle = async () => {
    setBusy(true);
    try {
      await onUnblock(block);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 sm:p-4">
      {block.user ? (
        <Avatar src={block.user.avatarUrl} name={name} size="md" />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted" aria-hidden>
          <UserX className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="text-sm text-muted">
          Blocked {formatDate(block.createdAt)}
          {block.anonymous && ' · from an anonymous dream'}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={handle} loading={busy} aria-label={`Unblock ${name}`}>
        Unblock
      </Button>
    </li>
  );
};

export default BlockedRow;
