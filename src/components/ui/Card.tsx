import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'article' | 'section';
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({ as: Tag = 'div', padded = true, className = '', ...rest }) => (
  <Tag className={`rounded-2xl border border-line bg-surface shadow-card ${padded ? 'p-5 sm:p-6' : ''} ${className}`} {...rest} />
);
