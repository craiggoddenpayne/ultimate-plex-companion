const DEFAULT_TIMEOUT_MS = 20_000;

export class ApiNetworkError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'ApiNetworkError';
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!path.startsWith('/api/')) throw new TypeError('API requests must use a same-origin /api/ path.');
  const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  try {
    return await fetch(path, { ...options, headers, signal, credentials: 'same-origin' });
  } catch (error) {
    if (signal.aborted) throw new ApiNetworkError('The request timed out. Please try again.', error);
    throw new ApiNetworkError('The companion server could not be reached.', error);
  }
}
