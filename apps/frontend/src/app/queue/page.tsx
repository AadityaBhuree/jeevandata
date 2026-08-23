'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PatientQueue, type QueuePatient } from '@/components/queue/patient-queue';
import { RequireAuth } from '@/components/auth/require-auth';
import { dashboardApi } from '@/services/api';
import { TitleSetter } from '@/components/ui/title-setter';
import { PageHeader } from '@/components/ui/page-header';
import { Users, Clock, CheckCircle2 } from 'lucide-react';

export default function QueuePage() {
  const [patients, setPatients] = useState<QueuePatient[]>([]);

  useEffect(() => {
    dashboardApi
      .getActiveSessions(1, 50)
      .then((res) => {
        const mapped = (
          res.data as Array<{
            id: string;
            patient?: { id?: string; name: string } | null;
            status: string;
            startedAt: string;
          }>
        ).map((s) => ({
          id: s.id,
          sessionId: s.id,
          patientId: s.patient?.id,
          patientName: s.patient?.name ?? 'Unknown Patient',
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
        <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
          <TitleSetter title="Patient Queue" />

          <PageHeader
            title="Patient Triage Queue"
            description="Real-time clinical flow board of waiting, active intake, and doctor-ready patients."
            breadcrumbs={[
              { label: 'Doctor Dashboard', href: '/dashboard' },
              { label: 'Patient Queue' },
            ]}
            actions={
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="shadow-2xs flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <Users className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>
                    Total:{' '}
                    <strong className="text-slate-900 dark:text-white">{patients.length}</strong>
                  </span>
                </span>
                <span className="shadow-2xs flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50/80 px-2.5 py-1 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                  <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>
                    Waiting: <strong>{waitingCount}</strong>
                  </span>
                </span>
                <span className="shadow-2xs flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50/80 px-2.5 py-1 text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-300">
                  <Users className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>
                    In Voice AI: <strong>{inIntakeCount}</strong>
                  </span>
                </span>
                <span className="shadow-2xs flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Ready for Doctor: <strong>{readyCount}</strong>
                  </span>
                </span>
              </div>
            }
          />

          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-0">
            <PatientQueue patients={patients} />
          </main>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
