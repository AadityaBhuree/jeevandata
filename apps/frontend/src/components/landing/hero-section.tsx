'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/session-store';
import { intakeApi } from '@/services/api';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  Camera,
  Sparkles,
  Shield,
  Activity,
  ArrowRight,
  Clock,
  Globe2,
  Lock,
  UserCheck,
} from 'lucide-react';
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
    <section className="relative overflow-hidden pb-16 pt-12 sm:pt-20">
      {/* Background ambient lighting */}
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
      </div>

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 text-center">
        {/* HealthyMe-style Top Notification Pill */}
        <div className="animate-fade-in-down mb-6">
          <div className="shadow-xs inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/80 px-4 py-1.5 text-xs font-semibold text-teal-800 backdrop-blur-md dark:border-teal-800/60 dark:bg-teal-950/40 dark:text-teal-300">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-teal-500" />
            <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Next-Gen Healthcare AI · Zero Paperwork Check-in</span>
          </div>
        </div>

        {/* Headline */}
        <div className="animate-fade-in-up">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
            Your Health Journey,
            <br />
            <span className="gradient-text">Simpler &amp; Smarter with AI</span>
          </h1>
        </div>

        {/* Subtitle */}
        <p className="animate-fade-in-up mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
          Seamless face recognition check-in, conversational voice symptom triage in multiple
          languages, and instant doctor briefings — designed for effortless clinic visits.
        </p>

        {/* Elevated HealthyMe-style Kiosk Action Card */}
        <div className="animate-scale-in-center mt-10 w-full max-w-lg">
          <div className="glass-panel relative overflow-hidden rounded-3xl border border-slate-200/80 p-6 shadow-xl sm:p-8 dark:border-slate-800/80">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100/80 pb-4 dark:border-slate-800/80">
              <div className="flex items-center gap-2.5 text-left">
                <div className="bg-jeevandata-50 text-jeevandata-600 dark:bg-jeevandata-900/50 dark:text-jeevandata-400 flex h-9 w-9 items-center justify-center rounded-xl">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Patient Self-Service Kiosk
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Touchless biometric check-in &amp; AI intake
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Ready
              </span>
            </div>

            <Button
              variant="jeevandata"
              size="xl"
              onClick={handleStartIntake}
              disabled={isLoading}
              className="w-full text-base font-bold shadow-lg shadow-teal-500/25 transition-all duration-200 hover:shadow-teal-500/35 active:scale-[0.98]"
              rightIcon={<ArrowRight className="h-5 w-5" />}
            >
              <Camera className="mr-2 h-5 w-5" />
              {isLoading ? 'Starting...' : 'Start Intake Session'}
            </Button>

            {/* Quick trust metrics within card */}
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100/80 pt-4 text-center dark:border-slate-800/80">
              <div className="flex flex-col items-center">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <Clock className="text-jeevandata-500 h-3.5 w-3.5" />
                  ~2 mins
                </span>
                <span className="text-[10px] text-slate-400">Avg Intake</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <Globe2 className="h-3.5 w-3.5 text-emerald-500" />4 Languages
                </span>
                <span className="text-[10px] text-slate-400">Multilingual</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <Lock className="h-3.5 w-3.5 text-violet-500" />
                  Encrypted
                </span>
                <span className="text-[10px] text-slate-400">HIPAA Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Badges below Hero */}
        <div className="animate-fade-in mt-10 flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="shadow-2xs inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/60 px-3 py-1.5 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/60">
            <UserCheck className="h-4 w-4 text-emerald-500" />
            478-Point Face Mesh (No Images Saved)
          </span>
          <span className="shadow-2xs inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/60 px-3 py-1.5 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/60">
            <Activity className="text-jeevandata-500 h-4 w-4" />
            Instant Doctor SOAP Note Generation
          </span>
          <span className="shadow-2xs inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/60 px-3 py-1.5 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/60">
            <Shield className="h-4 w-4 text-teal-500" />
            Full Audit Trail &amp; Offline Cache
          </span>
        </div>
      </div>
    </section>
  );
}
