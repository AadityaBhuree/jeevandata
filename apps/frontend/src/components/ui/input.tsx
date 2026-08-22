import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  description?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, description, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        {description && (
          <p className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        )}
        <input
          id={inputId}
          type={type}
          className={cn(
            'bg-background flex h-10 w-full rounded-lg border px-3 py-2 text-sm transition-colors',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-input focus:border-jeevandata-500 focus:ring-jeevandata-200',
            className,
          )}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
