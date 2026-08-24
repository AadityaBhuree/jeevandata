'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export type TriageUrgency = 'EMERGENCY' | 'PRIORITY' | 'ROUTINE' | 'COMPLETED' | 'IN_PROGRESS';

export interface ClinicalTriageBadgeProps {
  urgency: TriageUrgency | string;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  className?: string;
}

const triageStyles: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode; pulse: string }
> = {
  EMERGENCY: {
    label: 'Critical / Red Flag',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800/60',
    icon: <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />,
    pulse: 'bg-rose-500',
  },
  PRIORITY: {
    label: 'Priority Review',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/60',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />,
    pulse: 'bg-amber-500',
  },
  ROUTINE: {
    label: 'Routine',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800/60',
    icon: <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />,
    pulse: 'bg-sky-500',
  },
  COMPLETED: {
    label: 'Triaged & Ready',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
    pulse: 'bg-emerald-500',
  },
  IN_PROGRESS: {
    label: 'Intake In-Progress',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800/60',
    icon: <Clock className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />,
    pulse: 'bg-indigo-500',
  },
};

export function ClinicalTriageBadge({
  urgency,
  size = 'md',
  showPulse = true,
  className,
}: ClinicalTriageBadgeProps) {
  const normalizedKey = (urgency || 'ROUTINE').toUpperCase();
  const config = triageStyles[normalizedKey] || triageStyles.ROUTINE;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold tracking-wide transition-colors',
        config.bg,
        config.text,
        config.border,
        sizeClasses[size],
        className,
      )}
    >
      {showPulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              config.pulse,
            )}
          />
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', config.pulse)} />
        </span>
      )}
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}
