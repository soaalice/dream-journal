import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AtSign, CornerDownRight, Gavel, Heart, MessageSquare, ShieldAlert, X } from 'lucide-react';
import { reasonLabel } from '../../lib/reports';
import { AppNotification, ModerationNotice } from '../../types';
import AppealDialog from '../moderation/AppealDialog';
import Avatar from '../ui/Avatar';
import { Button } from '../ui/Button';
import RelativeTime from '../dream/RelativeTime';

interface NotificationItemProps {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
  onDismiss: (notification: AppNotification) => void;
  /** called after an appeal was sent, so the row can show its status */
  onAppealed?: (notification: AppNotification) => void;
}

const ICONS = {
  comment: MessageSquare,
  reply: CornerDownRight,
  mention: AtSign,
  like: Heart,
  moderation: ShieldAlert,
  appeal: Gavel
} as const;

/** Where clicking a notification should lead (null when there is nothing left to open). */
export const notificationTarget = (n: AppNotification): string | null => {
  if (n.appeal) return `/admin/appeals/${n.appeal._id}`;
  if (!n.dream) return null;
  return n.commentId ? `/dream/${n.dream._id}#comment-${n.commentId}` : `/dream/${n.dream._id}`;
};

const Quote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <em className="font-serif font-semibold not-italic">&ldquo;{children}&rdquo;</em>
);

const ModerationSummary: React.FC<{ m: ModerationNotice }> = ({ m }) => {
  const what = m.kind === 'comment' ? 'comment' : 'dream';
  const subject = <Quote>{m.title || 'Untitled'}</Quote>;
  switch (m.event) {
    case 'removed':
      return <>Your {what} {subject} was removed by moderators</>;
    case 'hidden':
      return <>Your {what} {subject} was hidden while moderators review reports about it</>;
    case 'restored':
      return <>Your {what} {subject} is visible again</>;
    case 'appeal_overturned':
      return <>Your appeal was accepted: your {what} {subject} is visible again</>;
    case 'appeal_upheld':
      return <>Your appeal was declined: your {what} {subject} stays removed</>;
  }
};

const APPEAL_LABEL = {
  open: 'Appeal sent. A moderator is reviewing it.',
  upheld: 'Appeal declined.',
  overturned: 'Appeal accepted.'
} as const;

const AppealSummary: React.FC<{ a: NonNullable<AppNotification['appeal']> }> = ({ a }) => {
  const who = <strong>{a.authorName || 'Someone'}</strong>;
  if (a.targetType === 'account') return <>{who} appealed their suspension</>;
  return (
    <>
      {who} appealed the removal of their {a.targetType} <Quote>{a.title || 'Untitled'}</Quote>
    </>
  );
};

const Summary: React.FC<{ n: AppNotification }> = ({ n }) => {
  if (n.appeal) return <AppealSummary a={n.appeal} />;
  if (n.moderation) return <ModerationSummary m={n.moderation} />;

  const who = <strong>{n.actor?.name ?? 'Someone'}</strong>;
  const title = <Quote>{n.dream?.title}</Quote>;
  switch (n.type) {
    case 'comment':
      return <>{who} commented on {title}</>;
    case 'reply':
      return <>{who} replied to your comment on {title}</>;
    case 'mention':
      return <>{who} mentioned you in {title}</>;
    default:
      return (
        <>
          {who}
          {n.count > 1 && ` and ${n.count - 1} ${n.count - 1 === 1 ? 'other' : 'others'}`} liked {title}
        </>
      );
  }
};

const NotificationItem: React.FC<NotificationItemProps> = ({ notification: n, onOpen, onDismiss, onAppealed }) => {
  const Icon = ICONS[n.type];
  const target = notificationTarget(n);
  const m = n.moderation;
  const a = n.appeal;
  const [appealing, setAppealing] = useState(false);

  const summary = <Summary n={n} />;

  return (
    <li
      className={`relative flex items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-surface-2 ${
        n.read ? 'border-line bg-surface' : 'border-accent/40 bg-accent-soft/50'
      }`}
    >
      <div className="relative shrink-0">
        {m || a ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        ) : (
          <>
            <Avatar src={n.actor?.avatarUrl} name={n.actor?.name ?? 'Someone'} size="md" />
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white ring-2 ring-surface">
              <Icon className="h-3 w-3" aria-hidden />
            </span>
          </>
        )}
      </div>

      <div className="min-w-0 flex-1 text-sm">
        {/* stretched link: the whole row opens the target; buttons inside sit above it */}
        {target ? (
          <Link to={target} onClick={() => onOpen(n)} className="rounded after:absolute after:inset-0 after:content-['']">
            {summary}
          </Link>
        ) : (
          <p onClick={() => onOpen(n)}>{summary}</p>
        )}

        {m && (
          <div className="mt-2 space-y-2">
            {m.excerpt && <p className="line-clamp-3 whitespace-pre-line rounded-lg bg-surface-2 p-2 text-muted">{m.excerpt}</p>}
            {m.message && <p>{m.message}</p>}
            {m.reasons.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5 text-muted">
                Reported for:
                {m.reasons.map((r) => (
                  <span key={r} className="rounded-full border border-line px-2 py-0.5">
                    {reasonLabel(r)}
                  </span>
                ))}
              </p>
            )}
            {m.appeal && <p className="font-medium text-accent-text">{APPEAL_LABEL[m.appeal.status]}</p>}
            {m.canAppeal && (
              <Button size="sm" variant="secondary" onClick={() => setAppealing(true)} className="relative z-10">
                Appeal this decision
              </Button>
            )}
          </div>
        )}

        {a && (
          <div className="mt-2 space-y-1">
            {a.excerpt && <p className="line-clamp-2 whitespace-pre-line rounded-lg bg-surface-2 p-2 text-muted">{a.excerpt}</p>}
            <p className="font-medium text-accent-text">
              {a.status === 'open' ? 'Waiting for a decision' : a.status === 'overturned' ? 'Accepted' : 'Declined'}
            </p>
          </div>
        )}

        <p className="mt-1 text-muted">
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

      {m && (
        <AppealDialog
          open={appealing}
          onClose={() => setAppealing(false)}
          notificationId={n._id}
          title={m.title || 'this content'}
          onSent={() => onAppealed?.(n)}
        />
      )}
    </li>
  );
};

export default NotificationItem;
