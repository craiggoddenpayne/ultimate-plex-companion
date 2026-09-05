const recentReports = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 10_000;

function describeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack?.slice(0, 4_000) };
  return { name: 'Error', message: String(error || 'Unknown browser error') };
}

export function reportClientError(error: unknown, context: Record<string, unknown> = {}): void {
  const details = describeError(error);
  const fingerprint = `${details.name}:${details.message}:${String(context.kind || '')}:${String(context.path || '')}`;
  const now = Date.now();
  if (now - (recentReports.get(fingerprint) || 0) < DEDUPLICATION_WINDOW_MS) return;
  recentReports.set(fingerprint, now);
  console.error('[Ultimate Plex Companion]', details.message, context);

  const body = JSON.stringify({
    ...details,
    ...context,
    route: location.pathname,
    userAgent: navigator.userAgent.slice(0, 500),
    occurredAt: new Date().toISOString(),
  });
  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon('/api/diagnostics/client-errors', blob)) return;
    void fetch('/api/diagnostics/client-errors', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Browser diagnostics must never interrupt the feature reporting the original error.
  }
}

window.addEventListener('error', (event) => {
  reportClientError(event.error || event.message, {
    kind: 'uncaught-error',
    source: event.filename ? new URL(event.filename, location.href).pathname : '',
    line: event.lineno,
    column: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  reportClientError(event.reason, { kind: 'unhandled-rejection' });
});
