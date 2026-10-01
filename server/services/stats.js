/**
 * Personal dream statistics. Everything here is a pure function of rows describing the signed-in user's own dreams, so it is
 * easy to test; the route (routes/stats.js) only fetches the rows. Days are calendar days in the user's time zone.
 */
import { MOODS } from '../utils/validation.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MOOD_LABEL = (mood) => mood.charAt(0).toUpperCase() + mood.slice(1);
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// ---------- day keys ("YYYY-MM-DD") ----------

const toDate = (key) => new Date(`${key}T00:00:00Z`);
const toKey = (date) => date.toISOString().slice(0, 10);
export const addDays = (key, n) => toKey(new Date(toDate(key).getTime() + n * DAY_MS));
export const daysBetween = (a, b) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);

/** Today's date as "YYYY-MM-DD" in a time zone. */
export const todayKeyIn = (timeZone, now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
};

export const isValidTimeZone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** The months ("YYYY-MM") from `from` to `to`, inclusive. */
const monthsBetween = (from, to) => {
  const out = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
};

// ---------- streaks ----------

/**
 * Consecutive days with at least one dream. The current streak is still alive if the last dream was yesterday
 * (today is not over yet), and is 0 once a whole day was skipped.
 */
export const computeStreaks = (dayKeys, todayKey) => {
  const days = [...new Set(dayKeys)].sort();
  if (days.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const last = days[days.length - 1];
  const gap = daysBetween(last, todayKey);
  if (gap > 1) return { current: 0, longest };

  let current = 1;
  for (let i = days.length - 1; i > 0 && daysBetween(days[i - 1], days[i]) === 1; i -= 1) current += 1;
  return { current, longest };
};

// ---------- insights ----------

const MIN_DREAMS = 5;

/**
 * A few plain-language observations. Each rule needs enough data to mean something, so a new journal gets none rather
 * than noise. These describe patterns in what the person recorded; they are not interpretations.
 */
export const buildInsights = ({ total, moods, weekdays, tags, streaks, recentMoods, previousMoods }) => {
  const insights = [];
  if (total < MIN_DREAMS) return insights;

  const [topMood] = moods;
  if (topMood && topMood.count >= 3) {
    insights.push({ id: 'top-mood', text: `${MOOD_LABEL(topMood.mood)} is your most common mood, in ${topMood.percent}% of your dreams.` });
  }

  const topDay = weekdays.reduce((best, d) => (d.count > best.count ? d : best), weekdays[0]);
  if (total >= 7 && topDay.count / total >= 0.25) {
    insights.push({ id: 'top-weekday', text: `You record most of your dreams on ${topDay.label}s (${pct(topDay.count, total)}%).` });
  }

  const [topTag] = tags;
  if (topTag && topTag.count >= 3) {
    insights.push({ id: 'top-tag', text: `#${topTag.tag} is your most recurring theme: it appears in ${topTag.count} dreams.` });
  }

  // A tag that points at one mood, when that mood is not simply the most common one overall.
  for (const tag of tags) {
    const overall = moods.find((m) => m.mood === tag.topMood);
    if (tag.count >= 4 && tag.topMoodPercent >= 70 && overall && overall.percent <= 40) {
      insights.push({
        id: `tag-mood-${tag.tag}`,
        text: `Dreams tagged #${tag.tag} are mostly ${tag.topMood} (${tag.topMoodPercent}%), more than your dreams in general (${overall.percent}%).`
      });
      break;
    }
  }

  // This month against the previous one.
  for (const mood of Object.keys(recentMoods)) {
    const now = recentMoods[mood];
    const before = previousMoods[mood] ?? 0;
    if (now >= 3 && before >= 1 && now >= before * 2) {
      insights.push({ id: `shift-${mood}`, text: `You had more ${mood} dreams in the last 30 days (${now}) than in the 30 days before (${before}).` });
      break;
    }
  }

  if (streaks.current >= 3) {
    insights.push({ id: 'streak', text: `You are on a ${streaks.current}-day streak. Keep it going!` });
  } else if (streaks.longest >= 5) {
    insights.push({ id: 'longest-streak', text: `Your longest streak is ${streaks.longest} days in a row.` });
  }

  return insights;
};

// ---------- the whole report ----------

/**
 * @param rows  one per published dream: { day, month, dow (1=Sunday..7=Saturday, as in MongoDB), mood, tags, privacyLevel,
 *              words, likes, comments }
 * @param options { todayKey, rangeDays (number | null for all time), drafts }
 */
export const buildStats = (rows, { todayKey, rangeDays = 365, drafts = 0 } = {}) => {
  const rangeStart = rangeDays ? addDays(todayKey, -(rangeDays - 1)) : null;
  const inRange = rangeStart ? rows.filter((r) => r.day >= rangeStart) : rows;

  const streaks = computeStreaks(rows.map((r) => r.day), todayKey);
  const sum = (list, key) => list.reduce((n, r) => n + (r[key] ?? 0), 0);

  // moods (all of them, so the chart is stable)
  const moodCounts = Object.fromEntries(MOODS.map((m) => [m, 0]));
  inRange.forEach((r) => {
    if (r.mood in moodCounts) moodCounts[r.mood] += 1;
  });
  const moods = MOODS.map((mood) => ({ mood, count: moodCounts[mood], percent: pct(moodCounts[mood], inRange.length) })).sort(
    (a, b) => b.count - a.count || MOODS.indexOf(a.mood) - MOODS.indexOf(b.mood)
  );

  // weekdays, Monday first
  const weekdayCounts = Array(7).fill(0);
  inRange.forEach((r) => {
    weekdayCounts[(r.dow + 5) % 7] += 1;
  });
  const weekdays = weekdayCounts.map((count, day) => ({ day, label: WEEKDAYS[day], count }));

  // tags, with the mood they most often go with
  const tagStats = new Map();
  inRange.forEach((r) => {
    for (const tag of r.tags ?? []) {
      const entry = tagStats.get(tag) ?? { tag, count: 0, moods: {} };
      entry.count += 1;
      entry.moods[r.mood] = (entry.moods[r.mood] ?? 0) + 1;
      tagStats.set(tag, entry);
    }
  });
  const tags = [...tagStats.values()]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 10)
    .map((t) => {
      const [topMood, topCount] = Object.entries(t.moods).sort((a, b) => b[1] - a[1] || MOODS.indexOf(a[0]) - MOODS.indexOf(b[0]))[0];
      return { tag: t.tag, count: t.count, topMood, topMoodPercent: pct(topCount, t.count) };
    });

  // privacy split
  const privacy = { public: 0, private: 0, anonymous: 0 };
  inRange.forEach((r) => {
    if (r.privacyLevel in privacy) privacy[r.privacyLevel] += 1;
  });

  // timeline: one bar per day for 30 days, one per month otherwise (stacked by mood)
  const daily = rangeDays !== null && rangeDays <= 31;
  let periods;
  if (daily) {
    periods = Array.from({ length: rangeDays }, (_, i) => addDays(rangeStart, i));
  } else {
    const firstMonth = rangeStart ? rangeStart.slice(0, 7) : (rows.map((r) => r.month).sort()[0] ?? todayKey.slice(0, 7));
    const lastMonth = todayKey.slice(0, 7);
    periods = monthsBetween(firstMonth, lastMonth).slice(-36);
  }
  const buckets = new Map(periods.map((p) => [p, { period: p, count: 0, moods: {} }]));
  inRange.forEach((r) => {
    const bucket = buckets.get(daily ? r.day : r.month);
    if (!bucket) return;
    bucket.count += 1;
    bucket.moods[r.mood] = (bucket.moods[r.mood] ?? 0) + 1;
  });
  const timeline = { unit: daily ? 'day' : 'month', points: [...buckets.values()] };

  // calendar heatmap: the last 365 days, only days that have dreams
  const heatStart = addDays(todayKey, -364);
  const heat = new Map();
  rows.filter((r) => r.day >= heatStart).forEach((r) => heat.set(r.day, (heat.get(r.day) ?? 0) + 1));
  const heatmap = { from: heatStart, to: todayKey, days: [...heat.entries()].sort().map(([date, count]) => ({ date, count })) };

  // mood shift: last 30 days against the 30 before (independent of the chosen range)
  const recentStart = addDays(todayKey, -29);
  const previousStart = addDays(todayKey, -59);
  const recentMoods = {};
  const previousMoods = {};
  rows.forEach((r) => {
    if (r.day >= recentStart) recentMoods[r.mood] = (recentMoods[r.mood] ?? 0) + 1;
    else if (r.day >= previousStart) previousMoods[r.mood] = (previousMoods[r.mood] ?? 0) + 1;
  });

  const words = sum(rows, 'words');
  return {
    totals: {
      dreams: rows.length,
      drafts,
      words,
      averageWords: rows.length ? Math.round(words / rows.length) : 0,
      activeDays: new Set(rows.map((r) => r.day)).size,
      firstDreamOn: rows.length ? rows.map((r) => r.day).sort()[0] : null,
      likesReceived: sum(rows, 'likes'),
      commentsReceived: sum(rows, 'comments')
    },
    streaks,
    range: { days: rangeDays, from: rangeStart, to: todayKey, dreams: inRange.length, words: sum(inRange, 'words') },
    moods,
    weekdays,
    tags,
    privacy,
    timeline,
    heatmap,
    insights: buildInsights({ total: inRange.length, moods, weekdays, tags, streaks, recentMoods, previousMoods })
  };
};
