import {
  Camera,
  MessageSquareText,
  ClipboardList,
  Shield,
  Activity,
  Globe,
  CheckCircle2,
} from 'lucide-react';

const features = [
  {
    icon: Camera,
    category: 'Biometrics',
    title: 'Instant Face Recognition',
    desc: '478-point on-device landmark detection for returning patients in under 1 second.',
    iconColor: 'text-jeevandata-600 dark:text-jeevandata-400',
    bgColor: 'bg-jeevandata-50 dark:bg-jeevandata-900/30',
  },
  {
    icon: MessageSquareText,
    category: 'Voice AI',
    title: 'Conversational Voice Intake',
    desc: 'Empathetic, medical-grade speech interview powered by Gemini and Whisper models.',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
  },
  {
    icon: ClipboardList,
    category: 'Clinical Intelligence',
    title: 'Automated SOAP Briefs',
    desc: 'Structured clinical notes with ICD-10 diagnostic suggestions and medication notes.',
    iconColor: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-900/30',
  },
  {
    icon: Shield,
    category: 'Privacy & Security',
    title: 'Zero Image Storage',
    desc: 'Only mathematical L2-normalized vectors stored with AES-256 local database encryption.',
    iconColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
  },
  {
    icon: Activity,
    category: 'Emergency Protocol',
    title: 'Critical Triage Screening',
    desc: 'Chest pain, shortness of breath, and high-risk flags highlighted immediately to staff.',
    iconColor: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-900/30',
  },
  {
    icon: Globe,
    category: 'Localization',
    title: 'Multilingual Natural Voice',
    desc: 'Supports English, Hindi, Marathi, and Spanish with native healthcare vocabulary.',
    iconColor: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-900/30',
  },
];

export function FeaturesGrid() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            Care Intelligence
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Designed for Modern Clinical Excellence
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Every feature is engineered to save doctor time, eliminate paper queues, and keep
            patient data secure.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="glass-card-elevated group relative flex flex-col justify-between rounded-3xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${feature.bgColor} shadow-2xs`}
                  >
                    <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {feature.category}
                  </span>
                </div>
                <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {feature.desc}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100/80 pt-3 text-[11px] font-semibold text-teal-700 dark:border-slate-800/80 dark:text-teal-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Production Ready</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
