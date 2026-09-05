import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { arrivalReport, healthReport, metadataReport, previewReports, qualityReport, refreshReport, streamReport } from './automation-report-server.ts';

const FREQUENCIES = new Set(['manual', 'hourly', 'every6h', 'daily', 'weekly']);
const TYPES = new Set(["quality_guardian", "library_refresh", "health_snapshot", "arrival_digest", "metadata_sentinel", "stream_sentinel"]);
const templates = [
  { type:'quality_guardian', name:'Quality Guardian', description:'Audit large H.264 media and record safe optimization opportunities.', tone:'amber', readOnly:true },
  { type:'library_refresh', name:'Quiet Library Refresh', description:'Ask Plex to refresh selected libraries during a quiet window.', tone:'cyan', readOnly:false },
  { type:'health_snapshot', name:'Health Chronicle', description:'Capture library and session totals to build an operational history.', tone:'violet', readOnly:true },
  { type:"arrival_digest", name:"Arrival Digest", description:"Summarize the newest additions across every Plex library.", tone:"rose", readOnly:true },
  { type:"metadata_sentinel", name:"Metadata Sentinel", description:"Find titles missing artwork, summaries, years or other useful metadata.", tone:"cyan", readOnly:true },
  { type:"stream_sentinel", name:"Stream Sentinel", description:"Record direct-play and transcode pressure across active sessions.", tone:"violet", readOnly:true },
];

function nextOccurrence(schedule, from = new Date()) {
  const frequency = schedule?.frequency || 'manual';
  if (frequency === 'manual') return null;
  const next = new Date(from);
  next.setSeconds(0, 0);
  if (frequency === 'hourly') { next.setMinutes(0); next.setHours(next.getHours() + 1); }
  else if (frequency === 'every6h') {
    next.setMinutes(0); next.setHours(Math.floor(next.getHours() / 6) * 6 + 6);
  } else {
    const [hour, minute] = String(schedule.time || '03:00').split(':').map(Number);
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
  return { frequency, time, weekday:Math.min(6, Math.max(0, Number(input.weekday ?? 1))) };
}

function cleanRule(input: any, existing: any = {}): any {
  const type = TYPES.has(input.type || existing.type) ? (input.type || existing.type) : null;
  if (!type) throw new Error('Unknown automation type.');
  const fallback = templates.find(item => item.type === type);
  const name = String(input.name ?? existing.name ?? fallback.name).trim().slice(0, 80);
  if (!name) throw new Error('Automation name is required.');
  const schedule = normalizeSchedule(input.schedule || existing.schedule);
  return {
    ...existing, type, name,
    enabled:Boolean(input.enabled ?? existing.enabled ?? false),
    schedule,
    libraryKey:String(input.libraryKey ?? existing.libraryKey ?? 'all').slice(0, 80),
    updatedAt:new Date().toISOString(),
  };
}

export function createAutomationEngine({ configDir, savedConfig, plexFetch, plexCommand, storageAnalysis, overview }) {
  const file = join(configDir, 'automations.json');
  let state = null;
  let saving = Promise.resolve();
  const running = new Set();

  async function load() {
    if (state) return state;
    try { state = JSON.parse(await readFile(file, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      state = { rules:[], runs:[] };
    }
    state.rules ||= []; state.runs ||= []; state.paused = Boolean(state.paused);
    return state;
  }

  function save() {
    saving = saving.then(async () => {
      await mkdir(configDir, { recursive:true });
      await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, { mode:0o600 });
    });
    return saving;
  }

  async function libraries(config) {
    const response = await plexFetch(config, '/library/sections');
    return (response.MediaContainer?.Directory || []).map(item => ({ key:String(item.key), title:item.title, type:item.type }));
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
    if (rule.type === "arrival_digest") {
      if (dryRun) return previewReports.arrival_digest;
      const response = await plexFetch(config, "/library/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size=12");
      const items = response.MediaContainer?.Metadata || [];
      return arrivalReport(items);
    }
    if (rule.type === "stream_sentinel") {
      if (dryRun) return previewReports.stream_sentinel;
      const response = await plexFetch(config, "/status/sessions");
      const sessions = response.MediaContainer?.Metadata || [];
      return streamReport(sessions);
    }
    if (rule.type === "metadata_sentinel") {
      if (dryRun) return previewReports.metadata_sentinel;
      const selected = await libraries(config);
      const targets = rule.libraryKey === "all" ? selected : selected.filter(item=>item.key === rule.libraryKey);
      const pages = await Promise.all(targets.map(library => plexFetch(config, "/library/sections/" + encodeURIComponent(library.key) + "/all?X-Plex-Container-Start=0&X-Plex-Container-Size=5000")));
      const items = pages.flatMap(page=>page.MediaContainer?.Metadata || []);
      const issues = items.filter(item=>!item.thumb || !item.summary || !item.year);
      return metadataReport(items, issues, targets);
    }
    const allLibraries = await libraries(config);
    const targets = rule.libraryKey === 'all' ? allLibraries : allLibraries.filter(item => item.key === rule.libraryKey);
    if (!targets.length) throw new Error('The selected Plex library no longer exists.');
    if (dryRun) return refreshReport(targets, true);
    for (const library of targets) await plexCommand(config, `/library/sections/${encodeURIComponent(library.key)}/refresh`);
    return refreshReport(targets, false);
  }

  async function run(id, { dryRun = false, trigger = 'manual' } = {}) {
    const data = await load();
    const rule = data.rules.find(item => item.id === id);
    if (!rule) throw new Error('Automation not found.');
    if (running.has(id)) throw new Error('This automation is already running.');
    running.add(id);
    const entry: any = { id:randomUUID(), ruleId:id, ruleName:rule.name, type:rule.type, trigger, dryRun:Boolean(dryRun), status:'running', startedAt:new Date().toISOString() };
    data.runs.unshift(entry); data.runs = data.runs.slice(0, 100); await save();
    try {
      entry.result = await perform(rule, Boolean(dryRun));
      entry.status = 'success';
      if (!dryRun) rule.lastRunAt = new Date().toISOString();
    } catch (error) {
      entry.status = 'failed'; entry.error = error.message;
    } finally {
      entry.finishedAt = new Date().toISOString();
      entry.durationMs = Math.max(0, Date.parse(entry.finishedAt) - Date.parse(entry.startedAt));
      rule.nextRunAt = rule.enabled ? nextOccurrence(rule.schedule) : null;
      rule.updatedAt = new Date().toISOString();
      running.delete(id); await save();
    }
    return entry;
  }

  async function list() {
    const data = await load();
    const config = await savedConfig();
    let plexLibraries = [];
    if (config) try { plexLibraries = await libraries(config); } catch {}
    return { templates, libraries:plexLibraries, paused:data.paused, rules:data.rules.map(rule => ({ ...rule, running:running.has(rule.id) })), runs:data.runs.slice(0, 40), timezone:Intl.DateTimeFormat().resolvedOptions().timeZone };
  }

  async function create(input) {
    const data = await load();
    const rule = cleanRule(input);
    Object.assign(rule, { id:randomUUID(), createdAt:new Date().toISOString(), lastRunAt:null });
    rule.nextRunAt = rule.enabled ? nextOccurrence(rule.schedule) : null;
    data.rules.push(rule); await save(); return rule;
  }

  async function update(id, input) {
    const data = await load();
    const index = data.rules.findIndex(item => item.id === id);
    if (index < 0) throw new Error('Automation not found.');
    const rule = cleanRule(input, data.rules[index]);
    rule.nextRunAt = rule.enabled ? nextOccurrence(rule.schedule) : null;
    data.rules[index] = rule; await save(); return rule;
  }

  async function remove(id) {
    const data = await load();
    if (running.has(id)) throw new Error('A running automation cannot be deleted.');
    const before = data.rules.length;
    data.rules = data.rules.filter(item => item.id !== id);
    if (data.rules.length === before) throw new Error('Automation not found.');
    await save();
  }

  async function setPaused(paused) { const data = await load(); data.paused = Boolean(paused); await save(); return data.paused; }

  async function tick() {
    const data = await load(); if (data.paused) return; const now = Date.now();
    for (const rule of data.rules) {
      if (rule.enabled && rule.nextRunAt && Date.parse(rule.nextRunAt) <= now && !running.has(rule.id)) run(rule.id, { trigger:'schedule' }).catch(() => {});
    }
  }

  const timer = setInterval(() => tick().catch(() => {}), 30_000);
  timer.unref();
  return { list, create, update, remove, run, tick, setPaused };
}

export { nextOccurrence };
