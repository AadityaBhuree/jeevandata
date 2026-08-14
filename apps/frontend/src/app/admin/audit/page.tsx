'use client';
import { TitleSetter } from '@/components/ui/title-setter';
import { AppShell } from '@/components/layout/app-shell';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  auditApi,
  type AuditLogRecord,
  type AuditFilters,
  type PhiAccessDay,
} from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import {
  Download,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const ROLE_OPTIONS = ['RECEPTIONIST', 'DOCTOR', 'ADMIN', 'SYSTEM'] as const;
const PAGE_SIZE = 50;

export default function AdminAuditPage() {
  // Log viewer state
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<AuditFilters>({});
  const [draft, setDraft] = useState<AuditFilters>({});
  const [filteredCount, setFilteredCount] = useState(false);

  // PHI access summary state
  const [phiPatientId, setPhiPatientId] = useState('');
  const [phiDays, setPhiDays] = useState(30);
  const [phiSummary, setPhiSummary] = useState<{
    patientId: string;
    days: number;
    totalAccesses: number;
    uniqueActors: number;
    perDay: PhiAccessDay[];
  } | null>(null);
  const [phiLoading, setPhiLoading] = useState(false);
  const [phiError, setPhiError] = useState<string | null>(null);

  // Retention state
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  // Only re-fetches when the APPLIED filters or the page change. `draft` is
  // intentionally excluded from the deps so typing in filter inputs does not
  // fire a request on every keystroke — filters apply on form submit.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditApi.getLogs(filters, page, PAGE_SIZE);
      setLogs(res.data);
      setTotal(Number(res.pagination?.total ?? 0));
      setFilteredCount(Object.values(filters).some((v) => v !== undefined && v !== ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      logger.error('Audit log load failed', err);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    auditApi
      .getRetention()
      .then((res) => setRetentionDays(res.retentionDays))
      .catch(() => {});
  }, []);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setFilters(draft);
  }

  function resetFilters() {
    setDraft({});
    setFilters({});
    setPage(1);
  }

  function setDraftValue(key: keyof AuditFilters, value: string) {
    setDraft((prev) => {
      const next = { ...prev } as AuditFilters;
      if (value === '' || value === 'ALL') {
        // Rebuild without the key to avoid dynamic delete
        const { [key]: _removed, ...rest } = next;
        return rest;
      }
      next[key] = value;
      return next;
    });
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await auditApi.exportCsv(filters);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Audit CSV export failed', err);
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const loadPhiSummary = async () => {
    if (!phiPatientId.trim()) return;
    setPhiLoading(true);
    setPhiError(null);
    try {
      const res = await auditApi.getPhiAccessSummary(phiPatientId.trim(), phiDays);
      setPhiSummary(res);
    } catch (err) {
      setPhiError(err instanceof Error ? err.message : 'Failed to load PHI summary');
      logger.error('PHI access summary failed', err);
    } finally {
      setPhiLoading(false);
    }
  };

  const runCleanup = async () => {
    if (
      !window.confirm(
        `Delete all audit logs older than ${retentionDays ?? 90} days? This is irreversible and part of the HIPAA retention policy.`,
      )
    ) {
      return;
    }
    setCleanupBusy(true);
    setCleanupResult(null);
    try {
      const res = await auditApi.runRetentionCleanup();
      setCleanupResult(`Deleted ${res.deleted} logs older than ${res.retentionDays} days.`);
      // Deleted rows may shrink the result set — go back to page 1
      setPage(1);
      setFilters({});
      setDraft({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup failed');
    } finally {
      setCleanupBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const formatDate = (iso: string) => new Date(iso).toLocaleString();

  return (
    <AppShell>
      <TitleSetter title="Audit Log" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Audit Trail</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            HIPAA compliance — filtered viewer, anonymized export
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => load()}
            loading={loading}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
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
      <div className="flex flex-col gap-6">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-400"
          >
            {error}
          </div>
        )}

        {/* Filter bar */}
        <Card className="animate-fade-in-up p-5">
          <form onSubmit={applyFilters} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <Input
              id="filter-action"
              label="Action"
              placeholder="PATIENT_PROFILE_VIEW"
              value={draft.action ?? ''}
              onChange={(e) => setDraftValue('action', e.target.value)}
            />
            <Input
              id="filter-actor"
              label="Actor"
              placeholder="user-123"
              value={draft.actorId ?? ''}
              onChange={(e) => setDraftValue('actorId', e.target.value)}
            />
            <div>
              <label
                htmlFor="filter-role"
                className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Role
              </label>
              <Select
                value={draft.actorRole ?? 'ALL'}
                onValueChange={(v) => setDraftValue('actorRole', v)}
              >
                <SelectTrigger id="filter-role">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All roles</SelectItem>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              id="filter-resource"
              label="Resource type"
              placeholder="patient"
              value={draft.resourceType ?? ''}
              onChange={(e) => setDraftValue('resourceType', e.target.value)}
            />
            <Input
              id="filter-from"
              label="From"
              type="date"
              value={draft.from ?? ''}
              onChange={(e) => setDraftValue('from', e.target.value)}
            />
            <Input
              id="filter-to"
              label="To"
              type="date"
              value={draft.to ?? ''}
              onChange={(e) => setDraftValue('to', e.target.value)}
            />
            <div className="col-span-full flex items-center gap-2">
              <Button
                type="submit"
                variant="jeevandata"
                size="sm"
                leftIcon={<Search className="h-3.5 w-3.5" />}
              >
                Apply filters
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                Reset
              </Button>
              {filteredCount && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Showing filtered results
                </span>
              )}
            </div>
          </form>
        </Card>

        {/* Log table */}
        <Card className="animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Audit logs</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {total} log{total !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              No audit logs match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                    <th className="px-5 py-3 font-medium">Timestamp</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                    <th className="px-5 py-3 font-medium">Actor</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Resource</th>
                    <th className="px-5 py-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-5 py-3">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {log.action}
                        </code>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {log.actorId}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="info" size="sm">
                          {log.actorRole}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {log.resourceType}
                        <span className="ml-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                          {log.resourceId.slice(0, 8)}…
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-400 dark:text-slate-500">
                        {log.ipAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* PHI access summary */}
          <Card className="animate-fade-in-up p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserCheck className="text-jeevandata-500 h-4 w-4" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                PHI Access Summary
              </h2>
            </div>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Who accessed a patient&apos;s record, grouped by day (HIPAA accounting of
              disclosures).
            </p>
            <div className="mb-4 flex gap-2">
              <Input
                id="phi-patient"
                label="Patient ID"
                placeholder="550e8400-…"
                value={phiPatientId}
                onChange={(e) => setPhiPatientId(e.target.value)}
              />
              <div className="w-32">
                <label
                  htmlFor="phi-days"
                  className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Days
                </label>
                <Select value={String(phiDays)} onValueChange={(v) => setPhiDays(Number(v))}>
                  <SelectTrigger id="phi-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[7, 30, 90, 365].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}d
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadPhiSummary}
                  loading={phiLoading}
                  disabled={!phiPatientId.trim()}
                  leftIcon={<Search className="h-3.5 w-3.5" />}
                >
                  Lookup
                </Button>
              </div>
            </div>

            {phiError && (
              <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
                {phiError}
              </p>
            )}

            {phiSummary && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Badge variant="info">Total accesses: {phiSummary.totalAccesses}</Badge>
                  <Badge variant="secondary">Unique actors: {phiSummary.uniqueActors}</Badge>
                </div>
                {phiSummary.perDay.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    No recorded accesses for this patient in the window.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {phiSummary.perDay.map((day) => (
                      <div
                        key={day.date}
                        className="rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {day.date}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {day.accessCount} access{day.accessCount !== 1 ? 'es' : ''} ·{' '}
                            {day.uniqueActors} actor{day.uniqueActors !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {Object.entries(day.actions).map(([action, count]) => (
                            <Badge key={action} variant="pending" size="sm">
                              {action} ×{count}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                          Actors: {day.actors.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Retention policy */}
          <Card className="animate-fade-in-up p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="text-jeevandata-500 h-4 w-4" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Log Retention Policy
              </h2>
            </div>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Audit logs are deleted after the retention window. Default is 90 days, configurable
              via{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                AUDIT_RETENTION_DAYS
              </code>
              .
            </p>
            <div className="mb-4 rounded-lg border border-slate-100 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Retention window</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {retentionDays ?? '—'} days
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button
                variant="destructive"
                size="sm"
                onClick={runCleanup}
                loading={cleanupBusy}
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Run retention cleanup
              </Button>
              {cleanupResult && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  {cleanupResult}
                </span>
              )}
            </div>
          </Card>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Exports mask PHI fields (names, mobiles, Aadhaar, emails) before download.
        </p>
      </div>
    </AppShell>
  );
}
