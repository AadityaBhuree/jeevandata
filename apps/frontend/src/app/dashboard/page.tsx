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
import { formatDateTime, formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Plus, CheckCircle2, ChevronRight, MessageSquare } from 'lucide-react';
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
      desc: 'Currently in intake',
    },
    {
      label: 'Ready for Review',
      value: recentBriefs.length,
      color: 'bg-emerald-500',
      desc: 'Briefs awaiting review',
    },
    {
      label: 'In Progress',
      value: activeSessions.filter(
        (s) => s.status === 'INTAKE_IN_PROGRESS' || s.status === 'TRANSCRIBING',
      ).length,
      color: 'bg-amber-500',
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
      desc: 'Sessions opened today',
    },
  ];

  // ─── Render ────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
        <TitleSetter title="Doctor Dashboard" />
        {/* Content toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Doctor Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Jeevandata — Live clinic intake monitor
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex items-center gap-1.5 text-xs',
                socketConnected
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400',
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  socketConnected ? 'animate-pulse bg-emerald-500' : 'bg-amber-500',
                )}
              />
              {socketConnected ? 'Live' : 'Reconnecting'}
            </span>
            <Link href="/">
              <Button variant="jeevandata" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                New Intake
              </Button>
            </Link>
          </div>
        </div>

        <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 p-0">
          {/* Left Panel — Sessions + Briefs */}
          <div className="flex flex-1 flex-col gap-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <Card
                  key={stat.label}
                  className="animate-fade-in-up p-4"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {stat.label}
                    </p>
                    <div className={cn('h-2 w-2 rounded-full', stat.color)} />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                    {stat.desc}
                  </p>
                </Card>
              ))}
            </div>

            {/* Active Sessions */}
            <Card className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Active Intake Sessions
                </h2>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {activeSessions.length} session
                  {activeSessions.length !== 1 ? 's' : ''}
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
                <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  No active sessions at the moment.
                  <br />
                  <Link
                    href="/"
                    className="text-jeevandata-500 dark:text-jeevandata-400 mt-1 inline-block hover:underline"
                  >
                    Start a new intake
                  </Link>
                </div>
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
                          {hasBrief && (
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                          )}
                          {isSelected && <ChevronRight className="text-jeevandata-500 h-4 w-4" />}
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
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Completed Briefs
                </h2>
                {briefsLoading ? (
                  <div className="border-jeevandata-200 border-t-jeevandata-500 h-4 w-4 animate-spin rounded-full border-2" />
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {recentBriefs.length} brief
                    {recentBriefs.length !== 1 ? 's' : ''}
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
                <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  No completed briefs yet.
                  <br />
                  <span className="text-xs text-slate-300 dark:text-slate-600">
                    Briefs appear here once an intake conversation is complete
                  </span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentBriefs.map((record) => {
                    const isSelected = selectedBrief?.id === record.id;
                    const patientName =
                      record.patient?.name ?? record.brief.chiefComplaint ?? 'Patient';
                    return (
                      // NOTE: a div role=button — NOT a <button> — because the
                      // "Mark Reviewed" action below is itself a button; nesting
                      // would be invalid HTML and cause React hydration errors.
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
                          'flex w-full cursor-pointer items-start justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
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
                                  ⚠ {flag}
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
              'flex w-[420px] flex-shrink-0 flex-col gap-4 transition-all duration-300',
              !selectedSession && 'w-0 overflow-hidden opacity-0',
            )}
          >
            {selectedSession && (
              <>
                {/* Session Info Card */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-jeevandata-100 text-jeevandata-600 dark:bg-jeevandata-900/50 dark:text-jeevandata-400 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
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
                <Card className="flex flex-1 flex-col">
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
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            Waiting for conversation...
                          </p>
                          <p className="mt-1 text-[10px] text-slate-300 dark:text-slate-600">
                            Turns appear here in real-time
                          </p>
                        </div>
                      </div>
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
                                <div className="bg-jeevandata-100 text-jeevandata-600 dark:bg-jeevandata-900/50 dark:text-jeevandata-400 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                                  AI
                                </div>
                                <div className="rounded-xl rounded-tl-sm bg-slate-100 px-3 py-2 dark:bg-slate-800">
                                  <p className="text-xs text-slate-700 dark:text-slate-300">
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
                                <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                  P
                                </div>
                                <div className="bg-jeevandata-500 rounded-xl rounded-tr-sm px-3 py-2">
                                  <p className="text-xs text-white">{turn.text}</p>
                                  {turn.timestamp && (
                                    <p className="text-jeevandata-200 mt-1 text-[10px]">
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
                  <Card className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Clinical Brief
                      </h3>
                      <Badge variant="success" size="sm">
                        Ready
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-medium uppercase text-slate-400 dark:text-slate-500">
                          Chief Complaint
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">
                          {selectedBrief.brief.chiefComplaint ?? 'N/A'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-medium uppercase text-slate-400 dark:text-slate-500">
                          Summary
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {selectedBrief.brief.summary ?? 'No summary'}
                        </p>
                      </div>

                      {selectedBrief.brief.riskFlags &&
                        selectedBrief.brief.riskFlags.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium uppercase text-red-400">
                              Risk Flags
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {selectedBrief.brief.riskFlags.map((flag) => (
                                <span
                                  key={flag}
                                  className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800"
                                >
                                  ⚠ {flag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      {selectedBrief.brief.vitalsToCheck &&
                        selectedBrief.brief.vitalsToCheck.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium uppercase text-slate-400 dark:text-slate-500">
                              Vitals to Check
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {selectedBrief.brief.vitalsToCheck.map((vital) => (
                                <span
                                  key={vital}
                                  className="bg-jeevandata-50 text-jeevandata-700 ring-jeevandata-200 dark:bg-jeevandata-900/30 dark:text-jeevandata-400 dark:ring-jeevandata-800 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1"
                                >
                                  {vital}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      <div className="flex gap-2 pt-2">
                        {isDoctor && (
                          <Button
                            variant="success"
                            size="sm"
                            className="flex-1"
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
