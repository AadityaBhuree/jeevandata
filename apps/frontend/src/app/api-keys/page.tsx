'use client';
import { TitleSetter } from '@/components/ui/title-setter';
import { AppShell } from '@/components/layout/app-shell';

import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { apiKeysApi, type ApiKeyRecord } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { Plus, Copy, Check, Trash2, RefreshCw, ShieldCheck, KeyRound } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // One-time display of a freshly created key
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiKeysApi.list();
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
      logger.error('API keys load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setName('');
    setExpiresInDays('');
    setFormError(null);
    setRevealedKey(null);
    setShowForm(true);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }
    const days = expiresInDays.trim() ? Number(expiresInDays) : undefined;
    if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 365)) {
      setFormError('Expiry must be an integer between 1 and 365 days');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const created = await apiKeysApi.create({
        name: name.trim(),
        expiresInDays: days,
      });
      setRevealedKey(created.apiKey);
      setCopied(false);
      setName('');
      setExpiresInDays('');
      await load();
      toast({
        title: 'API key generated',
        description: 'Copy it now — the raw key is shown only once.',
        variant: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Create failed';
      setFormError(msg);
      toast({ title: 'Create failed', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function copyKey() {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. non-secure context) — user can copy manually
    }
  }

  async function handleRevoke(key: ApiKeyRecord) {
    if (
      !window.confirm(
        `Revoke "${key.name}" (${key.prefix})? External systems using it will stop working.`,
      )
    ) {
      return;
    }
    setBusyId(key.id);
    try {
      await apiKeysApi.revoke(key.id);
      await load();
      toast({
        title: 'API key revoked',
        description: `${key.name} can no longer authenticate.`,
        variant: 'warning',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Revoke failed';
      setError(msg);
      toast({ title: 'Revoke failed', description: msg, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

  return (
    <AppShell>
      <TitleSetter title="API Keys" />

      <PageHeader
        title="API Keys"
        description="External integration keys — PMS & telemetry authentication"
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'API Keys' }]}
        actions={
          <Button
            variant="jeevandata"
            size="sm"
            onClick={openCreate}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Generate Key
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-400"
          >
            <span>{error}</span>
            <button onClick={load} className="flex items-center gap-1 text-xs underline">
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <Card className="animate-fade-in-up p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              Generate an API key
            </h2>
            <form onSubmit={handleCreate} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="key-name"
                  label="Key name"
                  placeholder="PMS integration"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  description="Descriptive identifier for this integration service"
                />
                <Input
                  id="key-expiry"
                  label="Expiry (days, optional)"
                  type="number"
                  min={1}
                  max={365}
                  placeholder="90"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  description="Leave empty for a non-expiring API token"
                />
              </div>

              {formError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="jeevandata" loading={saving}>
                  Generate Key
                </Button>
              </div>
            </form>

            {revealedKey && (
              <div
                role="status"
                className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/20"
              >
                <p className="mb-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  Your new key — copy it now, it won&apos;t be shown again
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-white px-2 py-1.5 text-xs text-slate-800 ring-1 ring-emerald-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-emerald-900">
                    {revealedKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyKey}
                    leftIcon={
                      copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />
                    }
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Key list */}
        <Card className="animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Keys</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {keys.length} key{keys.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-40" />
                    <div className="skeleton h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : keys.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No API keys generated"
              description="Create API keys for external Electronic Health Record (EHR) or PMS system integration."
              action={
                <Button
                  variant="jeevandata-outline"
                  size="sm"
                  onClick={openCreate}
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Generate your first key
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {keys.map((key) => {
                const active = key.isActive && !key.revokedAt;
                return (
                  <div
                    key={key.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {key.name}
                        </h3>
                        <Badge variant={active ? 'success' : 'error'} size="sm">
                          {active ? 'Active' : 'Revoked'}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">
                          {key.prefix}…
                        </code>
                        {' · '}created {formatDate(key.createdAt)}
                        {key.expiresAt && ` · expires ${formatDate(key.expiresAt)}`}
                        {key.lastUsedAt && ` · last used ${formatDate(key.lastUsedAt)}`}
                      </p>
                    </div>
                    {active && (
                      <Button
                        variant="destructive"
                        size="sm"
                        loading={busyId === key.id}
                        onClick={() => handleRevoke(key)}
                        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Only the SHA-256 hash of each key is stored — raw keys are shown once at creation.
        </p>
      </div>
    </AppShell>
  );
}
