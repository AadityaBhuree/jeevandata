import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserRole } from '@jeevandata/shared-types';
import DashboardPage from '../page';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { useAuthStore } from '@/stores/auth-store';

// ─── Hoisted mocks (available to vi.mock factories) ────────────
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
      isConnected: vi.fn(() => false),
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

const session = {
  id: 's1',
  patient: { id: 'p1', name: 'Ravi Kumar', dob: '1985-04-12' },
  status: 'INTAKE_IN_PROGRESS',
  startedAt: '2026-08-04T10:00:00.000Z',
  deviceId: 'kiosk-1',
};

const brief = {
  id: 'b1',
  sessionId: 's1',
  patientId: 'p1',
  brief: {
    summary: 'Fever and cough for 3 days',
    chiefComplaint: 'Fever with cough',
    riskFlags: ['High fever'],
    vitalsToCheck: ['Temperature', 'O2 saturation'],
    suggestedFollowups: [],
    medicationsNote: '',
    icd10Hints: ['R50.9'],
  },
  generatedAt: '2026-08-04T10:05:00.000Z',
  session: { id: 's1', startedAt: '2026-08-04T10:00:00.000Z', status: 'BRIEF_GENERATED' },
  patient: { id: 'p1', name: 'Ravi Kumar', dob: '1985-04-12' },
};

const doctorUser = {
  id: 'u1',
  email: 'doctor@jeevandata.com',
  name: 'Dr. Priya Sharma',
  role: UserRole.DOCTOR,
  clinicId: null,
};

const receptionistUser = {
  id: 'u2',
  email: 'reception@jeevandata.com',
  name: 'Sita Verma',
  role: UserRole.RECEPTIONIST,
  clinicId: null,
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DashboardPage />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  replaceMock.mockClear();
  pushMock.mockClear();
  useAuthStore.getState().clearSession();
  localStorage.clear();

  dashboardApiMock.getActiveSessions.mockResolvedValue({
    data: [session],
    pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  });
  dashboardApiMock.getRecentBriefs.mockResolvedValue({
    data: [brief],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  dashboardApiMock.markBriefReviewed.mockResolvedValue({ success: true, message: 'ok' });
  authApiMock.logout.mockResolvedValue({ success: true });
});

describe('Dashboard — role badge & RBAC', () => {
  it('shows the DOCTOR role badge and user name in the header', async () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, doctorUser);

    renderDashboard();

    expect(await screen.findByText(/dr\. priya sharma/i)).toBeInTheDocument();
    expect(screen.getByText('Doctor')).toBeInTheDocument();
  });

  it('shows the RECEPTIONIST role badge for reception staff', async () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, receptionistUser);

    renderDashboard();

    expect(await screen.findByText(/sita verma/i)).toBeInTheDocument();
    expect(screen.getByText('Receptionist')).toBeInTheDocument();
  });

  it('shows Mark Reviewed actions for DOCTOR users', async () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, doctorUser);

    renderDashboard();

    expect(await screen.findByText(/mark reviewed/i)).toBeInTheDocument();
  });

  it('hides Mark Reviewed actions for non-DOCTOR users', async () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, receptionistUser);

    renderDashboard();

    // Wait for the briefs list to render (chief complaint text is unique)
    await screen.findByText(/fever with cough/i);
    expect(screen.queryByText(/mark reviewed/i)).not.toBeInTheDocument();
  });

  it('clears the session and calls logout when sign-out is clicked', async () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, doctorUser);

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /sign out/i }));

    await waitFor(() => {
      expect(authApiMock.logout).toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('Dashboard — regression: no nested buttons', () => {
    it('never renders a <button> inside another <button> (hydration-safe)', async () => {
      useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, doctorUser);

      const { container } = renderDashboard();

      // Wait for all async data to settle (briefs list is the last async piece)
      await screen.findByText(/fever with cough/i);

      // Every <button> and role="button" in the rendered tree must NOT contain
      // another <button> or Button component — nesting buttons is invalid HTML
      // and causes React hydration warnings.
      const buttons = Array.from(container.querySelectorAll('button'));
      const nested = buttons.filter((btn) => {
        const innerButtons = btn.querySelectorAll('button');
        return innerButtons.length > 0;
      });

      if (nested.length > 0) {
        const details = nested.map(
          (btn) =>
            `  outer: <${btn.tagName.toLowerCase()}>${btn.textContent?.slice(0, 60)}… contains ${btn.querySelectorAll('button').length} inner <button>(s)`,
        );
        throw new Error(
          `Found ${nested.length} button(s) nested inside another button: ${details.join(' | ')}`,
        );
      }

      expect(nested).toHaveLength(0);
    });
  });
});
