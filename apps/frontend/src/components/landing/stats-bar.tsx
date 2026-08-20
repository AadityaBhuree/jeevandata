const stats = [
  { value: '< 10s', label: 'Average check-in time' },
  { value: '5 min', label: 'Complete intake conversation' },
  { value: 'Zero', label: 'Paper forms needed' },
];

export function StatsBar() {
  return (
    <section className="relative border-y border-slate-200/60 bg-slate-50/50 py-12 dark:border-slate-800/60 dark:bg-slate-900/30">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-8 px-4 sm:flex-row sm:gap-0">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="animate-fade-in-up flex flex-1 flex-col items-center px-6 text-center"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <p className="text-jeevandata-600 dark:text-jeevandata-400 text-3xl font-bold tracking-tight sm:text-4xl">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
