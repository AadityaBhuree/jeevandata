'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/session-store';
import { intakeApi } from '@/services/api';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Camera, Sparkles, Shield, Activity, ArrowRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function HeroSection() {
  const router = useRouter();
  const setSessionId = useSessionStore((s) => s.setSessionId);
  const [isLoading, setIsLoading] = useState(false);

  async function handleStartIntake() {
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
        description: err instanceof Error ? err.message : 'Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden pb-16 pt-20 sm:pt-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-float bg-jeevandata-200/30 dark:bg-jeevandata-900/20 absolute -left-32 -top-32 h-96 w-96 rounded-full blur-3xl" />
        <div
          className="animate-float absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-200/20 blur-3xl dark:bg-emerald-900/20"
          style={{ animationDelay: '1.5s' }}
        />
        <div
          className="animate-float bg-jeevandata-300/20 dark:bg-jeevandata-800/20 absolute left-1/2 top-1/3 h-64 w-64 rounded-full blur-3xl"
          style={{ animationDelay: '3s' }}
        />
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 text-center">
        <div className="animate-fade-in-down mb-8">
          <span className="glass-card text-jeevandata-700 dark:text-jeevandata-300 inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Clinic Intake
          </span>
        </div>

        <div className="animate-fade-in-up">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
            Smarter Patient Intake,
            <br />
            <span className="text-gradient-primary">Powered by AI</span>
          </h1>
        </div>

        <p className="animate-fade-in-up mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
          Jeevandata uses face recognition to identify patients, an AI voice assistant to collect
          symptoms through natural conversation, and generates a clinical brief before the doctor
          walks in.
        </p>

        <div className="animate-scale-in-center mt-10 w-full max-w-md">
          <div className="glass-card relative overflow-hidden p-6 shadow-md transition-all duration-300 sm:p-8">
            <div className="mb-5 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Self-Service Kiosk
              </span>
              <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Step in front of the camera to begin
              </p>
            </div>
            <Button
              variant="jeevandata"
              size="xl"
              onClick={handleStartIntake}
              disabled={isLoading}
              className="shadow-glow hover:shadow-glow-lg w-full transition-all active:scale-[0.98]"
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              <Camera className="mr-1.5 h-5 w-5" />
              {isLoading ? 'Starting...' : 'Start Intake Session'}
            </Button>
            <p className="mt-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
              Estimated duration: 2–3 minutes · Multilingual support
            </p>
          </div>
        </div>

        <div className="animate-fade-in mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 dark:text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            No raw face images stored
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="text-jeevandata-500 h-3.5 w-3.5" />
            HIPAA-compliant
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            Powered by Gemini AI
          </span>
        </div>
      </div>
    </section>
  );
}
