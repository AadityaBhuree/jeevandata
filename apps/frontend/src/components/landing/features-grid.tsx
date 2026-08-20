import { Camera, MessageSquareText, ClipboardList, Shield, Activity, Globe } from 'lucide-react';

const features = [
  {
    icon: Camera,
    title: 'Face Recognition',
    desc: '478-point face detection, entirely on-device',
    iconColor: 'text-jeevandata-600 dark:text-jeevandata-400',
    bgColor: 'bg-jeevandata-50 dark:bg-jeevandata-900/30',
  },
  {
    icon: MessageSquareText,
    title: 'AI Voice Intake',
    desc: 'Gemini-powered natural conversation',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
  },
  {
    icon: ClipboardList,
    title: 'Clinical Brief',
    desc: 'Auto-generated with risk flags and ICD-10 hints',
    iconColor: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-900/30',
  },
  {
    icon: Shield,
    title: 'Privacy-First',
    desc: 'No face images stored, vectors only',
    iconColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
  },
  {
    icon: Activity,
    title: 'Emergency Screening',
    desc: 'Critical symptoms flagged instantly',
    iconColor: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/30',
  },
  {
    icon: Globe,
    title: 'Multilingual',
    desc: 'English, Hindi, Marathi, Spanish',
    iconColor: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
  },
];

export function FeaturesGrid() {
  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="glass-card card-hover-glow animate-fade-in-up group relative overflow-hidden p-5"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="relative">
                <div
                  className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${feature.bgColor}`}
                >
                  <feature.icon className={`h-5 w-5 ${feature.iconColor}`} />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
