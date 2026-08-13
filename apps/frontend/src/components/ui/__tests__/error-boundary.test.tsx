import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../error-boundary';
import { logger } from '@/lib/logger';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function Bomb(): never {
  throw new Error('render explosion');
}

describe('ErrorBoundary (8.4.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Silence the expected React error logging in the test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>healthy content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy content')).toBeTruthy();
  });

  it('catches a render error and shows the recovery UI', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByRole('button', { name: /go back to home/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('logs the error with the component stack', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'React render error caught by boundary',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it('recovers after clicking Try again', () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) {
        throw new Error('first render fails');
      }
      return <div>recovered</div>;
    }

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('recovered')).toBeTruthy();
  });
});
