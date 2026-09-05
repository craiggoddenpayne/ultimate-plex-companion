import { requirePlex } from '../../core/router.js';
import { answerCompanion, companionNotifications, universalSearch } from './companion-server.js';
import { streamTelemetry } from '../telemetry/telemetry-server.js';

export function createCompanionRoutes(automationEngine) {
  return async context => {
    const { pathname, req, res, json } = context;
    if (!['/api/search','/api/assistant','/api/notifications'].includes(pathname)) return false;
    const config = await requirePlex(context);
    if (!config) return true;
    if (pathname === '/api/search' && req.method === 'GET') {
      json(res, 200, await universalSearch(config, context.plexFetch, new URL(req.url, 'http://localhost').searchParams.get('q')));
      return true;
    }
    if (pathname === '/api/assistant' && req.method === 'POST') {
      json(res, 200, await answerCompanion(config, { ...context, automationEngine, streamTelemetry }, (await context.body(req)).question));
      return true;
    }
    if (pathname === '/api/notifications' && req.method === 'GET') {
      json(res, 200, await companionNotifications(config, { ...context, automationEngine, streamTelemetry }));
      return true;
    }
    return false;
  };
}
