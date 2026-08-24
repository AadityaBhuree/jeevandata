'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Sun,
  Sunrise,
  Sunset,
  Moon,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

export type MealType = 'breakfast' | 'lunch' | 'evening' | 'dinner';

export interface MealItem {
  id: string;
  type: MealType;
  title: string;
  calories: number;
  time: string;
  items: string[];
  clinicalNote?: string;
  completed?: boolean;
  tag?: string;
}

export interface MealPlanCardProps {
  meal: MealItem;
  onToggleComplete?: (id: string) => void;
  className?: string;
}

const mealTypeConfig: Record<
  MealType,
  { label: string; icon: React.ReactNode; colorClass: string; badgeBg: string }
> = {
  breakfast: {
    label: 'Breakfast',
    icon: <Sunrise className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
    colorClass: 'border-amber-200/70 bg-amber-50/40 dark:border-amber-900/30 dark:bg-amber-950/20',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  lunch: {
    label: 'Lunch',
    icon: <Sun className="h-4 w-4 text-sky-600 dark:text-sky-400" />,
    colorClass: 'border-sky-200/70 bg-sky-50/40 dark:border-sky-900/30 dark:bg-sky-950/20',
    badgeBg: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  },
  evening: {
    label: 'Evening Snack',
    icon: <Sunset className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
    colorClass:
      'border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/30 dark:bg-emerald-950/20',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  dinner: {
    label: 'Dinner',
    icon: <Moon className="h-4 w-4 text-violet-600 dark:text-violet-400" />,
    colorClass:
      'border-violet-200/70 bg-violet-50/40 dark:border-violet-900/30 dark:bg-violet-950/20',
    badgeBg: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
  },
};

export function MealPlanCard({ meal, onToggleComplete, className }: MealPlanCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = mealTypeConfig[meal.type] || mealTypeConfig.breakfast;

  return (
    <div
      className={cn(
        'shadow-xs group relative overflow-hidden rounded-2xl border bg-white/90 p-4 backdrop-blur-xl transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90',
        meal.completed
          ? 'border-slate-200 opacity-75 dark:border-slate-800'
          : 'border-slate-200/80',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left icon and meal title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleComplete?.(meal.id)}
            aria-label={
              meal.completed ? `Mark ${meal.title} incomplete` : `Mark ${meal.title} complete`
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white transition-all hover:scale-105 active:scale-95 dark:border-slate-700 dark:bg-slate-800"
          >
            {meal.completed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              config.icon
            )}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {config.label}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="h-3 w-3" /> {meal.time}
              </span>
            </div>
            <h4
              className={cn(
                'text-sm font-semibold text-slate-800 dark:text-slate-100',
                meal.completed && 'text-slate-400 line-through dark:text-slate-500',
              )}
            >
              {meal.title}
            </h4>
          </div>
        </div>

        {/* Right calories & expand toggle */}
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', config.badgeBg)}>
            {meal.calories} kcal
          </span>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-label="Toggle meal details"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expandable ingredients and clinical prescription */}
      {isExpanded && (
        <div className="animate-fade-in mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Recommended Items
            </span>
            <ul className="mt-1 space-y-1">
              {meal.items.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {meal.clinicalNote && (
            <div className="flex items-start gap-1.5 rounded-xl border border-sky-100 bg-sky-50/60 p-2 text-xs text-sky-800 dark:border-sky-950/40 dark:bg-sky-950/30 dark:text-sky-300">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
              <span>
                <strong>Clinical Note:</strong> {meal.clinicalNote}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
