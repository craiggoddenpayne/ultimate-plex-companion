import test from 'node:test';
import assert from 'node:assert/strict';
import { clearOptimizationHistory, optimizationEta, optimizationSummary, reorderQueuedJob, updateQueuedJob } from '../optimization-queue-server.js';

test('optimization queue supports summaries, ETA, ordering and safe state changes', () => {
  const jobs = new Map([
    ['active', { id:'active', state:'encoding', progress:25, startedAt:'2026-01-01T00:00:00.000Z', targetLabel:'HEVC', estimatedSaving:100 }],
    ['one', { id:'one', state:'queued', progress:0, targetLabel:'AV1', estimatedSaving:200 }],
    ['two', { id:'two', state:'queued', progress:0, targetLabel:'HEVC', estimatedSaving:300 }],
    ['failed', { id:'failed', state:'failed', progress:10, error:'nope', targetLabel:'HEVC' }],
    ['done', { id:'done', state:'replaced', progress:100, reclaimed:80, targetLabel:'HEVC' }],
  ]);
  const summary = optimizationSummary(jobs, 'active');
  assert.equal(summary.active, 3);
  assert.equal(summary.estimatedSaving, 600);
  assert.equal(summary.reclaimed, 80);
  assert.deepEqual(summary.targets, { HEVC:4, AV1:1 });
  assert.equal(optimizationEta(jobs.get('active'), Date.parse('2026-01-01T00:10:00.000Z')), 1800);
  assert.equal(reorderQueuedJob(jobs, 'two', 'up'), true);
  assert.deepEqual([...jobs.keys()].slice(1, 3), ['two', 'one']);
  updateQueuedJob(jobs, 'one', 'cancel');
  assert.equal(jobs.get('one').state, 'cancelled');
  updateQueuedJob(jobs, 'failed', 'retry');
  assert.equal(jobs.get('failed').state, 'queued');
  assert.equal('error' in jobs.get('failed'), false);
  assert.equal(clearOptimizationHistory(jobs), 2);
  assert.equal(jobs.has('one'), false);
  assert.equal(jobs.has('done'), false);
});

test('optimization queue refuses actions against active work', () => {
  const jobs = new Map([['active', { id:'active', state:'encoding', progress:20 }]]);
  assert.throws(() => updateQueuedJob(jobs, 'active', 'cancel'), /Only a queued job/);
  assert.throws(() => reorderQueuedJob(jobs, 'active', 'up'), /Only queued jobs/);
});
