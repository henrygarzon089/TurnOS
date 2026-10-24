/**
 * Reintento con espera creciente para acciones del barbero (REQ-011.3): hasta 3 intentos
 * (1 + 2 reintentos) con 500 ms, 1 s, 2 s. Solo reintenta errores de red, nunca de negocio.
 */
export class NetworkError extends Error {}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 500;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (!isNetworkError(e) || i === attempts - 1) throw e;
      await sleep(baseMs * 2 ** i);
    }
  }
  throw lastError;
}

export function isNetworkError(e: unknown): boolean {
  if (e instanceof NetworkError) return true;
  if (e instanceof TypeError && /fetch|network|Failed to fetch|Load failed/i.test(e.message))
    return true;
  const msg = (e as { message?: string })?.message ?? "";
  return /ECONNRESET|ETIMEDOUT|ENOTFOUND|network|fetch failed/i.test(msg);
}
