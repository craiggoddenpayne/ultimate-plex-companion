import { requirePlex } from '../../core/router.ts';
import { commandDeck } from './command-deck-server.ts';

export function createCommandDeckRoutes() {
  return async context => {
    if (context.pathname !== '/api/command-deck' || context.req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (config) context.json(context.res, 200, await commandDeck(config, context));
    return true;
  };
}
