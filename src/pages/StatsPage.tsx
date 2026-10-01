import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, CloudOff, Flame, Heart, Lightbulb, MessageSquare, Trophy } from 'lucide-react';
import { api } from '../lib/api';
import { formatDay } from '../lib/dates';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PersonalStats, StatsRange } from '../types/stats';
import CalendarHeatmap from '../components/stats/CalendarHeatmap';
import { MoodBars, PrivacySplit, Timeline, TopTags, Weekdays } from '../components/stats/Charts';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Page, PageHeader } from '../components/ui/Page';
import { Chip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

const RANGES: Array<{ value: StatsRange; label: string }> = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: 'Year' },
  { value: 'all', label: 'All time' }
];

const Tile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }> = ({ icon, label, value, hint }) => (
  <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
    <p className="flex items-center gap-1.5 text-sm text-muted">
      {icon}
      {label}
    </p>
    <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    {hint && <p className="text-xs text-muted">{hint}</p>}
  </div>
);

const ChartCard: React.FC<{ title: string; hint?: string; children: React.ReactNode; className?: string }> = ({ title, hint, children, className = '' }) => (
  <Card as="section" aria-label={title} className={className}>
    <h2 className="section-title">{title}</h2>
    {hint ? <p className="meta mb-4">{hint}</p> : <div className="mb-4" />}
    {children}
  </Card>
);

/** Your own patterns: how often you record, how you felt, what keeps coming back. Visible to you only. */
const StatsPage: React.FC = () => {
  useDocumentTitle('Insights');
  const [params, setParams] = useSearchParams();
  const range = (RANGES.find((r) => r.value === params.get('range'))?.value ?? '365') as StatsRange;
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    api<PersonalStats>('/stats/me', { query: { range, tz }, signal: controller.signal })
      .then(setStats)
      .catch((err) => !controller.signal.aborted && setError(err instanceof Error ? err.message : 'Failed to load your insights'));
    return () => controller.abort();
  }, [range, tz, attempt]);

  if (error && !stats) {
    return (
      <EmptyState
        tone="error"
        icon={<CloudOff className="h-12 w-12" />}
        title="Could not load your insights"
        description={error}
        action={<Button onClick={() => setAttempt((a) => a + 1)}>Retry</Button>}
      />
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading your insights">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const { totals, streaks, range: scope } = stats;

  if (totals.dreams === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-12 w-12" />}
        title="Your insights will appear here"
        description="Record a few dreams and this page will show how often you dream, how you feel, and which themes keep coming back."
        action={<ButtonLink to="/capture">Record your first dream</ButtonLink>}
      />
    );
  }

  const rangeLabel = RANGES.find((r) => r.value === range)?.label.toLowerCase() ?? '';

  return (
    <Page>
      <PageHeader
        title="Insights"
        description="Patterns in your own dreams. Only you can see this page."
        actions={
          <div className="flex flex-wrap gap-2" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <Chip key={r.value} selected={range === r.value} onClick={() => setParams(r.value === '365' ? {} : { range: r.value }, { replace: true })}>
                {r.label}
              </Chip>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile icon={<BarChart3 className="h-4 w-4" aria-hidden />} label="Dreams" value={totals.dreams} hint={totals.drafts > 0 ? `+ ${totals.drafts} ${totals.drafts === 1 ? 'draft' : 'drafts'}` : 'all time'} />
        <Tile icon={<Flame className="h-4 w-4" aria-hidden />} label="Current streak" value={`${streaks.current} ${streaks.current === 1 ? 'day' : 'days'}`} hint="days in a row" />
        <Tile icon={<Trophy className="h-4 w-4" aria-hidden />} label="Longest streak" value={`${streaks.longest} ${streaks.longest === 1 ? 'day' : 'days'}`} />
        <Tile icon={<MessageSquare className="h-4 w-4" aria-hidden />} label="Words written" value={totals.words.toLocaleString()} hint={`about ${totals.averageWords} per dream`} />
        <Tile icon={<Heart className="h-4 w-4" aria-hidden />} label="Active days" value={totals.activeDays} hint={totals.firstDreamOn ? `since ${formatDay(totals.firstDreamOn)}` : undefined} />
      </div>

      {totals.dreams < 5 && (
        <p role="status" className="mb-6 rounded-lg bg-accent-soft p-3 text-sm text-accent-text">
          Insights appear once you have recorded at least 5 dreams ({5 - totals.dreams} to go). The charts below already work.
        </p>
      )}

      {stats.insights.length > 0 && (
        <Card as="section" aria-labelledby="insights-title" className="mb-6 bg-accent-soft/40">
          <h2 id="insights-title" className="section-title mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-accent-text" aria-hidden />
            What stands out
          </h2>
          <ul className="space-y-2">
            {stats.insights.map((i) => (
              <li key={i.id} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {i.text}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">These are patterns in what you recorded, for reflection. They are not an interpretation or medical advice.</p>
        </Card>
      )}

      <ChartCard title="Your year in dreams" hint="Each square is a day. The darker it is, the more dreams you recorded." className="mb-6">
        <CalendarHeatmap heatmap={stats.heatmap} />
      </ChartCard>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="How your dreams felt" hint={`${scope.dreams} ${scope.dreams === 1 ? 'dream' : 'dreams'} in the last ${rangeLabel === 'all time' ? 'while' : rangeLabel}`.replace('last all time', 'whole journal')}>
          <MoodBars moods={stats.moods} />
        </ChartCard>
        <ChartCard title={stats.timeline.unit === 'day' ? 'Day by day' : 'Month by month'} hint="Colours show the mood of each dream.">
          <Timeline timeline={stats.timeline} />
        </ChartCard>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Recurring themes" hint="Your most used tags.">
          <TopTags tags={stats.tags} />
        </ChartCard>
        <div className="space-y-6">
          <ChartCard title="Days you record" hint="Which weekday you tend to write your dreams down.">
            <Weekdays weekdays={stats.weekdays} />
          </ChartCard>
          <ChartCard title="Who sees them">
            <PrivacySplit privacy={stats.privacy} />
          </ChartCard>
        </div>
      </div>

      {(totals.likesReceived > 0 || totals.commentsReceived > 0) && (
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <Heart className="h-4 w-4" aria-hidden />
            {totals.likesReceived} {totals.likesReceived === 1 ? 'like' : 'likes'} received
          </span>
          <span className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" aria-hidden />
            {totals.commentsReceived} {totals.commentsReceived === 1 ? 'comment' : 'comments'} received
          </span>
        </p>
      )}
    </Page>
  );
};

export default StatsPage;
