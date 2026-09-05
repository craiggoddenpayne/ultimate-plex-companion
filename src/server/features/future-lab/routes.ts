import { refreshRequested, requirePlex } from '../../core/router.js';
import { futureLab } from './future-lab-server.js';

export function createFutureLabRoutes() {
  return async context => {
    if (context.pathname !== '/api/lab' || context.req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (config) context.json(context.res, 200, await futureLab(config, context, refreshRequested(context.req)));
    return true;
  };
}
