import React from 'react';
import { formatDate, formatDistanceToNow } from '../../utils/date';

/** Relative date with the exact date and time in a tooltip and in the machine-readable attribute. */
const RelativeTime: React.FC<{ date: string }> = ({ date }) => {
  const d = new Date(date);
  return (
    <time dateTime={d.toISOString()} title={`${formatDate(d)} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}>
      {formatDistanceToNow(d)}
    </time>
  );
};

export default RelativeTime;
