'use client';

import { BriefCard } from '@/components/intake/brief-card';
import { BriefExport } from '@/components/intake/brief-export';

interface BriefData {
  summary: string;
  chiefComplaint: string;
  riskFlags: string[];
  vitalsToCheck: string[];
  suggestedFollowups: string[];
  medicationsNote: string;
  icd10Hints: string[];
}

interface BriefPhaseProps {
  brief: BriefData | null;
  patientName?: string;
}

export function BriefPhase({ brief, patientName }: BriefPhaseProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      {brief ? (
        <>
          <BriefCard brief={brief} />
          <div className="print:hidden">
            <BriefExport brief={brief} patientName={patientName} />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="border-jeevandata-200 border-t-jeevandata-500 h-12 w-12 animate-spin rounded-full border-4" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading clinical brief...</p>
        </div>
      )}
    </div>
  );
}
