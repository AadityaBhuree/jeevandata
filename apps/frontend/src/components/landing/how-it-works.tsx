import { Camera, MessageSquareText, ClipboardList, ArrowRight, Clock } from 'lucide-react';

const steps = [
  {
    num: '01',
    icon: Camera,
    duration: '< 10s',
    title: '1. Touchless Check-In',
    desc: 'Patient arrives at the kiosk. On-device face landmark detection instantly verifies returning patients with zero image retention.',
  },
  {
    num: '02',
    icon: MessageSquareText,
    duration: '~2 mins',
    title: '2. Conversational Voice AI',
    desc: 'An AI assistant collects symptoms, duration, severity, and medical history through comfortable, natural speech in their native language.',
  },
  {
    num: '03',
    icon: ClipboardList,
    duration: 'Instant',
    title: '3. Clinical SOAP Brief',
    desc: 'The doctor receives a structured clinical summary with triage risk flags, vitals to check, and ICD-10 diagnostic suggestions before entering.',
  },
];

export function HowItWorks() {
  return (
    <section className="relative border-y border-slate-200/50 bg-slate-50/50 py-16 sm:py-24 dark:border-slate-800/50 dark:bg-slate-900/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-14 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            Patient Journey
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Three Simple Steps to Care
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            From stepping in front of the kiosk to clinical decision support in under three minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="glass-card-elevated group relative flex flex-col justify-between rounded-3xl p-7 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div>
                <div className="mb-5 flex items-center justify-between">
                  <div className="from-jeevandata-50 text-jeevandata-600 ring-jeevandata-200/60 shadow-2xs dark:from-jeevandata-950/60 dark:text-jeevandata-400 dark:ring-jeevandata-800/60 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br to-teal-50 ring-1 dark:to-teal-950/60">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                    <Clock className="h-3 w-3" />
                    {step.duration}
                  </span>
                </div>

                <div className="mb-2 flex items-baseline gap-2">
                  <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                    STEP {step.num}
                  </span>
                </div>
                <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {step.desc}
                </p>
              </div>

              {i < steps.length - 1 && (
                <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  <span>Next: Step {steps[i + 1]?.num}</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
