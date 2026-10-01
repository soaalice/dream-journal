import React from 'react';
import { Link } from 'react-router-dom';

interface TagBadgeProps {
  tag: string;
  size?: 'sm' | 'md';
  /** when true the tag links to the Explore page filtered by it */
  link?: boolean;
}

const classes = (size: 'sm' | 'md') =>
  `inline-block rounded-full bg-accent-soft font-medium text-accent-text transition hover:brightness-95 ${
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
  }`;

const TagBadge: React.FC<TagBadgeProps> = ({ tag, size = 'md', link = true }) =>
  link ? (
    <Link to={`/explore?tag=${encodeURIComponent(tag)}`} className={`${classes(size)} relative z-10`}>
      #{tag}
    </Link>
  ) : (
    <span className={classes(size)}>#{tag}</span>
  );

export default TagBadge;
