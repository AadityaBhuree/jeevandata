'use client';
import { TitleSetter } from '@/components/ui/title-setter';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { hasRole } from '@/lib/roles';
import { useAuth } from '@/hooks/useAuth';
import { socketService } from '@/services/socket';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/app-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSessionStatusText } from '@/lib/session-status';
import { formatDateTime, formatTime, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Plus,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Users,
  FileCheck2,
  Activity,
  Calendar,
  AlertTriangle,
  Stethoscope,
  Pill,
  ClipboardList,
} from 'lucide-react';
import {
  useActiveSessions,
  useRecentBriefs,
  useMarkBriefReviewed,
  type ActiveSession,
  type BriefRecord,
} from '@/hooks/useQueries';
import { UserRole } from '@jeevandata/shared-types';

// ─── Types ──────────────────────────────────────────────────────

interface ConversationTurn {
  sessionId: string;
  speaker: string;
  text: string;
  timestamp?: string;
}

// ─── Dashboard Component ────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const isDoctor = hasRole(user?.role, [UserRole.DOCTOR]);

  const queryClient = useQueryClient();
  const [socketConnected, setSocketConnected] = useState(false);
  const {
    data: activeSessions = [],
    isLoading: sessionsLoading,
    isError: sessionsError,
    error: sessionsErrorObj,
  } = useActiveSessions(50);
  const { data: recentBriefs = [], isLoading: briefsLoading } = useRecentBriefs(20);
  const markReviewed = useMarkBriefReviewed();

  // Session detail state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionTurns, setSessionTurns] = useState<ConversationTurn[]>([]);
  const [selectedBrief, setSelectedBrief] = useState<BriefRecord | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const turnsEndRef = useRef<HTMLDivElement>(null);
  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId);

  // ─── WebSocket Subscriptions ───────────────────────────────────

  useEffect(() => {
    socketService.connect();
    const unsubConn = socketService.onConnectionChange(setSocketConnected);

    // Listen for session status updates
    const unsubStatus = socketService.onSessionStatus((data) => {
      const payload = data as Record<string, unknown>;
      const status =
        (payload.payload as Record<string, unknown> | undefined)?.status ??
        (data as { status?: string }).status ??
        '';
      const rawSessionId = typeof payload.sessionId === 'string' ? payload.sessionId : '';

      queryClient.setQueryData<ActiveSession[]>(['active-sessions', 50], (prev) =>
        (prev ?? []).map((s) => (s.id === rawSessionId ? { ...s, status: status as string } : s)),
      );
    });

    // Listen for brief:ready — refetch the briefs list
    const unsubBrief = socketService.onBriefReady((_data) => {
      queryClient.invalidateQueries({ queryKey: ['recent-briefs'] });
    });

    // Listen for real-time conversation turns
    const unsubTurns = socketService.onConversationTurn((data) => {
      const payload = data as Record<string, unknown>;
      const nestedPayload = payload.payload as Record<string, unknown> | undefined;
      const speaker =
        (nestedPayload?.speaker as string) ?? (data as { speaker?: string }).speaker ?? '';
      const text = (nestedPayload?.text as string) ?? (data as { text?: string }).text ?? '';
      const turnSessionId =
        (payload.sessionId as string) ?? (data as { sessionId?: string }).sessionId ?? '';
      const timestamp = (payload.timestamp as string) ?? new Date().toISOString();

      if (turnSessionId !== selectedSessionId) return;
      if (!speaker || !text) return;

      setSessionTurns((prev) => {
        const turn: ConversationTurn = {
          sessionId: turnSessionId,
          speaker,
          text,
          timestamp,
        };
        const recent = prev.slice(-3);
        if (recent.some((t) => t.text === text && t.speaker === speaker)) return prev;
        return [...prev, turn];
      });
    });

    // Join all active session rooms so we receive their events
    const joinRooms = () => {
      activeSessions.forEach((s) => socketService.joinSession(s.id));
    };
    joinRooms();

    return () => {
      unsubConn();
      unsubStatus();
      unsubBrief();
      unsubTurns();
      activeSessions.forEach((s) => socketService.leaveSession(s.id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId]);

  // Auto-scroll conversation viewer
  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionTurns]);

  // ─── Actions ───────────────────────────────────────────────────

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        setSessionTurns([]);
        setSelectedBrief(null);
        return;
      }

      setSelectedSessionId(sessionId);
      setSessionTurns([]);

      const brief = recentBriefs.find((b) => b.sessionId === sessionId);
      setSelectedBrief(brief ?? null);

      socketService.joinSession(sessionId);
    },
    [selectedSessionId, recentBriefs],
  );

  const handleMarkReviewed = useCallback(
    (briefId: string) => {
      setReviewingId(briefId);
      markReviewed.mutate(briefId, {
        onSuccess: () => {
          setSelectedBrief(null);
          const brief = recentBriefs.find((b) => b.id === briefId);
          if (brief) {
            queryClient.setQueryData<ActiveSession[]>(['active-sessions', 50], (prev) =>
              (prev ?? []).map((s) =>
                s.id === brief.sessionId ? { ...s, status: 'COMPLETED' } : s,
              ),
            );
          }
        },
        onSettled: () => setReviewingId(null),
      });
    },
    [markReviewed, recentBriefs, queryClient],
  );

  // ─── Stats ─────────────────────────────────────────────────────

  const stats = [
    {
      label: 'Active Sessions',
      value: activeSessions.length,
      color: 'bg-jeevandata-500',
      icon: <Users className="h-4 w-4" />,
      desc: 'Currently in intake',
    },
    {
      label: 'Ready for Review',
      value: recentBriefs.length,
      color: 'bg-emerald-500',
      icon: <FileCheck2 className="h-4 w-4" />,
      desc: 'Briefs awaiting review',
    },
    {
      label: 'In Progress',
      value: activeSessions.filter(
        (s) => s.status === 'INTAKE_IN_PROGRESS' || s.status === 'TRANSCRIBING',
      ).length,
      color: 'bg-amber-500',
      icon: <Activity className="h-4 w-4" />,
      desc: 'Active conversation',
    },
    {
      label: 'Started Today',
      value: activeSessions.filter((s) => {
        const d = new Date(s.startedAt);
        const now = new Date();
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      }).length,
      color: 'bg-violet-500',
      icon: <Calendar className="h-4 w-4" />,
      desc: 'Sessions opened today',
    },
  ];

  // ─── Render ────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
        <TitleSetter title="Doctor Dashboard" />

        {/* Page Header */}
        <PageHeader
          title="Doctor Dashboard"
          description="Jeevandata — Live clinic intake monitor & clinical brief triage"
          actions={
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                  socketConnected
                    ? 'border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : 'border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400',
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    socketConnected ? 'animate-pulse bg-emerald-500' : 'bg-amber-500',
                  )}
                />
                {socketConnected ? 'Live Connection' : 'Reconnecting'}
              </span>
              <Link href="/">
                <Button variant="jeevandata" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                  New Intake
                </Button>
              </Link>
            </div>
          }
        />

        <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 p-0">
          {/* Left Panel — Sessions + Briefs */}
          <div className="flex flex-1 flex-col gap-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {stats.map((stat, i) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  hint={stat.desc}
                  icon={stat.icon}
                  accent={stat.color}
                  delay={i * 80}
                />
              ))}
            </div>

            {/* Active Sessions */}
            <Card className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Active Intake Sessions
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {activeSessions.length}
                  </span>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Real-time kiosk queue
                </span>
              </div>

              {sessionsLoading ? (
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
              ) : sessionsError ? (
                <div className="px-5 py-8 text-center text-sm text-red-500 dark:text-red-400">
                  {(sessionsErrorObj as Error | null)?.message ?? 'Failed to load sessions'}
                  <button
                    onClick={() => window.location.reload()}
                    className="text-jeevandata-500 dark:text-jeevandata-400 ml-2 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : activeSessions.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No active sessions"
                  description="Patients checking in at the kiosk will appear here live."
                  action={
                    <Link href="/">
                      <Button
                        variant="jeevandata-outline"
                        size="sm"
                        leftIcon={<Plus className="h-3.5 w-3.5" />}
                      >
                        Start a new intake
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeSessions.map((session) => {
                    const isSelected = selectedSessionId === session.id;
                    const hasBrief = recentBriefs.some((b) => b.sessionId === session.id);
                    return (
                      <button
                        key={session.id}
                        onClick={() => handleSelectSession(session.id)}
                        className={cn(
                          'flex w-full items-center justify-between px-5 py-3.5 text-left transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                          isSelected &&
                            'border-l-jeevandata-500 bg-jeevandata-50/60 dark:border-l-jeevandata-400 dark:bg-jeevandata-900/20 border-l-4',
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="from-jeevandata-500 to-jeevandata-700 shadow-xs flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white">
                            {session.patient?.name
                              ?.split(' ')
                              .map((n) => n[0])
                              .join('') ?? '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {session.patient?.name ?? 'Unknown Patient'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {formatDateTime(session.startedAt)}
                              {session.patient?.dob && ` · DOB: ${session.patient.dob}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={getSessionStatusText(session.status)} />
                          {hasBrief && (
                            <span
                              title="Clinical brief ready"
                              className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
                            />
                          )}
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 transition-transform',
                              isSelected
                                ? 'text-jeevandata-500'
                                : 'text-slate-300 dark:text-slate-600',
                            )}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Ready Briefs */}
            <Card className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Completed Clinical Briefs
                  </h2>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {recentBriefs.length}
                  </span>
                </div>
                {briefsLoading ? (
                  <div className="border-jeevandata-200 border-t-jeevandata-500 h-4 w-4 animate-spin rounded-full border-2" />
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Awaiting doctor review
                  </span>
                )}
              </div>

              {briefsLoading ? (
                <div className="space-y-4 p-5">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="skeleton h-4 w-32" />
                        <div className="skeleton h-4 w-10 rounded-full" />
                      </div>
                      <div className="skeleton h-3 w-56" />
                      <div className="skeleton h-3 w-20" />
                    </div>
                  ))}
                </div>
              ) : recentBriefs.length === 0 ? (
                <EmptyState
                  icon={FileCheck2}
                  title="No completed briefs yet"
                  description="Structured clinical briefs appear here automatically once an intake conversation is concluded."
                />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentBriefs.map((record) => {
                    const isSelected = selectedBrief?.id === record.id;
                    const patientName =
                      record.patient?.name ?? record.brief.chiefComplaint ?? 'Patient';
                    return (
                      <div
                        key={record.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedBrief(selectedBrief?.id === record.id ? null : record);
                          setSelectedSessionId(record.sessionId);
                          setSessionTurns([]);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedBrief(selectedBrief?.id === record.id ? null : record);
                            setSelectedSessionId(record.sessionId);
                            setSessionTurns([]);
                          }
                        }}
                        className={cn(
                          'flex w-full cursor-pointer items-start justify-between px-5 py-4 text-left transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                          isSelected &&
                            'border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:border-l-emerald-400 dark:bg-emerald-950/20',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                              {patientName}
                            </h3>
                            <Badge variant="outline-success" size="sm">
                              Ready for Review
                            </Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-medium text-slate-900 dark:text-white">
                              Chief complaint:
                            </span>{' '}
                            {record.brief.chiefComplaint}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            Generated {formatDateTime(record.generatedAt)}
                          </p>
                          {record.brief.riskFlags && record.brief.riskFlags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {record.brief.riskFlags.map((flag) => (
                                <span
                                  key={flag}
                                  className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                                >
                                  <AlertTriangle className="h-3 w-3" /> {flag}
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
                              handleMarkReviewed(record.id);
                            }}
                            className="ml-3 flex-shrink-0"
                            leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                          >
                            {reviewingId === record.id ? 'Marking...' : 'Mark Reviewed'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right Panel — Session Detail Drawer */}
          <div
            className={cn(
              'flex w-[440px] flex-shrink-0 flex-col gap-4 transition-all duration-300',
              !selectedSession && 'w-0 overflow-hidden opacity-0',
            )}
          >
            {selectedSession && (
              <>
                {/* Session Info Card */}
                <Card className="p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="from-jeevandata-500 to-jeevandata-700 shadow-xs flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white">
                        {selectedSession.patient?.name
                          ?.split(' ')
                          .map((n) => n[0])
                          .join('') ?? '?'}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {selectedSession.patient?.name ?? 'Unknown Patient'}
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {formatDateTime(selectedSession.startedAt)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={getSessionStatusText(selectedSession.status)} />
                  </div>
                </Card>

                {/* Real-time Conversation Viewer */}
                <Card className="flex flex-1 flex-col shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Live Conversation
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {sessionTurns.length} turn
                      {sessionTurns.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {sessionTurns.length === 0 ? (
                      <EmptyState
                        icon={MessageSquare}
                        title="Waiting for conversation..."
                        description="Utterances from the AI intake session will stream here in real time."
                        className="py-8"
                      />
                    ) : (
                      <>
                        {sessionTurns.map((turn, i) => (
                          <div
                            key={`${turn.speaker}-${i}-${turn.timestamp}`}
                            className={cn(
                              'flex gap-2',
                              turn.speaker === 'ai' ? 'justify-start' : 'justify-end',
                            )}
                          >
                            {/* AI Message */}
                            {turn.speaker === 'ai' && (
                              <div className="flex max-w-[85%] gap-2">
                                <div className="bg-jeevandata-100 text-jeevandata-700 dark:bg-jeevandata-900/50 dark:text-jeevandata-300 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                                  AI
                                </div>
                                <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2.5 dark:bg-slate-800">
                                  <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                                    {turn.text}
                                  </p>
                                  {turn.timestamp && (
                                    <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                                      {formatTime(turn.timestamp)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Patient Message */}
                            {turn.speaker === 'patient' && (
                              <div className="flex max-w-[85%] flex-row-reverse gap-2">
                                <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                  P
                                </div>
                                <div className="bg-jeevandata-500 shadow-xs rounded-2xl rounded-tr-sm px-3.5 py-2.5">
                                  <p className="text-xs leading-relaxed text-white">{turn.text}</p>
                                  {turn.timestamp && (
                                    <p className="text-jeevandata-100 mt-1 text-[10px]">
                                      {formatTime(turn.timestamp)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        <div ref={turnsEndRef} />
                      </>
                    )}
                  </div>
                </Card>

                {/* Selected Brief Preview */}
                {selectedBrief && (
                  <Card className="border-l-4 border-l-emerald-500 p-5 shadow-sm dark:border-l-emerald-400">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Structured Clinical Brief
                        </h3>
                      </div>
                      <Badge variant="outline-success" size="sm">
                        Ready
                      </Badge>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Chief Complaint
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                          {selectedBrief.brief.chiefComplaint ?? 'N/A'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Summary
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {selectedBrief.brief.summary ?? 'No summary'}
                        </p>
                      </div>

                      {selectedBrief.brief.riskFlags &&
                        selectedBrief.brief.riskFlags.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500">
                              Risk Flags
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {selectedBrief.brief.riskFlags.map((flag) => (
                                <span
                                  key={flag}
                                  className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                                >
                                  <AlertTriangle className="h-3 w-3" /> {flag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      {selectedBrief.brief.vitalsToCheck &&
                        selectedBrief.brief.vitalsToCheck.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              Vitals to Check
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {selectedBrief.brief.vitalsToCheck.map((vital) => (
                                <span
                                  key={vital}
                                  className="border-jeevandata-200 bg-jeevandata-50/60 text-jeevandata-700 dark:border-jeevandata-800 dark:bg-jeevandata-950/30 dark:text-jeevandata-300 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
                                >
                                  {vital}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Display medicationsNote if available */}
                      {selectedBrief.brief.medicationsNote && (
                        <div>
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            <Pill className="h-3 w-3" />
                            <span>Current Medications</span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                            {selectedBrief.brief.medicationsNote}
                          </p>
                        </div>
                      )}

                      {/* Display suggestedFollowups if available */}
                      {selectedBrief.brief.suggestedFollowups &&
                        selectedBrief.brief.suggestedFollowups.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              <ClipboardList className="h-3 w-3" />
                              <span>Suggested Follow-ups</span>
                            </div>
                            <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-300">
                              {selectedBrief.brief.suggestedFollowups.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {/* Display icd10Hints if available */}
                      {selectedBrief.brief.icd10Hints &&
                        selectedBrief.brief.icd10Hints.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              ICD-10 Clinical Hints
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {selectedBrief.brief.icd10Hints.map((hint, idx) => (
                                <span
                                  key={idx}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  {hint}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      <div className="flex gap-2 pt-3">
                        {isDoctor && (
                          <Button
                            variant="success"
                            size="sm"
                            className="flex-1 shadow-sm"
                            loading={reviewingId === selectedBrief.id}
                            onClick={() => handleMarkReviewed(selectedBrief.id)}
                            leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                          >
                            Mark as Reviewed
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </AppShell>
  );
}
