import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserRole } from '@jeevandata/shared-types';
import DashboardPage from '../page';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { useAuthStore } from '@/stores/auth-store';

const { replaceMock, pushMock, dashboardApiMock, authApiMock, socketServiceMock } = vi.hoisted(
  () => ({
    replaceMock: vi.fn(),
    pushMock: vi.fn(),
    dashboardApiMock: {
      getActiveSessions: vi.fn(),
      getRecentBriefs: vi.fn(),
      markBriefReviewed: vi.fn(),
      getLatestBrief: vi.fn(),
      getPatientHistory: vi.fn(),
    },
    authApiMock: {
      login: vi.fn(),
      register: vi.fn(),
      refresh: vi.fn(),
      getProfile: vi.fn(),
      logout: vi.fn(),
    },
    socketServiceMock: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      joinSession: vi.fn(),
      leaveSession: vi.fn(),
      isConnected: vi.fn(() => true),
      onConnectionChange: vi.fn(() => () => {}),
      onSessionStatus: vi.fn(() => () => {}),
      onTranscriptChunk: vi.fn(() => () => {}),
      onBriefReady: vi.fn(() => () => {}),
      onFaceMatched: vi.fn(() => () => {}),
      sendConversationTurn: vi.fn(),
      sendAudioChunk: vi.fn(),
      onConversationTurn: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
    },
  }),
);

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/services/api', () => ({
  dashboardApi: dashboardApiMock,
  authApi: authApiMock,
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

vi.mock('@/services/socket', () => ({
  socketService: socketServiceMock,
}));

const doctorUser = {
  id: 'u1',
  email: 'doctor@jeevandata.com',
  name: 'Dr. Priya Sharma',
  role: UserRole.DOCTOR,
  clinicId: null,
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DashboardPage />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('DashboardPage — Search & Pagination (Item D6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore
      .getState()
      .setSession({ accessToken: 'mock-acc', refreshToken: 'mock-ref' }, doctorUser);
  });

  it('filters active sessions by patient name and resets visible count', async () => {
    const sessions = [
      {
        id: 's1',
        patient: { id: 'p1', name: 'Aarav Sharma', dob: '1990-01-01' },
        status: 'INTAKE_IN_PROGRESS',
        startedAt: '2026-04-11T10:00:00.000Z',
        deviceId: 'kiosk-1',
      },
      {
        id: 's2',
        patient: { id: 'p2', name: 'Kavita Iyer', dob: '1988-02-02' },
        status: 'INTAKE_IN_PROGRESS',
        startedAt: '2026-04-11T10:01:00.000Z',
        deviceId: 'kiosk-2',
      },
    ];

    dashboardApiMock.getActiveSessions.mockResolvedValue({
      data: sessions,
      pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
    });
    dashboardApiMock.getRecentBriefs.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
      expect(screen.getByText('Kavita Iyer')).toBeInTheDocument();
    });

    // Type "Aarav" into active sessions search input
    const searchInput = screen.getByPlaceholderText(/search patient \/ dob/i);
    fireEvent.change(searchInput, { target: { value: 'Aarav' } });

    expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
    expect(screen.queryByText('Kavita Iyer')).not.toBeInTheDocument();
    expect(screen.getByTestId('sessions-pagination-info')).toHaveTextContent(
      /Showing 1 of 1 sessions/i,
    );

    // Clear search
    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearBtn);

    expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
    expect(screen.getByText('Kavita Iyer')).toBeInTheDocument();
  });

  it('paginates active sessions with Load More and Show All', async () => {
    // Generate 12 sessions
    const sessions = Array.from({ length: 12 }, (_, i) => ({
      id: `session-${i + 1}`,
      patient: { id: `patient-${i + 1}`, name: `Patient ${i + 1}`, dob: '1990-01-01' },
      status: 'INTAKE_IN_PROGRESS',
      startedAt: new Date(Date.now() - i * 60000).toISOString(),
      deviceId: 'kiosk-1',
    }));

    dashboardApiMock.getActiveSessions.mockResolvedValue({
      data: sessions,
      pagination: { page: 1, limit: 50, total: 12, totalPages: 1 },
    });
    dashboardApiMock.getRecentBriefs.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Patient 1')).toBeInTheDocument();
    });

    // Initial visible is 8
    expect(screen.getByTestId('sessions-pagination-info')).toHaveTextContent(
      /Showing 8 of 12 sessions/i,
    );
    expect(screen.getByRole('button', { name: /load more \(\+4\)/i })).toBeInTheDocument();
    expect(screen.queryByText('Patient 9')).not.toBeInTheDocument();

    // Click Load More
    fireEvent.click(screen.getByRole('button', { name: /load more \(\+4\)/i }));

    expect(screen.getByText('Patient 9')).toBeInTheDocument();
    expect(screen.getByText('Patient 12')).toBeInTheDocument();
    expect(screen.getByTestId('sessions-pagination-info')).toHaveTextContent(
      /Showing 12 of 12 sessions/i,
    );
  });

  it('searches completed briefs by chief complaint and diagnoses', async () => {
    const briefs = [
      {
        id: 'b1',
        sessionId: 's1',
        patientId: 'p1',
        brief: { chiefComplaint: 'Acute migraine with aura', riskFlags: [] },
        generatedAt: '2026-04-11T10:05:00.000Z',
        session: { id: 's1', startedAt: '2026-04-11T10:00:00.000Z', status: 'BRIEF_GENERATED' },
        patient: { id: 'p1', name: 'Sunita Rao', dob: '1982-03-14' },
      },
      {
        id: 'b2',
        sessionId: 's2',
        patientId: 'p2',
        brief: { chiefComplaint: 'Persistent high fever', riskFlags: ['High fever'] },
        generatedAt: '2026-04-11T10:06:00.000Z',
        session: { id: 's2', startedAt: '2026-04-11T10:01:00.000Z', status: 'BRIEF_GENERATED' },
        patient: { id: 'p2', name: 'Rohan Mehta', dob: '1975-08-20' },
      },
    ];

    dashboardApiMock.getActiveSessions.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
    dashboardApiMock.getRecentBriefs.mockResolvedValue({
      data: briefs,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Sunita Rao')).toBeInTheDocument();
      expect(screen.getByText('Rohan Mehta')).toBeInTheDocument();
    });

    // Search for "migraine"
    const briefSearch = screen.getByPlaceholderText(/search brief \/ diagnosis/i);
    fireEvent.change(briefSearch, { target: { value: 'migraine' } });

    expect(screen.getByText('Sunita Rao')).toBeInTheDocument();
    expect(screen.queryByText('Rohan Mehta')).not.toBeInTheDocument();
    expect(screen.getByTestId('briefs-pagination-info')).toHaveTextContent(
      /Showing 1 of 1 briefs/i,
    );

    // Clear search using clear button
    const clearBriefBtn = screen.getByRole('button', { name: /clear brief search/i });
    fireEvent.click(clearBriefBtn);

    expect(screen.getByText('Sunita Rao')).toBeInTheDocument();
    expect(screen.getByText('Rohan Mehta')).toBeInTheDocument();
  });

  it('filters briefs by High-Risk flag tab', async () => {
    const briefs = [
      {
        id: 'b1',
        sessionId: 's1',
        patientId: 'p1',
        brief: { chiefComplaint: 'Mild cough', riskFlags: [] },
        generatedAt: '2026-04-11T10:05:00.000Z',
        session: { id: 's1', startedAt: '2026-04-11T10:00:00.000Z', status: 'BRIEF_GENERATED' },
        patient: { id: 'p1', name: 'Standard Patient', dob: '1990-01-01' },
      },
      {
        id: 'b2',
        sessionId: 's2',
        patientId: 'p2',
        brief: { chiefComplaint: 'Chest pain', riskFlags: ['Chest pain', 'Shortness of breath'] },
        generatedAt: '2026-04-11T10:06:00.000Z',
        session: { id: 's2', startedAt: '2026-04-11T10:01:00.000Z', status: 'BRIEF_GENERATED' },
        patient: { id: 'p2', name: 'Critical Patient', dob: '1965-06-12' },
      },
    ];

    dashboardApiMock.getActiveSessions.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
    dashboardApiMock.getRecentBriefs.mockResolvedValue({
      data: briefs,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Standard Patient')).toBeInTheDocument();
      expect(screen.getByText('Critical Patient')).toBeInTheDocument();
    });

    // Click "High-Risk" tab in briefs
    const highRiskTabs = screen.getAllByRole('button', { name: /high-risk/i });
    // Pick the one inside the briefs toolbar
    const briefHighRiskTab = highRiskTabs[highRiskTabs.length - 1];
    fireEvent.click(briefHighRiskTab);

    expect(screen.getByText('Critical Patient')).toBeInTheDocument();
    expect(screen.queryByText('Standard Patient')).not.toBeInTheDocument();
  });
});
