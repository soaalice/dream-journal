import React, { useId, useState } from 'react';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';

export const controlClasses = (hasError: boolean) =>
  'w-full rounded-lg border bg-surface px-4 py-2.5 text-fg placeholder:text-muted/70 transition-colors ' +
  (hasError ? 'border-danger' : 'border-line hover:border-muted/60');

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  /** shows "n/max" under the control */
  counter?: { value: number; max: number };
  optional?: boolean;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}

/** Label + control + hint/error/counter, wired together for screen readers. */
export const Field: React.FC<FieldProps> = ({ label, error, hint, counter, optional, children }) => {
  const id = useId();
  const messageId = `${id}-msg`;
  const describedBy = error || hint ? messageId : undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      <div className="mt-1 flex justify-between gap-3 text-sm">
        <div id={messageId} role={error ? 'alert' : undefined}>
          {error ? (
            <p className="flex items-center text-danger-text">
              <AlertTriangle className="mr-1 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : (
            hint && <p className="text-muted">{hint}</p>
          )}
        </div>
        {counter && (
          <span className={`shrink-0 tabular-nums ${counter.value > counter.max ? 'text-danger-text' : 'text-muted'}`}>
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
    </div>
  );
};

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ invalid = false, className = '', ...rest }, ref) => (
  <input ref={ref} aria-invalid={invalid || undefined} className={`${controlClasses(invalid)} ${className}`} {...rest} />
));
Input.displayName = 'Input';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid = false, className = '', ...rest }, ref) => (
    <textarea ref={ref} aria-invalid={invalid || undefined} className={`${controlClasses(invalid)} ${className}`} {...rest} />
  )
);
Textarea.displayName = 'Textarea';

export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(({ invalid = false, ...rest }, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} invalid={invalid} className="pr-12" {...rest} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-fg"
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
