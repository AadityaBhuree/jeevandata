import { SessionStatus } from '@jeevandata/shared-types';

/**
 * Single source of truth for rendering session statuses across the app.
 *
 * The backend FSM emits UPPER_SNAKE statuses (SessionStatus) over Socket.IO
 * and REST. This map turns any status — including legacy snake_case values
 * from older clients/stores — into a stable label, tone, and dot color so
 * the UI never renders a blank chip.
 */

export interface SessionStatusInfo {
  /** Human-readable label, e.g. "Intake in progress" */
  label: string;
  /** Semantic tone used by Badge variants */
  variant: 'success' | 'warning' | 'error' | 'info' | 'pending';
  /** Tailwind classes for the header chip */
  chipClass: string;
  /** Tailwind classes for a small status dot */
  dotClass: string;
}

type StatusKey = string;

const STATUS_MAP: Record<StatusKey, Omit<SessionStatusInfo, 'label'> & { label?: string }> = {
  [SessionStatus.INITIATED]: {
    variant: 'pending',
    chipClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    dotClass: 'bg-slate-400',
    label: 'Waiting for camera',
  },
  [SessionStatus.FACE_MATCHED]: {
    variant: 'info',
    chipClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dotClass: 'bg-blue-500',
    label: 'Patient identified',
  },
  [SessionStatus.CONTEXT_LOADED]: {
    variant: 'info',
    chipClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dotClass: 'bg-blue-500',
    label: 'Context loaded',
  },
  [SessionStatus.INTAKE_IN_PROGRESS]: {
    variant: 'warning',
    chipClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    dotClass: 'bg-amber-500',
    label: 'Intake in progress',
  },
  [SessionStatus.TRANSCRIBING]: {
    variant: 'warning',
    chipClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    dotClass: 'bg-amber-500',
    label: 'Transcribing',
  },
  [SessionStatus.BRIEF_GENERATED]: {
    variant: 'success',
    chipClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
    label: 'Brief ready',
  },
  [SessionStatus.SYNCED]: {
    variant: 'success',
    chipClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
    label: 'Synced',
  },
  [SessionStatus.COMPLETED]: {
    variant: 'success',
    chipClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
    label: 'Completed',
  },
  [SessionStatus.FAILED]: {
    variant: 'error',
    chipClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    dotClass: 'bg-red-500',
    label: 'Failed',
  },
  [SessionStatus.TIMED_OUT]: {
    variant: 'error',
    chipClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    dotClass: 'bg-red-500',
    label: 'Timed out',
  },

  // Legacy snake_case values (older frontend store) — normalize to the same rendering
  idle: {
    variant: 'pending',
    chipClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    dotClass: 'bg-slate-400',
    label: 'Waiting',
  },
  detecting: {
    variant: 'info',
    chipClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dotClass: 'bg-blue-500',
    label: 'Detecting face',
  },
  face_matched: {
    variant: 'info',
    chipClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dotClass: 'bg-blue-500',
    label: 'Patient identified',
  },
  context_loaded: {
    variant: 'info',
    chipClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dotClass: 'bg-blue-500',
    label: 'Context loaded',
  },
  intake_in_progress: {
    variant: 'warning',
    chipClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    dotClass: 'bg-amber-500',
    label: 'Intake in progress',
  },
  transcribing: {
    variant: 'warning',
    chipClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    dotClass: 'bg-amber-500',
    label: 'Transcribing',
  },
  brief_generated: {
    variant: 'success',
    chipClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
    label: 'Brief ready',
  },
  ready: {
    variant: 'success',
    chipClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
    label: 'Ready',
  },
  synced: {
    variant: 'success',
    chipClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
    label: 'Synced',
  },
  completed: {
    variant: 'success',
    chipClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
    label: 'Completed',
  },
  failed: {
    variant: 'error',
    chipClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    dotClass: 'bg-red-500',
    label: 'Failed',
  },
  error: {
    variant: 'error',
    chipClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    dotClass: 'bg-red-500',
    label: 'Error',
  },
  timed_out: {
    variant: 'error',
    chipClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    dotClass: 'bg-red-500',
    label: 'Timed out',
  },
};

const FALLBACK: SessionStatusInfo = {
  label: 'Processing',
  variant: 'pending',
  chipClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  dotClass: 'bg-slate-400',
};

/** Resolve a status (any casing) to its display info. Never returns undefined. */
export function getSessionStatusInfo(status?: string | null): SessionStatusInfo {
  if (!status) return FALLBACK;
  const key = status.trim().toLowerCase();
  const entry = STATUS_MAP[key] ?? STATUS_MAP[status];
  if (!entry) return FALLBACK;
  return {
    label: entry.label ?? FALLBACK.label,
    variant: entry.variant,
    chipClass: entry.chipClass,
    dotClass: entry.dotClass,
  };
}

/** Human-readable label, e.g. "INTAKE_IN_PROGRESS" -> "Intake In Progress". */
export function getSessionStatusText(status?: string | null): string {
  return getSessionStatusInfo(status).label;
}
