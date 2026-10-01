import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** use for failures so assistive tech announces them */
  tone?: 'neutral' | 'error';
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, tone = 'neutral' }) => (
  <div
    role={tone === 'error' ? 'alert' : undefined}
    className="flex flex-col items-center rounded-xl border border-dashed border-line bg-surface/60 px-6 py-14 text-center"
  >
    <div className={`mb-4 ${tone === 'error' ? 'text-danger-text' : 'text-muted'}`}>{icon}</div>
    <h3 className="mb-1 text-lg font-semibold">{title}</h3>
    {description && <p className="mb-5 max-w-sm text-muted">{description}</p>}
    {action}
  </div>
);
