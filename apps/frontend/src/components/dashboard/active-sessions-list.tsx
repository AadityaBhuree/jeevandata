import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';

interface ActiveSession {
  id: string;
  patient: { id: string; name: string; dob: string } | null;
  status: string;
  startedAt: string;
  deviceId: string;
}

interface BriefRecord {
  id: string;
  sessionId: string;
}

function getSessionStatusText(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ActiveSessionsListProps {
  sessions: ActiveSession[];
  recentBriefs: BriefRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function ActiveSessionsList({
  sessions,
  recentBriefs,
  selectedId,
  onSelect,
  isLoading,
  error,
}: ActiveSessionsListProps) {
  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Active Intake Sessions
        </h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
      </div>
      {isLoading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="px-5 py-8 text-center text-sm text-red-500 dark:text-red-400">
          {error}
          <button
            onClick={() => window.location.reload()}
            className="text-jeevandata-500 ml-2 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No active sessions at the moment.
          <br />
          <Link href="/" className="text-jeevandata-500 mt-1 inline-block hover:underline">
            Start a new intake
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {sessions.map((session) => {
            const isSelected = selectedId === session.id;
            const hasBrief = recentBriefs.some((b) => b.sessionId === session.id);
            return (
              <button
                key={session.id}
                onClick={() => onSelect(session.id)}
                className={cn(
                  'flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
                  isSelected && 'bg-jeevandata-50/50 dark:bg-jeevandata-900/20',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {session.patient?.name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('') ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {session.patient?.name ?? 'Unknown Patient'}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {formatDateTime(session.startedAt)}
                      {session.patient?.dob && ` · DOB: ${session.patient.dob}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={getSessionStatusText(session.status)} />
                  {hasBrief && <span className="flex h-2 w-2 rounded-full bg-emerald-500" />}
                  {isSelected && <ChevronRight className="text-jeevandata-500 h-4 w-4" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
