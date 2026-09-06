import { requirePlex } from '../../core/router.ts';
import { plexServerIntelligence } from './server-intelligence-server.ts';

export function createServerInfoRoutes() {
  return async (context) => {
    if (context.pathname !== '/api/server-intelligence' || context.req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (!config) return true;
    context.json(context.res, 200, await plexServerIntelligence(config, context));
    return true;
  };
}
