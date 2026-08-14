import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type * as ApiModule from '@/services/api';
import AdminHealthPage from '../health/page';
import { ThemeProvider } from '@/components/ui/theme-provider';

const { healthApiMock } = vi.hoisted(() => ({
  healthApiMock: {
    getSummary: vi.fn(),
    getReady: vi.fn(),
    getLive: vi.fn(),
  },
}));

// The page reads per-dependency checks from the readiness endpoint.
vi.mock('@/services/api', async (importOriginal) => {
  const original = await importOriginal<typeof ApiModule>();
  return { ...original, healthApi: healthApiMock };
});

vi.mock('@/services/api', () => ({
  healthApi: healthApiMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function renderPage() {
  return render(
    <ThemeProvider>
      <AdminHealthPage />
    </ThemeProvider>,
  );
}

const healthySummary = {
  status: 'healthy',
  checks: {
    database: { status: 'healthy', latencyMs: 4 },
    redis: { status: 'healthy', latencyMs: 7 },
    qdrant: { status: 'healthy', latencyMs: 6 },
    whisper: { status: 'healthy', latencyMs: 1 },
  },
  timestamp: '2026-08-14T12:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('AdminHealthPage', () => {
  it('renders the overall status and every dependency with latency', async () => {
    healthApiMock.getReady.mockResolvedValue(healthySummary);
    renderPage();

    expect(await screen.findByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getByText('Qdrant')).toBeInTheDocument();
    expect(screen.getByText('Whisper (STT)')).toBeInTheDocument();
    // Latency labels
    expect(screen.getByText('4 ms')).toBeInTheDocument();
    expect(screen.getByText('7 ms')).toBeInTheDocument();
    // All Up badges (healthy)
    expect(screen.getAllByText('Up')).toHaveLength(4);
  });

  it('marks a slow dependency as Degraded (yellow) even when healthy', async () => {
    healthApiMock.getReady.mockResolvedValue({
      ...healthySummary,
      checks: { ...healthySummary.checks, qdrant: { status: 'healthy', latencyMs: 2500 } },
    });
    renderPage();

    expect(await screen.findByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('2,500 ms')).toBeInTheDocument();
  });

  it('shows Down + Unhealthy when a dependency fails and renders checks from error.details', async () => {
    const err = new Error('One or more dependencies are unhealthy') as Error & {
      details?: Record<string, unknown>;
    };
    err.details = {
      status: 'unhealthy',
      checks: {
        database: { status: 'healthy', latencyMs: 4 },
        redis: { status: 'unhealthy', latencyMs: 0, error: 'ECONNREFUSED' },
      },
      timestamp: '2026-08-14T12:00:00Z',
    };
    healthApiMock.getReady.mockRejectedValue(err);
    renderPage();

    expect(await screen.findByText('Unhealthy')).toBeInTheDocument();
    expect(screen.getByText('Down')).toBeInTheDocument();
    expect(screen.getByText('ECONNREFUSED')).toBeInTheDocument();
    // Healthy dependency still listed as Up
    expect(screen.getAllByText('Up')).toHaveLength(1);
  });

  it('shows the error message when the backend is unreachable (no details)', async () => {
    healthApiMock.getReady.mockRejectedValue(new Error('Network down'));
    renderPage();

    expect(
      await screen.findByText(/could not reach the backend: network down/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });

  it('re-fetches on manual refresh', async () => {
    healthApiMock.getReady.mockResolvedValue(healthySummary);
    renderPage();
    await screen.findByText('Healthy');
    expect(healthApiMock.getReady).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(healthApiMock.getReady).toHaveBeenCalledTimes(2));
  });

  it('auto-refreshes after 30 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    healthApiMock.getReady.mockResolvedValue(healthySummary);
    renderPage();

    // Let the initial load settle (auto-advancing fake clock keeps waitFor alive)
    await screen.findByText('Healthy');
    expect(healthApiMock.getReady).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await vi.waitFor(() => expect(healthApiMock.getReady).toHaveBeenCalledTimes(2));
    vi.useRealTimers();
  });
});
