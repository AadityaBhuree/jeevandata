'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PatientQueue } from '@/components/queue/patient-queue';
import { RequireAuth } from '@/components/auth/require-auth';
import { dashboardApi } from '@/services/api';
import { TitleSetter } from '@/components/ui/title-setter';

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

  return (
    <RequireAuth>
      <AppShell>
        <TitleSetter title="Patient Queue" />
        <div className="space-y-4">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Patient Queue</h1>
          <PatientQueue patients={patients} />
        </div>
      </AppShell>
    </RequireAuth>
  );
}
