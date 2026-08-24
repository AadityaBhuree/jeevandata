'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  gradient?: boolean;
  className?: string;
}

export function BentoCard({
  title,
  subtitle,
  icon,
  badge,
  children,
  gradient = false,
  className,
  ...props
}: BentoCardProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col justify-between overflow-hidden rounded-3xl p-5 backdrop-blur-xl transition-all duration-200 sm:p-6',
        gradient
          ? 'bento-card-gradient border border-sky-200/60 shadow-sm hover:-translate-y-0.5 hover:shadow-lg'
          : 'bento-card',
        className,
      )}
      {...props}
    >
      {(title || icon || badge) && (
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-sm font-bold text-slate-900 sm:text-base dark:text-white">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {badge && <div>{badge}</div>}
        </div>
      )}

      <div className="flex-1">{children}</div>
    </div>
  );
}
