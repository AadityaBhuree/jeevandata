'use client';

import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';

import { Users, Clock, CheckCircle2 } from 'lucide-react';

interface QueuePatient {
  id: string;
  sessionId: string;
  patientName: string;
  status: string;
  startedAt: string;
}

interface PatientQueueProps {
  patients: QueuePatient[];
}

const columns = [
  {
    key: 'waiting',
    label: 'Waiting',
    icon: Clock,
    color: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
  },
  {
    key: 'intake',
    label: 'In Intake',
    icon: Users,
    color:
      'border-jeevandata-200 bg-jeevandata-50 dark:border-jeevandata-800 dark:bg-jeevandata-950/30',
  },
  {
    key: 'ready',
    label: 'Ready for Doctor',
    icon: CheckCircle2,
    color: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
  },
];

function getStatusColumn(status: string): string {
  if (status === 'INITIATED' || status === 'PENDING') return 'waiting';
  if (status === 'INTAKE_IN_PROGRESS' || status === 'TRANSCRIBING' || status === 'DETECTING')
    return 'intake';
  if (status === 'BRIEF_READY' || status === 'COMPLETED') return 'ready';
  return 'waiting';
}

function getWaitTime(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm';
  return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
}

export function PatientQueue({ patients }: PatientQueueProps) {
  const grouped = columns.map((col) => ({
    ...col,
    patients: patients.filter((p) => getStatusColumn(p.status) === col.key),
  }));

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
      {grouped.map((col) => (
        <div
          key={col.key}
          className={
            'rounded-2xl border p-4 backdrop-blur-sm transition-all duration-200 ' + col.color
          }
        >
          <div className="mb-4 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="shadow-2xs flex h-7 w-7 items-center justify-center rounded-lg bg-white/70 dark:bg-slate-900/70">
                <col.icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{col.label}</h3>
            </div>
            <span className="shadow-2xs rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
              {col.patients.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {col.patients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200/80 bg-white/30 py-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-500">
                No patients in this queue
              </div>
            ) : (
              col.patients.map((p) => (
                <Card
                  key={p.id}
                  className="glass-card-elevated group p-3.5 transition-all duration-150"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="from-jeevandata-500 to-jeevandata-700 shadow-2xs flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white">
                        {p.patientName
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {p.patientName}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          <Clock className="h-3 w-3" />
                          <span>{getWaitTime(p.startedAt)} wait</span>
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={p.status.toLowerCase()} />
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
