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

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="card-hover-glow animate-fade-in-up relative text-center"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="bg-jeevandata-50 dark:bg-jeevandata-900/30 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
                <span className="text-jeevandata-600 dark:text-jeevandata-400 text-lg font-bold">
                  {step.num}
                </span>
              </div>
              <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {step.desc}
              </p>
              {i < steps.length - 1 && (
                <div className="absolute right-0 top-7 hidden translate-x-[calc(50%+8px)] text-slate-300 sm:block dark:text-slate-600">
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
