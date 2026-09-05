import { refreshRequested, requirePlex } from '../../core/router.js';
import { invalidateLibraryInsights, libraryInsights } from './library-insights-server.js';
import { deleteOverlap } from './library-overlap-server.js';

export function createLibraryRoutes() {
  return async context => {
    const { pathname, req, res, json } = context;
    if (pathname === '/api/library/insights' && req.method === 'GET') {
      const config = await requirePlex(context);
      if (config) json(res, 200, await libraryInsights(config, context, refreshRequested(req)));
      return true;
    }
    if (pathname === '/api/library/overlaps/delete' && req.method === 'POST') {
      const config = await requirePlex(context);
      if (!config) return true;
      const report = await libraryInsights(config, context, true);
      const result = await deleteOverlap(config, { ...context, invalidate:invalidateLibraryInsights }, await context.body(req), report);
      json(res, 200, result);
      return true;
    }
    return false;
  };
}
