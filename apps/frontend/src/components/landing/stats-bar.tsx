const stats = [
  { value: '< 10s', label: 'Average check-in time' },
  { value: '5 min', label: 'Complete intake conversation' },
  { value: 'Zero', label: 'Paper forms needed' },
];

export function StatsBar() {
  return (
    <section className="relative border-y border-slate-200/50 bg-white/40 py-12 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/40">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-8 px-4 sm:flex-row sm:divide-x sm:divide-slate-200/60 dark:sm:divide-slate-800/60">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="flex flex-1 flex-col items-center px-6 text-center"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <p className="gradient-text text-3xl font-extrabold tracking-tight sm:text-4xl">
              {stat.value}
            </p>
            <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
