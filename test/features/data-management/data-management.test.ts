import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearApplicationData,
  dataManagementSummary,
} from '../../../src/server/features/data-management/data-management-server.ts';

function dependencies({ active = 0, running = 0 } = {}) {
  const calls = [];
  return {
    calls,
    queue: {
      summary: () => ({
        total: 7,
        active,
        activeJob: active ? 'working' : null,
        counts: { queued: 2, ready: 2, failed: 1 },
      }),
      clearAll: async () => {
        calls.push('queue');
        return { total: 7 };
      },
    },
    automations: {
      dataSummary: async () => ({ rules: 3, runs: 11, running, paused: false }),
      clearAll: async () => {
        calls.push('automations');
        return { rules: 3, runs: 11 };
      },
    },
  };
}

test('data reset preview describes records and explicitly preserved state', async () => {
  const source = dependencies();
  const preview = await dataManagementSummary(source);
  assert.equal(preview.optimization.jobs, 7);
  assert.equal(preview.optimization.queued, 2);
  assert.equal(preview.automation.rules, 3);
  assert.equal(preview.canReset, true);
  assert.ok(preview.preserved.includes('media files and generated encode outputs'));
});

test('application data reset clears both stores in a guarded order', async () => {
  const source = dependencies();
  const result = await clearApplicationData(source);
  assert.deepEqual(source.calls, ['queue', 'automations']);
  assert.deepEqual(result.cleared, { optimizationJobs: 7, automationRules: 3, automationRuns: 11 });
});

test('application data reset refuses while operational work is active', async () => {
  const source = dependencies({ active: 1 });
  await assert.rejects(() => clearApplicationData(source), /active optimizations and automations/);
  assert.deepEqual(source.calls, []);
});
