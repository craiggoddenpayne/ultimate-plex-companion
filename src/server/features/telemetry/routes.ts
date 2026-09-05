import { requirePlex } from '../../core/router.ts';
import { peopleTelemetry, streamTelemetry } from './telemetry-server.ts';

export function createTelemetryRoutes() {
  return async context => {
    const { pathname, req, res, json } = context;
    if (!['/api/streams','/api/people'].includes(pathname) || req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (!config) return true;
    if (pathname === '/api/streams') json(res, 200, await streamTelemetry(config, context.plexFetch));
    else json(res, 200, await peopleTelemetry(config, context.plexFetch, Number(new URL(req.url, 'http://localhost').searchParams.get('days') || 30)));
    return true;
  };
}
