import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAutomationEngine, nextOccurrence } from '../../../src/server/features/automations/automation-server.ts';

test('automation rules persist, preview safely and execute Plex actions', async (t) => {
  const configDir = await mkdtemp(join(tmpdir(), 'plex-automations-'));
  t.after(() => rm(configDir, { recursive: true, force: true }));
  const commands = [];
  const dependencies = {
    configDir,
    savedConfig: async () => ({ plexUrl: 'http://plex', token: 'secret' }),
    plexFetch: async (_config, path) =>
      path === '/library/sections'
        ? { MediaContainer: { Directory: [{ key: '1', title: 'Movies', type: 'movie' }] } }
        : { MediaContainer: {} },
    plexCommand: async (_config, path) => commands.push(path),
    storageAnalysis: async () => ({ candidateCount: 2, scanned: 40, estimatedSaving: 1024 }),
    overview: async () => ({ titleCount: 40, libraryCount: 1, sessions: [] }),
  };
  const engine = createAutomationEngine(dependencies);
  const rule = await engine.create({
    type: 'library_refresh',
    name: 'Night scan',
    enabled: true,
    schedule: { frequency: 'daily', time: '03:00' },
    libraryKey: '1',
  });
  assert.equal(rule.enabled, true);
  assert.ok(rule.nextRunAt);

  const preview = await engine.run(rule.id, { dryRun: true });
  assert.equal(preview.status, 'success');
  assert.equal(commands.length, 0);
  const live = await engine.run(rule.id);
  assert.equal(live.status, 'success');
  assert.ok(live.durationMs >= 0);
  assert.equal(live.result.headline, 'Refresh requested');
  assert.equal(live.result.items[0].title, 'Movies');
  assert.equal(live.result.facts[0].value, 'Library refresh');
  assert.deepEqual(commands, ['/library/sections/1/refresh']);

  await engine.update(rule.id, { enabled: false });
  const persisted = createAutomationEngine(dependencies);
  const listing = await persisted.list();
  assert.equal(listing.rules[0].enabled, false);
  assert.equal(listing.runs.length, 2);
  assert.equal(listing.templates.length, 6);
  assert.equal(await persisted.setPaused(true), true);
  assert.equal((await persisted.list()).paused, true);
  assert.equal(await persisted.setPaused(false), false);
  await persisted.remove(rule.id);
  assert.equal((await persisted.list()).rules.length, 0);
});

test('scheduler calculates future hourly, daily and weekly events', () => {
  const now = new Date('2026-09-05T10:30:00Z');
  assert.equal(nextOccurrence({ frequency: 'hourly' }, now), '2026-09-05T11:00:00.000Z');
  const daily = new Date(nextOccurrence({ frequency: 'daily', time: '12:15' }, now));
  assert.equal(daily.getHours(), 12);
  assert.equal(daily.getMinutes(), 15);
  assert.ok(Date.parse(nextOccurrence({ frequency: 'weekly', time: '09:00', weekday: 1 }, now)) > now.getTime());
});
