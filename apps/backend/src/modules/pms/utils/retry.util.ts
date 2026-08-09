import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 10_000,
};

/**
 * Executes an async operation with exponential backoff retry.
 * Doubles delay on each retry: baseDelay, baseDelay*2, baseDelay*4, ...
 * Jitters the delay by ±25% to avoid thundering herd.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  context?: string,
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };
  const logger = new Logger('RetryUtil');

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs);
        logger.warn(
          `[${context ?? 'operation'}] Attempt ${attempt}/${maxRetries} failed: ${lastError.message}. Retrying in ${delay}ms...`,
        );
        await sleep(delay);
      }
    }
  }

  logger.error(
    `[${context ?? 'operation'}] All ${maxRetries} attempts failed: ${lastError!.message}`,
  );
  throw lastError;
}

function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, maxDelayMs);

  // Add ±25% jitter
  const jitter = capped * (0.75 + Math.random() * 0.5);
  return Math.round(jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms).unref());
}
