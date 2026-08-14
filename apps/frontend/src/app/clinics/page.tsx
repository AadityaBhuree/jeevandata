'use client';
import { TitleSetter } from '@/components/ui/title-setter';
import { AppShell } from '@/components/layout/app-shell';

import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { clinicsApi, type Clinic } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Power, MapPin, Phone, Mail, RefreshCw } from 'lucide-react';

const CODE_RE = /^[A-Z0-9_-]+$/;

interface ClinicForm {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
}

const EMPTY_FORM: ClinicForm = { name: '', code: '', address: '', phone: '', email: '' };

function validate(form: ClinicForm): string | null {
  if (!form.name.trim()) return 'Name is required';
  if (!form.code.trim()) return 'Code is required';
  // Backend schema: /^[A-Z0-9_-]+$/ with min 2, max 20. Validate against the
  // uppercased value (submission normalizes case) so lowercase input is accepted.
  const code = form.code.trim().toUpperCase();
  if (code.length < 2 || code.length > 20) {
    return 'Code must be 2–20 characters';
  }
  if (!CODE_RE.test(code)) {
    return 'Code may only contain A-Z, 0-9, _ or -';
  }
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'Enter a valid email address';
  }
  return null;
}

export default function ClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Clinic | null>(null);
  const [form, setForm] = useState<ClinicForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clinicsApi.list();
      setClinics(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clinics');
      logger.error('Clinics load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(clinic: Clinic) {
    setEditing(clinic);
    setForm({
      name: clinic.name,
      code: clinic.code,
      address: clinic.address ?? '',
      phone: clinic.phone ?? '',
      email: clinic.email ?? '',
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationError = validate(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      };
      if (editing) {
        await clinicsApi.update(editing.id, payload);
      } else {
        await clinicsApi.create(payload);
      }
      setShowForm(false);
      await load();
      toast({
        title: editing ? 'Clinic updated' : 'Clinic created',
        description: `${form.name.trim()} was ${editing ? 'updated' : 'added'} successfully.`,
        variant: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(clinic: Clinic) {
    if (!window.confirm(`Deactivate ${clinic.name}? This can be reversed by an admin.`)) return;
    setBusyId(clinic.id);
    try {
      await clinicsApi.deactivate(clinic.id);
      await load();
      toast({
        title: 'Clinic deactivated',
        description: `${clinic.name} is now inactive.`,
        variant: 'warning',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deactivate failed';
      setError(msg);
      toast({ title: 'Deactivate failed', description: msg, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell>
      <TitleSetter title="Clinics" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Clinics</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Multi-tenancy management — ADMIN/SYSTEM only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="jeevandata"
            size="sm"
            onClick={openCreate}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Add Clinic
          </Button>
        </div>
      </div>
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

        {/* Create/Edit form */}
        {showForm && (
          <Card className="animate-fade-in-up p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              {editing ? `Edit ${editing.name}` : 'Add a clinic'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="clinic-name"
                  label="Clinic name"
                  placeholder="Sharma Multispeciality"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  id="clinic-code"
                  label="Clinic code (unique)"
                  placeholder="SMS-01"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
                <Input
                  id="clinic-address"
                  label="Address"
                  placeholder="12 MG Road, Pune"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
                <Input
                  id="clinic-phone"
                  label="Phone"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <Input
                  id="clinic-email"
                  label="Email"
                  type="email"
                  placeholder="contact@clinic.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                  {editing ? 'Save Changes' : 'Create Clinic'}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Clinic list */}
        <Card className="animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">All Clinics</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {clinics.length} clinic{clinics.length !== 1 ? 's' : ''}
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
          ) : clinics.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              No clinics yet.
              <br />
              <button
                onClick={openCreate}
                className="text-jeevandata-500 dark:text-jeevandata-400 mt-1 hover:underline"
              >
                Add your first clinic
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {clinics.map((clinic) => (
                <div
                  key={clinic.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {clinic.name}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          clinic.isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {clinic.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {clinic.code}
                      {clinic.address && (
                        <>
                          {' '}
                          · <MapPin className="inline h-3 w-3" /> {clinic.address}
                        </>
                      )}
                      {clinic.phone && (
                        <>
                          {' '}
                          · <Phone className="inline h-3 w-3" /> {clinic.phone}
                        </>
                      )}
                      {clinic.email && (
                        <>
                          {' '}
                          · <Mail className="inline h-3 w-3" /> {clinic.email}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => openEdit(clinic)}
                      aria-label={`Edit ${clinic.name}`}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {clinic.isActive && (
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        loading={busyId === clinic.id}
                        onClick={() => handleDeactivate(clinic)}
                        aria-label={`Deactivate ${clinic.name}`}
                        title="Deactivate"
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
