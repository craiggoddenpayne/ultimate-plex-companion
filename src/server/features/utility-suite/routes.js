import { refreshRequested, requirePlex } from '../../core/router.js';
import { utilitySuite } from './utility-suite-server.js';

export function createUtilityRoutes() {
  return async context => {
    if (context.pathname !== '/api/utility-suite' || context.req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (config) context.json(context.res, 200, await utilitySuite(config, context, refreshRequested(context.req)));
    return true;
  };
}
