import { API_BASE_URL } from '@/lib/utils';
import { useAuthStore, type AuthUser } from '@/stores/auth-store';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | undefined>;
  /** 'json' (default) parses response.data; 'text' returns the raw body. */
  responseType?: 'json' | 'text';
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
  retryOn401 = true,
): Promise<T> {
  const { method = 'GET', body, headers = {}, params, responseType = 'json' } = options;

  let url = `${API_BASE_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) url += `?${queryString}`;
  }

  const accessToken = useAuthStore.getState().accessToken;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Expired access token → try a single refresh, then replay the request.
  if (response.status === 401 && retryOn401 && !endpoint.startsWith('/auth/')) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request<T>(endpoint, options, false);
    }
  }

  if (responseType === 'text') {
    const text = await response.text();
    if (!response.ok) {
      throw new ApiError(response.status, 'HTTP_ERROR', text || 'An error occurred');
    }
    return text as T;
  }

  const json = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      json?.error?.code ?? 'UNKNOWN_ERROR',
      json?.error?.message ?? 'An error occurred',
      json?.error?.details,
    );
  }

  return json.data as T;
}

/**
 * Single-attempt refresh: swaps the refresh token for a fresh access token.
 * On any failure the session is cleared (fail-closed → back to /login).
 */
async function tryRefreshToken(): Promise<boolean> {
  const { refreshToken, setAccessToken, clearSession } = useAuthStore.getState();

  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = await response.json();

    if (!response.ok) {
      clearSession();
      return false;
    }

    setAccessToken(json.data.accessToken as string);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

// ─── Intake API ────────────────────────────────────────────────

export const intakeApi = {
  startSession: (data: { patientId?: string | null; deviceId: string }) =>
    request<{ id: string; status: string }>('/intake/session', {
      method: 'POST',
      body: data,
    }),

  getSession: (id: string) => request<Record<string, unknown>>(`/intake/session/${id}`),

  completeSession: (id: string, intakeData: Record<string, unknown>, idempotencyKey?: string) =>
    request<Record<string, unknown>>(`/intake/session/${id}/complete`, {
      method: 'POST',
      body: intakeData,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),

  getSessionStatus: (id: string) =>
    request<{ id: string; status: string }>(`/intake/session/${id}/status`),
};

// ─── Face API ──────────────────────────────────────────────────

export const faceApi = {
  upsertEmbedding: (data: { patientId: string; vector: number[] }) =>
    request<undefined>('/face/embedding', {
      method: 'POST',
      body: data,
    }),

  searchByFace: (data: { vector: number[]; threshold?: number; limit?: number }) =>
    request<Array<{ patientId: string; score: number }>>('/face/search', {
      method: 'POST',
      body: data,
    }),

  searchWithDetails: (data: { vector: number[]; threshold?: number; limit?: number }) =>
    request<{
      matches: Array<{
        patientId: string;
        score: number;
        patientName: string;
        dob: string;
        mobile: string;
      }>;
      total: number;
    }>('/face/search-with-details', {
      method: 'POST',
      body: data,
    }),

  registerPatient: (
    data: {
      name: string;
      dob: string;
      mobile: string;
      consent: boolean;
      embedding: number[];
    },
    idempotencyKey?: string,
  ) =>
    request<{ id: string; name: string; message: string }>('/face/register-patient', {
      method: 'POST',
      body: data,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
};

// ─── Dashboard API ─────────────────────────────────────────────

export const dashboardApi = {
  getLatestBrief: (patientId: string) =>
    request<Record<string, unknown>>(`/dashboard/patient/${patientId}/latest-brief`),

  getActiveSessions: (page = 1, limit = 20) =>
    request<{ data: unknown[]; pagination: Record<string, unknown> }>(
      '/dashboard/active-sessions',
      { params: { page, limit } },
    ),

  getRecentBriefs: (page = 1, limit = 20) =>
    request<{ data: unknown[]; pagination: Record<string, unknown> }>('/dashboard/recent-briefs', {
      params: { page, limit },
    }),

  markBriefReviewed: (briefId: string) =>
    request<{ success: boolean; message: string }>(`/brief/${briefId}/review`, {
      method: 'PATCH',
    }),

  getPatientHistory: (patientId: string, page = 1, limit = 10) =>
    request<{ data: unknown[]; pagination: Record<string, unknown> }>(
      `/dashboard/patient/${patientId}/history`,
      { params: { page, limit } },
    ),
};

// ─── AI API ────────────────────────────────────────────────────

export const aiApi = {
  processIntake: (data: {
    sessionId: string;
    patientContext: string;
    conversationHistory: Array<{ role: string; content: string }>;
    currentInput: string;
    language?: string;
  }) =>
    request<{ response: string; intakeComplete: boolean }>('/ai/intake-agent', {
      method: 'POST',
      body: data,
    }),

  generateBrief: (data: {
    sessionId: string;
    patientId: string;
    intakeData: Record<string, unknown>;
    transcript: string;
    patientHistory: string;
    language?: string;
  }) =>
    request<Record<string, unknown>>('/ai/brief', {
      method: 'POST',
      body: data,
    }),
};

// ─── Analytics API (ADMIN/SYSTEM) ─────────────────────────────

export interface VolumePoint {
  date: string;
  count: number;
}

export interface HourPoint {
  hour: number;
  count: number;
}

export interface FlowStage {
  key: string;
  label: string;
  count: number;
}

// ─── Health API (admin health page) ────────────────────────────

export interface DependencyCheck {
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  error?: string;
}

export interface HealthSummary {
  status: 'healthy' | 'unhealthy';
  checks: Record<string, DependencyCheck>;
  timestamp: string;
}

export const healthApi = {
  /** Overall health summary — GET /health */
  getSummary: () => request<HealthSummary>('/health'),

  /** Readiness probe — GET /health/ready (503 when a dependency is down) */
  getReady: () => request<HealthSummary>('/health/ready'),

  /** Liveness probe — GET /health/live */
  getLive: () => request<HealthSummary>('/health/live'),
};

export const analyticsApi = {
  getOverview: (days = 30) =>
    request<{
      days: number;
      totalSessions: number;
      returningPatients: number;
      newPatients: number;
      faceMatchRate: number;
      avgIntakeMinutes: number;
      briefSuccessRate: number;
      activeSessions: number;
    }>('/analytics/overview', { params: { days } }),

  getVolume: (days = 30) =>
    request<{ days: number; data: VolumePoint[] }>('/analytics/volume', { params: { days } }),

  getHours: (days = 30) =>
    request<{ days: number; data: HourPoint[] }>('/analytics/hours', { params: { days } }),

  getFlow: () => request<{ total: number; stages: FlowStage[] }>('/analytics/flow'),

  /** Fetch the CSV as raw text (text/csv — routed through the shared request
   *  helper so Bearer auth and refresh-on-401 behave like every other call). */
  fetchCsv: (days = 30) =>
    request<string>('/analytics/export', { params: { days }, responseType: 'text' }),
};

// ─── Clinics API (ADMIN/SYSTEM) ───────────────────────────────

export interface Clinic {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const clinicsApi = {
  list: (page = 1, limit = 50) =>
    request<{ data: Clinic[]; pagination: Record<string, unknown> }>('/clinics', {
      params: { page, limit },
    }),

  getById: (id: string) => request<Clinic>(`/clinics/${id}`),

  create: (data: {
    name: string;
    code: string;
    address?: string;
    phone?: string;
    email?: string;
  }) => request<Clinic>('/clinics', { method: 'POST', body: data }),

  update: (
    id: string,
    data: Partial<{
      name: string;
      code: string;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
    }>,
  ) => request<Clinic>(`/clinics/${id}`, { method: 'PATCH', body: data }),

  deactivate: (id: string) =>
    request<{ success: boolean; message: string }>(`/clinics/${id}`, { method: 'DELETE' }),
};

// ─── API Keys API (ADMIN/SYSTEM) ──────────────────────────────

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  clinicId: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreatedApiKey extends ApiKeyRecord {
  apiKey: string;
}

export const apiKeysApi = {
  list: () => request<ApiKeyRecord[]>('/api-keys'),

  create: (data: { name: string; clinicId?: string | null; expiresInDays?: number }) =>
    request<CreatedApiKey>('/api-keys', { method: 'POST', body: data }),

  revoke: (id: string) =>
    request<{ success: boolean; message: string }>(`/api-keys/${id}`, { method: 'DELETE' }),
};

// ─── Audit / HIPAA API (ADMIN/SYSTEM) ─────────────────────────

export interface AuditLogRecord {
  id: string;
  action: string;
  actorId: string;
  actorRole: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  timestamp: string;
}

export interface PhiAccessDay {
  date: string;
  accessCount: number;
  uniqueActors: number;
  actors: string[];
  actions: Record<string, number>;
}

export interface AuditFilters {
  action?: string;
  actorId?: string;
  actorRole?: string;
  resourceType?: string;
  from?: string;
  to?: string;
}

export const auditApi = {
  getLogs: (filters: AuditFilters = {}, page = 1, limit = 50) =>
    request<{ data: AuditLogRecord[]; pagination: Record<string, unknown> }>('/audit/logs', {
      params: {
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.actorId ? { actorId: filters.actorId } : {}),
        ...(filters.actorRole ? { actorRole: filters.actorRole } : {}),
        ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        page,
        limit,
      },
    }),

  /** Fetch the anonymized CSV as raw text (text/csv — via the shared helper). */
  exportCsv: (filters: AuditFilters = {}) =>
    request<string>('/audit/logs/export', {
      params: {
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.actorId ? { actorId: filters.actorId } : {}),
        ...(filters.actorRole ? { actorRole: filters.actorRole } : {}),
        ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      },
      responseType: 'text',
    }),

  getPhiAccessSummary: (patientId: string, days = 30) =>
    request<{
      patientId: string;
      days: number;
      totalAccesses: number;
      uniqueActors: number;
      perDay: PhiAccessDay[];
    }>(`/audit/patients/${patientId}/access-summary`, { params: { days } }),

  getRetention: () => request<{ retentionDays: number }>('/audit/retention'),

  runRetentionCleanup: (days?: number) =>
    request<{ deleted: number; retentionDays: number; cutoff: string }>(
      '/audit/retention/cleanup',
      { method: 'POST', body: days ? { days } : {} },
    ),
};

// ─── Monitoring API (ADMIN/SYSTEM) ────────────────────────────

export interface LatencyPoint {
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

export interface LatencySnapshot {
  http: LatencyPoint;
  qdrant: LatencyPoint;
}

export type AlertSeverity = 'ok' | 'warning' | 'critical';

export interface MonitoredAlert {
  key: string;
  label: string;
  severity: AlertSeverity;
  value: number;
  threshold: number;
  message: string;
}

export const monitoringApi = {
  getLatency: () => request<LatencySnapshot>('/monitoring/latency'),

  getAlerts: () => request<MonitoredAlert[]>('/monitoring/alerts'),
};

// ─── Auth API ──────────────────────────────────────────────────

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    request<AuthUser>('/auth/register', { method: 'POST', body: data }),

  login: (data: { email: string; password: string }) =>
    request<{
      user: AuthUser;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>('/auth/login', { method: 'POST', body: data }),

  refresh: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string; expiresIn: number }>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    }),

  getProfile: () => request<AuthUser>('/auth/profile'),

  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
};

export { ApiError };
