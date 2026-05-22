export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  backoffFactor?: number;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryAsync<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelay = Math.max(0, options.delayMs ?? 250);
  const backoffFactor = Math.max(1, options.backoffFactor ?? 2);

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }

      const delayMs = Math.round(baseDelay * Math.pow(backoffFactor, attempt - 1));
      options.onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry operation failed');
}
