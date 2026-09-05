import { reportClientError } from './client-logger.ts';

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
    const response = await fetch(path, { ...options, headers, signal, credentials: 'same-origin' });
    if (!response.ok)
      reportClientError(new Error(`API request returned HTTP ${response.status}.`), {
        kind: 'api-response',
        method: options.method || 'GET',
        path: new URL(path, location.origin).pathname,
        status: response.status,
        requestId: response.headers.get('x-request-id') || undefined,
      });
    return response;
  } catch (error) {
    const networkError = signal.aborted
      ? new ApiNetworkError('The request timed out. Please try again.', error)
      : new ApiNetworkError('The companion server could not be reached.', error);
    reportClientError(networkError, {
      kind: 'api-network',
      method: options.method || 'GET',
      path: new URL(path, location.origin).pathname,
    });
    throw networkError;
  }
}
