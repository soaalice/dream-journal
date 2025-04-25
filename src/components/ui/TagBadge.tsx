import React from 'react';

interface TagBadgeProps {
  tag: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const TagBadge: React.FC<TagBadgeProps> = ({ tag, size = 'md', onClick }) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };
  
  return (
    <span 
      className={`inline-block rounded-full bg-purple-100 text-purple-800 ${sizeClasses[size]} font-medium cursor-pointer hover:bg-purple-200 transition-colors`}
      onClick={onClick}
    >
      #{tag}
    </span>
  );
};

export default TagBadge;