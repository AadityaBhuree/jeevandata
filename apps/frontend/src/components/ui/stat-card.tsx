import * as React from 'react';
import { Card } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  icon?: React.ReactNode;
  accent?: string;
  delay?: number;
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon,
  accent = 'bg-jeevandata-500',
  delay = 0,
  className,
  style,
  ...props
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'animate-fade-in-up p-4 transition-all duration-200 hover:shadow-md sm:p-5',
        className,
      )}
      style={{ animationDelay: `${delay}ms`, ...style }}
      {...props}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {icon ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {icon}
          </div>
        ) : (
          <div className={cn('h-2 w-2 rounded-full', accent)} />
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          {value}
        </p>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trend.isPositive ? 'stat-trend-up' : 'stat-trend-down',
            )}
          >
            {trend.isPositive ? (
              <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            {trend.value}
          </span>
        )}
      </div>

      {(hint || trend?.label) && (
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
          {trend?.label ? trend.label : hint}
        </p>
      )}
    </Card>
  );
}
