import { requirePlex } from '../../core/router.ts';
import { peopleTelemetry, plexAccountDevices, revokePlexClient, streamTelemetry } from './telemetry-server.ts';

export function createTelemetryRoutes() {
  return async (context) => {
    const { pathname, req, res, json } = context;
    if (pathname === '/api/people/devices/revoke' && req.method === 'POST') {
      const config = await requirePlex(context);
      if (!config) return true;
      const input = await context.body(req);
      json(res, 200, await revokePlexClient(config, input.clientIdentifier, input.confirmed === true));
      return true;
    }
    if (!['/api/streams', '/api/people'].includes(pathname) || req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (!config) return true;
    if (pathname === '/api/streams') json(res, 200, await streamTelemetry(config, context.plexFetch));
    else {
      const accountDevices = await plexAccountDevices(config).catch(() => null);
      json(
        res,
        200,
        await peopleTelemetry(
          config,
          context.plexFetch,
          Number(new URL(req.url, 'http://localhost').searchParams.get('days') || 30),
          accountDevices,
        ),
      );
    }
    return true;
  };
}
