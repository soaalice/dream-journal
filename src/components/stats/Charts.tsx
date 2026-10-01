import React from 'react';
import { MOODS, PRIVACY, PRIVACY_LIST } from '../../lib/moods';
import { shortMonth } from '../../lib/dates';
import { DreamMood, PrivacyLevel } from '../../types';
import { MoodStat, PersonalStats, TagStat } from '../../types/stats';

/** Bars use the mood's own colour (the same as the card stripe), and always print the numbers: colour is never the only cue. */
const moodBar = (mood: DreamMood) => MOODS[mood].stripe;

export const MoodBars: React.FC<{ moods: MoodStat[] }> = ({ moods }) => {
  const max = Math.max(1, ...moods.map((m) => m.count));
  return (
    <ul className="space-y-2.5">
      {moods.map(({ mood, count, percent }) => {
        const { Icon, label } = MOODS[mood];
        return (
          <li key={mood} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_5rem]">
            <span className="flex items-center gap-1.5">
              <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              {label}
            </span>
            <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span className={`block h-full rounded-full ${moodBar(mood)}`} style={{ width: `${(count / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums text-muted">
              {count} <span className="text-xs">({percent}%)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
};

/** Dreams per day or month, stacked by mood. A hidden table gives screen readers the same numbers. */
export const Timeline: React.FC<{ timeline: PersonalStats['timeline'] }> = ({ timeline }) => {
  const { points, unit } = timeline;
  const max = Math.max(1, ...points.map((p) => p.count));
  // fewer labels when there are many bars, so they never collide or push the page wider on a phone
  const labelEvery = unit === 'day' ? 5 : points.length > 14 ? 3 : points.length > 8 ? 2 : 1;

  const label = (period: string) => (unit === 'day' ? String(Number(period.slice(8))) : shortMonth(period));
  const title = (p: (typeof points)[number]) =>
    `${p.period}: ${p.count} ${p.count === 1 ? 'dream' : 'dreams'}` +
    (p.count ? ` (${Object.entries(p.moods).map(([m, n]) => `${m} ${n}`).join(', ')})` : '');

  return (
    <div>
      <div className="flex h-40 items-end gap-0.5 sm:gap-1" role="img" aria-label={`Dreams per ${unit}, most recent on the right`}>
        {points.map((p) => (
          <div key={p.period} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={title(p)}>
            {p.count === 0 ? (
              <span className="h-px w-full bg-line" aria-hidden />
            ) : (
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${(p.count / max) * 100}%` }} aria-hidden>
                {(Object.entries(p.moods) as Array<[DreamMood, number]>).map(([mood, n]) => (
                  <span key={mood} className={moodBar(mood)} style={{ height: `${(n / p.count) * 100}%` }} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 overflow-hidden text-xs text-muted sm:gap-1" aria-hidden>
        {points.map((p, i) => (
          <span key={p.period} className="min-w-0 flex-1 whitespace-nowrap text-center">
            {i % labelEvery === 0 || i === points.length - 1 ? label(p.period) : ''}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Dreams per {unit}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Dreams</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.period}>
              <th scope="row">{p.period}</th>
              <td>{p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const Weekdays: React.FC<{ weekdays: PersonalStats['weekdays'] }> = ({ weekdays }) => {
  const max = Math.max(1, ...weekdays.map((d) => d.count));
  return (
    <ul className="space-y-2">
      {weekdays.map((d) => (
        <li key={d.day} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3 text-sm">
          <span>{d.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(d.count / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-muted">{d.count}</span>
        </li>
      ))}
    </ul>
  );
};

export const TopTags: React.FC<{ tags: TagStat[] }> = ({ tags }) => {
  const max = Math.max(1, ...tags.map((t) => t.count));
  if (tags.length === 0) return <p className="text-muted">Add tags to your dreams to see your recurring themes.</p>;
  return (
    <ul className="space-y-3">
      {tags.map((t) => (
        <li key={t.tag} className="text-sm">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="font-medium">#{t.tag}</span>
            <span className="tabular-nums text-muted">
              {t.count} {t.count === 1 ? 'dream' : 'dreams'}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-accent" style={{ width: `${(t.count / max) * 100}%` }} />
          </div>
          {t.count >= 3 && (
            <p className="mt-1 text-xs text-muted">
              Mostly {MOODS[t.topMood].label.toLowerCase()} ({t.topMoodPercent}%)
            </p>
          )}
        </li>
      ))}
    </ul>
  );
};

const PRIVACY_BAR: Record<PrivacyLevel, string> = { public: 'bg-emerald-400', private: 'bg-slate-400', anonymous: 'bg-sky-400' };

export const PrivacySplit: React.FC<{ privacy: PersonalStats['privacy'] }> = ({ privacy }) => {
  const total = PRIVACY_LIST.reduce((n, p) => n + privacy[p], 0);
  if (total === 0) return null;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {PRIVACY_LIST.map((p) => (privacy[p] > 0 ? <span key={p} className={PRIVACY_BAR[p]} style={{ width: `${(privacy[p] / total) * 100}%` }} /> : null))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {PRIVACY_LIST.map((p) => (
          <li key={p} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${PRIVACY_BAR[p]}`} aria-hidden />
            {PRIVACY[p].label}: <strong className="tabular-nums">{privacy[p]}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
};
