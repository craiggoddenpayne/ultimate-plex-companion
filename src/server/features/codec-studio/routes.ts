import { isAbsolute } from 'node:path';
import { requirePlex } from '../../core/router.ts';
import { supportedTargets } from './codec-modernizer-server.ts';
import { clearOptimizationHistory, optimizationSummary, updateQueuedJob } from './optimization-queue-server.ts';

export function createCodecRoutes(queue) {
  return async context => {
    const { pathname, req, res, json } = context;
    if (!pathname.startsWith('/api/optimization/')) return false;

    if (pathname === '/api/optimization/config' && req.method === 'GET') {
      const config = await context.savedConfig();
      const settings = context.optimizationSettings(config || {});
      let encoderAvailable = true;
      let targets = [];
      try {
        await context.runProcess('ffprobe', ['-version']);
        const capability = await context.runProcess('ffmpeg', ['-hide_banner','-encoders']);
        targets = supportedTargets(capability.stdout + ' ' + capability.stderr);
      } catch { encoderAvailable = false; targets = supportedTargets(''); }
      json(res, 200, { ...settings, encoderAvailable, targets, managed:Boolean(process.env.PLEX_MEDIA_ROOT || process.env.MEDIA_ROOT) });
      return true;
    }
    if (pathname === '/api/optimization/config' && req.method === 'POST') {
      const config = await requirePlex(context);
      if (!config) return true;
      if (process.env.PLEX_MEDIA_ROOT || process.env.MEDIA_ROOT) { json(res, 409, { error:'Media paths are managed by environment variables.' }); return true; }
      const settings = context.optimizationSettings({ optimization:await context.body(req) });
      if (!isAbsolute(settings.plexPathRoot) || !isAbsolute(settings.mediaPathRoot)) throw new Error('Both media roots must be absolute paths.');
      await context.access(settings.mediaPathRoot);
      await context.saveConfig({ plexUrl:config.plexUrl, token:config.token, optimization:settings });
      json(res, 200, { ...settings, ok:true });
      return true;
    }
    if (pathname === '/api/optimization/jobs' && req.method === 'GET') {
      json(res, 200, { jobs:[...queue.jobs.values()].map(queue.publicJob), paused:queue.isPaused(), summary:optimizationSummary(queue.jobs, queue.activeJob()) });
      return true;
    }
    if (pathname === '/api/optimization/queue' && req.method === 'PATCH') {
      const input = await context.body(req);
      if (typeof input.paused !== 'boolean') throw new Error('Paused must be true or false.');
      await queue.setPaused(input.paused);
      json(res, 200, { paused:queue.isPaused(), summary:optimizationSummary(queue.jobs, queue.activeJob()) });
      return true;
    }
    if (pathname === '/api/optimization/queue/clear' && req.method === 'POST') {
      if ((await context.body(req)).confirmed !== true) throw new Error('Confirm history cleanup before continuing.');
      const removed = clearOptimizationHistory(queue.jobs);
      await queue.persist();
      json(res, 200, { removed, summary:optimizationSummary(queue.jobs, queue.activeJob()) });
      return true;
    }
    if (pathname === '/api/optimization/jobs' && req.method === 'POST') {
      const config = await requirePlex(context);
      if (!config) return true;
      const input = await context.body(req);
      json(res, 202, { job:await queue.create(config, input.ratingKey, input.targetCodec) });
      return true;
    }
    const action = pathname.match(/^\/api\/optimization\/jobs\/([a-f0-9-]+)\/action$/);
    if (action && req.method === 'POST') {
      const input = await context.body(req);
      const job = input.action === 'cancel'
        ? await queue.cancel(action[1])
        : updateQueuedJob(queue.jobs, action[1], input.action);
      await queue.persist();
      if (input.action === 'retry') queue.runNext();
      json(res, 200, { job:queue.publicJob(job), summary:optimizationSummary(queue.jobs, queue.activeJob()) });
      return true;
    }
    const replace = pathname.match(/^\/api\/optimization\/jobs\/([a-f0-9-]+)\/replace$/);
    if (replace && req.method === 'POST') {
      const config = await context.savedConfig();
      const job = queue.jobs.get(replace[1]);
      if (!job) { json(res, 404, { error:'Optimization job not found.' }); return true; }
      json(res, 200, { job:await queue.replace(job, config, (await context.body(req)).confirmed) });
      return true;
    }
    return false;
  };
}
