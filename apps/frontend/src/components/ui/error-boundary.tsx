'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * App-level error boundary. A render crash in any component (bad API data,
 * missing prop, etc.) would otherwise take down the whole app with a white
 * screen. Catches the error, logs it, and shows a recoverable UI.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('React render error caught by boundary', error, {
      componentStack: info.componentStack,
    });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="text-5xl">😕</div>
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground max-w-md text-sm">
            An unexpected error interrupted this page. Your data is safe — try going back home, or
            reload to continue.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleReset}>
              Try again
            </Button>
            <Button
              variant="jeevandata"
              onClick={() => {
                window.location.href = '/';
              }}
            >
              Go back to home
            </Button>
          </div>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre className="bg-muted text-muted-foreground mt-4 max-w-xl overflow-auto rounded-lg p-3 text-left text-xs">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
