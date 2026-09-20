'use client';
import { TitleSetter } from '@/components/ui/title-setter';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
  AlertTriangle,
  Stethoscope,
  Pill,
  ClipboardList,
  Search,
  History,
  X,
  ShieldAlert,
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

type FilterTab = 'all' | 'in_progress' | 'ready' | 'high_risk';
type BriefFilterTab = 'all' | 'high_risk' | 'standard';

const INITIAL_VISIBLE_COUNT = 8;
const LOAD_MORE_STEP = 8;

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

  // Search, filter, and pagination state for Sessions
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [sessionsVisibleCount, setSessionsVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  // Search, filter, and pagination state for Briefs
  const [briefSearchQuery, setBriefSearchQuery] = useState('');
  const [briefFilterTab, setBriefFilterTab] = useState<BriefFilterTab>('all');
  const [briefsVisibleCount, setBriefsVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  // Session detail state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionTurns, setSessionTurns] = useState<ConversationTurn[]>([]);
  const [selectedBrief, setSelectedBrief] = useState<BriefRecord | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const turnsEndRef = useRef<HTMLDivElement>(null);
  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId);

  // Reset pagination when search or filters change
  useEffect(() => {
    setSessionsVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [searchQuery, filterTab]);

  useEffect(() => {
    setBriefsVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [briefSearchQuery, briefFilterTab]);

  // ─── High Risk Detection ───────────────────────────────────────
  const highRiskBriefs = useMemo(() => {
    return recentBriefs.filter((b) => (b.brief.riskFlags?.length ?? 0) > 0);
  }, [recentBriefs]);

  // ─── Filtered & Paginated Sessions ──────────────────────────────
  const filteredSessions = useMemo(() => {
    return activeSessions.filter((session) => {
      const name = session.patient?.name?.toLowerCase() ?? '';
      const dob = session.patient?.dob?.toLowerCase() ?? '';
      const deviceId = session.deviceId?.toLowerCase() ?? '';
      const sessionId = session.id.toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch =
        !q || name.includes(q) || dob.includes(q) || deviceId.includes(q) || sessionId.includes(q);
      if (!matchesSearch) return false;

      if (filterTab === 'in_progress') {
        return session.status === 'INTAKE_IN_PROGRESS' || session.status === 'TRANSCRIBING';
      }
      if (filterTab === 'ready') {
        return recentBriefs.some((b) => b.sessionId === session.id);
      }
      if (filterTab === 'high_risk') {
        const brief = recentBriefs.find((b) => b.sessionId === session.id);
        return (brief?.brief.riskFlags?.length ?? 0) > 0;
      }
      return true;
    });
  }, [activeSessions, recentBriefs, searchQuery, filterTab]);

  const paginatedSessions = useMemo(() => {
    return filteredSessions.slice(0, sessionsVisibleCount);
  }, [filteredSessions, sessionsVisibleCount]);

  // ─── Filtered & Paginated Briefs ────────────────────────────────
  const filteredBriefs = useMemo(() => {
    return recentBriefs.filter((record) => {
      const patientName = record.patient?.name?.toLowerCase() ?? '';
      const complaint = record.brief.chiefComplaint?.toLowerCase() ?? '';
      const summary = record.brief.summary?.toLowerCase() ?? '';
      const flags = (record.brief.riskFlags ?? []).join(' ').toLowerCase();
      const icd10 = (record.brief.icd10Hints ?? []).join(' ').toLowerCase();
      const q = briefSearchQuery.toLowerCase().trim();

      const matchesSearch =
        !q ||
        patientName.includes(q) ||
        complaint.includes(q) ||
        summary.includes(q) ||
        flags.includes(q) ||
        icd10.includes(q);
      if (!matchesSearch) return false;

      const hasRisk = (record.brief.riskFlags?.length ?? 0) > 0;
      if (briefFilterTab === 'high_risk') return hasRisk;
      if (briefFilterTab === 'standard') return !hasRisk;
      return true;
    });
  }, [recentBriefs, briefSearchQuery, briefFilterTab]);

  const paginatedBriefs = useMemo(() => {
    return filteredBriefs.slice(0, briefsVisibleCount);
  }, [filteredBriefs, briefsVisibleCount]);

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
      color: 'bg-sky-500',
      icon: <Users className="h-4 w-4" />,
      desc: 'Currently in kiosk queue',
    },
    {
      label: 'Ready for Review',
      value: recentBriefs.length,
      color: 'bg-emerald-500',
      icon: <FileCheck2 className="h-4 w-4" />,
      desc: 'Completed SOAP briefs',
    },
    {
      label: 'In Progress',
      value: activeSessions.filter(
        (s) => s.status === 'INTAKE_IN_PROGRESS' || s.status === 'TRANSCRIBING',
      ).length,
      color: 'bg-amber-500',
      icon: <Activity className="h-4 w-4" />,
      desc: 'Live voice conversations',
    },
    {
      label: 'High Risk Flags',
      value: highRiskBriefs.length,
      color: 'bg-rose-500',
      icon: <AlertTriangle className="h-4 w-4" />,
      desc: 'Urgent triage screening',
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
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-sm',
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

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-0">
          {/* High-Risk Clinical Alert Banner */}
          {highRiskBriefs.length > 0 && (
            <div className="animate-fade-in flex items-center justify-between rounded-2xl border border-rose-200/80 bg-rose-50/80 p-4 shadow-sm backdrop-blur-sm dark:border-rose-900/60 dark:bg-rose-950/30">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-rose-900 dark:text-rose-200">
                    High-Risk Patient Triage Alert ({highRiskBriefs.length} Flagged)
                  </h3>
                  <p className="text-xs text-rose-700 dark:text-rose-300">
                    Patients presenting with acute risk flags require priority physician evaluation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFilterTab('high_risk')}
                className="shadow-2xs rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-slate-800"
              >
                Filter High-Risk
              </button>
            </div>
          )}

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

          {/* Main Content: Split Layout */}
          <div className="flex flex-1 gap-6">
            {/* Left Panel — Sessions & Briefs */}
            <div className="flex flex-1 flex-col gap-6">
              {/* Active Sessions Card */}
              <Card className="glass-panel animate-fade-in-up overflow-hidden rounded-2xl border-slate-200/80 p-0 shadow-md dark:border-slate-800/80">
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Intake Queue &amp; Sessions
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {filteredSessions.length}
                    </span>
                  </div>

                  {/* Filter Pills & Search */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 sm:w-48">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search patient / DOB..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-slate-200/80 bg-white/90 py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          aria-label="Clear search"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    <div className="flex rounded-xl border border-slate-200/80 bg-slate-100/80 p-0.5 text-[11px] font-semibold dark:border-slate-800 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => setFilterTab('all')}
                        className={cn(
                          'rounded-lg px-2.5 py-1 transition-colors',
                          filterTab === 'all'
                            ? 'shadow-2xs bg-white text-slate-900 dark:bg-slate-800 dark:text-white'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                        )}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab('in_progress')}
                        className={cn(
                          'rounded-lg px-2.5 py-1 transition-colors',
                          filterTab === 'in_progress'
                            ? 'shadow-2xs bg-white text-slate-900 dark:bg-slate-800 dark:text-white'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                        )}
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab('ready')}
                        className={cn(
                          'rounded-lg px-2.5 py-1 transition-colors',
                          filterTab === 'ready'
                            ? 'shadow-2xs bg-white text-slate-900 dark:bg-slate-800 dark:text-white'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                        )}
                      >
                        Brief Ready
                      </button>
                    </div>
                  </div>
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
                      className="ml-2 text-sky-500 hover:underline dark:text-sky-400"
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No active sessions found"
                    description={
                      searchQuery
                        ? 'No sessions match your search query.'
                        : 'Patients checking in at the kiosk will appear here live.'
                    }
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
                  <>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paginatedSessions.map((session) => {
                        const isSelected = selectedSessionId === session.id;
                        const brief = recentBriefs.find((b) => b.sessionId === session.id);
                        const hasBrief = !!brief;
                        const hasRisk = (brief?.brief.riskFlags?.length ?? 0) > 0;

                        return (
                          <div
                            key={session.id}
                            className={cn(
                              'group flex w-full items-center justify-between px-5 py-3.5 text-left transition-all duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/50',
                              isSelected &&
                                'border-l-4 border-l-sky-500 bg-sky-50/50 dark:border-l-sky-400 dark:bg-sky-950/20',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectSession(session.id)}
                              className="flex flex-1 items-center gap-3.5 text-left"
                            >
                              <div className="shadow-xs flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 text-xs font-bold text-white">
                                {session.patient?.name
                                  ?.split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('') ?? '?'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                                    {session.patient?.name ?? 'Unknown Patient'}
                                  </p>
                                  {hasRisk && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                                      <AlertTriangle className="h-2.5 w-2.5" /> High Risk
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {formatDateTime(session.startedAt)}
                                  {session.patient?.dob && ` · DOB: ${session.patient.dob}`}
                                </p>
                              </div>
                            </button>

                            <div className="flex items-center gap-2">
                              {session.patient?.id && (
                                <Link
                                  href={`/patient/${session.patient.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="shadow-2xs hidden items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  title="View Patient Dossier"
                                >
                                  <History className="h-3 w-3" /> History
                                </Link>
                              )}

                              <StatusBadge status={getSessionStatusText(session.status)} />
                              {hasBrief && (
                                <span
                                  title="Clinical brief ready"
                                  className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => handleSelectSession(session.id)}
                                aria-label="Toggle details"
                              >
                                <ChevronRight
                                  className={cn(
                                    'h-4 w-4 transition-transform',
                                    isSelected
                                      ? 'text-sky-500'
                                      : 'text-slate-300 dark:text-slate-600',
                                  )}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination / Load More Bar for Sessions */}
                    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500 sm:flex-row dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400">
                      <span data-testid="sessions-pagination-info">
                        Showing{' '}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {paginatedSessions.length}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {filteredSessions.length}
                        </span>{' '}
                        sessions
                        {searchQuery && ` (filtered from ${activeSessions.length})`}
                      </span>
                      {filteredSessions.length > sessionsVisibleCount && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="jeevandata-outline"
                            size="sm"
                            onClick={() => setSessionsVisibleCount((prev) => prev + LOAD_MORE_STEP)}
                            className="h-7 px-3 text-xs"
                          >
                            Load More (+
                            {Math.min(
                              LOAD_MORE_STEP,
                              filteredSessions.length - sessionsVisibleCount,
                            )}
                            )
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSessionsVisibleCount(filteredSessions.length)}
                            className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          >
                            Show All
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>

              {/* Ready Briefs Card */}
              <Card className="glass-panel animate-fade-in-up overflow-hidden rounded-2xl border-slate-200/80 p-0 shadow-md dark:border-slate-800/80">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Completed Clinical SOAP Briefs
                    </h2>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {filteredBriefs.length}
                    </span>
                    {briefsLoading && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-500" />
                    )}
                  </div>

                  {/* Briefs Search & Filter Toolbar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 sm:w-52">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search brief / diagnosis..."
                        value={briefSearchQuery}
                        onChange={(e) => setBriefSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-slate-200/80 bg-white/90 py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                      {briefSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setBriefSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          aria-label="Clear brief search"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    <div className="flex rounded-xl border border-slate-200/80 bg-slate-100/80 p-0.5 text-[11px] font-semibold dark:border-slate-800 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => setBriefFilterTab('all')}
                        className={cn(
                          'rounded-lg px-2.5 py-1 transition-colors',
                          briefFilterTab === 'all'
                            ? 'shadow-2xs bg-white text-slate-900 dark:bg-slate-800 dark:text-white'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                        )}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setBriefFilterTab('high_risk')}
                        className={cn(
                          'rounded-lg px-2.5 py-1 transition-colors',
                          briefFilterTab === 'high_risk'
                            ? 'shadow-2xs bg-white text-slate-900 dark:bg-slate-800 dark:text-white'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                        )}
                      >
                        High-Risk
                      </button>
                      <button
                        type="button"
                        onClick={() => setBriefFilterTab('standard')}
                        className={cn(
                          'rounded-lg px-2.5 py-1 transition-colors',
                          briefFilterTab === 'standard'
                            ? 'shadow-2xs bg-white text-slate-900 dark:bg-slate-800 dark:text-white'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                        )}
                      >
                        Standard
                      </button>
                    </div>
                  </div>
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
                ) : filteredBriefs.length === 0 ? (
                  <EmptyState
                    icon={FileCheck2}
                    title={
                      briefSearchQuery || briefFilterTab !== 'all'
                        ? 'No matching briefs found'
                        : 'No completed briefs yet'
                    }
                    description={
                      briefSearchQuery
                        ? `No clinical briefs match "${briefSearchQuery}". Try clearing your search or filter.`
                        : recentBriefs.length === 0
                          ? 'Structured clinical briefs appear here automatically once an intake conversation is concluded.'
                          : 'No clinical briefs match the selected filter category.'
                    }
                    action={
                      briefSearchQuery || briefFilterTab !== 'all' ? (
                        <Button
                          variant="jeevandata-outline"
                          size="sm"
                          onClick={() => {
                            setBriefSearchQuery('');
                            setBriefFilterTab('all');
                          }}
                        >
                          Clear search &amp; filter
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paginatedBriefs.map((record) => {
                        const isSelected = selectedBrief?.id === record.id;
                        const patientName =
                          record.patient?.name ?? record.brief.chiefComplaint ?? 'Patient';
                        const hasRisk = (record.brief.riskFlags?.length ?? 0) > 0;

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
                                {hasRisk && (
                                  <Badge variant="error" size="sm">
                                    <AlertTriangle className="mr-1 h-3 w-3" /> Risk Flag
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                                <span className="font-semibold text-slate-900 dark:text-white">
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
                                      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
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
                                className="shadow-xs ml-3 flex-shrink-0"
                                leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                              >
                                {reviewingId === record.id ? 'Marking...' : 'Mark Reviewed'}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination / Load More Bar for Briefs */}
                    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500 sm:flex-row dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400">
                      <span data-testid="briefs-pagination-info">
                        Showing{' '}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {paginatedBriefs.length}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {filteredBriefs.length}
                        </span>{' '}
                        briefs
                        {briefSearchQuery && ` (filtered from ${recentBriefs.length})`}
                      </span>
                      {filteredBriefs.length > briefsVisibleCount && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="jeevandata-outline"
                            size="sm"
                            onClick={() => setBriefsVisibleCount((prev) => prev + LOAD_MORE_STEP)}
                            className="h-7 px-3 text-xs"
                          >
                            Load More (+
                            {Math.min(LOAD_MORE_STEP, filteredBriefs.length - briefsVisibleCount)})
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setBriefsVisibleCount(filteredBriefs.length)}
                            className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          >
                            Show All
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
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
                  <Card className="glass-panel p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="shadow-xs flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 text-xs font-bold text-white">
                          {selectedSession.patient?.name
                            ?.split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
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
                  <Card className="glass-panel flex flex-1 flex-col shadow-sm">
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

                    <div className="max-h-[350px] flex-1 space-y-3 overflow-y-auto p-4">
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
                                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
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
                                  <div className="shadow-xs rounded-2xl rounded-tr-sm bg-sky-600 px-3.5 py-2.5">
                                    <p className="text-xs leading-relaxed text-white">
                                      {turn.text}
                                    </p>
                                    {turn.timestamp && (
                                      <p className="mt-1 text-[10px] text-sky-100">
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
                    <Card className="glass-panel border-l-4 border-l-emerald-500 p-5 shadow-sm dark:border-l-emerald-400">
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
                                    className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50/60 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300"
                                  >
                                    {vital}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

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
          </div>
        </main>
      </div>
    </AppShell>
  );
}
