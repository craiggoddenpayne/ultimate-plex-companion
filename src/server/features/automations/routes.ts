export function createAutomationRoutes(automationEngine) {
  return async (context) => {
    const { pathname, req, res, json } = context;
    if (pathname === '/api/automations' && req.method === 'GET') {
      json(res, 200, await automationEngine.list());
      return true;
    }
    if (pathname === '/api/automations' && req.method === 'POST') {
      json(res, 201, { rule: await automationEngine.create(await context.body(req)) });
      return true;
    }
    if (pathname === '/api/automations/state' && req.method === 'PATCH') {
      json(res, 200, { paused: await automationEngine.setPaused((await context.body(req)).paused) });
      return true;
    }

    const parts = pathname.split('/');
    if (
      parts.length === 6 &&
      parts[1] === 'api' &&
      parts[2] === 'automations' &&
      parts[3] === 'recipes' &&
      parts[5] === 'run' &&
      req.method === 'POST'
    ) {
      const input = await context.body(req);
      const run = await automationEngine.runRecipe(parts[4], { libraryKey: input.libraryKey || 'all' });
      json(res, run.status === 'success' ? 200 : 400, { run });
      return true;
    }
    if (
      parts.length === 5 &&
      parts[1] === 'api' &&
      parts[2] === 'automations' &&
      parts[4] === 'run' &&
      req.method === 'POST'
    ) {
      const input = await context.body(req);
      const run = await automationEngine.run(parts[3], { dryRun: input.dryRun === true });
      json(res, run.status === 'success' ? 200 : 400, { run });
      return true;
    }
    if (parts.length === 4 && parts[1] === 'api' && parts[2] === 'automations' && req.method === 'PATCH') {
      json(res, 200, { rule: await automationEngine.update(parts[3], await context.body(req)) });
      return true;
    }
    if (parts.length === 4 && parts[1] === 'api' && parts[2] === 'automations' && req.method === 'DELETE') {
      await automationEngine.remove(parts[3]);
      json(res, 200, { ok: true });
      return true;
    }
    return false;
  };
}
