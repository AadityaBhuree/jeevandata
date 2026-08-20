'use client';

import { Button } from '@/components/ui/button';
import { Printer, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface BriefExportProps {
  brief: {
    chiefComplaint?: string;
    summary?: string;
    riskFlags?: string[];
    vitalsToCheck?: string[];
    icd10Hints?: string[];
    medicationsNote?: string;
  };
  patientName?: string;
}

export function BriefExport({ brief, patientName }: BriefExportProps) {
  function handlePrint() {
    window.print();
  }

  function handleCopy() {
    const parts: string[] = [];
    parts.push('Clinical Brief' + (patientName ? ' - ' + patientName : ''));
    parts.push('Chief Complaint: ' + (brief.chiefComplaint || 'N/A'));
    parts.push('Summary: ' + (brief.summary || 'No summary'));
    if (brief.riskFlags && brief.riskFlags.length > 0)
      parts.push('Risk Flags: ' + brief.riskFlags.join(', '));
    if (brief.vitalsToCheck && brief.vitalsToCheck.length > 0)
      parts.push('Vitals: ' + brief.vitalsToCheck.join(', '));
    if (brief.icd10Hints && brief.icd10Hints.length > 0)
      parts.push('ICD-10: ' + brief.icd10Hints.join(', '));
    if (brief.medicationsNote) parts.push('Medications: ' + brief.medicationsNote);
    navigator.clipboard.writeText(parts.join('\n')).then(() => {
      toast({ title: 'Copied to clipboard', description: 'Brief text copied.' });
    });
  }

  return (
    <div className="flex gap-2 print:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrint}
        leftIcon={<Printer className="h-3.5 w-3.5" />}
      >
        Print
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        leftIcon={<Copy className="h-3.5 w-3.5" />}
      >
        Copy as Text
      </Button>
    </div>
  );
}
