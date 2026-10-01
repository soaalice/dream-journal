import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame, Moon } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { PersonalStats } from '../../types/stats';
import { Skeleton } from '../ui/Skeleton';

/** A glance at your own journal for the home page: streak, dreams this month, and a way in to the full Insights. */
const JournalSummary: React.FC = () => {
  const { user } = useAuth();
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api<PersonalStats>('/stats/me', { query: { range: '30', tz }, signal: controller.signal })
      .then(setStats)
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, [tz]);

  if (failed) return null;

  const streak = stats?.streaks.current ?? 0;

  return (
    <aside aria-label="Your journal" className="rounded-2xl border border-line bg-surface/90 p-5 shadow-card backdrop-blur">
      <p className="eyebrow mb-3">Your journal</p>

      {!stats ? (
        <div className="space-y-3" role="status" aria-label="Loading your journal">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-highlight-soft p-3">
            <dt className="flex items-center gap-1.5 text-sm text-highlight">
              <Flame className="h-4 w-4" aria-hidden />
              Streak
            </dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">
              {streak} <span className="text-sm font-medium text-muted">{streak === 1 ? 'day' : 'days'}</span>
            </dd>
          </div>
          <div className="rounded-xl bg-accent-soft p-3">
            <dt className="flex items-center gap-1.5 text-sm text-accent-text">
              <Moon className="h-4 w-4" aria-hidden />
              Last 30 days
            </dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">
              {stats.range.dreams} <span className="text-sm font-medium text-muted">{stats.range.dreams === 1 ? 'dream' : 'dreams'}</span>
            </dd>
          </div>
        </dl>
      )}

      <p className="meta mt-3">
        {stats && streak === 0 ? 'Record a dream today to start a streak. ' : ''}
        {user && stats && stats.totals.dreams === 0 ? 'Your insights appear after your first dream.' : ''}
      </p>
      <Link to="/stats" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:underline">
        See your insights <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </aside>
  );
};

export default JournalSummary;
