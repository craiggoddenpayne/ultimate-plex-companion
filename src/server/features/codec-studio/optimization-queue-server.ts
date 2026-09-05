const activeStates = new Set(['queued', 'preparing', 'encoding', 'verifying']);
const finishedStates = new Set(['replaced', 'cancelled', 'failed']);

export function optimizationEta(job, now = Date.now()) {
  if (job?.state !== 'encoding' || !job.startedAt || Number(job.progress) <= 0 || Number(job.progress) >= 100)
    return null;
  const started = Date.parse(job.startedAt);
  if (!Number.isFinite(started) || now <= started) return null;
  const elapsed = (now - started) / 1000;
  return Math.max(0, Math.round((elapsed * (100 - Number(job.progress))) / Number(job.progress)));
}

export function optimizationSummary(jobs, activeJob = null) {
  const list = [...jobs.values()];
  const counts = Object.fromEntries(
    ['queued', 'preparing', 'encoding', 'verifying', 'ready', 'failed', 'replaced', 'cancelled'].map((state) => [
      state,
      0,
    ]),
  );
  const targets = {};
  let estimatedSaving = 0;
  let reclaimed = 0;
  for (const job of list) {
    counts[job.state] = (counts[job.state] || 0) + 1;
    if (activeStates.has(job.state) || job.state === 'ready') estimatedSaving += Number(job.estimatedSaving || 0);
    reclaimed += Number(job.reclaimed || 0);
    const key = job.targetLabel || String(job.targetCodec || 'Modern').toUpperCase();
    targets[key] = (targets[key] || 0) + 1;
  }
  return {
    total: list.length,
    active: list.filter((job) => activeStates.has(job.state)).length,
    completed: counts.replaced + counts.cancelled,
    counts,
    estimatedSaving,
    reclaimed,
    targets,
    activeJob,
  };
}

export function reorderQueuedJob(jobs, id, direction) {
  const ordered = [...jobs.values()];
  const queuedIndexes = ordered
    .map((job, index) => (job.state === 'queued' ? index : -1))
    .filter((index) => index >= 0);
  const currentIndex = ordered.findIndex((job) => job.id === id);
  const queuedPosition = queuedIndexes.indexOf(currentIndex);
  const destinationPosition = queuedPosition + (direction === 'up' ? -1 : direction === 'down' ? 1 : 0);
  if (queuedPosition < 0) throw new Error('Only queued jobs can be reordered.');
  if (!['up', 'down'].includes(direction)) throw new Error('Choose up or down when reordering a job.');
  if (destinationPosition < 0 || destinationPosition >= queuedIndexes.length) return false;
  const destinationIndex = queuedIndexes[destinationPosition];
  [ordered[currentIndex], ordered[destinationIndex]] = [ordered[destinationIndex], ordered[currentIndex]];
  jobs.clear();
  for (const job of ordered) jobs.set(job.id, job);
  return true;
}

export function updateQueuedJob(jobs, id, action, now = new Date().toISOString()) {
  const job = jobs.get(id);
  if (!job) throw new Error('Optimization job not found.');
  if (action === 'cancel') {
    if (job.state !== 'queued') throw new Error('Only a queued job can be cancelled.');
    Object.assign(job, { state: 'cancelled', progress: 0, updatedAt: now });
    return job;
  }
  if (action === 'retry') {
    if (!['failed', 'cancelled'].includes(job.state)) throw new Error('Only failed or cancelled jobs can be retried.');
    Object.assign(job, { state: 'queued', progress: 0, updatedAt: now });
    delete job.error;
    delete job.startedAt;
    return job;
  }
  if (['up', 'down'].includes(action)) {
    reorderQueuedJob(jobs, id, action);
    job.updatedAt = now;
    return job;
  }
  throw new Error('Unknown queue action.');
}

export function requestOptimizationCancellation(jobs, id, activeJob = null, now = new Date().toISOString()) {
  const job = jobs.get(id);
  if (!job) throw new Error('Optimization job not found.');
  if (job.state === 'queued' && activeJob !== id) return updateQueuedJob(jobs, id, 'cancel', now);
  if (activeJob !== id || !['queued', 'preparing', 'encoding', 'verifying'].includes(job.state))
    throw new Error('Only a queued or active optimization can be cancelled.');
  job.cancelRequested = true;
  job.updatedAt = now;
  return job;
}

export function clearOptimizationHistory(jobs) {
  let removed = 0;
  for (const [id, job] of jobs)
    if (finishedStates.has(job.state)) {
      jobs.delete(id);
      removed++;
    }
  return removed;
}
