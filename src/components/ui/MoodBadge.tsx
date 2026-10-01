import React from 'react';
import { DreamMood } from '../../types';
import { MOODS } from '../../lib/moods';

export const badgeSizes = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5'
};

const MoodBadge: React.FC<{ mood: DreamMood; size?: keyof typeof badgeSizes }> = ({ mood, size = 'md' }) => {
  const { Icon, label, badge } = MOODS[mood];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${badge} ${badgeSizes[size]}`}>
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </span>
  );
};

export default MoodBadge;
