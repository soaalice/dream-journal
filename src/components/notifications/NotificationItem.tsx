import React from 'react';
import { Link } from 'react-router-dom';
import { AtSign, CornerDownRight, Heart, MessageSquare, X } from 'lucide-react';
import { AppNotification } from '../../types';
import Avatar from '../ui/Avatar';
import RelativeTime from '../dream/RelativeTime';

interface NotificationItemProps {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
  onDismiss: (notification: AppNotification) => void;
}

const ICONS = {
  comment: MessageSquare,
  reply: CornerDownRight,
  mention: AtSign,
  like: Heart
} as const;

/** Where clicking a notification should lead. */
export const notificationTarget = (n: AppNotification): string => {
  return n.commentId ? `/dream/${n.dream._id}#comment-${n.commentId}` : `/dream/${n.dream._id}`;
};

const Summary: React.FC<{ n: AppNotification }> = ({ n }) => {
  const who = <strong>{n.actor?.name ?? 'Someone'}</strong>;
  const title = <em className="font-serif not-italic font-semibold">“{n.dream.title}”</em>;

  switch (n.type) {
    case 'comment':
      return <>{who} commented on {title}</>;
    case 'reply':
      return <>{who} replied to your comment on {title}</>;
    case 'mention':
      return <>{who} mentioned you in {title}</>;
    case 'like':
      return (
        <>
          {who}
          {n.count > 1 && ` and ${n.count - 1} ${n.count - 1 === 1 ? 'other' : 'others'}`} liked {title}
        </>
      );
  }
};

const NotificationItem: React.FC<NotificationItemProps> = ({ notification: n, onOpen, onDismiss }) => {
  const Icon = ICONS[n.type];

  return (
    <li
      className={`relative flex items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-surface-2 ${
        n.read ? 'border-line bg-surface' : 'border-accent/40 bg-accent-soft/50'
      }`}
    >
      <div className="relative shrink-0">
        <Avatar src={n.actor?.avatarUrl} name={n.actor?.name ?? 'Someone'} size="md" />
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white ring-2 ring-surface">
          <Icon className="h-3 w-3" aria-hidden />
        </span>
      </div>

      <div className="min-w-0 flex-1 text-sm">
        {/* stretched link: the whole row opens the target, the dismiss button sits above it */}
        <Link
          to={notificationTarget(n)}
          onClick={() => onOpen(n)}
          className="rounded after:absolute after:inset-0 after:content-['']"
        >
          <Summary n={n} />
        </Link>
        <p className="mt-0.5 text-muted">
          <RelativeTime date={n.createdAt} />
          {!n.read && <span className="ml-2 font-medium text-accent-text">New</span>}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(n)}
        aria-label="Dismiss notification"
        className="relative z-10 -mr-2 -mt-2 rounded-lg p-2 text-muted hover:bg-surface hover:text-fg"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
};

export default NotificationItem;
