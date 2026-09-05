import { requestOptions, requirePlex } from '../../core/router.ts';
import { personalRecommendations } from './recommendations-server.ts';

export function createRecommendationRoutes() {
  return async context => {
    if (context.pathname !== '/api/recommendations' || context.req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (config) context.json(context.res, 200, await personalRecommendations(config, context, requestOptions(context.req)));
    return true;
  };
}
