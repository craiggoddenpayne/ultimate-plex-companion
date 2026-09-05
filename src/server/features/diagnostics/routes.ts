export function createDiagnosticsRoutes() {
  return async (context) => {
    if (context.pathname === '/api/diagnostics/client-errors' && context.req.method === 'POST') {
      const input = await context.body(context.req);
      context.logger.error('client.error', {
        name: String(input.name || 'Error').slice(0, 100),
        message: String(input.message || 'Unknown browser error').slice(0, 1_000),
        stack: String(input.stack || '').slice(0, 4_000),
        kind: String(input.kind || 'browser').slice(0, 100),
        route: String(input.route || '').slice(0, 300),
        source: String(input.source || '').slice(0, 500),
        line: Number(input.line || 0),
        column: Number(input.column || 0),
        status: Number(input.status || 0) || undefined,
        requestId: String(input.requestId || '').slice(0, 100) || undefined,
        userAgent: String(input.userAgent || '').slice(0, 500),
      });
      context.json(context.res, 202, { accepted: true });
      return true;
    }
    if (context.pathname === '/api/diagnostics' && context.req.method === 'GET') {
      context.json(context.res, 200, await context.diagnostics());
      return true;
    }
    return false;
  };
}
