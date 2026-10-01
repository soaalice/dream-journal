import React from 'react';

/**
 * Layout primitives. Every screen is `<Page>` with a `<PageHeader>`, so widths, spacing and the title hierarchy are decided
 * in one place instead of on each page.
 *
 *   narrow   forms and settings        reading   one dream, long text
 *   wide     lists and dashboards      full     the whole content column
 */
const WIDTH = {
  narrow: 'max-w-2xl',
  reading: 'max-w-3xl',
  wide: 'max-w-5xl',
  full: ''
} as const;

export const Page: React.FC<{ width?: keyof typeof WIDTH; className?: string; children: React.ReactNode }> = ({
  width = 'full',
  className = '',
  children
}) => <div className={`mx-auto w-full animate-fade-in ${WIDTH[width]} ${className}`}>{children}</div>;

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** small label above the title */
  eyebrow?: React.ReactNode;
  /** buttons or filters aligned to the right (below the title on small screens) */
  actions?: React.ReactNode;
  /** icon shown in a tinted tile before the title */
  icon?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, eyebrow, actions, icon, className = '' }) => (
  <header className={`mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mb-8 ${className}`}>
    <div className="flex min-w-0 items-center gap-4">
      {icon && <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-text sm:flex">{icon}</span>}
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-1.5 max-w-prose text-muted">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

/** A titled block inside a page: heading, optional hint, content. */
export const Section: React.FC<{ title: React.ReactNode; hint?: React.ReactNode; action?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  title,
  hint,
  action,
  className = '',
  children
}) => (
  <section className={className}>
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="section-title">{title}</h2>
        {hint && <p className="meta mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);
