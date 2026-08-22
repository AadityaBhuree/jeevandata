import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center p-8 text-center sm:p-12', className)}
      {...props}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-900 sm:text-base dark:text-white">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
