'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Flame, Droplet, Dumbbell, Wheat, ShieldCheck } from 'lucide-react';

export interface NutritionMacro {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  colorClass: string;
  strokeColor: string;
  icon?: React.ReactNode;
}

export interface NutritionGaugeRingProps {
  currentCalories: number;
  targetCalories: number;
  carbs: NutritionMacro;
  protein: NutritionMacro;
  fat: NutritionMacro;
  waterLiters?: number;
  targetWaterLiters?: number;
  className?: string;
  subtitle?: string;
}

export function NutritionGaugeRing({
  currentCalories,
  targetCalories,
  carbs,
  protein,
  fat,
  waterLiters = 2.4,
  targetWaterLiters = 3.0,
  className,
  subtitle = 'Daily Intake Target',
}: NutritionGaugeRingProps) {
  const percentage = Math.min(100, Math.round((currentCalories / targetCalories) * 100));

  // Circular gauge calculation
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Macro progress helper
  const getMacroPercentage = (val: number, max: number) =>
    Math.min(100, Math.round((val / max) * 100));

  return (
    <div
      className={cn(
        'shadow-xs relative flex flex-col items-center justify-center rounded-3xl border border-sky-100/80 bg-white/90 p-6 backdrop-blur-xl transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90',
        className,
      )}
    >
      {/* Top Header */}
      <div className="mb-4 flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Nutrition & Energy
            </h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-50/70 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          <ShieldCheck className="h-3 w-3" />
          <span>Doctor Prescribed</span>
        </div>
      </div>

      {/* SVG Multi-Ring Gauge */}
      <div className="relative flex h-[180px] w-[180px] items-center justify-center">
        <svg
          className="h-full w-full -rotate-90 transform"
          viewBox={`0 0 ${size} ${size}`}
          aria-label={`Calorie intake: ${currentCalories} of ${targetCalories} kcal (${percentage}%)`}
        >
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-sky-100 dark:text-slate-800"
          />

          {/* Calorie Progress Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#calorieGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />

          {/* Gradients */}
          <defs>
            <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#16A34A" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center Calorie Display */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {currentCalories.toLocaleString()}
          </span>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            / {targetCalories.toLocaleString()} kcal
          </span>
          <span className="py-0.2 mt-0.5 rounded-md bg-sky-100/70 px-1.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
            {percentage}% Goal
          </span>
        </div>
      </div>

      {/* Macronutrient Bars Breakdown (Figma reference) */}
      <div className="mt-5 grid w-full grid-cols-3 gap-2.5 pt-2">
        {/* Carbs */}
        <div className="flex flex-col rounded-xl border border-amber-100/60 bg-amber-50/50 p-2.5 dark:border-amber-950/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            <span className="flex items-center gap-1">
              <Wheat className="h-3 w-3" /> Carbs
            </span>
            <span>{carbs.consumed}g</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-200/50 dark:bg-amber-900/40">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${getMacroPercentage(carbs.consumed, carbs.target)}%` }}
            />
          </div>
          <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            Goal: {carbs.target}g
          </span>
        </div>

        {/* Protein */}
        <div className="flex flex-col rounded-xl border border-sky-100/60 bg-sky-50/50 p-2.5 dark:border-sky-950/40 dark:bg-sky-950/20">
          <div className="flex items-center justify-between text-[11px] font-semibold text-sky-700 dark:text-sky-300">
            <span className="flex items-center gap-1">
              <Dumbbell className="h-3 w-3" /> Protein
            </span>
            <span>{protein.consumed}g</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-sky-200/50 dark:bg-sky-900/40">
            <div
              className="h-full rounded-full bg-sky-600 transition-all duration-500 dark:bg-sky-400"
              style={{ width: `${getMacroPercentage(protein.consumed, protein.target)}%` }}
            />
          </div>
          <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            Goal: {protein.target}g
          </span>
        </div>

        {/* Fat */}
        <div className="flex flex-col rounded-xl border border-violet-100/60 bg-violet-50/50 p-2.5 dark:border-violet-950/40 dark:bg-violet-950/20">
          <div className="flex items-center justify-between text-[11px] font-semibold text-violet-700 dark:text-violet-300">
            <span className="flex items-center gap-1">
              <Flame className="h-3 w-3" /> Fats
            </span>
            <span>{fat.consumed}g</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-violet-200/50 dark:bg-violet-900/40">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${getMacroPercentage(fat.consumed, fat.target)}%` }}
            />
          </div>
          <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            Goal: {fat.target}g
          </span>
        </div>
      </div>

      {/* Hydration Banner Strip */}
      <div className="mt-3 flex w-full items-center justify-between rounded-xl border border-sky-100 bg-sky-50/40 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
        <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
          <Droplet className="h-3.5 w-3.5 fill-current" />
          <span>Hydration Log</span>
        </div>
        <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
          <span>{waterLiters}L</span>
          <span className="text-[10px] font-normal text-slate-500">
            / {targetWaterLiters}L Target
          </span>
        </div>
      </div>
    </div>
  );
}
