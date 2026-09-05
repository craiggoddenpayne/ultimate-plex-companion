import { refreshRequested, requirePlex } from '../../core/router.ts';
import { utilitySuite } from './utility-suite-server.ts';

export function createUtilityRoutes() {
  return async context => {
    if (context.pathname !== '/api/utility-suite' || context.req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (config) context.json(context.res, 200, await utilitySuite(config, context, refreshRequested(context.req)));
    return true;
  };
}
