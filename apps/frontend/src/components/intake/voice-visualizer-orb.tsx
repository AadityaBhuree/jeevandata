'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Mic, Loader2, Volume2 } from 'lucide-react';

export type VoiceOrbState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface VoiceVisualizerOrbProps {
  state?: VoiceOrbState;
  audioLevel?: number; // 0 to 100
  onClick?: () => void;
  className?: string;
  subtext?: string;
}

export function VoiceVisualizerOrb({
  state = 'idle',
  audioLevel = 35,
  onClick,
  className,
  subtext,
}: VoiceVisualizerOrbProps) {
  const getOrbStateLabel = () => {
    switch (state) {
      case 'listening':
        return 'Listening to your symptoms...';
      case 'processing':
        return 'Analyzing clinical details with Gemini AI...';
      case 'speaking':
        return 'AI Assistant speaking...';
      default:
        return 'Tap microphone to speak';
    }
  };

  return (
    <div className={cn('flex flex-col items-center justify-center text-center', className)}>
      {/* Orb Center Container */}
      <div className="relative flex h-36 w-36 items-center justify-center sm:h-44 sm:w-44">
        {/* Ambient Glow Rings */}
        <div
          className={cn(
            'absolute inset-0 rounded-full transition-all duration-700',
            state === 'listening' && 'animate-ping bg-sky-400/20 opacity-75',
            state === 'processing' && 'animate-pulse bg-emerald-400/20 opacity-75',
            state === 'speaking' && 'animate-pulse bg-indigo-400/20 opacity-75',
            state === 'idle' && 'bg-sky-200/10',
          )}
        />

        {/* Outer Visualizer Wave Ring */}
        <div
          className={cn(
            'absolute inset-2 rounded-full border-2 border-dashed transition-all duration-500',
            state === 'listening'
              ? 'animate-spin-slow border-sky-400/60'
              : state === 'processing'
                ? 'animate-spin border-emerald-400/60'
                : 'border-slate-200/60 dark:border-slate-800',
          )}
        />

        {/* Main Gradient Orb */}
        <button
          type="button"
          onClick={onClick}
          aria-label={getOrbStateLabel()}
          className={cn(
            'relative z-10 flex h-24 w-24 cursor-pointer items-center justify-center rounded-full shadow-xl transition-all duration-300 active:scale-95 sm:h-28 sm:w-28',
            state === 'listening' &&
              'orb-glow scale-105 bg-gradient-to-tr from-sky-600 via-sky-500 to-emerald-400 text-white',
            state === 'processing' &&
              'orb-glow bg-gradient-to-tr from-emerald-600 via-teal-500 to-sky-400 text-white',
            state === 'speaking' &&
              'orb-glow bg-gradient-to-tr from-indigo-600 via-purple-500 to-sky-400 text-white',
            state === 'idle' &&
              'border border-sky-200/80 bg-white text-sky-600 shadow-md hover:scale-105 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-400',
          )}
        >
          {state === 'listening' && <Mic className="h-8 w-8 animate-pulse" />}
          {state === 'processing' && <Loader2 className="h-8 w-8 animate-spin" />}
          {state === 'speaking' && <Volume2 className="h-8 w-8 animate-bounce" />}
          {state === 'idle' && <Mic className="h-8 w-8" />}
        </button>
      </div>

      {/* Dynamic Waveform Bars (Active while listening) */}
      {state === 'listening' && (
        <div className="mt-3 flex h-6 items-center gap-1.5">
          {[40, 75, 100, 60, 90, 45, 80, 55, 30].map((height, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-sky-500 transition-all duration-150 dark:bg-sky-400"
              style={{
                height: `${Math.max(4, (height * (audioLevel || 40)) / 100)}px`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Status Copy */}
      <div className="mt-3">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{getOrbStateLabel()}</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {subtext || 'Speak naturally in English, Hindi, Marathi, or Spanish'}
        </p>
      </div>
    </div>
  );
}
