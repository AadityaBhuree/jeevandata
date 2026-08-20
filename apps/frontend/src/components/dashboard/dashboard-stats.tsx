import { Card } from '@/components/ui/card';
import { Users, FileCheck, Loader, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActiveSession {
  id: string;
  patient: { id: string; name: string; dob: string } | null;
  status: string;
  startedAt: string;
  deviceId: string;
}

interface BriefRecord {
  id: string;
  sessionId: string;
  brief: { summary?: string; chiefComplaint?: string; riskFlags?: string[] };
  generatedAt: string;
}

interface DashboardStatsProps {
  activeSessions: ActiveSession[];
  recentBriefs: BriefRecord[];
}

const statIcons = [
  { icon: Users, color: 'bg-jeevandata-500' },
  { icon: FileCheck, color: 'bg-emerald-500' },
  { icon: Loader, color: 'bg-amber-500' },
  { icon: CalendarDays, color: 'bg-violet-500' },
];

export function DashboardStats({ activeSessions, recentBriefs }: DashboardStatsProps) {
  const stats = [
    { label: 'Active Sessions', value: activeSessions.length, desc: 'Currently in intake' },
    { label: 'Ready for Review', value: recentBriefs.length, desc: 'Briefs awaiting review' },
    {
      label: 'In Progress',
      value: activeSessions.filter(
        (s) => s.status === 'INTAKE_IN_PROGRESS' || s.status === 'TRANSCRIBING',
      ).length,
      desc: 'Active conversation',
    },
    {
      label: 'Completed Today',
      value: activeSessions.filter((s) => s.status === 'COMPLETED').length,
      desc: 'Reviewed sessions',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat, i) => (
        <Card
          key={stat.label}
          className="card-hover-glow animate-fade-in-up p-4"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
            <div className={cn('h-2 w-2 rounded-full', statIcons[i].color)} />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{stat.desc}</p>
        </Card>
      ))}
    </div>
  );
}
