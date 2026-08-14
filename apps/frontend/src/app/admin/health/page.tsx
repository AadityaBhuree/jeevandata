'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { healthApi, type HealthSummary, type DependencyCheck } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DarkModeToggle } from '@/components/ui/dark-mode-toggle';
import { logger } from '@/lib/logger';
import { Activity, RefreshCw, HeartPulse, Database, Timer } from 'lucide-react';

// Auto-refresh interval (ms) — the page re-polls /health every 30s.
const REFRESH_MS = 30_000;
// A check slower than this (ms) is shown as "degraded" (yellow) even if healthy.
const SLOW_THRESHOLD_MS = 1_000;

const DEPENDENCY_LABELS: Record<string, string> = {
  database: 'PostgreSQL',
  redis: 'Redis',
  qdrant: 'Qdrant',
  whisper: 'Whisper (STT)',
};

function statusVariant(check: DependencyCheck): 'success' | 'warning' | 'error' {
  if (check.status === 'unhealthy') return 'error';
  if (check.latencyMs > SLOW_THRESHOLD_MS) return 'warning';
  return 'success';
}

function statusLabel(check: DependencyCheck): string {
  if (check.status === 'unhealthy') return 'Down';
  if (check.latencyMs > SLOW_THRESHOLD_MS) return 'Degraded';
  return 'Up';
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      // /health returns 503 (with the checks in error.details) when any
      // dependency is down — so a failed call can still yield full detail.
      const summary = await healthApi.getSummary();
      setHealth(summary);
      setError(null);
    } catch (err) {
      const details = (err as { details?: Record<string, unknown> })?.details;
      if (details && 'checks' in details && typeof details.checks === 'object') {
        setHealth(details as unknown as HealthSummary);
      } else {
        setHealth(null);
      }
      setError(err instanceof Error ? err.message : 'Health check failed');
      logger.error('Admin health load failed', { error: err });
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  // Initial load + 30s auto-refresh
  useEffect(() => {
    load();
    timerRef.current = setInterval(load, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  const overallVariant: 'success' | 'error' | 'warning' =
    health?.status === 'unhealthy' ? 'error' : error ? 'warning' : 'success';

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HeartPulse className="text-jeevandata-500 h-6 w-6" />
            <h1 className="text-2xl font-semibold">System Health</h1>
          </div>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Overall status */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-slate-400" />
              <span className="font-medium">Overall</span>
            </div>
            <Badge variant={overallVariant}>
              {health?.status === 'unhealthy' ? 'Unhealthy' : error ? 'Degraded' : 'Healthy'}
            </Badge>
          </div>
          {lastUpdated && (
            <p className="mt-3 text-xs text-slate-400">
              Last checked: {lastUpdated.toLocaleTimeString()} · auto-refreshes every 30s
            </p>
          )}
          {error && health === null && (
            <p className="mt-3 text-sm text-red-500 dark:text-red-400">
              Could not reach the backend: {error}
            </p>
          )}
        </Card>

        {/* Dependency checks */}
        <div className="space-y-3">
          {loading && !health ? (
            <Card className="p-5">
              <p className="text-sm text-slate-400">Checking dependencies…</p>
            </Card>
          ) : health ? (
            Object.entries(health.checks).map(([name, check]) => (
              <Card key={name} className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4 text-slate-400" />
                    <span className="font-medium">{DEPENDENCY_LABELS[name] ?? name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Timer className="h-3.5 w-3.5" />
                      {`${check.latencyMs.toLocaleString()} ms`}
                    </span>
                    <Badge variant={statusVariant(check)}>{statusLabel(check)}</Badge>
                  </div>
                </div>
                {check.error && (
                  <p className="mt-2 text-xs text-red-500 dark:text-red-400">{check.error}</p>
                )}
              </Card>
            ))
          ) : (
            <Card className="p-5">
              <p className="text-sm text-red-500 dark:text-red-400">
                No health data available — is the backend running?
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
