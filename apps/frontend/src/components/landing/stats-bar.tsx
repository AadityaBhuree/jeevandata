import { Zap, Clock, ShieldCheck, FileSpreadsheet } from 'lucide-react';

const stats = [
  {
    value: '< 10s',
    label: 'Touchless Biometric Check-In',
    subtext: '478 on-device landmark mesh points',
    icon: Zap,
    accent: 'from-sky-500 to-emerald-500',
  },
  {
    value: '5 min',
    label: 'Average Intake Conversation',
    subtext: 'Voice triage in Hindi, Marathi, English, Spanish',
    icon: Clock,
    accent: 'from-sky-400 to-sky-600',
  },
  {
    value: 'Zero',
    label: 'Paper Forms or Clipboards',
    subtext: 'Instant automated SOAP diagnostic brief',
    icon: FileSpreadsheet,
    accent: 'from-emerald-500 to-sky-600',
  },
  {
    value: '100%',
    label: 'Encrypted & Privacy Preserving',
    subtext: 'AES-256 local vectors, no raw face images',
    icon: ShieldCheck,
    accent: 'from-indigo-500 to-sky-500',
  },
];

export function StatsBar() {
  return (
    <section className="relative border-y border-slate-200/60 bg-white/50 py-14 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="shadow-xs group relative flex flex-col items-center rounded-2xl border border-slate-200/60 bg-white/70 p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-sky-500/40 hover:shadow-lg dark:border-slate-800/80 dark:bg-slate-900/70"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="shadow-2xs mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="bg-gradient-to-r from-sky-600 via-sky-500 to-emerald-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl dark:from-sky-400 dark:via-sky-300 dark:to-emerald-400">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  {stat.label}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {stat.subtext}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
