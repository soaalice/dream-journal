import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildInsights,
  buildStats,
  computeStreaks,
  daysBetween,
  isValidTimeZone,
  todayKeyIn
} from '../services/stats.js';

const TODAY = '2026-10-01';

/** A row as the aggregation produces it. `dow` follows MongoDB: 1 = Sunday ... 7 = Saturday. */
const row = (day, overrides = {}) => ({
  day,
  month: day.slice(0, 7),
  dow: new Date(`${day}T00:00:00Z`).getUTCDay() + 1,
  mood: 'peaceful',
  tags: [],
  privacyLevel: 'private',
  words: 10,
  likes: 0,
  comments: 0,
  ...overrides
});

const rows = (days, overrides) => days.map((d) => row(d, overrides));

// ---------- dates ----------

test('day arithmetic works across month and year boundaries', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29', 'leap year');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-09-30', '2026-10-02'), 2);
});

test('"today" is the calendar day in the user\'s own time zone', () => {
  const now = new Date('2026-10-01T23:30:00Z');
  assert.equal(todayKeyIn('UTC', now), '2026-10-01');
  assert.equal(todayKeyIn('Asia/Tokyo', now), '2026-10-02', 'already tomorrow in Tokyo');
  assert.equal(todayKeyIn('America/Los_Angeles', now), '2026-10-01');
});

test('time zones are validated', () => {
  assert.equal(isValidTimeZone('Europe/Paris'), true);
  assert.equal(isValidTimeZone('UTC'), true);
  assert.equal(isValidTimeZone('Mars/Olympus_Mons'), false);
  assert.equal(isValidTimeZone("'; drop table"), false);
});

// ---------- streaks ----------

test('streaks: no dreams, one dream today, and a dream yesterday keeps the streak alive', () => {
  assert.deepEqual(computeStreaks([], TODAY), { current: 0, longest: 0 });
  assert.deepEqual(computeStreaks([TODAY], TODAY), { current: 1, longest: 1 });
  assert.deepEqual(computeStreaks(['2026-09-30', '2026-09-29'], TODAY), { current: 2, longest: 2 });
});

test('streaks: a whole skipped day ends the current streak but not the record', () => {
  const days = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-28'];
  assert.deepEqual(computeStreaks(days, TODAY), { current: 0, longest: 4 });
});

test('streaks: duplicates, unsorted input and month boundaries', () => {
  const days = ['2026-10-01', '2026-09-30', '2026-09-30', '2026-09-29', '2026-09-01', '2026-08-31'];
  assert.deepEqual(computeStreaks(days, TODAY), { current: 3, longest: 3 });
  assert.deepEqual(computeStreaks(['2026-08-31', '2026-09-01'], '2026-09-01'), { current: 2, longest: 2 });
});

// ---------- the report ----------

test('totals count dreams, words, active days and engagement', () => {
  const data = [
    row('2026-09-28', { words: 120, likes: 2, comments: 1 }),
    row('2026-09-28', { words: 80 }),
    row('2026-10-01', { words: 100, likes: 1, comments: 2 })
  ];
  const { totals } = buildStats(data, { todayKey: TODAY, drafts: 3 });
  assert.deepEqual(totals, {
    dreams: 3,
    drafts: 3,
    words: 300,
    averageWords: 100,
    activeDays: 2,
    firstDreamOn: '2026-09-28',
    likesReceived: 3,
    commentsReceived: 3
  });
});

test('an empty journal gives a complete, zeroed report', () => {
  const s = buildStats([], { todayKey: TODAY });
  assert.equal(s.totals.dreams, 0);
  assert.equal(s.totals.firstDreamOn, null);
  assert.equal(s.moods.length, 8);
  assert.ok(s.moods.every((m) => m.count === 0 && m.percent === 0));
  assert.equal(s.weekdays.length, 7);
  assert.deepEqual(s.tags, []);
  assert.deepEqual(s.insights, []);
  assert.deepEqual(s.streaks, { current: 0, longest: 0 });
  assert.equal(s.heatmap.days.length, 0);
});

test('moods always list all eight, most common first, with percentages', () => {
  const data = [...rows(['2026-09-01', '2026-09-02', '2026-09-03'], { mood: 'scary' }), row('2026-09-04', { mood: 'happy' })];
  const { moods } = buildStats(data, { todayKey: TODAY });
  assert.equal(moods.length, 8);
  assert.deepEqual(moods[0], { mood: 'scary', count: 3, percent: 75 });
  assert.deepEqual(moods[1], { mood: 'happy', count: 1, percent: 25 });
  assert.equal(moods.at(-1).count, 0);
});

test('weekdays start on Monday and map MongoDB\'s Sunday-first numbers correctly', () => {
  // 2026-09-28 is a Monday, 2026-10-04 a Sunday
  const { weekdays } = buildStats([row('2026-09-28'), row('2026-09-28'), row('2026-10-04')], { todayKey: '2026-10-04' });
  assert.deepEqual(weekdays.map((d) => d.label), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  assert.equal(weekdays[0].count, 2, 'Monday');
  assert.equal(weekdays[6].count, 1, 'Sunday');
  assert.equal(weekdays.reduce((n, d) => n + d.count, 0), 3);
});

test('tags are ranked and show the mood they most often go with', () => {
  const data = [
    row('2026-09-01', { tags: ['water', 'night'], mood: 'scary' }),
    row('2026-09-02', { tags: ['water'], mood: 'scary' }),
    row('2026-09-03', { tags: ['water'], mood: 'happy' }),
    row('2026-09-04', { tags: ['night'], mood: 'happy' })
  ];
  const { tags } = buildStats(data, { todayKey: TODAY });
  assert.deepEqual(tags[0], { tag: 'water', count: 3, topMood: 'scary', topMoodPercent: 67 });
  assert.equal(tags[1].tag, 'night');
  const many = buildStats(Array.from({ length: 15 }, (_, i) => row('2026-09-01', { tags: [`t${String(i).padStart(2, '0')}`] })), { todayKey: TODAY });
  assert.equal(many.tags.length, 10, 'only the top ten');
});

test('the range limits the charts but not the all-time totals or streaks', () => {
  const data = [row('2026-10-01'), row('2026-09-30'), row('2026-06-01', { mood: 'sad' }), row('2025-01-01', { mood: 'sad' })];
  const s30 = buildStats(data, { todayKey: TODAY, rangeDays: 30 });
  assert.equal(s30.range.dreams, 2);
  assert.equal(s30.totals.dreams, 4, 'all-time total');
  assert.equal(s30.moods.find((m) => m.mood === 'sad').count, 0);
  assert.equal(s30.streaks.current, 2);

  const all = buildStats(data, { todayKey: TODAY, rangeDays: null });
  assert.equal(all.range.dreams, 4);
  assert.equal(all.range.from, null);
  assert.equal(all.moods.find((m) => m.mood === 'sad').count, 2);
});

test('timeline: one bar per day for 30 days, one per month otherwise, with empty periods kept', () => {
  const data = [row('2026-10-01', { mood: 'happy' }), row('2026-10-01', { mood: 'sad' }), row('2026-08-15')];
  const daily = buildStats(data, { todayKey: TODAY, rangeDays: 30 }).timeline;
  assert.equal(daily.unit, 'day');
  assert.equal(daily.points.length, 30);
  assert.deepEqual(daily.points.at(-1), { period: '2026-10-01', count: 2, moods: { happy: 1, sad: 1 } });
  assert.equal(daily.points[0].count, 0);

  const monthly = buildStats(data, { todayKey: TODAY, rangeDays: 90 }).timeline;
  assert.equal(monthly.unit, 'month');
  assert.deepEqual(monthly.points.map((p) => p.period), ['2026-07', '2026-08', '2026-09', '2026-10']);
  assert.deepEqual(monthly.points.map((p) => p.count), [0, 1, 0, 2], 'September is kept as an empty month');
});

test('the heatmap covers exactly the last 365 days and lists only days with dreams', () => {
  const data = [row('2026-10-01'), row('2026-10-01'), row('2025-10-02'), row('2025-10-01')];
  const { heatmap } = buildStats(data, { todayKey: TODAY, rangeDays: 30 });
  assert.equal(heatmap.from, '2025-10-02');
  assert.equal(heatmap.to, TODAY);
  assert.deepEqual(heatmap.days, [
    { date: '2025-10-02', count: 1 },
    { date: '2026-10-01', count: 2 }
  ]);
});

test('privacy split counts public, private and anonymous', () => {
  const data = [row('2026-09-01', { privacyLevel: 'public' }), row('2026-09-02', { privacyLevel: 'anonymous' }), row('2026-09-03')];
  assert.deepEqual(buildStats(data, { todayKey: TODAY }).privacy, { public: 1, private: 1, anonymous: 1 });
});

// ---------- insights ----------

test('insights stay silent until there is enough data', () => {
  assert.deepEqual(buildStats(rows(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']), { todayKey: TODAY }).insights, []);
  const five = buildStats(rows(['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-07', '2026-09-09']), { todayKey: TODAY });
  assert.ok(five.insights.some((i) => i.id === 'top-mood'));
});

test('insight: most common weekday, only when it clearly stands out', () => {
  // 2026-09-28 and 2026-10-05 are Mondays
  const mondays = rows(['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-09-23', '2026-09-25', '2026-09-26']);
  const s = buildStats(mondays, { todayKey: '2026-10-05' });
  assert.ok(s.insights.some((i) => i.id === 'top-weekday' && /Mondays \(57%\)/.test(i.text)), JSON.stringify(s.insights));
  const spread = buildStats(rows(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']), { todayKey: '2026-09-27' });
  assert.equal(spread.insights.some((i) => i.id === 'top-weekday'), false);
});

test('insight: a recurring theme, and a tag that points at one mood', () => {
  const data = [
    ...rows(['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-07'], { tags: ['water'], mood: 'scary' }),
    ...rows(['2026-09-09', '2026-09-11', '2026-09-13', '2026-09-15', '2026-09-17', '2026-09-19'], { tags: ['home'], mood: 'happy' })
  ];
  const { insights } = buildStats(data, { todayKey: TODAY });
  assert.ok(insights.some((i) => i.id === 'top-tag' && i.text.includes('#home')));
  assert.ok(insights.some((i) => i.id === 'tag-mood-water' && /mostly scary \(100%\)/.test(i.text)), JSON.stringify(insights));
  assert.equal(insights.some((i) => i.id === 'tag-mood-home'), false, 'home goes with the mood that is common overall');
});

test('insight: a mood that doubled against the previous 30 days', () => {
  const recent = rows(['2026-09-20', '2026-09-22', '2026-09-24', '2026-09-26'], { mood: 'anxious' });
  const before = rows(['2026-08-25'], { mood: 'anxious' });
  const filler = rows(['2026-09-02'], { mood: 'happy' });
  const { insights } = buildStats([...recent, ...before, ...filler], { todayKey: TODAY });
  assert.ok(insights.some((i) => i.id === 'shift-anxious' && /\(4\).*\(1\)/.test(i.text)), JSON.stringify(insights));
});

test('insight: streaks are celebrated only when meaningful', () => {
  const base = { total: 10, moods: [{ mood: 'happy', count: 1, percent: 10 }], weekdays: Array.from({ length: 7 }, (_, d) => ({ day: d, label: 'x', count: 1 })), tags: [], recentMoods: {}, previousMoods: {} };
  assert.ok(buildInsights({ ...base, streaks: { current: 4, longest: 4 } }).some((i) => i.id === 'streak'));
  assert.ok(buildInsights({ ...base, streaks: { current: 1, longest: 6 } }).some((i) => i.id === 'longest-streak'));
  assert.equal(buildInsights({ ...base, streaks: { current: 2, longest: 3 } }).some((i) => /streak/.test(i.id)), false);
});
