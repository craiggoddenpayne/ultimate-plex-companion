export function composeFeatureRouters(routers) {
  const active = routers.filter(router => typeof router === 'function');
  return async context => {
    for (const router of active) {
      if (await router(context)) return true;
    }
    return false;
  };
}

export async function requirePlex(context) {
  const config = await context.savedConfig();
  if (config) return config;
  context.json(context.res, 428, { error:'Plex is not configured.' });
  return null;
}

export function requestOptions(req) {
  return Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
}

export function refreshRequested(req) {
  return new URL(req.url, 'http://localhost').searchParams.get('refresh') === '1';
}
