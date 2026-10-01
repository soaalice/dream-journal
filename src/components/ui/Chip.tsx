import React from 'react';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

/** Toggle button used for filters and pickers. */
export const Chip: React.FC<ChipProps> = ({ selected, className = '', children, ...rest }) => (
  <button
    type="button"
    aria-pressed={selected}
    className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
      selected ? 'border-accent bg-accent-soft text-accent-text' : 'border-line bg-surface text-fg hover:bg-surface-2'
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);
