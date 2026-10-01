import React, { useEffect, useMemo, useRef } from 'react';
import { addDays, formatDay, mondayIndex, parseDay, shortMonth } from '../../lib/dates';
import { PersonalStats } from '../../types/stats';

const LEVELS = ['bg-surface-2', 'bg-accent/25', 'bg-accent/50', 'bg-accent/75', 'bg-accent'];

/** 0 = no dreams, 1-4 = more and more. Relative to the busiest day, so a quiet journal still shows shape. */
const levelOf = (count: number, max: number) => {
  if (count <= 0) return 0;
  if (max <= 1) return 4;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
};

interface Cell {
  date: string;
  count: number;
  inRange: boolean;
}

/**
 * One square per day for the last year, a column per week (Monday first), darker = more dreams that day.
 * The summary is read out as a whole; the squares themselves are for sighted pointer users (each has a tooltip).
 */
const CalendarHeatmap: React.FC<{ heatmap: PersonalStats['heatmap'] }> = ({ heatmap }) => {
  const scroller = useRef<HTMLDivElement>(null);

  const { weeks, max, total, activeDays } = useMemo(() => {
    const counts = new Map(heatmap.days.map((d) => [d.date, d.count]));
    const first = addDays(heatmap.from, -mondayIndex(heatmap.from)); // start on a Monday
    const cells: Cell[] = [];
    for (let day = first; day <= heatmap.to || cells.length % 7 !== 0; day = addDays(day, 1)) {
      cells.push({ date: day, count: counts.get(day) ?? 0, inRange: day >= heatmap.from && day <= heatmap.to });
    }
    const columns: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));
    return {
      weeks: columns,
      max: Math.max(0, ...heatmap.days.map((d) => d.count)),
      total: heatmap.days.reduce((n, d) => n + d.count, 0),
      activeDays: heatmap.days.length
    };
  }, [heatmap]);

  // Recent weeks matter most: start scrolled to the right on narrow screens.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [weeks.length]);

  return (
    <figure>
      <div ref={scroller} className="overflow-x-auto pb-2">
        <div
          role="img"
          aria-label={`Calendar of the last year: ${total} ${total === 1 ? 'dream' : 'dreams'} on ${activeDays} ${activeDays === 1 ? 'day' : 'days'}`}
          className="inline-block min-w-max"
        >
          {/* month labels */}
          <div className="mb-1 flex gap-1 pl-8 text-xs text-muted" aria-hidden>
            {weeks.map((week, i) => {
              const startsMonth = week.some((c) => c.inRange && c.date.endsWith('-01')) || i === 0;
              return (
                <span key={week[0].date} className="w-3.5 overflow-visible whitespace-nowrap">
                  {startsMonth ? shortMonth(week.find((c) => c.date.endsWith('-01'))?.date ?? week[0].date) : ''}
                </span>
              );
            })}
          </div>
          <div className="flex gap-1">
            <div className="grid w-7 grid-rows-7 gap-1 pr-1 text-right text-xs text-muted" aria-hidden>
              {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
                <span key={i} className="flex h-3.5 items-center justify-end leading-none">
                  {d}
                </span>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={week[0].date} className="grid grid-rows-7 gap-1" aria-hidden>
                {week.map((cell) => (
                  <span
                    key={cell.date}
                    title={cell.inRange ? `${cell.count === 0 ? 'No dreams' : `${cell.count} ${cell.count === 1 ? 'dream' : 'dreams'}`} · ${formatDay(cell.date)}` : undefined}
                    className={`h-3.5 w-3.5 rounded-[3px] ${cell.inRange ? LEVELS[levelOf(cell.count, max)] : 'bg-transparent'}`}
                    data-date={cell.date}
                    data-count={cell.count}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {parseDay(heatmap.from).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })} to{' '}
          {parseDay(heatmap.to).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })}
        </span>
        <span className="flex items-center gap-1" aria-hidden>
          Less
          {LEVELS.map((c) => (
            <span key={c} className={`h-3.5 w-3.5 rounded-[3px] ${c}`} />
          ))}
          More
        </span>
      </figcaption>
    </figure>
  );
};

export default CalendarHeatmap;
