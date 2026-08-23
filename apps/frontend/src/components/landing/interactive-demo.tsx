'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Mic,
  FileCheck2,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Volume2,
  Stethoscope,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepData {
  id: 'face' | 'voice' | 'soap';
  label: string;
  badge: string;
  icon: typeof Camera;
}

const STEPS: StepData[] = [
  { id: 'face', label: '1. Biometric Match', badge: '< 1s Landmark Mesh', icon: Camera },
  { id: 'voice', label: '2. Voice Symptom AI', badge: 'Multilingual Triage', icon: Mic },
  { id: 'soap', label: '3. Clinical SOAP Brief', badge: 'Doctor Ready Note', icon: FileCheck2 },
];

export function InteractiveDemo() {
  const [activeStep, setActiveStep] = useState<'face' | 'voice' | 'soap'>('face');
  const [isSimulating, setIsSimulating] = useState(false);

  const simulateNext = () => {
    setIsSimulating(true);
    setTimeout(() => {
      if (activeStep === 'face') setActiveStep('voice');
      else if (activeStep === 'voice') setActiveStep('soap');
      else setActiveStep('face');
      setIsSimulating(false);
    }, 400);
  };

  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-float absolute right-1/4 top-1/2 h-80 w-80 rounded-full bg-sky-200/20 blur-3xl dark:bg-sky-900/20" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-sky-50/70 px-3.5 py-1 text-xs font-semibold text-sky-800 backdrop-blur-sm dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300">
            <Sparkles className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <span>Interactive Care Flow Simulator</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            See the 3-Step Clinical AI in Action
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Experience how a patient checks in touchlessly, speaks naturally in their language, and
            arms the physician with a structured diagnostic briefing.
          </p>
        </div>

        {/* Step Selector Pills */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-xs font-bold transition-all duration-200 sm:text-sm',
                  isActive
                    ? 'border-sky-500 bg-sky-500 text-white shadow-md shadow-sky-500/20 dark:border-sky-400 dark:bg-sky-500'
                    : 'border-slate-200/80 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    isActive ? 'text-white' : 'text-sky-600 dark:text-sky-400',
                  )}
                />
                <span>{step.label}</span>
                <span
                  className={cn(
                    'hidden rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:inline-block',
                    isActive
                      ? 'bg-sky-600/60 text-white'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                  )}
                >
                  {step.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Interactive Simulation Frame */}
        <Card className="glass-panel overflow-hidden rounded-3xl border-slate-200/80 p-6 shadow-2xl sm:p-8 dark:border-slate-800/80">
          {/* Phase 1: Biometric Face Match */}
          {activeStep === 'face' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Step 1: On-Device Facial Landmark Verification
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    478 3D mesh landmarks extracted in real-time. Zero raw images are ever stored or
                    uploaded.
                  </p>
                </div>
                <Badge variant="outline-success" size="sm" className="flex-shrink-0">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" /> 100% Client-Side
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {/* Simulated Camera View */}
                <div className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-2xl border border-sky-500/30 bg-slate-950 p-4 text-center">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-900/30 via-slate-950 to-slate-950" />

                  {/* Face Target Reticle */}
                  <div className="relative flex h-36 w-36 items-center justify-center rounded-2xl border-2 border-dashed border-sky-400 shadow-[0_0_30px_rgba(2,132,199,0.3)]">
                    <div className="absolute -top-2 left-2 rounded bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      CONFIDENCE 99.4%
                    </div>
                    <Camera className="h-10 w-10 text-sky-400/80" />
                    <div className="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-sky-400/60 shadow-[0_0_8px_#0284c7]" />
                  </div>

                  <div className="relative mt-4 flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-medium text-sky-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Matched: Priya Sharma (UHID #82914)</span>
                  </div>
                </div>

                {/* Match Details */}
                <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Verified Biometric Dossier
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5 dark:border-slate-800">
                        <span className="text-slate-500">Patient Name:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          Priya Sharma
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5 dark:border-slate-800">
                        <span className="text-slate-500">Age / Gender:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          34 yrs / Female
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5 dark:border-slate-800">
                        <span className="text-slate-500">Preferred Language:</span>
                        <span className="font-semibold text-sky-600 dark:text-sky-400">
                          Hindi (हिंदी)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">L2 Cosine Distance:</span>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          0.142 (Match &lt; 0.40)
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={simulateNext}
                    disabled={isSimulating}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-600/20 transition-all hover:bg-sky-700 active:scale-[0.98]"
                  >
                    <span>Proceed to Voice Intake Demo</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Phase 2: Conversational Voice AI */}
          {activeStep === 'voice' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Step 2: Multilingual Speech Symptom Triage
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Patient speaks naturally in Hindi/Marathi/English. Whisper transcribes and
                    clinical LLM extracts symptoms.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline-info" size="sm">
                    <Volume2 className="mr-1 h-3.5 w-3.5 text-sky-500" /> Live Audio Active
                  </Badge>
                </div>
              </div>

              {/* Simulated Conversation Turns */}
              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/50">
                {/* AI Turn */}
                <div className="flex max-w-[85%] gap-2.5">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                    AI
                  </div>
                  <div className="shadow-xs rounded-2xl rounded-tl-sm bg-white p-3 dark:bg-slate-800">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      नमस्ते प्रिया जी, आज आप कैसा महसूस कर रही हैं? आपको क्या परेशानी हो रही है?
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      (Translation: Hello Priya, how are you feeling today? What symptoms bring you
                      in?)
                    </p>
                  </div>
                </div>

                {/* Patient Turn */}
                <div className="ml-auto flex max-w-[85%] flex-row-reverse gap-2.5 self-end">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                    P
                  </div>
                  <div className="shadow-xs rounded-2xl rounded-tr-sm bg-sky-600 p-3 text-white">
                    <p className="text-xs font-medium">
                      मुझे पिछले 3 दिनों से तेज़ बुखार और सिरदर्द है। कल रात से हल्की सूखी खांसी भी
                      शुरू हो गई है।
                    </p>
                    <p className="mt-1 text-[10px] text-sky-100">
                      (Translation: High fever &amp; headache for 3 days, dry cough since last
                      night.)
                    </p>
                  </div>
                </div>

                {/* Audio Waveform visualization */}
                <div className="mt-4 flex items-center justify-center gap-1 py-2">
                  <div className="h-3 w-1 animate-pulse rounded-full bg-sky-500" />
                  <div
                    className="h-6 w-1 animate-pulse rounded-full bg-sky-600"
                    style={{ animationDelay: '0.1s' }}
                  />
                  <div
                    className="h-8 w-1 animate-pulse rounded-full bg-emerald-500"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <div
                    className="h-4 w-1 animate-pulse rounded-full bg-sky-400"
                    style={{ animationDelay: '0.3s' }}
                  />
                  <div
                    className="h-7 w-1 animate-pulse rounded-full bg-sky-600"
                    style={{ animationDelay: '0.4s' }}
                  />
                  <span className="ml-3 text-[11px] font-semibold text-slate-500">
                    Live Voice Transcription Active
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('face')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  &larr; Back to Biometrics
                </button>
                <button
                  type="button"
                  onClick={simulateNext}
                  disabled={isSimulating}
                  className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-600/20 transition-all hover:bg-sky-700 active:scale-[0.98]"
                >
                  <span>Generate Clinical SOAP Note</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Phase 3: SOAP Note Preview */}
          {activeStep === 'soap' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Step 3: Structured Clinical SOAP Note
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Instant AI synthesis ready for physician sign-off before entering the exam room.
                  </p>
                </div>
                <Badge variant="outline-success" size="sm">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-500" /> Triage Complete
                </Badge>
              </div>

              {/* SOAP Note Card */}
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-5 sm:grid-cols-2 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Chief Complaint
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      High fever (3 days), headache, dry cough
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Clinical Summary
                    </span>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      Patient reports acute onset febrile illness with frontal cephalalgia for 72
                      hours. Denies dyspnea or hemoptysis. Responsive to verbal stimuli.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Suggested ICD-10 Hints
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="shadow-2xs rounded bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        R50.9 (Fever, unspecified)
                      </span>
                      <span className="shadow-2xs rounded bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        R05.1 (Acute cough)
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Recommended Vitals to Check
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
                        Body Temp (°F)
                      </span>
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
                        SpO2 &amp; Heart Rate
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('voice')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  &larr; Back to Voice Intake
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('face')}
                  className="shadow-xs flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Restart Interactive Demo</span>
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
