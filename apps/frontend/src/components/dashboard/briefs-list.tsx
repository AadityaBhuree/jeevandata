import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatDateTime } from '@/lib/utils';

interface BriefRecord {
  id: string;
  sessionId: string;
  patientId: string;
  brief: {
    summary?: string;
    chiefComplaint?: string;
    riskFlags?: string[];
    vitalsToCheck?: string[];
    suggestedFollowups?: string[];
    medicationsNote?: string;
    icd10Hints?: string[];
  };
  generatedAt: string;
  session: { id: string; startedAt: string; status: string };
  patient?: { id: string; name: string; dob: string } | null;
}

interface BriefsListProps {
  briefs: BriefRecord[];
  selectedBrief: BriefRecord | null;
  onSelectBrief: (brief: BriefRecord) => void;
  onMarkReviewed: (id: string) => void;
  reviewingId: string | null;
  isDoctor: boolean;
  isLoading: boolean;
}

export function BriefsList({
  briefs,
  selectedBrief,
  onSelectBrief,
  onMarkReviewed,
  reviewingId,
  isDoctor,
  isLoading,
}: BriefsListProps) {
  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Completed Briefs</h2>
        {isLoading ? (
          <div className="border-jeevandata-200 border-t-jeevandata-500 h-4 w-4 animate-spin rounded-full border-2" />
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {briefs.length} brief{briefs.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-4 p-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-10 rounded-full" />
              </div>
              <div className="skeleton h-3 w-56" />
            </div>
          ))}
        </div>
      ) : briefs.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No completed briefs yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {briefs.map((record) => {
            const isSelected = selectedBrief?.id === record.id;
            const patientName = record.patient?.name ?? record.brief.chiefComplaint ?? 'Patient';
            return (
              <button
                key={record.id}
                onClick={() => onSelectBrief(record)}
                className={cn(
                  'flex w-full items-start justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
                  isSelected && 'bg-emerald-50/50 dark:bg-emerald-900/20',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {patientName}
                    </h3>
                    <Badge variant="success" size="sm">
                      New
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {record.brief.chiefComplaint}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    {formatDateTime(record.generatedAt)}
                  </p>
                  {record.brief.riskFlags && record.brief.riskFlags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {record.brief.riskFlags.map((flag) => (
                        <span
                          key={flag}
                          className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {isDoctor && (
                  <Button
                    variant="success"
                    size="sm"
                    loading={reviewingId === record.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkReviewed(record.id);
                    }}
                    className="ml-3 flex-shrink-0"
                  >
                    {reviewingId === record.id ? 'Marking...' : 'Mark Reviewed'}
                  </Button>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
