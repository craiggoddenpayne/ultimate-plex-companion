import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeJsonAtomic } from '../../core/atomic-json-store.ts';
import {
  arrivalReport,
  healthReport,
  metadataReport,
  previewReports,
  qualityReport,
  refreshReport,
  streamReport,
} from './automation-report-server.ts';
import {
  backlogReport,
  editionReport,
  formatReport,
  growthReport,
  newMediaReport,
  playbackDigestReport,
} from './automation-insight-server.ts';
import {
  buildExpandedAutomationReport,
  expandedAutomationTemplates,
  expandedAutomationTypes,
  expandedPreviewReport,
} from './automation-expanded-server.ts';

const FREQUENCIES = new Set(['manual', 'hourly', 'every6h', 'daily', 'weekly']);
const templates = [
  {
    type: 'quality_guardian',
    name: 'Quality Guardian',
    description: 'Audit large H.264 media and record safe optimization opportunities.',
    tone: 'amber',
    readOnly: true,
  },
  {
    type: 'library_refresh',
    name: 'Quiet Library Refresh',
    description: 'Ask Plex to refresh selected libraries during a quiet window.',
    tone: 'cyan',
    readOnly: false,
  },
  {
    type: 'health_snapshot',
    name: 'Health Chronicle',
    description: 'Capture library and session totals to build an operational history.',
    tone: 'violet',
    readOnly: true,
  },
  {
    type: 'arrival_digest',
    name: 'Arrival Digest',
    description: 'Summarize the newest additions across every Plex library.',
    tone: 'rose',
    readOnly: true,
  },
  {
    type: 'metadata_sentinel',
    name: 'Metadata Sentinel',
    description: 'Find titles missing artwork, summaries, years or other useful metadata.',
    tone: 'cyan',
    readOnly: true,
  },
  {
    type: 'stream_sentinel',
    name: 'Stream Sentinel',
    description: 'Record direct-play and transcode pressure across active sessions.',
    tone: 'violet',
    readOnly: true,
  },
  {
    type: 'backlog_radar',
    name: 'Backlog Age Radar',
    description: 'Track old and highly rated unwatched titles before they disappear into the archive.',
    tone: 'amber',
    readOnly: true,
  },
  {
    type: 'format_sentinel',
    name: 'Format Drift Sentinel',
    description: 'Chronicle codec and resolution drift across selected libraries.',
    tone: 'cyan',
    readOnly: true,
  },
  {
    type: 'edition_sentinel',
    name: 'Edition Storage Sentinel',
    description: 'Find multi-version titles and measure their additional storage footprint.',
    tone: 'rose',
    readOnly: true,
  },
  {
    type: 'growth_chronicle',
    name: 'Library Growth Chronicle',
    description: 'Record daily, weekly and monthly arrival velocity and storage growth.',
    tone: 'violet',
    readOnly: true,
  },
  {
    type: 'playback_digest',
    name: 'Weekly Playback Digest',
    description: 'Summarize seven-day activity, viewing momentum, top titles and household participation.',
    tone: 'cyan',
    readOnly: true,
  },
  {
    type: 'new_media_guard',
    name: 'New Media Integrity Guard',
    description: 'Check recent arrivals for missing media, duration, codec, resolution or size information.',
    tone: 'amber',
    readOnly: true,
  },
  ...expandedAutomationTemplates,
];
const TYPES = new Set(templates.map((item) => item.type));

function nextOccurrence(schedule, from = new Date()) {
  const frequency = schedule?.frequency || 'manual';
  if (frequency === 'manual') return null;
  const next = new Date(from);
  next.setSeconds(0, 0);
  if (frequency === 'hourly') {
    next.setMinutes(0);
    next.setHours(next.getHours() + 1);
  } else if (frequency === 'every6h') {
    next.setMinutes(0);
    next.setHours(Math.floor(next.getHours() / 6) * 6 + 6);
  } else {
    const [hour, minute] = String(schedule.time || '03:00')
      .split(':')
      .map(Number);
    next.setHours(hour, minute, 0, 0);
    if (next <= from) next.setDate(next.getDate() + 1);
    if (frequency === 'weekly') {
      const target = Math.min(6, Math.max(0, Number(schedule.weekday ?? 1)));
      const days = (target - next.getDay() + 7) % 7;
      next.setDate(next.getDate() + days);
      if (next <= from) next.setDate(next.getDate() + 7);
    }
  }
  return next.toISOString();
}

function normalizeSchedule(input: any = {}) {
  const frequency = FREQUENCIES.has(input.frequency) ? input.frequency : 'daily';
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '') ? input.time : '03:00';
  return { frequency, time, weekday: Math.min(6, Math.max(0, Number(input.weekday ?? 1))) };
}

function cleanRule(input: any, existing: any = {}): any {
  const type = TYPES.has(input.type || existing.type) ? input.type || existing.type : null;
  if (!type) throw new Error('Unknown automation type.');
  const fallback = templates.find((item) => item.type === type);
  const name = String(input.name ?? existing.name ?? fallback.name)
    .trim()
    .slice(0, 80);
  if (!name) throw new Error('Automation name is required.');
  const schedule = normalizeSchedule(input.schedule || existing.schedule);
  return {
    ...existing,
    type,
    name,
    enabled: Boolean(input.enabled ?? existing.enabled ?? false),
    schedule,
    libraryKey: String(input.libraryKey ?? existing.libraryKey ?? 'all').slice(0, 80),
    updatedAt: new Date().toISOString(),
  };
}

export function createAutomationEngine({
  configDir,
  savedConfig,
  plexFetch,
  plexCommand,
  storageAnalysis,
  overview,
  logger = null,
}) {
  const file = join(configDir, 'automations.json');
  let state = null;
  let saving = Promise.resolve();
  const running = new Set();

  async function load() {
    if (state) return state;
    try {
      state = JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      state = { rules: [], runs: [] };
    }
    state.rules ||= [];
    state.runs ||= [];
    state.paused = Boolean(state.paused);
    return state;
  }

  function save() {
    saving = saving.catch(() => {}).then(() => writeJsonAtomic(file, state));
    return saving;
  }

  async function libraries(config) {
    const response = await plexFetch(config, '/library/sections');
    return (response.MediaContainer?.Directory || []).map((item) => ({
      key: String(item.key),
      title: item.title,
      type: item.type,
    }));
  }

  async function selectedCatalog(config, rule) {
    const selected = await libraries(config);
    const targets = rule.libraryKey === 'all' ? selected : selected.filter((item) => item.key === rule.libraryKey);
    if (!targets.length) throw new Error('The selected Plex library no longer exists.');
    const pages = await Promise.all(
      targets.map((library) =>
        plexFetch(
          config,
          '/library/sections/' +
            encodeURIComponent(library.key) +
            '/all?includeMedia=1&includeGuids=1&includeAllStreams=1&X-Plex-Container-Start=0&X-Plex-Container-Size=5000',
        ).then((page) =>
          (page.MediaContainer?.Metadata || []).map((item) => ({ ...item, libraryTitle: library.title })),
        ),
      ),
    );
    return { targets, items: pages.flat() };
  }

  async function perform(rule, dryRun) {
    const config = await savedConfig();
    if (!config) throw new Error('Plex is not configured.');
    if (rule.type === 'quality_guardian') {
      if (dryRun) return previewReports.quality_guardian;
      const report = await storageAnalysis(config, true);
      return qualityReport(report);
    }
    if (rule.type === 'health_snapshot') {
      if (dryRun) return previewReports.health_snapshot;
      const report = await overview(config);
      return healthReport(report);
    }
    if (rule.type === 'arrival_digest') {
      if (dryRun) return previewReports.arrival_digest;
      const response = await plexFetch(
        config,
        '/library/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size=12',
      );
      const items = response.MediaContainer?.Metadata || [];
      return arrivalReport(items);
    }
    if (rule.type === 'stream_sentinel') {
      if (dryRun) return previewReports.stream_sentinel;
      const response = await plexFetch(config, '/status/sessions');
      const sessions = response.MediaContainer?.Metadata || [];
      return streamReport(sessions);
    }
    if (rule.type === 'metadata_sentinel') {
      if (dryRun) return previewReports.metadata_sentinel;
      const { targets, items } = await selectedCatalog(config, rule);
      const issues = items.filter((item) => !item.thumb || !item.summary || !item.year);
      return metadataReport(items, issues, targets);
    }
    if (rule.type === 'backlog_radar') {
      if (dryRun) return previewReports.backlog_radar;
      const { targets, items } = await selectedCatalog(config, rule);
      return backlogReport(items, targets);
    }
    if (rule.type === 'format_sentinel') {
      if (dryRun) return previewReports.format_sentinel;
      const { targets, items } = await selectedCatalog(config, rule);
      return formatReport(items, targets);
    }
    if (rule.type === 'edition_sentinel') {
      if (dryRun) return previewReports.edition_sentinel;
      const { targets, items } = await selectedCatalog(config, rule);
      return editionReport(items, targets);
    }
    if (rule.type === 'growth_chronicle') {
      if (dryRun) return previewReports.growth_chronicle;
      const response = await plexFetch(
        config,
        '/library/recentlyAdded?includeMedia=1&X-Plex-Container-Start=0&X-Plex-Container-Size=100',
      );
      return growthReport(response.MediaContainer?.Metadata || []);
    }
    if (rule.type === 'playback_digest') {
      if (dryRun) return previewReports.playback_digest;
      const response = await plexFetch(
        config,
        '/status/sessions/history/all?X-Plex-Container-Start=0&X-Plex-Container-Size=1000&sort=viewedAt%3Adesc',
      );
      return playbackDigestReport(response.MediaContainer?.Metadata || []);
    }
    if (rule.type === 'new_media_guard') {
      if (dryRun) return previewReports.new_media_guard;
      const response = await plexFetch(
        config,
        '/library/recentlyAdded?includeMedia=1&X-Plex-Container-Start=0&X-Plex-Container-Size=50',
      );
      return newMediaReport(response.MediaContainer?.Metadata || []);
    }
    if (expandedAutomationTypes.has(rule.type)) {
      if (dryRun) return expandedPreviewReport(rule.type);
      const { targets, items } = await selectedCatalog(config, rule);
      return buildExpandedAutomationReport(rule.type, items, targets);
    }
    const allLibraries = await libraries(config);
    const targets =
      rule.libraryKey === 'all' ? allLibraries : allLibraries.filter((item) => item.key === rule.libraryKey);
    if (!targets.length) throw new Error('The selected Plex library no longer exists.');
    if (dryRun) return refreshReport(targets, true);
    for (const library of targets)
      await plexCommand(config, `/library/sections/${encodeURIComponent(library.key)}/refresh`);
    return refreshReport(targets, false);
  }

  async function execute(rule, runKey, { dryRun = false, trigger = 'manual', persistedRule = false } = {}) {
    const data = await load();
    if (running.has(runKey)) throw new Error('This automation is already running.');
    running.add(runKey);
    const entry: any = {
      id: randomUUID(),
      ruleId: rule.id,
      ruleName: rule.name,
      type: rule.type,
      trigger,
      dryRun: Boolean(dryRun),
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    data.runs.unshift(entry);
    data.runs = data.runs.slice(0, 100);
    await save();
    logger?.info('automation.started', { runId: entry.id, ruleId: rule.id, type: rule.type, trigger, dryRun });
    try {
      entry.result = await perform(rule, Boolean(dryRun));
      entry.status = 'success';
      if (!dryRun && persistedRule) rule.lastRunAt = new Date().toISOString();
      logger?.info('automation.completed', { runId: entry.id, ruleId: rule.id, type: rule.type, dryRun });
    } catch (error) {
      entry.status = 'failed';
      entry.error = error.message;
      logger?.error('automation.failed', { runId: entry.id, ruleId: rule.id, type: rule.type, error });
    } finally {
      entry.finishedAt = new Date().toISOString();
      entry.durationMs = Math.max(0, Date.parse(entry.finishedAt) - Date.parse(entry.startedAt));
      if (persistedRule) {
        rule.nextRunAt = rule.enabled ? nextOccurrence(rule.schedule) : null;
        rule.updatedAt = new Date().toISOString();
      }
      running.delete(runKey);
      await save();
    }
    return entry;
  }

  async function run(id, { dryRun = false, trigger = 'manual' } = {}) {
    const data = await load();
    const rule = data.rules.find((item) => item.id === id);
    if (!rule) throw new Error('Automation not found.');
    return execute(rule, id, { dryRun, trigger, persistedRule: true });
  }

  async function runRecipe(type, { libraryKey = 'all' } = {}) {
    if (!TYPES.has(type)) throw new Error('Unknown automation recipe.');
    const recipe = templates.find((item) => item.type === type);
    const rule = cleanRule({
      type,
      name: recipe.name,
      enabled: false,
      libraryKey,
      schedule: { frequency: 'manual' },
    });
    rule.id = `recipe:${type}`;
    return execute(rule, rule.id, { trigger: 'manual_recipe' });
  }

  async function list() {
    const data = await load();
    const config = await savedConfig();
    let plexLibraries = [];
    if (config)
      try {
        plexLibraries = await libraries(config);
      } catch (error) {
        logger?.warn('automation.libraries_unavailable', { error });
      }
    return {
      templates: templates.map((template) => ({
        ...template,
        running: running.has(`recipe:${template.type}`),
      })),
      libraries: plexLibraries,
      paused: data.paused,
      rules: data.rules.map((rule) => ({ ...rule, running: running.has(rule.id) })),
      runs: data.runs.slice(0, 40),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  async function create(input) {
    const data = await load();
    const rule = cleanRule(input);
    Object.assign(rule, { id: randomUUID(), createdAt: new Date().toISOString(), lastRunAt: null });
    rule.nextRunAt = rule.enabled ? nextOccurrence(rule.schedule) : null;
    data.rules.push(rule);
    await save();
    logger?.info('automation.created', { ruleId: rule.id, type: rule.type, enabled: rule.enabled });
    return rule;
  }

  async function update(id, input) {
    const data = await load();
    const index = data.rules.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Automation not found.');
    const rule = cleanRule(input, data.rules[index]);
    rule.nextRunAt = rule.enabled ? nextOccurrence(rule.schedule) : null;
    data.rules[index] = rule;
    await save();
    logger?.info('automation.updated', { ruleId: rule.id, type: rule.type, enabled: rule.enabled });
    return rule;
  }

  async function remove(id) {
    const data = await load();
    if (running.has(id)) throw new Error('A running automation cannot be deleted.');
    const before = data.rules.length;
    data.rules = data.rules.filter((item) => item.id !== id);
    if (data.rules.length === before) throw new Error('Automation not found.');
    await save();
    logger?.info('automation.deleted', { ruleId: id });
  }

  async function setPaused(paused) {
    const data = await load();
    data.paused = Boolean(paused);
    await save();
    logger?.info('automation.scheduler_changed', { paused: data.paused });
    return data.paused;
  }

  async function dataSummary() {
    const data = await load();
    return { rules: data.rules.length, runs: data.runs.length, running: running.size, paused: data.paused };
  }

  async function clearAll() {
    const before = await dataSummary();
    if (before.running) throw new Error('Wait for running automations to finish before clearing application data.');
    state = { rules: [], runs: [], paused: false };
    await save();
    logger?.warn('automation.database_cleared', { rules: before.rules, runs: before.runs });
    return before;
  }

  async function tick() {
    const data = await load();
    if (data.paused) return;
    const now = Date.now();
    for (const rule of data.rules) {
      if (rule.enabled && rule.nextRunAt && Date.parse(rule.nextRunAt) <= now && !running.has(rule.id))
        run(rule.id, { trigger: 'schedule' }).catch((error) =>
          logger?.error('automation.schedule_failed', { ruleId: rule.id, error }),
        );
    }
  }

  const timer = setInterval(() => tick().catch((error) => logger?.error('automation.tick_failed', { error })), 30_000);
  timer.unref();
  return { list, create, update, remove, run, runRecipe, tick, setPaused, dataSummary, clearAll };
}

export { nextOccurrence };
