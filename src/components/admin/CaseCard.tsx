import React from 'react';
import { Link } from 'react-router-dom';
import { Flag, MessageSquare, Moon } from 'lucide-react';
import { reasonLabel } from '../../lib/reports';
import { AdminCaseSummary } from '../../types/admin';
import RelativeTime from '../dream/RelativeTime';

export const caseLink = (c: { dreamId: string; commentId: string | null }) =>
  `/admin/case?dream=${c.dreamId}${c.commentId ? `&comment=${c.commentId}` : ''}`;

/** One reported dream or comment in the queue, with all its reports rolled up. */
const CaseCard: React.FC<{ item: AdminCaseSummary }> = ({ item }) => {
  const isComment = item.targetType === 'comment';
  const Icon = isComment ? MessageSquare : Moon;
  const reasons = Object.entries(item.reasons) as Array<[Parameters<typeof reasonLabel>[0], number]>;
  const resolved = item.openCount === 0;

  return (
    <li className="relative rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:bg-surface-2/60 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 font-medium text-accent-text">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {isComment ? 'Comment' : 'Dream'}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-0.5 font-medium text-danger-text">
          <Flag className="h-3.5 w-3.5" aria-hidden />
          {item.reportCount} {item.reportCount === 1 ? 'report' : 'reports'}
        </span>
        {item.moderationState === 'hidden' && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">Auto-hidden</span>
        )}
        {item.moderationState === 'removed' && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-muted">Removed</span>}
        {resolved && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-muted">Resolved</span>}
        {!item.contentExists && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-muted">Content gone</span>}
        {item.authorSuspended && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">Author suspended</span>
        )}
        <span className="ml-auto text-muted">
          <RelativeTime date={resolved && item.lastResolvedAt ? item.lastResolvedAt : item.lastReportedAt} />
        </span>
      </div>

      <h2 className="mb-1 font-serif text-lg font-bold leading-snug">
        {/* stretched link: the whole card opens the case */}
        <Link to={caseLink(item)} className="rounded after:absolute after:inset-0 after:content-['']">
          {isComment ? `Comment by ${item.authorName}` : item.title || 'Untitled dream'}
        </Link>
      </h2>
      <p className="mb-3 line-clamp-2 whitespace-pre-line text-muted">{item.excerpt || 'No text kept for this report.'}</p>

      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {reasons.map(([reason, count]) => (
          <span key={reason} className="rounded-full border border-line px-2.5 py-0.5">
            {reasonLabel(reason)}
            {count > 1 && <span className="ml-1 tabular-nums text-muted">×{count}</span>}
          </span>
        ))}
        {!isComment && <span className="ml-auto text-muted">by {item.authorName}</span>}
      </div>
    </li>
  );
};

export default CaseCard;
