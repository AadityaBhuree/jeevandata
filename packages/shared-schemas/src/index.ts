import { z } from 'zod';

// ─── Patient Schemas ────────────────────────────────────────────

export const createPatientSchema = z.object({
  name: z.string().min(1).max(200),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  mobile: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid mobile number'),
  aadhaarRef: z.string().length(64).optional().nullable(),
  consentGranted: z.boolean().default(false),
});

export const updatePatientSchema = createPatientSchema.partial();

export const patientQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['name', 'createdAt', 'dob']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Face Embedding Schema ──────────────────────────────────────

export const faceEmbeddingSchema = z.object({
  patientId: z.string().uuid(),
  vector: z.array(z.number()).length(512),
  capturedAt: z.string().datetime().optional(),
});

export const faceSearchQuerySchema = z.object({
  vector: z.array(z.number()).length(512),
  threshold: z.number().min(0).max(1).default(0.82),
  limit: z.coerce.number().int().positive().max(10).default(5),
});

// ─── Symptom Schemas ────────────────────────────────────────────

export const symptomEntrySchema = z.object({
  name: z.string().min(1).max(300),
  duration: z.string().min(1).max(100),
  severity: z.number().int().min(1).max(10),
});

// ─── Intake Schemas ─────────────────────────────────────────────

export const intakeDataSchema = z.object({
  // The kiosk UI creates sessions before face match, so the patient is only
  // known once the face match succeeds. The complete payload therefore may
  // carry the matched patientId, which the backend persists onto the session.
  patientId: z.string().uuid().optional(),
  chiefComplaint: z.string().min(1).max(2000),
  symptoms: z.array(symptomEntrySchema).min(0).max(50),
  associated: z.array(z.string()).max(20),
  medicationChanges: z.string().max(1000).default(''),
  allergyUpdates: z.string().max(1000).default(''),
  patientNotes: z.string().max(5000).default(''),
});

export const startIntakeSessionSchema = z.object({
  patientId: z.string().uuid().optional().nullable(),
  deviceId: z.string().min(1).max(100),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const updateIntakeSessionSchema = z.object({
  status: z.enum([
    'INITIATED',
    'FACE_MATCHED',
    'CONTEXT_LOADED',
    'INTAKE_IN_PROGRESS',
    'TRANSCRIBING',
    'BRIEF_GENERATED',
    'SYNCED',
    'COMPLETED',
    'FAILED',
    'TIMED_OUT',
  ]),
  patientId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── Clinical Brief Schema ──────────────────────────────────────

export const clinicalBriefSchema = z.object({
  summary: z.string().min(1).max(5000),
  chiefComplaint: z.string().min(1).max(2000),
  riskFlags: z.array(z.string()).max(20),
  vitalsToCheck: z.array(z.string()).max(20),
  suggestedFollowups: z.array(z.string()).max(20),
  medicationsNote: z.string().max(2000),
  icd10Hints: z.array(z.string()).max(10),
});

// ─── Transcript Schema ──────────────────────────────────────────

export const transcriptEntrySchema = z.object({
  sessionId: z.string().uuid(),
  speaker: z.enum(['patient', 'ai', 'system']),
  text: z.string().min(1),
  timestampMs: z.number().int().nonnegative(),
});

export const transcriptQuerySchema = z.object({
  sessionId: z.string().uuid(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

// ─── AI Agent Schemas ───────────────────────────────────────────

export const aiIntakePromptSchema = z.object({
  sessionId: z.string().uuid(),
  patientContext: z.string().max(10000),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['assistant', 'user']),
      content: z.string(),
    }),
  ),
  currentInput: z.string().min(1).max(5000),
  language: z.enum(['en', 'hi', 'mr', 'es']).default('en'),
});

export const aiBriefGenerateSchema = z.object({
  sessionId: z.string().uuid(),
  patientId: z.string().uuid(),
  intakeData: intakeDataSchema,
  transcript: z.string().max(100000),
  patientHistory: z.string().max(5000),
  language: z.enum(['en', 'hi', 'mr', 'es']).default('en'),
});

// ─── WebSocket Schemas ──────────────────────────────────────────

export const wsMessageSchema = z.object({
  event: z.string(),
  sessionId: z.string().uuid(),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime().optional(),
});

// ─── Audio Upload Schema ────────────────────────────────────────

export const audioChunkSchema = z.object({
  sessionId: z.string().uuid(),
  chunkIndex: z.number().int().nonnegative(),
  data: z.instanceof(Blob).or(z.string()),
  format: z.enum(['opus', 'pcm16']).default('opus'),
  sampleRate: z.number().int().default(48000),
});

// ─── PMS/EMR Sync Schema ───────────────────────────────────────

export const pmsSyncSchema = z.object({
  sessionId: z.string().uuid(),
  patientId: z.string().uuid(),
  intakeRecordId: z.string().uuid(),
  targetSystem: z.enum(['hl7_fhir', 'custom']).default('custom'),
});

// ─── Audit Log Schema ──────────────────────────────────────────

export const auditLogSchema = z.object({
  action: z.string().min(1).max(200),
  actorId: z.string().min(1),
  actorRole: z.enum(['RECEPTIONIST', 'DOCTOR', 'ADMIN', 'SYSTEM']),
  resourceType: z.string().min(1).max(100),
  resourceId: z.string().min(1),
  details: z.record(z.unknown()).default({}),
  ipAddress: z.string().ip().or(z.string().max(45)),
});

// Accepts ISO date or datetime strings for filtering (e.g. 2026-08-01).
const isDateLike = (s: string) => !Number.isNaN(Date.parse(s));

/** Filtered audit log viewer query (ADMIN/SYSTEM). */
export const auditLogQuerySchema = z.object({
  action: z.string().max(200).optional(),
  actorId: z.string().max(100).optional(),
  actorRole: z.enum(['RECEPTIONIST', 'DOCTOR', 'ADMIN', 'SYSTEM']).optional(),
  resourceType: z.string().max(100).optional(),
  resourceId: z.string().max(100).optional(),
  from: z.string().refine(isDateLike, { message: 'from must be a valid date' }).optional(),
  to: z.string().refine(isDateLike, { message: 'to must be a valid date' }).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

/** Same filters minus pagination — used for CSV export. */
export const auditExportQuerySchema = z.object({
  action: z.string().max(200).optional(),
  actorId: z.string().max(100).optional(),
  actorRole: z.enum(['RECEPTIONIST', 'DOCTOR', 'ADMIN', 'SYSTEM']).optional(),
  resourceType: z.string().max(100).optional(),
  resourceId: z.string().max(100).optional(),
  from: z.string().refine(isDateLike, { message: 'from must be a valid date' }).optional(),
  to: z.string().refine(isDateLike, { message: 'to must be a valid date' }).optional(),
});

/** PHI access summary query — patientId comes from the path param. */
export const phiAccessSummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/** Retention cleanup trigger — optional override of the configured policy. */
export const retentionCleanupSchema = z.object({
  days: z.coerce.number().int().min(1).max(3650).optional(),
});

// ─── Dashboard Query Schemas ────────────────────────────────────

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const patientHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const patientIdParamSchema = z.object({
  patientId: z.string().uuid(),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid(),
});

// ─── Transcription Schemas ───────────────────────────────────────

export const transcribeAudioSchema = z.object({
  audioUrl: z.string().url().max(2000),
  sessionId: z.string().uuid(),
});

// ─── API Key Schemas ─────────────────────────────────────────────

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  clinicId: z.string().uuid().optional().nullable(),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const apiKeyIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ─── Analytics Schemas ─────────────────────────────────────────────

export const analyticsRangeQuerySchema = z.object({
  // Rolling look-back window, in days. 7, 30, 90 or 365.
  days: z.coerce.number().int().min(1).max(365).default(30),
  clinicId: z.string().uuid().optional(),
});

export const analyticsExportQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  clinicId: z.string().uuid().optional(),
});

// ─── Clinic Schemas (multi-tenancy) ───────────────────────────────

export const createClinicSchema = z.object({
  name: z.string().min(1).max(200),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Clinic code must be uppercase alphanumeric (A-Z, 0-9, _ or -)'),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional().nullable(),
});

export const updateClinicSchema = createClinicSchema.partial();

export const clinicIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ─── Auth Schemas ────────────────────────────────────────────────

// NOTE: role and clinicId are intentionally NOT accepted on public
// registration — new accounts always start as RECEPTIONIST. Role
// promotion happens via authenticated admin endpoints (RBAC).
export const registerUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export const loginUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10).max(1000),
});

// ─── Type Exports ───────────────────────────────────────────────

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginUserInput = z.infer<typeof loginUserSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type FaceEmbeddingInput = z.infer<typeof faceEmbeddingSchema>;
export type FaceSearchQuery = z.infer<typeof faceSearchQuerySchema>;
export type StartIntakeSessionInput = z.infer<typeof startIntakeSessionSchema>;
export type UpdateIntakeSessionInput = z.infer<typeof updateIntakeSessionSchema>;
export type IntakeDataInput = z.infer<typeof intakeDataSchema>;
export type ClinicalBriefInput = z.infer<typeof clinicalBriefSchema>;
export type AiIntakePromptInput = z.infer<typeof aiIntakePromptSchema>;
export type AiBriefGenerateInput = z.infer<typeof aiBriefGenerateSchema>;
export type AudioChunkInput = z.infer<typeof audioChunkSchema>;
export type AuditLogInput = z.infer<typeof auditLogSchema>;
export type TranscriptEntryInput = z.infer<typeof transcriptEntrySchema>;
export type PmsSyncInput = z.infer<typeof pmsSyncSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PatientHistoryQuery = z.infer<typeof patientHistoryQuerySchema>;
export type TranscribeAudioInput = z.infer<typeof transcribeAudioSchema>;
export type SessionIdParam = z.infer<typeof sessionIdParamSchema>;
export type PatientIdParam = z.infer<typeof patientIdParamSchema>;
export type UuidParam = z.infer<typeof uuidParamSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type ApiKeyIdParam = z.infer<typeof apiKeyIdParamSchema>;
export type CreateClinicInput = z.infer<typeof createClinicSchema>;
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
export type ClinicIdParam = z.infer<typeof clinicIdParamSchema>;
export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeQuerySchema>;
export type AnalyticsExportQuery = z.infer<typeof analyticsExportQuerySchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
export type AuditExportQuery = z.infer<typeof auditExportQuerySchema>;
export type PhiAccessSummaryQuery = z.infer<typeof phiAccessSummaryQuerySchema>;
export type RetentionCleanupInput = z.infer<typeof retentionCleanupSchema>;
