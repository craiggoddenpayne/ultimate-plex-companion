import { requestOptions, requirePlex } from '../../core/router.js';
import { personalRecommendations } from './recommendations-server.js';

export function createRecommendationRoutes() {
  return async context => {
    if (context.pathname !== '/api/recommendations' || context.req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (config) context.json(context.res, 200, await personalRecommendations(config, context, requestOptions(context.req)));
    return true;
  };
}
