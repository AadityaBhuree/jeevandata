'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PatientQueue } from '@/components/queue/patient-queue';
import { RequireAuth } from '@/components/auth/require-auth';
import { dashboardApi } from '@/services/api';
import { TitleSetter } from '@/components/ui/title-setter';

import { PageHeader } from '@/components/ui/page-header';
import { Users, Clock, CheckCircle2 } from 'lucide-react';

interface QueuePatient {
  id: string;
  sessionId: string;
  patientName: string;
  status: string;
  startedAt: string;
}

export default function QueuePage() {
  const [patients, setPatients] = useState<QueuePatient[]>([]);

  useEffect(() => {
    dashboardApi
      .getActiveSessions(1, 50)
      .then((res) => {
        const mapped = (
          res.data as Array<{
            id: string;
            patient?: { name: string } | null;
            status: string;
            startedAt: string;
          }>
        ).map((s) => ({
          id: s.id,
          sessionId: s.id,
          patientName: s.patient?.name ?? 'Unknown',
          status: s.status,
          startedAt: s.startedAt,
        }));
        setPatients(mapped);
      })
      .catch(() => {});
  }, []);

  const waitingCount = patients.filter(
    (p) => p.status === 'INITIATED' || p.status === 'PENDING',
  ).length;
  const inIntakeCount = patients.filter(
    (p) =>
      p.status === 'INTAKE_IN_PROGRESS' || p.status === 'TRANSCRIBING' || p.status === 'DETECTING',
  ).length;
  const readyCount = patients.filter(
    (p) => p.status === 'BRIEF_READY' || p.status === 'COMPLETED',
  ).length;

  return (
    <RequireAuth>
      <AppShell>
        <TitleSetter title="Patient Queue" />

        <PageHeader
          title="Patient Queue"
          description="Real-time status board of waiting, in-intake, and ready patients"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Patient Queue' }]}
          actions={
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <Users className="text-jeevandata-500 h-3.5 w-3.5" />
                <span>
                  Total:{' '}
                  <strong className="text-slate-900 dark:text-white">{patients.length}</strong>
                </span>
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>
                  Waiting:{' '}
                  <strong className="text-slate-900 dark:text-white">{waitingCount}</strong>
                </span>
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <Users className="text-jeevandata-500 h-3.5 w-3.5" />
                <span>
                  In Intake:{' '}
                  <strong className="text-slate-900 dark:text-white">{inIntakeCount}</strong>
                </span>
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>
                  Ready: <strong className="text-slate-900 dark:text-white">{readyCount}</strong>
                </span>
              </span>
            </div>
          }
        />

        <div className="space-y-4">
          <PatientQueue patients={patients} />
        </div>
      </AppShell>
    </RequireAuth>
  );
}
