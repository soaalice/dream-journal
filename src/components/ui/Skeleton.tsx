import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton ${className}`} aria-hidden />
);

/** Same footprint as DreamCard so the page does not jump when data arrives. */
export const DreamCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-line bg-surface p-5 shadow-card" aria-hidden>
    <div className="mb-4 flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
    <Skeleton className="mb-2 h-3 w-full" />
    <Skeleton className="mb-2 h-3 w-full" />
    <Skeleton className="mb-5 h-3 w-1/2" />
    <Skeleton className="h-6 w-24 rounded-full" />
  </div>
);

export const DreamGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2" role="status" aria-label="Loading dreams">
    {Array.from({ length: count }, (_, i) => (
      <DreamCardSkeleton key={i} />
    ))}
  </div>
);
