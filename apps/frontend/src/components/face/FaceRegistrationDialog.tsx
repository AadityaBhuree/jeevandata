'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useFaceStore } from '@/stores/face-store';
import { useOfflineStore } from '@/stores/offline-store';
import { faceApi } from '@/services/api';
import { cachePatient } from '@/services/db';
import { enqueueIntakeMutation } from '@/services/sync';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  User,
  Calendar,
  Phone,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Camera,
} from 'lucide-react';

interface FaceRegistrationDialogProps {
  /** The face embedding from the detection pipeline */
  embedding: number[] | null;
  /** Called when registration is complete */
  onRegistered: (patientId: string, patientName: string) => void;
  /** Called when cancelled */
  onCancel: () => void;
  isOpen: boolean;
}

type RegistrationStep = 'name' | 'details' | 'consent' | 'success';

function formatMobile(value: string): string {
  // Strip non-digit chars except leading +
  const cleaned = value.replace(/[^\d+]/g, '');
  // Ensure + prefix for international format
  if (cleaned.length > 0 && !cleaned.startsWith('+')) {
    return '+' + cleaned.replace(/^0+/, '');
  }
  return cleaned;
}

function isValidAge(dob: string): boolean {
  if (!dob) return false;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 && age <= 120;
}

export function FaceRegistrationDialog({
  embedding,
  onRegistered,
  onCancel,
  isOpen,
}: FaceRegistrationDialogProps) {
  const livenessStatus = useFaceStore((s) => s.livenessStatus);

  const [step, setStep] = useState<RegistrationStep>('name');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registeredName, setRegisteredName] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);
  const dobInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Auto-focus first field on step change
  useEffect(() => {
    if (step === 'name') nameInputRef.current?.focus();
    if (step === 'details') dobInputRef.current?.focus();
  }, [step]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && step !== 'success') onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, step]);

  const resetForm = useCallback(() => {
    setStep('name');
    setName('');
    setDob('');
    setMobile('');
    setConsent(false);
    setError(null);
    setIsRegistering(false);
    setRegisteredName('');
  }, []);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen, resetForm]);

  if (!isOpen) return null;

  // ─── Embedding not ready yet — show waiting state ────────
  if (!embedding) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Waiting for face data"
          className="animate-scale-in-center relative w-full max-w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/50">
            <Camera className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Capturing face data...
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Please hold still while we process your face scan.
          </p>
          <div className="mx-auto mt-4 h-2 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="from-jeevandata-400 to-jeevandata-600 h-full animate-[shimmer_1.5s_linear_infinite] rounded-full bg-gradient-to-r" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ─── Step Validators ────────────────────────────────────────────

  function validateName(): boolean {
    setError(null);
    if (!name.trim()) {
      setError('Patient name is required');
      return false;
    }
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return false;
    }
    if (name.trim().length > 200) {
      setError('Name is too long (max 200 characters)');
      return false;
    }
    if (!/^[\p{L}\p{M}\s.'-]+$/u.test(name.trim())) {
      setError('Name contains invalid characters');
      return false;
    }
    return true;
  }

  function validateDetails(): boolean {
    setError(null);

    if (!dob) {
      setError('Date of birth is required');
      return false;
    }
    if (!isValidAge(dob)) {
      setError('Patient age must be between 0 and 120 years');
      return false;
    }

    const formattedMobile = formatMobile(mobile);
    if (!/^\+?[1-9]\d{9,14}$/.test(formattedMobile)) {
      setError('Enter a valid mobile number (e.g., +919876543210)');
      return false;
    }
    if (formattedMobile.replace(/\D/g, '').length < 10) {
      setError('Mobile number must have at least 10 digits');
      return false;
    }

    return true;
  }

  // ─── Step Handlers ──────────────────────────────────────────────

  function handleNameContinue() {
    if (validateName()) setStep('details');
  }

  function handleDetailsContinue() {
    if (validateDetails()) setStep('consent');
  }

  async function handleRegister() {
    setError(null);

    if (!consent) {
      setError('Patient consent is required to store facial data');
      return;
    }
    if (!embedding) {
      setError('No face data captured. Please try again.');
      return;
    }
    if (livenessStatus !== 'verified') {
      setError('Liveness check not passed. Please complete the blink challenge.');
      return;
    }

    const payload = {
      name: name.trim(),
      dob,
      mobile: formatMobile(mobile),
      consent,
      embedding,
    };

    setIsRegistering(true);
    try {
      const result = await faceApi.registerPatient(payload);

      setRegisteredName(result.name);
      setStep('success');

      // Cache the patient locally for offline lookup
      void cachePatient({
        id: result.id,
        name: result.name,
        dob,
        mobile: formatMobile(mobile),
        lastSyncedAt: new Date().toISOString(),
        data: {},
      }).catch(() => {});

      // Auto-transition to intake after showing success for 2 seconds
      setTimeout(() => {
        onRegistered(result.id, result.name);
      }, 2000);
    } catch (err) {
      // Offline — queue registration for replay, then continue with a temp id
      if (!useOfflineStore.getState().isOnline) {
        await enqueueIntakeMutation('REGISTER_PATIENT', payload).catch(() => {});
        const tempId = `offline-${Date.now()}`;
        setRegisteredName(payload.name);
        setStep('success');
        setTimeout(() => {
          onRegistered(tempId, payload.name);
        }, 2000);
        return;
      }

      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
    } finally {
      setIsRegistering(false);
    }
  }

  // ─── Step Indicators ────────────────────────────────────────────

  const steps = [
    { key: 'name', label: 'Name', icon: User },
    { key: 'details', label: 'Details', icon: Calendar },
    { key: 'consent', label: 'Consent', icon: ShieldCheck },
  ] as const;

  function getStepIndex(s: RegistrationStep): number {
    return steps.findIndex((st) => st.key === s);
  }

  const currentStepIndex = getStepIndex(step);

  // ─── Render: Step 1 - Name ──────────────────────────────────────
  function renderNameStep() {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="text-center">
          <div className="bg-jeevandata-100 dark:bg-jeevandata-900/50 mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl">
            <User className="text-jeevandata-600 dark:text-jeevandata-400 h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            What is your name?
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Enter the patient&apos;s full name as it appears on their ID
          </p>
        </div>

        <input
          ref={nameInputRef}
          id="reg-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleNameContinue()}
          placeholder="e.g., Priya Sharma"
          maxLength={200}
          aria-label="Full name"
          aria-invalid={!!error}
          aria-describedby={error ? 'face-reg-dialog-error' : undefined}
          className="focus:border-jeevandata-500 focus:ring-jeevandata-500 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          disabled={isRegistering}
        />

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
            disabled={isRegistering}
          >
            Cancel
          </button>
          <button
            onClick={handleNameContinue}
            className="bg-jeevandata-500 hover:bg-jeevandata-600 focus:ring-jeevandata-500 flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Step 2 - DOB & Mobile ──────────────────────────────
  function renderDetailsStep() {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/50">
            <Calendar className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Patient Details</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Date of birth and contact information
          </p>
        </div>

        {/* DOB */}
        <div>
          <label
            htmlFor="reg-dob"
            className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Date of Birth
          </label>
          <input
            id="reg-dob"
            ref={dobInputRef}
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            min="1900-01-01"
            aria-invalid={!!error}
            aria-describedby={error ? 'face-reg-dialog-error' : undefined}
            className="focus:border-jeevandata-500 focus:ring-jeevandata-500 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            disabled={isRegistering}
          />
          {dob && !isValidAge(dob) && (
            <p className="mt-1 text-xs text-red-500">Age must be between 0 and 120 years</p>
          )}
        </div>

        {/* Mobile */}
        <div>
          <label
            htmlFor="reg-mobile"
            className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Mobile Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="reg-mobile"
              ref={mobileInputRef}
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(formatMobile(e.target.value))}
              placeholder="+919876543210"
              maxLength={15}
              aria-invalid={!!error}
              aria-describedby={error ? 'face-reg-dialog-error' : undefined}
              className="focus:border-jeevandata-500 focus:ring-jeevandata-500 w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              disabled={isRegistering}
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => setStep('name')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
            disabled={isRegistering}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={handleDetailsContinue}
            disabled={isRegistering}
            className="bg-jeevandata-500 hover:bg-jeevandata-600 focus:ring-jeevandata-500 flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Step 3 - Consent ───────────────────────────────────
  function renderConsentStep() {
    return (
      <div className="animate-fade-in space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/50">
            <ShieldCheck className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Review & Consent</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Please review the information and provide consent
          </p>
        </div>

        {/* Summary Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Name</span>
              <span className="font-medium text-slate-900 dark:text-white">{name.trim()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Date of Birth</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {new Date(dob).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Mobile</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {formatMobile(mobile)}
              </span>
            </div>
          </div>
        </div>

        {/* Liveness Warning */}
        {livenessStatus !== 'verified' && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800">
            ⚠ Liveness check required. Please look at the camera and blink naturally when prompted.
            This must be completed before registering.
          </div>
        )}

        {/* Consent Checkbox */}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="text-jeevandata-500 focus:ring-jeevandata-500 mt-0.5 h-5 w-5 rounded border-slate-300 dark:border-slate-600"
            disabled={isRegistering}
          />
          <div>
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              I give my consent
            </span>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              I authorize the capture and storage of my facial data for identification purposes
              during clinic visits. This data will be encrypted and stored securely in accordance
              with applicable privacy regulations. I understand I can withdraw consent at any time.
            </p>
          </div>
        </label>

        {/* Navigation */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => setStep('details')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
            disabled={isRegistering}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={handleRegister}
            disabled={isRegistering || !consent || livenessStatus !== 'verified'}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRegistering ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Registering...
              </span>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirm & Register
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Step 4 - Success ───────────────────────────────────
  function renderSuccessStep() {
    return (
      <div
        role="status"
        aria-live="polite"
        className="animate-scale-in-center flex flex-col items-center py-6 text-center"
      >
        {/* Animated success circle */}
        <div className="relative mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          {/* Animated rings */}
          <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />
          <div
            className="absolute inset-0 rounded-full bg-emerald-400/10"
            style={{
              animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
              animationDelay: '0.3s',
            }}
          />
        </div>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          Welcome, {registeredName}!
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Patient registered successfully. Redirecting to intake...
        </p>

        {/* Progress bar */}
        <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full animate-[shimmer_2s_linear_infinite] rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
        </div>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Preparing AI intake conversation...
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="face-reg-dialog-title"
        aria-describedby={error ? 'face-reg-dialog-error' : 'face-reg-dialog-desc'}
        className="animate-scale-in-center relative w-full max-w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        {/* Step Progress Bar */}
        {step !== 'success' && (
          <div
            role="list"
            aria-label="Registration progress"
            className="flex items-center gap-1.5 px-6 pb-0 pt-6"
          >
            {steps.map((s, i) => (
              <div key={s.key} role="listitem" className="flex flex-1 items-center gap-1.5">
                <div
                  aria-hidden="true"
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all duration-300',
                    i < currentStepIndex
                      ? 'bg-emerald-500 text-white'
                      : i === currentStepIndex
                        ? 'bg-jeevandata-500 ring-jeevandata-200 dark:ring-jeevandata-800 text-white ring-2'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
                  )}
                >
                  {i < currentStepIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span
                  className="sr-only"
                  aria-current={i === currentStepIndex ? 'step' : undefined}
                >
                  Step {i + 1}: {s.label}
                  {i < currentStepIndex ? ' (completed)' : ''}
                  {i === currentStepIndex ? ' (current)' : ''}
                </span>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1 rounded-full transition-all duration-300',
                      i < currentStepIndex ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700',
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-6">
          {/* Visually-hidden description for screen readers */}
          <p id="face-reg-dialog-desc" className="sr-only">
            Patient registration with name, date of birth, and mobile number
          </p>
          {/* Error */}
          {error && (
            <div
              id="face-reg-dialog-error"
              role="alert"
              className={cn(
                'mb-4 rounded-xl p-3 text-xs ring-1',
                'bg-red-50 text-red-600 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-800',
              )}
            >
              {error}
            </div>
          )}

          {step === 'name' && renderNameStep()}
          {step === 'details' && renderDetailsStep()}
          {step === 'consent' && renderConsentStep()}
          {step === 'success' && renderSuccessStep()}
        </div>
      </div>
    </div>
  );
}
