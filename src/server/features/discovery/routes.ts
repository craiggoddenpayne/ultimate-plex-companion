import { requestOptions, refreshRequested, requirePlex } from '../../core/router.ts';

export function createDiscoveryRoutes() {
  return async context => {
    const { pathname, req, res, json } = context;
    if (!['/api/overview','/api/analysis/storage','/api/discovery'].includes(pathname) || req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (!config) return true;
    if (pathname === '/api/overview') json(res, 200, await context.overview(config));
    if (pathname === '/api/analysis/storage') json(res, 200, await context.storageAnalysis(config, refreshRequested(req)));
    if (pathname === '/api/discovery') json(res, 200, await context.discoveryRecommendations(config, requestOptions(req)));
    return true;
  };
}
