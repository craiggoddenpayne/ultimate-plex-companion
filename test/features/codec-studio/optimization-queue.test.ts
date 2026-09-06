import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearOptimizationHistory,
  optimizationEta,
  optimizationSummary,
  parseFfmpegProgress,
  removeOptimizationJob,
  reorderQueuedJob,
  requestOptimizationCancellation,
  updateQueuedJob,
} from '../../../src/server/features/codec-studio/optimization-queue-server.ts';

test('FFmpeg progress is normalized into safe live encoding telemetry', () => {
  const telemetry = parseFfmpegProgress(`frame=18420
fps=72.4
stream_0_0_q=24.6
bitrate=812.5kbits/s
total_size=182345678
out_time_us=614000000
out_time=00:10:14.000000
dup_frames=2
drop_frames=1
speed=2.41x
progress=continue
`);
  assert.deepEqual(telemetry, {
    frame: 18420,
    fps: 72.4,
    quality: 24.6,
    bitrateKbps: 812.5,
    outputBytes: 182345678,
    encodedSeconds: 614,
    encodedTime: '00:10:14.000000',
    duplicateFrames: 2,
    droppedFrames: 1,
    speed: 2.41,
    phase: 'continue',
  });
});

test('optimization queue supports summaries, ETA, ordering and safe state changes', () => {
  const jobs = new Map<string, any>([
    [
      'active',
      {
        id: 'active',
        state: 'encoding',
        progress: 25,
        startedAt: '2026-01-01T00:00:00.000Z',
        targetLabel: 'HEVC',
        estimatedSaving: 100,
      },
    ],
    ['one', { id: 'one', state: 'queued', progress: 0, targetLabel: 'AV1', estimatedSaving: 200 }],
    ['two', { id: 'two', state: 'queued', progress: 0, targetLabel: 'HEVC', estimatedSaving: 300 }],
    ['failed', { id: 'failed', state: 'failed', progress: 10, error: 'nope', targetLabel: 'HEVC' }],
    ['done', { id: 'done', state: 'replaced', progress: 100, reclaimed: 80, targetLabel: 'HEVC' }],
  ]);
  const summary = optimizationSummary(jobs, 'active');
  assert.equal(summary.active, 3);
  assert.equal(summary.estimatedSaving, 600);
  assert.equal(summary.reclaimed, 80);
  assert.deepEqual(summary.targets, { HEVC: 4, AV1: 1 });
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
  const jobs = new Map([['active', { id: 'active', state: 'encoding', progress: 20 }]]);
  assert.throws(() => updateQueuedJob(jobs, 'active', 'cancel'), /Only a queued job/);
  assert.throws(() => reorderQueuedJob(jobs, 'active', 'up'), /Only queued jobs/);
});

test('cancellation is immediate for waiting jobs and requested safely for active encodes', () => {
  const jobs = new Map<string, any>([
    ['waiting', { id: 'waiting', state: 'queued', progress: 0 }],
    ['active', { id: 'active', state: 'encoding', progress: 48 }],
    ['ready', { id: 'ready', state: 'ready', progress: 100 }],
  ]);
  requestOptimizationCancellation(jobs, 'waiting', 'active', '2026-09-05T12:00:00.000Z');
  assert.equal(jobs.get('waiting').state, 'cancelled');
  requestOptimizationCancellation(jobs, 'active', 'active', '2026-09-05T12:01:00.000Z');
  assert.equal(jobs.get('active').state, 'encoding');
  assert.equal(jobs.get('active').cancelRequested, true);
  assert.throws(() => requestOptimizationCancellation(jobs, 'ready', 'active'), /Only a queued or active optimization/);
});

test('queued jobs can be removed for clean restaging without touching active work', () => {
  const queued = { id: 'waiting', ratingKey: '42', state: 'queued', sourcePath: '/media/original.mkv' };
  const jobs = new Map<string, any>([
    ['waiting', queued],
    ['active', { id: 'active', state: 'encoding' }],
    ['ready', { id: 'ready', state: 'ready' }],
  ]);
  assert.equal(removeOptimizationJob(jobs, 'waiting', 'active'), queued);
  assert.equal(jobs.has('waiting'), false);
  assert.equal(queued.sourcePath, '/media/original.mkv');
  assert.throws(() => removeOptimizationJob(jobs, 'active', 'active'), /not actively encoding/);
  assert.throws(() => removeOptimizationJob(jobs, 'ready', 'active'), /Only queued, failed or cancelled/);
});
