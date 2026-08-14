'use client';
import { TitleSetter } from '@/components/ui/title-setter';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/hooks/useLanguage';
import { useSessionStore } from '@/stores/session-store';
import { intakeApi } from '@/services/api';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/ui/language-selector';
import {
  Camera,
  MessageSquareText,
  ClipboardList,
  Sparkles,
  Shield,
  Activity,
  ArrowRight,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const setSessionId = useSessionStore((s) => s.setSessionId);
  const [isLoading, setIsLoading] = useState(false);
  const { locale, setLocale } = useLanguage();

  async function handleStartIntake() {
    if (isLoading) {
      return; // prevent double-clicks creating duplicate sessions
    }
    setIsLoading(true);
    try {
      const session = await intakeApi.startSession({
        deviceId: `web-${crypto.randomUUID().slice(0, 8)}`,
      });
      setSessionId(session.id);
      router.push(`/intake/${session.id}`);
    } catch (err) {
      logger.error('Failed to start session', err);
      toast({
        title: 'Failed to start session',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="via-jeevandata-50 dark:via-jeevandata-950 relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <TitleSetter title="Welcome" />
      {/* ─── Top Bar: language + staff login ────────────────── */}
      <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 pt-4">
        <LanguageSelector currentLocale={locale} onLocaleChange={setLocale} compact />
        <Link
          href="/login"
          className="hover:border-jeevandata-300 hover:text-jeevandata-600 dark:hover:border-jeevandata-700 dark:hover:text-jeevandata-400 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur transition-colors dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
        >
          Staff login
        </Link>
      </div>
      {/* ─── Animated Background ──────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Gradient orbs */}
        <div className="animate-float bg-jeevandata-200/30 dark:bg-jeevandata-900/20 absolute -left-32 -top-32 h-96 w-96 rounded-full blur-3xl" />
        <div
          className="animate-float absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-200/20 blur-3xl dark:bg-emerald-900/20"
          style={{ animationDelay: '1.5s' }}
        />
        <div
          className="animate-float bg-jeevandata-300/20 dark:bg-jeevandata-800/20 absolute left-1/2 top-1/3 h-64 w-64 rounded-full blur-3xl"
          style={{ animationDelay: '3s' }}
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(12, 142, 230, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(12, 142, 230, 0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Decorative dots */}
        <div className="bg-jeevandata-300/40 dark:bg-jeevandata-500/30 animate-float absolute left-[15%] top-[20%] h-2 w-2 rounded-full" />
        <div
          className="absolute right-[25%] top-[15%] h-1.5 w-1.5 rounded-full bg-emerald-300/40 dark:bg-emerald-500/30"
          style={{ animationDelay: '0.5s' }}
        />
        <div
          className="bg-jeevandata-400/30 dark:bg-jeevandata-500/20 absolute bottom-[30%] left-[20%] h-2 w-2 rounded-full"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute bottom-[20%] right-[30%] h-1.5 w-1.5 rounded-full bg-emerald-400/30 dark:bg-emerald-500/20"
          style={{ animationDelay: '2s' }}
        />
      </div>

      {/* ─── Main Content ────────────────────────────────────── */}
      <main className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 py-20">
        {/* Brand Pill */}
        <div className="animate-fade-in-down mb-8">
          <span className="border-jeevandata-200 bg-jeevandata-50 text-jeevandata-700 dark:border-jeevandata-800 dark:bg-jeevandata-900/50 dark:text-jeevandata-300 inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Clinic Intake System
          </span>
        </div>

        {/* Hero Section */}
        <div className="animate-fade-in-up text-center">
          <div className="from-jeevandata-500 to-jeevandata-700 shadow-jeevandata-500/20 dark:shadow-jeevandata-500/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg">
            <Camera className="h-8 w-8 text-white" />
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
            Welcome to <span className="gradient-text">Jeevandata</span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
            The smart clinic intake system that uses{' '}
            <span className="text-jeevandata-600 dark:text-jeevandata-400 font-semibold">
              face recognition
            </span>{' '}
            to identify patients,{' '}
            <span className="text-jeevandata-600 dark:text-jeevandata-400 font-semibold">
              AI voice conversations
            </span>{' '}
            to collect symptoms, and generates a{' '}
            <span className="text-jeevandata-600 dark:text-jeevandata-400 font-semibold">
              clinical brief
            </span>{' '}
            before the doctor walks in.
          </p>
        </div>

        {/* CTA Section */}
        <div className="animate-scale-in-center mt-10">
          <div className="shadow-soft rounded-2xl border border-slate-200/60 bg-white/50 p-8 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/50">
            <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Start a new patient intake session. The system will guide you through face detection,
              identity verification, and AI-assisted symptom collection.
            </p>

            <Button
              variant="jeevandata"
              size="xl"
              onClick={handleStartIntake}
              disabled={isLoading}
              loading={isLoading}
              className="shadow-glow hover:shadow-glow-lg w-full"
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              <Camera className="mr-1.5 h-5 w-5" />
              Start New Intake Session
            </Button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: Camera,
              title: 'Face Recognition',
              desc: 'Instant patient identification using on-device face detection',
              accent: '#0c8ee6',
              bgColor: 'bg-jeevandata-50 dark:bg-jeevandata-900/30',
              iconColor: 'text-jeevandata-600 dark:text-jeevandata-400',
            },
            {
              icon: MessageSquareText,
              title: 'AI Voice Intake',
              desc: 'Natural symptom conversation powered by Gemini AI with live transcription',
              accent: '#10b981',
              bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
              iconColor: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              icon: ClipboardList,
              title: 'Clinical Brief',
              desc: 'AI-generated doctor summary with risk flags, vitals, and ICD-10 hints',
              accent: '#7c3aed',
              bgColor: 'bg-violet-50 dark:bg-violet-900/30',
              iconColor: 'text-violet-600 dark:text-violet-400',
            },
          ].map((feature, i) => (
            <div
              key={feature.title}
              className="shadow-soft animate-fade-in-up group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white/70 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700/50 dark:bg-slate-900/50"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              {/* Hover gradient accent */}
              <div
                className="absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background: `linear-gradient(to right, ${feature.accent}, ${feature.accent}88)`,
                }}
              />

              <div className="relative">
                <div
                  className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${feature.bgColor}`}
                >
                  <feature.icon className={`h-5 w-5 ${feature.iconColor}`} />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="animate-fade-in mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 dark:text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            No raw face images stored
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            HIPAA-compliant architecture
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Powered by Gemini AI
          </span>
        </div>
      </main>
    </div>
  );
}
