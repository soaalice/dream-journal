import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton ${className}`} aria-hidden />
);

/** Same shape as DreamCard (badges, title, a few lines, footer) so the page does not jump when data arrives. */
export const DreamCardSkeleton: React.FC = () => (
  <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 pl-6 shadow-card" aria-hidden>
    <Skeleton className="mb-3 h-5 w-24 rounded-full" />
    <Skeleton className="mb-3 h-6 w-3/4" />
    <Skeleton className="mb-2 h-3.5 w-full" />
    <Skeleton className="mb-2 h-3.5 w-full" />
    <Skeleton className="mb-4 h-3.5 w-1/2" />
    <Skeleton className="mb-4 h-5 w-32 rounded-full" />
    <div className="mt-auto flex items-center justify-between pt-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3.5 w-28" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  </div>
);

export const DreamGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6" role="status" aria-label="Loading dreams">
    {Array.from({ length: count }, (_, i) => (
      <DreamCardSkeleton key={i} />
    ))}
  </div>
);
