import { HttpError } from '../../core/http.ts';
import { clearApplicationData, dataManagementSummary } from './data-management-server.ts';

export function createDataManagementRoutes(dependencies) {
  return async (context) => {
    if (context.pathname === '/api/settings/data' && context.req.method === 'GET') {
      context.json(context.res, 200, await dataManagementSummary(dependencies));
      return true;
    }
    if (context.pathname === '/api/settings/data/reset' && context.req.method === 'POST') {
      const input = await context.body(context.req);
      if (input.confirmed !== true)
        throw new HttpError(
          400,
          'Confirm the application data reset before continuing.',
          'RESET_CONFIRMATION_REQUIRED',
        );
      const result = await clearApplicationData(dependencies);
      context.logger.warn('settings.application_data_reset', result.cleared);
      context.json(context.res, 200, result);
      return true;
    }
    return false;
  };
}
