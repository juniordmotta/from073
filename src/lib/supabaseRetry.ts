const RETRYABLE_ERROR_PATTERNS = [
  'failed to fetch',
  'networkerror',
  'load failed',
  'fetcherror',
  'timeout',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isRetryableSupabaseError = (error: unknown) => {
  if (!error) return false;

  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : String(error);

  const normalized = message.toLowerCase();
  return RETRYABLE_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
};

export async function withSupabaseRetry<T>(
  operation: () => PromiseLike<T>,
  options: { retries?: number; delayMs?: number } = {}
): Promise<T> {
  const { retries = 3, delayMs = 500 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await operation();
      const resultError = (result as { error?: unknown })?.error;

      if (!resultError || !isRetryableSupabaseError(resultError) || attempt === retries) {
        return result;
      }

      lastError = resultError;
    } catch (error) {
      if (!isRetryableSupabaseError(error) || attempt === retries) {
        throw error;
      }

      lastError = error;
    }

    await sleep(delayMs * 2 ** attempt);
  }

  throw lastError;
}