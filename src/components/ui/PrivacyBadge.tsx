import React from 'react';
import { PrivacyLevel } from '../../types';
import { PRIVACY } from '../../lib/moods';
import { badgeSizes } from './MoodBadge';

const PrivacyBadge: React.FC<{ privacy: PrivacyLevel; size?: keyof typeof badgeSizes }> = ({ privacy, size = 'md' }) => {
  const { Icon, label, badge } = PRIVACY[privacy];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${badge} ${badgeSizes[size]}`}>
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </span>
  );
};

export default PrivacyBadge;
