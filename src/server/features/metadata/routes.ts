import { refreshRequested, requirePlex } from '../../core/router.ts';
import { invalidateLibraryInsights } from '../library/library-insights-server.ts';
import { invalidateMetadataCenter, metadataCenter } from './metadata-center-server.ts';
import { metadataUpdate, publicMetadata } from './metadata-helper-server.ts';

export function createMetadataRoutes() {
  return async (context) => {
    const { pathname, req, res, json } = context;
    if (pathname === '/api/metadata-center' && req.method === 'GET') {
      const config = await requirePlex(context);
      if (config) json(res, 200, await metadataCenter(config, context, refreshRequested(req)));
      return true;
    }
    const match = pathname.match(/^\/api\/library\/metadata\/(\d+)$/);
    if (!match || !['GET', 'POST'].includes(req.method)) return false;
    const config = await requirePlex(context);
    if (!config) return true;
    const data = await context.plexFetch(config, `/library/metadata/${match[1]}`);
    const item = data.MediaContainer?.Metadata?.[0];
    if (!item) {
      json(res, 404, { error: 'Plex metadata record not found.' });
      return true;
    }
    if (req.method === 'GET') {
      json(res, 200, publicMetadata(item));
      return true;
    }
    const update = metadataUpdate(item, await context.body(req));
    if (update.changed.some((field) => field !== 'artwork')) await context.plexCommand(config, update.path, 'PUT');
    if (update.posterPath) await context.plexCommand(config, update.posterPath, 'POST');
    invalidateLibraryInsights();
    invalidateMetadataCenter();
    context.invalidateCaches();
    json(res, 200, { ok: true, changed: update.changed });
    return true;
  };
}
