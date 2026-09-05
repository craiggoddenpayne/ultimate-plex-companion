import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOptimizationStore } from '../../../src/server/features/codec-studio/optimization-store-server.ts';

test('optimization jobs persist and interrupted work is safely re-queued', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'plex-jobs-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createOptimizationStore(directory);
  const jobs = new Map([
    ['active', { id: 'a1-b2', ratingKey: '42', title: 'Active film', state: 'encoding', progress: 61 }],
    ['ready', { id: 'c3-d4', ratingKey: '43', title: 'Ready film', state: 'ready', progress: 100, verified: true }],
  ]);
  await store.save(jobs, { paused: true });
  const restored = await createOptimizationStore(directory).load();
  assert.equal(restored.recovered, 1);
  assert.equal(restored.jobs[0].state, 'queued');
  assert.equal(restored.jobs[0].progress, 0);
  assert.equal(restored.jobs[0].recovered, true);
  assert.equal(restored.jobs[1].state, 'ready');
  assert.equal(restored.jobs[1].verified, true);
  assert.equal(restored.paused, true);
});

test('a persisted cancellation request is finalized instead of resumed', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'plex-jobs-cancel-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createOptimizationStore(directory);
  const jobs = new Map([
    [
      'active',
      { id: 'a1-b2', ratingKey: '42', title: 'Cancelled film', state: 'encoding', progress: 61, cancelRequested: true },
    ],
  ]);
  await store.save(jobs);
  const restored = await createOptimizationStore(directory).load();
  assert.equal(restored.recovered, 1);
  assert.equal(restored.jobs[0].state, 'cancelled');
  assert.equal(restored.jobs[0].progress, 0);
  assert.equal('cancelRequested' in restored.jobs[0], false);
});
