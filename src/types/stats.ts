import { DreamMood, PrivacyLevel } from './index';

export type StatsRange = '30' | '90' | '365' | 'all';

export interface MoodStat {
  mood: DreamMood;
  count: number;
  percent: number;
}

export interface TagStat {
  tag: string;
  count: number;
  /** the mood this tag most often goes with, and how often */
  topMood: DreamMood;
  topMoodPercent: number;
}

export interface TimelinePoint {
  /** "YYYY-MM-DD" for daily points, "YYYY-MM" for monthly ones */
  period: string;
  count: number;
  moods: Partial<Record<DreamMood, number>>;
}

export interface PersonalStats {
  tz: string;
  generatedAt: string;
  totals: {
    dreams: number;
    drafts: number;
    words: number;
    averageWords: number;
    activeDays: number;
    firstDreamOn: string | null;
    likesReceived: number;
    commentsReceived: number;
  };
  streaks: { current: number; longest: number };
  /** what the chosen range covers */
  range: { days: number | null; from: string | null; to: string; dreams: number; words: number };
  moods: MoodStat[];
  /** Monday first */
  weekdays: Array<{ day: number; label: string; count: number }>;
  tags: TagStat[];
  privacy: Record<PrivacyLevel, number>;
  timeline: { unit: 'day' | 'month'; points: TimelinePoint[] };
  /** the last 365 days; only days that have dreams are listed */
  heatmap: { from: string; to: string; days: Array<{ date: string; count: number }> };
  insights: Array<{ id: string; text: string }>;
}
