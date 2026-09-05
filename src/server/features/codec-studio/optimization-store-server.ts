import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const resumableStates = new Set(['preparing', 'encoding', 'verifying']);
const validStates = new Set(['queued', 'preparing', 'encoding', 'verifying', 'ready', 'failed', 'replaced', 'replacement-partial', 'cancelled']);

function validJob(job) {
  return job && typeof job === 'object' && /^[a-f0-9-]+$/.test(String(job.id || ''))
    && /^\d+$/.test(String(job.ratingKey || '')) && validStates.has(job.state);
}

export function createOptimizationStore(configDir) {
  const file = join(configDir, 'optimization-jobs.json');
  let pendingWrite = Promise.resolve();

  async function load() {
    let saved;
    try { saved = JSON.parse(await readFile(file, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return { jobs:[], recovered:0, paused:false };
      throw new Error(`Could not restore optimization jobs: ${error.message}`);
    }
    const jobs = (Array.isArray(saved?.jobs) ? saved.jobs : []).filter(validJob);
    let recovered = 0;
    for (const job of jobs) {
      if (!resumableStates.has(job.state)) continue;
      if (job.cancelRequested) {
        job.state = 'cancelled';
        job.progress = 0;
        job.cancelledAt = new Date().toISOString();
        delete job.cancelRequested;
        job.updatedAt = job.cancelledAt;
        recovered++;
        continue;
      }
      job.state = 'queued';
      job.progress = 0;
      job.recovered = true;
      job.resumeCount = Number(job.resumeCount || 0) + 1;
      job.updatedAt = new Date().toISOString();
      recovered++;
    }
    return { jobs, recovered, paused:saved?.paused === true };
  }

  function save(jobs, options: any = {}) {
    const snapshot = JSON.stringify({ version:2, savedAt:new Date().toISOString(), paused:options.paused === true, jobs:[...jobs.values()] }, null, 2) + '\n';
    pendingWrite = pendingWrite.catch(() => {}).then(async () => {
      await mkdir(configDir, { recursive:true });
      const temporary = `${file}.tmp`;
      await writeFile(temporary, snapshot, { mode:0o600 });
      await rename(temporary, file);
    });
    return pendingWrite;
  }

  return { load, save };
}
