import React from 'react';
import { AlertTriangle, Cloud, Frown, Globe, HelpCircle, Heart, Lock, Smile, Sparkles, UserX, Zap } from 'lucide-react';
import { DreamMood, PrivacyLevel } from '../types';

/**
 * Single source of truth for mood and privacy presentation.
 * Each mood owns one colour used on badges, card accents and filters, in light and dark mode.
 */
interface MoodConfig {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge: string;
  /** left accent stripe on dream cards */
  stripe: string;
}

export const MOODS: Record<DreamMood, MoodConfig> = {
  happy: { label: 'Happy', Icon: Smile, badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-200', stripe: 'bg-yellow-400' },
  sad: { label: 'Sad', Icon: Frown, badge: 'bg-blue-100 text-blue-800 dark:bg-blue-400/15 dark:text-blue-200', stripe: 'bg-blue-400' },
  scary: { label: 'Scary', Icon: AlertTriangle, badge: 'bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-200', stripe: 'bg-red-500' },
  confusing: { label: 'Confusing', Icon: HelpCircle, badge: 'bg-purple-100 text-purple-800 dark:bg-purple-400/15 dark:text-purple-200', stripe: 'bg-purple-400' },
  exciting: { label: 'Exciting', Icon: Zap, badge: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200', stripe: 'bg-amber-400' },
  peaceful: { label: 'Peaceful', Icon: Heart, badge: 'bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-200', stripe: 'bg-green-400' },
  anxious: { label: 'Anxious', Icon: Cloud, badge: 'bg-slate-200 text-slate-800 dark:bg-slate-400/15 dark:text-slate-200', stripe: 'bg-slate-400' },
  mysterious: { label: 'Mysterious', Icon: Sparkles, badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200', stripe: 'bg-indigo-400' }
};

export const MOOD_LIST = Object.keys(MOODS) as DreamMood[];

interface PrivacyConfig {
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge: string;
}

export const PRIVACY: Record<PrivacyLevel, PrivacyConfig> = {
  public: {
    label: 'Public',
    description: 'Anyone can read it and see your name.',
    Icon: Globe,
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200'
  },
  private: {
    label: 'Private',
    description: 'Only you can see it. Perfect for your personal journal.',
    Icon: Lock,
    badge: 'bg-slate-200 text-slate-800 dark:bg-slate-400/15 dark:text-slate-200'
  },
  anonymous: {
    label: 'Anonymous',
    description: 'Shared with everyone, but your name and avatar stay hidden.',
    Icon: UserX,
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200'
  }
};

export const PRIVACY_LIST = Object.keys(PRIVACY) as PrivacyLevel[];
