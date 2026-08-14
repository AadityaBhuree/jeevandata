import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { dashboardApi, analyticsApi } from '@/services/api';
import {
  useActiveSessions,
  useRecentBriefs,
  useAnalyticsOverview,
  useMarkBriefReviewed,
} from '../useQueries';

// ─── Mocks ──────────────────────────────────────────────────────

vi.mock('@/services/api', () => ({
  dashboardApi: {
    getActiveSessions: vi.fn(),
    getRecentBriefs: vi.fn(),
    markBriefReviewed: vi.fn(),
  },
  analyticsApi: {
    getOverview: vi.fn(),
  },
}));

const mockedDashboardApi = vi.mocked(dashboardApi);
const mockedAnalyticsApi = vi.mocked(analyticsApi);

// ─── Helpers ────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const session = {
  id: 's1',
  patient: { id: 'p1', name: 'Priya', dob: '1990-01-15' },
  status: 'INTAKE_IN_PROGRESS',
  startedAt: '2026-08-14T10:00:00Z',
  deviceId: 'kiosk-1',
};

const brief = {
  id: 'b1',
  sessionId: 's1',
  patientId: 'p1',
  brief: { summary: 'Fever for 3 days' },
  generatedAt: '2026-08-14T10:30:00Z',
  session: { id: 's1', startedAt: '2026-08-14T10:00:00Z', status: 'COMPLETED' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedDashboardApi.getActiveSessions.mockResolvedValue({
    data: [session],
    pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  });
  mockedDashboardApi.getRecentBriefs.mockResolvedValue({
    data: [brief],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  mockedAnalyticsApi.getOverview.mockResolvedValue({
    days: 30,
    totalSessions: 10,
    returningPatients: 4,
    newPatients: 6,
    faceMatchRate: 92,
    avgIntakeMinutes: 8,
    briefSuccessRate: 95,
    activeSessions: 2,
  });
  mockedDashboardApi.markBriefReviewed.mockResolvedValue({ success: true, message: 'ok' });
});

// ─── Tests ──────────────────────────────────────────────────────

describe('useQueries', () => {
  it('useActiveSessions fetches sessions with the configured limit', async () => {
    const { result } = renderHook(() => useActiveSessions(50), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedDashboardApi.getActiveSessions).toHaveBeenCalledWith(1, 50);
    expect(result.current.data).toEqual([session]);
  });

  it('useRecentBriefs fetches briefs and exposes the list', async () => {
    const { result } = renderHook(() => useRecentBriefs(20), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedDashboardApi.getRecentBriefs).toHaveBeenCalledWith(1, 20);
    expect(result.current.data?.[0]?.id).toBe('b1');
  });

  it('useAnalyticsOverview fetches KPIs with the requested range', async () => {
    const { result } = renderHook(() => useAnalyticsOverview(7), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedAnalyticsApi.getOverview).toHaveBeenCalledWith(7);
    expect(result.current.data?.totalSessions).toBe(10);
  });

  it('surfaces errors instead of throwing', async () => {
    mockedDashboardApi.getActiveSessions.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useActiveSessions(50), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('useMarkBriefReviewed calls markBriefReviewed and invalidates the briefs list', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Seed the cache so invalidation has something to refetch
    queryClient.setQueryData(['recent-briefs', 20], [brief]);

    const { result } = renderHook(() => useMarkBriefReviewed(), { wrapper });

    result.current.mutate('b1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedDashboardApi.markBriefReviewed).toHaveBeenCalledWith('b1');
  });
});
