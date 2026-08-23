'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Users, Clock, CheckCircle2, Stethoscope, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QueuePatient {
  id: string;
  sessionId: string;
  patientId?: string;
  patientName: string;
  status: string;
  startedAt: string;
  priority?: 'P1' | 'P2' | 'P3';
}

interface PatientQueueProps {
  patients: QueuePatient[];
}

const columns = [
  {
    key: 'waiting',
    label: 'Waiting for Intake',
    icon: Clock,
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    headerColor: 'border-amber-500/20 bg-amber-50/40 dark:border-amber-900/30 dark:bg-amber-950/20',
  },
  {
    key: 'intake',
    label: 'In AI Voice Intake',
    icon: Users,
    badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
    headerColor: 'border-sky-500/20 bg-sky-50/40 dark:border-sky-900/30 dark:bg-sky-950/20',
  },
  {
    key: 'ready',
    label: 'Ready for Doctor',
    icon: CheckCircle2,
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    headerColor:
      'border-emerald-500/20 bg-emerald-50/40 dark:border-emerald-900/30 dark:bg-emerald-950/20',
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
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {grouped.map((col) => (
        <div
          key={col.key}
          className={cn(
            'glass-panel flex flex-col rounded-3xl border p-4 shadow-sm transition-all duration-200',
            col.headerColor,
          )}
        >
          {/* Column Header */}
          <div className="mb-4 flex items-center justify-between border-b border-slate-100/80 px-1 pb-3 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="shadow-2xs flex h-8 w-8 items-center justify-center rounded-xl bg-white dark:bg-slate-900">
                <col.icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{col.label}</h3>
            </div>
            <span
              className={cn(
                'shadow-2xs rounded-full px-2.5 py-0.5 text-xs font-extrabold',
                col.badgeColor,
              )}
            >
              {col.patients.length}
            </span>
          </div>

          {/* Column Patient List */}
          <div className="flex-1 space-y-3">
            {col.patients.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/80 bg-white/40 p-4 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-500">
                No patients in this queue
              </div>
            ) : (
              col.patients.map((p) => {
                return (
                  <Card
                    key={p.id}
                    className="glass-card-elevated group relative rounded-2xl border-slate-200/80 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="shadow-xs flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 text-xs font-bold text-white">
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
                            <span>{getWaitTime(p.startedAt)} elapsed</span>
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={p.status.toLowerCase()} />
                    </div>

                    {/* Bottom Actions if Doctor is ready */}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 pt-2.5 dark:border-slate-800/80">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        <Stethoscope className="h-3 w-3 text-sky-600" />
                        Triage Room 1
                      </span>

                      {p.patientId ? (
                        <Link
                          href={`/patient/${p.patientId}`}
                          className="inline-flex items-center gap-0.5 text-xs font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400"
                        >
                          <span>Dossier</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <Link
                          href="/dashboard"
                          className="inline-flex items-center gap-0.5 text-xs font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400"
                        >
                          <span>Dashboard</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
