import React from 'react';
import { Link, LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 select-none';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-surface-2 text-fg hover:bg-line',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-danger text-white hover:bg-red-700'
};

// 44px tap targets on touch screens
const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 text-sm sm:min-h-9',
  md: 'min-h-11 px-4 text-sm sm:min-h-10',
  lg: 'min-h-12 px-6 text-base'
};

export const buttonClasses = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') =>
  `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading, disabled, className = '', children, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const ButtonLink: React.FC<ButtonLinkProps> = ({ variant, size, className = '', ...rest }) => (
  <Link className={buttonClasses(variant, size, className)} {...rest} />
);
