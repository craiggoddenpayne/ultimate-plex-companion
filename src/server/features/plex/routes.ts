import { requirePlex } from '../../core/router.ts';
import { plexItemUrl } from './plex-link-server.ts';

export function createPlexRoutes() {
  return async (context) => {
    const match = context.pathname.match(/^\/api\/plex\/open\/(\d+)$/);
    if (!match || context.req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (!config) return true;
    const identity = await context.inspectPlex(config);
    context.res.writeHead(302, {
      Location: plexItemUrl(identity.machineIdentifier, match[1]),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    });
    context.res.end();
    return true;
  };
}
