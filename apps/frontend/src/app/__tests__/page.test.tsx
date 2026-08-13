import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HomePage from '../page';

const push = vi.fn();
const setSessionId = vi.fn();
const startSession = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/stores/session-store', () => ({
  useSessionStore: (selector?: (s: { setSessionId: typeof setSessionId }) => unknown) => {
    const state = { setSessionId };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/services/api', () => ({
  intakeApi: {
    startSession: (...args: unknown[]) => startSession(...args),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('HomePage — start intake (8.4.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a session and navigates to the intake page', async () => {
    startSession.mockResolvedValue({ id: 'sess-123' });

    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /start new intake/i }));

    await waitFor(() => {
      expect(startSession).toHaveBeenCalledWith({
        deviceId: expect.stringMatching(/^web-/),
      });
      expect(setSessionId).toHaveBeenCalledWith('sess-123');
      expect(push).toHaveBeenCalledWith('/intake/sess-123');
    });
  });

  it('shows an error toast and does not navigate when the API fails', async () => {
    const { toast } = await import('@/hooks/use-toast');
    startSession.mockRejectedValue(new Error('backend unreachable'));

    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /start new intake/i }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to start session',
          description: 'backend unreachable',
          variant: 'destructive',
        }),
      );
    });
    expect(push).not.toHaveBeenCalled();
  });

  it('disables the button while the request is in flight (no double sessions)', async () => {
    let resolve!: (v: unknown) => void;
    startSession.mockImplementation(() => new Promise((r) => (resolve = r)));

    render(<HomePage />);

    const button = screen.getByRole('button', { name: /start new intake/i });
    fireEvent.click(button);
    fireEvent.click(button);

    // Only one API call made despite two clicks
    expect(startSession).toHaveBeenCalledTimes(1);

    resolve({ id: 'sess-1' });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });
});
