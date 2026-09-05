export function createConnectionRoutes() {
  return async (context) => {
    const { pathname, req, res, json } = context;
    if (pathname === '/api/config' && req.method === 'GET') {
      const config = await context.savedConfig();
      json(res, 200, {
        configured: Boolean(config),
        plexUrl: config?.plexUrl || '',
        tokenSource: context.envConfig ? 'environment' : config ? 'saved' : 'none',
      });
      return true;
    }
    if (pathname === '/api/config/test' && req.method === 'POST') {
      const config = context.normalizeConfig(await context.body(req));
      json(res, 200, { ok: true, server: await context.inspectPlex(config) });
      return true;
    }
    if (pathname === '/api/config' && req.method === 'POST') {
      if (context.envConfig) {
        json(res, 409, { error: 'Settings are managed by PLEX_URL and PLEX_TOKEN environment variables.' });
        return true;
      }
      const previous = await context.savedConfig();
      const config = {
        ...context.normalizeConfig(await context.body(req)),
        optimization: previous?.optimization || context.optimizationSettings(),
      };
      const server = await context.inspectPlex(config);
      await context.saveConfig(config);
      context.invalidateCaches();
      json(res, 200, { ok: true, server });
      return true;
    }
    return false;
  };
}
