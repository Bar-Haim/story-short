type RetriableFn<T> = () => Promise<T>;

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

function isRetriableError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  // network + transient server issues
  return (
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504')
  );
}

export async function withRetry<T>(
  fn: RetriableFn<T>,
  {
    maxRetries = 3,
    baseDelayMs = 500,
    label = 'op'
  }: { maxRetries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const retriable = isRetriableError(err);
      if (!retriable || attempt === maxRetries) throw err;
      const backoff = baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      console.warn(`[retry] ${label} attempt ${attempt}/${maxRetries} failed: ${err?.message || err}. Retrying in ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
} 