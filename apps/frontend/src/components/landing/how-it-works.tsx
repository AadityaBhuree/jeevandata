import { Camera, MessageSquareText, ClipboardList } from 'lucide-react';

const steps = [
  {
    num: 1,
    icon: Camera,
    title: 'Check In',
    desc: 'Patient steps up to the kiosk. Face recognition identifies returning patients instantly.',
  },
  {
    num: 2,
    icon: MessageSquareText,
    title: 'AI Interview',
    desc: 'Our AI voice assistant collects symptoms through a natural, multilingual conversation.',
  },
  {
    num: 3,
    icon: ClipboardList,
    title: 'Clinical Brief',
    desc: 'A structured brief with risk flags, vitals, and ICD-10 hints is ready for the doctor.',
  },
];

export function HowItWorks() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-12 text-center">
          <div className="via-jeevandata-400 mx-auto mb-4 h-px w-12 bg-gradient-to-r from-transparent to-transparent" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            How It Works
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Three steps from kiosk to clinical brief
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="glass-card-elevated group relative rounded-2xl p-6 text-center"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="from-jeevandata-50 shadow-xs ring-jeevandata-200/50 dark:from-jeevandata-950/60 dark:ring-jeevandata-800/50 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br to-teal-50 ring-1 dark:to-teal-950/60">
                <span className="text-jeevandata-600 dark:text-jeevandata-400 text-lg font-bold">
                  {step.num}
                </span>
              </div>
              <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
                {step.title}
              </h3>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
