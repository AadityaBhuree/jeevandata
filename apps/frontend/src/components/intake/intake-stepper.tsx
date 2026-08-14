'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepperStep {
  id: string;
  label: string;
}

interface IntakeStepperProps {
  steps: StepperStep[];
  /** Index of the current (active) step */
  currentIndex: number;
  className?: string;
}

/**
 * Kiosk progress indicator — shows the patient where they are in the flow:
 * Camera -> Identify -> Intake -> Brief. Completed steps get a checkmark.
 */
export function IntakeStepper({ steps, currentIndex, className }: IntakeStepperProps) {
  return (
    <nav aria-label="Intake progress" className={cn('w-full', className)}>
      <ol className="flex w-full items-center gap-1.5">
        {steps.map((step, i) => {
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <li key={step.id} className="flex flex-1 items-center gap-1.5">
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                  isCurrent
                    ? 'bg-jeevandata-500 text-white shadow-sm'
                    : isDone
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
                    isCurrent
                      ? 'bg-white/20 text-white'
                      : isDone
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className={cn('hidden sm:inline', isCurrent && 'font-semibold')}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    isDone ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
