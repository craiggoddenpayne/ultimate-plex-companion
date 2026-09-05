export async function dataManagementSummary({ queue, automations }) {
  const automation = await automations.dataSummary();
  const optimization = queue.summary();
  return {
    optimization: {
      jobs: optimization.total,
      active: optimization.activeJob ? 1 : 0,
      queued: optimization.counts.queued || 0,
      ready: optimization.counts.ready || 0,
      failed: optimization.counts.failed || 0,
    },
    automation,
    canReset: !optimization.activeJob && automation.running === 0,
    preserved: ['Plex connection and token', 'media files and generated encode outputs', 'browser theme and text size'],
  };
}

export async function clearApplicationData({ queue, automations }) {
  const preview = await dataManagementSummary({ queue, automations });
  if (!preview.canReset)
    throw new Error('Cancel or finish active optimizations and automations before clearing application data.');
  const optimization = await queue.clearAll();
  const automation = await automations.clearAll();
  return {
    cleared: {
      optimizationJobs: optimization.total,
      automationRules: automation.rules,
      automationRuns: automation.runs,
    },
    preserved: preview.preserved,
    completedAt: new Date().toISOString(),
  };
}
