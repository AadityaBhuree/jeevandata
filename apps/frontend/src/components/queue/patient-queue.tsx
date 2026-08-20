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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {grouped.map((col) => (
        <div key={col.key} className={'rounded-xl border p-3 ' + col.color}>
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <col.icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{col.label}</h3>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {col.patients.length}
            </span>
          </div>
          <div className="space-y-2">
            {col.patients.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                No patients
              </p>
            ) : (
              col.patients.map((p) => (
                <Card key={p.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {p.patientName}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {getWaitTime(p.startedAt)} wait
                      </p>
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
