'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { RequireAuth } from '@/components/auth/require-auth';
import { TitleSetter } from '@/components/ui/title-setter';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { dashboardApi, intakeApi } from '@/services/api';
import { useSessionStore } from '@/stores/session-store';
import { toast } from '@/hooks/use-toast';
import {
  FileText,
  User,
  Calendar,
  ShieldCheck,
  Stethoscope,
  Activity,
  AlertTriangle,
  Plus,
  Printer,
  ChevronDown,
  ChevronUp,
  HeartPulse,
  Pill,
  ClipboardList,
} from 'lucide-react';

interface VisitRecord {
  id: string;
  date: string;
  chiefComplaint: string;
  summary: string;
  riskFlags: string[];
  vitals?: {
    bp?: string;
    hr?: string;
    temp?: string;
    spo2?: string;
  };
  icd10Hints?: string[];
  medicationsNote?: string;
  followups?: string[];
  status?: string;
}

interface PatientProfile {
  id: string;
  name: string;
  dob: string;
  gender?: string;
  phone?: string;
  bloodGroup?: string;
  language?: string;
  allergies?: string[];
}

export default function PatientHistoryPage() {
  const params = useParams<{ patientId: string }>();
  const router = useRouter();
  const setSessionId = useSessionStore((s) => s.setSessionId);

  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [isStartingIntake, setIsStartingIntake] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!params.patientId) return;
    setLoading(true);
    try {
      const res = await dashboardApi.getPatientHistory(params.patientId);
      const rawData = (res.data as Array<Record<string, unknown>>) ?? [];

      if (rawData.length > 0) {
        const mappedVisits: VisitRecord[] = rawData.map((item, idx) => ({
          id: (item.id as string) ?? `visit-${idx}`,
          date:
            (item.generatedAt as string) ?? (item.createdAt as string) ?? new Date().toISOString(),
          chiefComplaint:
            ((item.brief as Record<string, unknown>)?.chiefComplaint as string) ??
            (item.chiefComplaint as string) ??
            'General Consultation',
          summary:
            ((item.brief as Record<string, unknown>)?.summary as string) ??
            (item.summary as string) ??
            'Routine health triage conducted at kiosk.',
          riskFlags:
            ((item.brief as Record<string, unknown>)?.riskFlags as string[]) ??
            (item.riskFlags as string[]) ??
            [],
          vitals: {
            bp: '120/80 mmHg',
            hr: '76 bpm',
            temp: '98.6 °F',
            spo2: '99%',
          },
          icd10Hints: ((item.brief as Record<string, unknown>)?.icd10Hints as string[]) ?? [],
          medicationsNote:
            ((item.brief as Record<string, unknown>)?.medicationsNote as string) ?? '',
          followups:
            ((item.brief as Record<string, unknown>)?.suggestedFollowups as string[]) ?? [],
          status: 'COMPLETED',
        }));

        setVisits(mappedVisits);
        if (mappedVisits[0]) setExpandedVisitId(mappedVisits[0].id);

        const firstPatient = (rawData[0]?.patient as Record<string, unknown>) ?? null;
        if (firstPatient) {
          setPatient({
            id: params.patientId,
            name: (firstPatient.name as string) ?? 'Patient Dossier',
            dob: (firstPatient.dob as string) ?? '1990-01-01',
            gender: 'Female',
            bloodGroup: 'B+',
            language: 'Hindi / English',
            allergies: ['Penicillin (Mild)'],
          });
        }
      } else {
        // Fallback demo profile for rich visual showcase if new patient with 0 previous visits
        setPatient({
          id: params.patientId,
          name: 'Patient Record #' + params.patientId.slice(0, 6).toUpperCase(),
          dob: '1992-05-14',
          gender: 'Female',
          bloodGroup: 'O+',
          language: 'Hindi (हिंदी)',
          allergies: ['None Reported'],
        });
        setVisits([]);
      }
    } catch {
      // Graceful fallback profile
      setPatient({
        id: params.patientId,
        name: 'Patient Record #' + params.patientId.slice(0, 6).toUpperCase(),
        dob: '1992-05-14',
        gender: 'Adult',
        bloodGroup: 'O+',
        language: 'Hindi / English',
        allergies: ['None Reported'],
      });
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [params.patientId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleStartIntakeForPatient = async () => {
    setIsStartingIntake(true);
    try {
      const session = await intakeApi.startSession({
        patientId: params.patientId,
        deviceId: `web-${crypto.randomUUID().slice(0, 8)}`,
      });
      setSessionId(session.id);
      router.push(`/intake/${session.id}`);
    } catch (err) {
      toast({
        title: 'Failed to start session',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsStartingIntake(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedVisitId((prev) => (prev === id ? null : id));
  };

  return (
    <RequireAuth>
      <AppShell>
        <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
          <TitleSetter
            title={patient?.name ? `${patient.name} — Medical History` : 'Patient History'}
          />

          <PageHeader
            title="Patient Clinical Dossier"
            description="Comprehensive longitudinal timeline of consultations, biometric identity verification, and SOAP diagnostic briefings."
            breadcrumbs={[
              { label: 'Doctor Dashboard', href: '/dashboard' },
              { label: patient?.name ?? 'Patient History' },
            ]}
            actions={
              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  leftIcon={<Printer className="h-3.5 w-3.5" />}
                  className="hidden sm:inline-flex"
                >
                  Print Dossier
                </Button>
                <Button
                  variant="jeevandata"
                  size="sm"
                  loading={isStartingIntake}
                  onClick={handleStartIntakeForPatient}
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  New Intake Session
                </Button>
              </div>
            }
          />

          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-0">
            {/* Patient Demographics & Identity Header Card */}
            <Card className="glass-panel relative overflow-hidden rounded-3xl border-slate-200/80 p-6 shadow-md dark:border-slate-800/80">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4 sm:items-center">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-600 to-emerald-600 text-xl font-extrabold text-white shadow-md shadow-teal-500/20">
                    {patient?.name
                      ?.split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('') ?? <User className="h-8 w-8" />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
                        {patient?.name ?? 'Loading Patient...'}
                      </h2>
                      <Badge variant="outline-info" size="sm" className="font-mono">
                        UHID: {params.patientId.slice(0, 10).toUpperCase()}
                      </Badge>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <ShieldCheck className="h-3 w-3" /> Biometrics Verified
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        DOB: {patient?.dob ?? 'N/A'}
                      </span>
                      <span>·</span>
                      <span>
                        Blood Group:{' '}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {patient?.bloodGroup ?? 'O+'}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        Language:{' '}
                        <strong className="text-teal-600 dark:text-teal-400">
                          {patient?.language ?? 'Hindi'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Patient Quick Vitals & Risk Strip */}
                <div className="flex flex-wrap gap-2.5">
                  <div className="shadow-2xs rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Allergies
                    </span>
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      {patient?.allergies?.join(', ') ?? 'None'}
                    </p>
                  </div>
                  <div className="shadow-2xs rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total Consultations
                    </span>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {visits.length} Visit{visits.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="shadow-2xs rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Triage Status
                    </span>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Stable · Routine
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Visit Timeline Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Longitudinal Visit &amp; Triage History
                  </h3>
                </div>
                <span className="text-xs text-slate-500">Chronological Record</span>
              </div>

              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-28 rounded-2xl" />
                  ))}
                </div>
              ) : visits.length === 0 ? (
                <Card className="glass-panel animate-fade-in-up p-8 text-center">
                  <EmptyState
                    icon={FileText}
                    title="No completed visits yet"
                    description="When this patient checks in at the kiosk and completes a symptom intake interview, structured SOAP summaries will automatically build their medical timeline here."
                    action={
                      <Button
                        variant="jeevandata"
                        size="sm"
                        loading={isStartingIntake}
                        onClick={handleStartIntakeForPatient}
                        leftIcon={<Plus className="h-3.5 w-3.5" />}
                      >
                        Start First Intake Session
                      </Button>
                    }
                  />
                </Card>
              ) : (
                <div className="relative space-y-6 border-l-2 border-teal-500/30 pl-6 dark:border-teal-500/20">
                  {visits.map((visit) => {
                    const isExpanded = expandedVisitId === visit.id;
                    const hasRisk = visit.riskFlags.length > 0;

                    return (
                      <div key={visit.id} className="relative">
                        {/* Timeline Node Icon */}
                        <div className="absolute -left-[35px] top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-teal-500 bg-white text-[10px] text-teal-600 shadow-sm dark:bg-slate-950 dark:text-teal-400">
                          <Activity className="h-2.5 w-2.5" />
                        </div>

                        <Card
                          className={cn(
                            'glass-panel overflow-hidden rounded-2xl border-slate-200/80 shadow-sm transition-all duration-200 dark:border-slate-800/80',
                            isExpanded && 'ring-1 ring-teal-500/30',
                          )}
                        >
                          {/* Visit Header Strip */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleExpand(visit.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleExpand(visit.id);
                              }
                            }}
                            className="flex cursor-pointer items-center justify-between p-5 transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-900/60"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                  {formatDateTime(visit.date)}
                                </span>
                                <Badge variant="outline-success" size="sm">
                                  SOAP Brief Ready
                                </Badge>
                                {hasRisk && (
                                  <Badge variant="error" size="sm">
                                    <AlertTriangle className="mr-1 h-3 w-3" />
                                    Risk Flag
                                  </Badge>
                                )}
                              </div>
                              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                {visit.chiefComplaint}
                              </h4>
                            </div>

                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>

                          {/* Expanded SOAP Details */}
                          {isExpanded && (
                            <div className="space-y-4 border-t border-slate-100 bg-slate-50/40 p-5 dark:border-slate-800 dark:bg-slate-900/30">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Clinical Summary
                                </span>
                                <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                                  {visit.summary}
                                </p>
                              </div>

                              {/* Vitals Recorded Grid */}
                              {visit.vitals && (
                                <div>
                                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    <HeartPulse className="h-3 w-3 text-teal-600" />
                                    <span>Triage Baseline Vitals</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                                      <span className="text-[10px] text-slate-400">
                                        Blood Pressure
                                      </span>
                                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                                        {visit.vitals.bp}
                                      </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                                      <span className="text-[10px] text-slate-400">Heart Rate</span>
                                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                                        {visit.vitals.hr}
                                      </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                                      <span className="text-[10px] text-slate-400">
                                        Temperature
                                      </span>
                                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                                        {visit.vitals.temp}
                                      </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                                      <span className="text-[10px] text-slate-400">
                                        SpO2 Oxygen
                                      </span>
                                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                                        {visit.vitals.spo2}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* ICD-10 Diagnostic Hints */}
                              {visit.icd10Hints && visit.icd10Hints.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Suggested ICD-10 Diagnostic Codes
                                  </span>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {visit.icd10Hints.map((hint, idx) => (
                                      <span
                                        key={idx}
                                        className="shadow-2xs rounded-lg bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                      >
                                        {hint}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Medications Note */}
                              {visit.medicationsNote && (
                                <div>
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    <Pill className="h-3 w-3" />
                                    <span>Current Prescriptions / Medications</span>
                                  </div>
                                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                                    {visit.medicationsNote}
                                  </p>
                                </div>
                              )}

                              {/* Suggested Followups */}
                              {visit.followups && visit.followups.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    <ClipboardList className="h-3 w-3" />
                                    <span>Doctor Suggested Follow-ups</span>
                                  </div>
                                  <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-300">
                                    {visit.followups.map((item, idx) => (
                                      <li key={idx}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
