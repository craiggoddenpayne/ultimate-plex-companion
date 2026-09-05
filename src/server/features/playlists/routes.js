import { requirePlex } from '../../core/router.js';
import { createGeneratedPlaylist, playlistStudio } from './playlist-studio-server.js';

export function createPlaylistRoutes() {
  return async context => {
    const { pathname, req, res, json } = context;
    if (pathname === '/api/playlists/studio' && req.method === 'GET') {
      const config = await requirePlex(context);
      if (config) json(res, 200, await playlistStudio(config, context));
      return true;
    }
    if (pathname === '/api/playlists/generate' && req.method === 'POST') {
      const config = await requirePlex(context);
      if (config) json(res, 201, { playlist:await createGeneratedPlaylist(config, context, await context.body(req)) });
      return true;
    }
    return false;
  };
}
