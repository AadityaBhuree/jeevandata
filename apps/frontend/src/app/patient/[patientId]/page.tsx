'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { RequireAuth } from '@/components/auth/require-auth';
import { TitleSetter } from '@/components/ui/title-setter';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';

interface VisitRecord {
  id: string;
  date: string;
  chiefComplaint: string;
  summary: string;
  riskFlags: string[];
}

export default function PatientHistoryPage() {
  const params = useParams<{ patientId: string }>();
  const [visits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual API call when endpoint is available
    // dashboardApi.getPatientHistory(params.patientId)
    setLoading(false);
  }, [params.patientId]);

  return (
    <RequireAuth>
      <AppShell>
        <TitleSetter title="Patient History" />
        <div className="space-y-4">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Visit History</h1>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
          ) : visits.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-slate-400 dark:text-slate-500">No visit history found.</p>
            </Card>
          ) : (
            <div className="relative space-y-4 border-l-2 border-slate-200 pl-6 dark:border-slate-700">
              {visits.map((visit) => (
                <div key={visit.id} className="relative">
                  <div className="border-jeevandata-500 absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 bg-white dark:bg-slate-900" />
                  <Card className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {formatDateTime(visit.date)}
                      </p>
                      {visit.riskFlags.length > 0 && (
                        <Badge variant="error" size="sm">
                          Risk Flags
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {visit.chiefComplaint}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {visit.summary}
                    </p>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
