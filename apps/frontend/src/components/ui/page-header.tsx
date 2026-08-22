import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-2', className)} {...props}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500"
        >
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.label}>
                {idx > 0 && (
                  <ChevronRight className="h-3 w-3 flex-shrink-0 text-slate-300 dark:text-slate-600" />
                )}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="transition-colors hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={cn(isLast && 'font-medium text-slate-600 dark:text-slate-300')}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
