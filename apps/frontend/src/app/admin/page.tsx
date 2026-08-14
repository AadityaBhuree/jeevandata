'use client';
import { TitleSetter } from '@/components/ui/title-setter';
import { AppShell } from '@/components/layout/app-shell';

import { useEffect, useState, useCallback } from 'react';
import {
  analyticsApi,
  monitoringApi,
  type VolumePoint,
  type HourPoint,
  type FlowStage,
  type LatencySnapshot,
  type MonitoredAlert,
} from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/admin/stat-card';
import { VolumeChart } from '@/components/admin/volume-chart';
import { HoursHeatmap } from '@/components/admin/hours-heatmap';
import { FlowBoard } from '@/components/admin/flow-board';
import { LatencyPanel } from '@/components/admin/latency-panel';
import { AlertsPanel } from '@/components/admin/alerts-panel';
import { logger } from '@/lib/logger';
import {
  Users,
  UserCheck,
  UserPlus,
  Gauge,
  Timer,
  FileCheck2,
  Activity,
  Download,
  RefreshCw,
} from 'lucide-react';

interface Overview {
  days: number;
  totalSessions: number;
  returningPatients: number;
  newPatients: number;
  faceMatchRate: number;
  avgIntakeMinutes: number;
  briefSuccessRate: number;
  activeSessions: number;
}

const RANGES = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
] as const;

export default function AdminPage() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [volume, setVolume] = useState<VolumePoint[]>([]);
  const [hours, setHours] = useState<HourPoint[]>([]);
  const [flow, setFlow] = useState<FlowStage[]>([]);
  const [flowTotal, setFlowTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [latency, setLatency] = useState<LatencySnapshot | null>(null);
  const [alerts, setAlerts] = useState<MonitoredAlert[]>([]);
  const [monitoringLoading, setMonitoringLoading] = useState(true);
  const [monitoringError, setMonitoringError] = useState<string | null>(null);

  const loadMonitoring = useCallback(async () => {
    setMonitoringLoading(true);
    setMonitoringError(null);
    try {
      const [lat, alr] = await Promise.all([monitoringApi.getLatency(), monitoringApi.getAlerts()]);
      setLatency(lat);
      setAlerts(alr);
    } catch (err) {
      setMonitoringError(err instanceof Error ? err.message : 'Failed to load monitoring');
      logger.error('Admin monitoring load failed', err);
    } finally {
      setMonitoringLoading(false);
    }
  }, []);

  // Load the monitoring panel once on mount + on refresh
  useEffect(() => {
    loadMonitoring();
  }, [loadMonitoring]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, vol, hrs] = await Promise.all([
        analyticsApi.getOverview(days),
        analyticsApi.getVolume(days),
        analyticsApi.getHours(days),
      ]);
      setOverview(ov);
      setVolume(vol.data);
      setHours(hrs.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      logger.error('Admin analytics load failed', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  // Initial load + refresh on range change
  useEffect(() => {
    load();
  }, [load]);

  // Load the live flow board once on mount
  useEffect(() => {
    analyticsApi
      .getFlow()
      .then((res) => {
        setFlow(res.stages);
        setFlowTotal(res.total);
      })
      .catch(() => {});
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await analyticsApi.fetchCsv(days);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${days}d.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('CSV export failed', err);
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell>
      <TitleSetter title="Admin Analytics" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Admin Analytics</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Jeevandata — clinic KPIs & patient flow
          </p>
        </div>
        <div className="flex items-center gap-2"></div>
      </div>
      <div className="flex flex-col gap-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === r.days
                    ? 'bg-jeevandata-500 text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
                aria-pressed={days === r.days}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                load();
                loadMonitoring();
              }}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              loading={loading || monitoringLoading}
            >
              Refresh
            </Button>
            <Button
              variant="jeevandata"
              size="sm"
              onClick={handleExport}
              loading={exporting}
              leftIcon={<Download className="h-3.5 w-3.5" />}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-400"
          >
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Sessions"
            value={overview?.totalSessions ?? '—'}
            hint={`Last ${days} days`}
            icon={<Users className="h-4 w-4" />}
            accent="bg-jeevandata-500"
            delay={0}
          />
          <StatCard
            label="Returning Patients"
            value={overview?.returningPatients ?? '—'}
            hint={`${overview?.faceMatchRate ?? 0}% face match rate`}
            icon={<UserCheck className="h-4 w-4" />}
            accent="bg-emerald-500"
            delay={80}
          />
          <StatCard
            label="New Patients"
            value={overview?.newPatients ?? '—'}
            hint="Registered at kiosk"
            icon={<UserPlus className="h-4 w-4" />}
            accent="bg-violet-500"
            delay={160}
          />
          <StatCard
            label="Avg Intake Duration"
            value={overview ? `${overview.avgIntakeMinutes} min` : '—'}
            hint="Per completed intake"
            icon={<Timer className="h-4 w-4" />}
            accent="bg-amber-500"
            delay={240}
          />
        </div>

        {/* Secondary row: success rate + active */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Brief Success Rate"
            value={overview ? `${overview.briefSuccessRate}%` : '—'}
            hint="Briefs generated / sessions"
            icon={<FileCheck2 className="h-4 w-4" />}
            accent="bg-sky-500"
            delay={0}
          />
          <StatCard
            label="Active Sessions"
            value={overview?.activeSessions ?? '—'}
            hint="Currently in intake"
            icon={<Activity className="h-4 w-4" />}
            accent="bg-rose-500"
            delay={80}
          />
          <StatCard
            label="Avg Face Match"
            value={overview ? `${overview.faceMatchRate}%` : '—'}
            hint="Returning vs new"
            icon={<Gauge className="h-4 w-4" />}
            accent="bg-teal-500"
            delay={160}
          />
        </div>

        {/* Real-time flow board */}
        <Card className="animate-fade-in-up p-5" style={{ animationDelay: '320ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Patient Flow Board
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          </div>
          <FlowBoard stages={flow} total={flowTotal} />
        </Card>

        {/* Volume chart */}
        <Card className="animate-fade-in-up p-5" style={{ animationDelay: '400ms' }}>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
            Patient Volume
          </h2>
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-40 w-full" />
              <div className="skeleton h-3 w-48" />
            </div>
          ) : (
            <VolumeChart data={volume} />
          )}
        </Card>

        {/* Peak hours heatmap */}
        <Card className="animate-fade-in-up p-5" style={{ animationDelay: '480ms' }}>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
            Peak Clinic Hours
          </h2>
          {loading ? (
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skeleton h-9 rounded-md" />
              ))}
            </div>
          ) : (
            <HoursHeatmap data={hours} />
          )}
        </Card>

        {/* System monitoring (Phase 6.8) */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="animate-fade-in-up p-5" style={{ animationDelay: '560ms' }}>
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              API Latency
            </h2>
            {monitoringLoading ? (
              <div className="space-y-3">
                <div className="skeleton h-16 w-full" />
                <div className="skeleton h-16 w-full" />
              </div>
            ) : monitoringError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{monitoringError}</p>
            ) : latency ? (
              <LatencyPanel http={latency.http} qdrant={latency.qdrant} />
            ) : null}
          </Card>

          <Card className="animate-fade-in-up p-5" style={{ animationDelay: '640ms' }}>
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              Active Alerts
            </h2>
            {monitoringLoading ? (
              <div className="space-y-2">
                <div className="skeleton h-14 w-full" />
                <div className="skeleton h-14 w-full" />
                <div className="skeleton h-14 w-full" />
              </div>
            ) : monitoringError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{monitoringError}</p>
            ) : alerts.length > 0 ? (
              <AlertsPanel alerts={alerts} />
            ) : null}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
