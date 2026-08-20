import { Shield, Lock, Sparkles } from 'lucide-react';

const items = [
  {
    icon: Shield,
    title: 'No Raw Face Images',
    desc: 'Only L2-normalized 512-dim vectors are stored',
    color: 'text-jeevandata-600 dark:text-jeevandata-400',
    bgColor: 'bg-jeevandata-50 dark:bg-jeevandata-900/30',
  },
  {
    icon: Lock,
    title: 'HIPAA-Compliant',
    desc: 'End-to-end encryption, audit logging, consent-gated',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered',
    desc: 'Gemini 2.0 Flash with Whisper speech-to-text',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-900/30',
  },
];

export function TrustSection() {
  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Built for Trust
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Healthcare-grade privacy and compliance from day one
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={item.title}
              className="animate-fade-in-up glass-card flex items-start gap-4 p-5"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${item.bgColor}`}
              >
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
