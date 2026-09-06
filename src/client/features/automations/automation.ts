import { renderAutomationReports } from './automation-report-ui.ts';
import { expandedSuggestedSchedules, expandedTypeMeta } from './automation-expanded.ts';
import { apiFetch } from '../../core/api-client.ts';
const autoState = { data: null, loaded: false, view: 'recipes' };
const autoIcon = {
  bolt: '<svg viewBox="0 0 24 24"><path d="m13 2-9 12h8l-1 8 9-12h-8z"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  scan: '<svg viewBox="0 0 24 24"><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3"/><circle cx="12" cy="12" r="3"/></svg>',
};
const autoEscape = (value) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
const autoBytes = (bytes) => {
  let value = Number(bytes) || 0,
    unit = 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  while (value >= 1024 && unit < 4) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit > 2 ? 1 : 0)} ${units[unit]}`;
};
const typeMeta = {
  quality_guardian: {
    label: 'Quality Guardian',
    icon: 'shield',
    verb: 'Audit quality',
    note: 'Read-only Plex metadata audit',
  },
  library_refresh: {
    label: 'Quiet Refresh',
    icon: 'scan',
    verb: 'Refresh libraries',
    note: 'Requests a standard Plex scan',
  },
  health_snapshot: {
    label: 'Health Chronicle',
    icon: 'clock',
    verb: 'Capture snapshot',
    note: 'Read-only operational history',
  },
  arrival_digest: {
    label: 'Arrival Digest',
    icon: 'bolt',
    verb: 'Summarize arrivals',
    note: 'Read-only recently added digest',
  },
  metadata_sentinel: {
    label: 'Metadata Sentinel',
    icon: 'scan',
    verb: 'Inspect metadata',
    note: 'Read-only artwork and metadata audit',
  },
  stream_sentinel: {
    label: 'Stream Sentinel',
    icon: 'clock',
    verb: 'Sample playback',
    note: 'Read-only transcode pressure snapshot',
  },
  backlog_radar: {
    label: 'Backlog Age Radar',
    icon: 'clock',
    verb: 'Measure backlog age',
    note: 'Read-only unwatched shelf forecast',
  },
  format_sentinel: {
    label: 'Format Drift Sentinel',
    icon: 'scan',
    verb: 'Map media formats',
    note: 'Read-only codec and resolution audit',
  },
  edition_sentinel: {
    label: 'Edition Storage Sentinel',
    icon: 'shield',
    verb: 'Inspect stored editions',
    note: 'Read-only multi-version storage audit',
  },
  growth_chronicle: {
    label: 'Library Growth Chronicle',
    icon: 'bolt',
    verb: 'Measure library growth',
    note: 'Read-only arrival and storage timeline',
  },
  playback_digest: {
    label: 'Weekly Playback Digest',
    icon: 'clock',
    verb: 'Summarize playback',
    note: 'Read-only seven-day household report',
  },
  new_media_guard: {
    label: 'New Media Integrity Guard',
    icon: 'shield',
    verb: 'Verify new arrivals',
    note: 'Read-only recent media integrity check',
  },
  ...expandedTypeMeta,
};
const suggestedSchedules = {
  quality_guardian: { frequency: 'weekly', time: '03:00', weekday: 0 },
  library_refresh: { frequency: 'daily', time: '03:00', weekday: 1 },
  health_snapshot: { frequency: 'every6h', time: '03:00', weekday: 1 },
  arrival_digest: { frequency: 'daily', time: '08:00', weekday: 1 },
  metadata_sentinel: { frequency: 'weekly', time: '04:00', weekday: 0 },
  stream_sentinel: { frequency: 'hourly', time: '03:00', weekday: 1 },
  backlog_radar: { frequency: 'weekly', time: '09:00', weekday: 6 },
  format_sentinel: { frequency: 'weekly', time: '04:30', weekday: 0 },
  edition_sentinel: { frequency: 'weekly', time: '05:00', weekday: 0 },
  growth_chronicle: { frequency: 'daily', time: '08:15', weekday: 1 },
  playback_digest: { frequency: 'weekly', time: '08:00', weekday: 1 },
  new_media_guard: { frequency: 'daily', time: '06:00', weekday: 1 },
  ...expandedSuggestedSchedules,
};

function autoRequest(path, options: any = {}) {
  return apiFetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } }).then(
    async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.run?.error || 'Automation request failed.');
      return data;
    },
  );
}

function relativeTime(value) {
  if (!value) return 'Not scheduled';
  const seconds = Math.round((Date.parse(value) - Date.now()) / 1000),
    abs = Math.abs(seconds);
  if (abs < 60) return seconds < 0 ? 'just now' : 'in under a minute';
  const units = abs < 3600 ? ['minute', 60] : abs < 86400 ? ['hour', 3600] : ['day', 86400];
  const amount = Math.round(abs / Number(units[1]));
  return seconds < 0
    ? `${amount} ${units[0]}${amount === 1 ? '' : 's'} ago`
    : `in ${amount} ${units[0]}${amount === 1 ? '' : 's'}`;
}

function scheduleLabel(rule) {
  const labels = {
    manual: 'Manual only',
    hourly: 'Every hour',
    every6h: 'Every six hours',
    daily: `Daily · ${rule.schedule.time}`,
    weekly: `Weekly · ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][rule.schedule.weekday]} ${rule.schedule.time}`,
  };
  return labels[rule.schedule.frequency] || 'Manual only';
}

function shell() {
  return `<button class="back-link" data-auto-route="dashboard">← Command deck</button>
    <header class="automation-hero"><div><span class="eyebrow">AUTOMATION CORE · LOCAL-FIRST</span><h1>Put the routine<br><em>on autopilot.</em></h1><p>Scheduled Plex care with previews, guardrails and a permanent record of every action.</p></div><div class="auto-reactor" aria-hidden="true"><i></i><i></i><i></i><span><b></b></span><em>CORE ONLINE</em></div><button class="auto-primary" id="new-automation">${autoIcon.bolt} Create automation</button></header>
    <section class="auto-metrics"><article><span>ACTIVE RULES</span><strong id="auto-active">—</strong><small>Enabled by you</small></article><article><span>NEXT EVENT</span><strong id="auto-next">—</strong><small id="auto-next-name">Nothing scheduled</small></article><article><span>SUCCESS RATE</span><strong id="auto-success">—</strong><small>Across recorded runs</small></article><article><span>TIMEZONE</span><strong id="auto-timezone">LOCAL</strong><small>Schedules follow the container</small></article></section>
    <div class="auto-safety">${autoIcon.shield}<div><b>Guardrails are always active</b><p>Automations cannot delete or replace media. Every rule can be previewed with a dry run, and new rules begin disabled unless you explicitly enable them.</p></div><span>SAFE MODE</span></div>
    <nav class="auto-view-tabs" aria-label="Automation sections"><button class="active" data-auto-view="recipes"><span>Recipe catalogue</span><b id="auto-recipe-count">42</b></button><button data-auto-view="rules"><span>Your automations</span><b id="auto-rule-count">0</b></button><button data-auto-view="history"><span>Run history</span><b id="auto-run-count">0</b></button></nav>
    <section class="auto-section" data-auto-section="recipes"><div class="auto-section-head"><div><span class="card-label">MISSION PROFILES</span><h2>Start with a trusted recipe</h2></div><label class="auto-recipe-filter"><span>FILTER 42 RECIPES</span><input id="auto-recipe-filter" type="search" placeholder="Metadata, storage, playback…"></label></div><div class="auto-templates" id="auto-templates"></div></section>
    <section class="auto-section" data-auto-section="rules" hidden><div class="auto-section-head"><div><span class="card-label">CONTROL MATRIX</span><h2>Your automations</h2></div><div class="auto-toolbar"><span class="auto-live" id="scheduler-state"><i></i> Scheduler online</span><button id="preview-all">Dry-run all</button><button id="export-automations">Export</button><button id="pause-scheduler">Pause core</button></div></div><div class="auto-rules" id="auto-rules"><div class="auto-loading"><i></i><span>Synchronising rules…</span></div></div></section>
    <section class="auto-section history-section" data-auto-section="history" hidden><div class="auto-section-head"><div><span class="card-label">IMMUTABLE MEMORY</span><h2>Run history</h2></div><p>Latest 40 events</p></div><div class="auto-history" id="auto-history"></div></section>`;
}

function setAutomationView(view, { scroll = false } = {}) {
  if (!['recipes', 'rules', 'history'].includes(view)) return;
  autoState.view = view;
  document.querySelectorAll('[data-auto-view]').forEach((button) => {
    const selected = button.dataset.autoView === view;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('[data-auto-section]').forEach((section) => {
    section.hidden = section.dataset.autoSection !== view;
  });
  if (scroll) document.querySelector(`[data-auto-section="${view}"]`)?.scrollIntoView({ behavior: 'smooth' });
}

function renderViewTabs() {
  document.querySelector('#auto-recipe-count').textContent = String(autoState.data.templates.length);
  document.querySelector('#auto-rule-count').textContent = String(autoState.data.rules.length);
  document.querySelector('#auto-run-count').textContent = String(Math.min(40, autoState.data.runs.length));
  setAutomationView(autoState.view);
}

function renderTemplates() {
  const container = document.querySelector('#auto-templates');
  container.innerHTML = autoState.data.templates
    .map(
      (item, index) =>
        `<article class="auto-template ${item.tone}" data-recipe-card><span class="template-index">${String(index + 1).padStart(2, '0')}</span><div class="template-orb">${autoIcon[typeMeta[item.type].icon]}</div><span class="template-access">${item.category ? `${autoEscape(item.category).toUpperCase()} · ` : ''}${item.readOnly ? 'READ ONLY' : 'PLEX ACTION'}</span><h3>${autoEscape(item.name)}</h3><p>${autoEscape(item.description)}</p><div class="template-actions"><button data-template="${item.type}">Configure recipe <b>→</b></button><button class="template-run" data-template-run="${item.type}" ${item.running ? 'disabled' : ''}>${item.running ? 'Running…' : 'Run now'}</button></div></article>`,
    )
    .join('');
  container
    .querySelectorAll('[data-template]')
    .forEach((button) => button.addEventListener('click', () => openRuleModal(button.dataset.template)));
  container.querySelectorAll('[data-template-run]').forEach((button) =>
    button.addEventListener('click', async () => {
      const type = button.dataset.templateRun;
      button.disabled = true;
      button.textContent = 'Running…';
      try {
        await autoRequest(`/api/automations/recipes/${type}/run`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        await loadAutomations();
        autoToast(`${typeMeta[type].label} completed`);
        setAutomationView('history', { scroll: true });
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Run now';
        autoToast(error.message, true);
      }
    }),
  );
  const query = document.querySelector('#auto-recipe-filter')?.value.trim().toLowerCase();
  if (query)
    container.querySelectorAll('[data-recipe-card]').forEach((card) => {
      card.hidden = !card.textContent.toLowerCase().includes(query);
    });
}

function renderRules() {
  const rules = autoState.data.rules,
    container = document.querySelector('#auto-rules');
  if (!rules.length) {
    container.innerHTML = `<div class="auto-empty">${autoIcon.bolt}<h3>No missions configured</h3><p>Choose a trusted recipe above or create your first automation.</p><button id="empty-create">Create first automation</button></div>`;
    document.querySelector('#empty-create').onclick = () => openRuleModal('quality_guardian');
    return;
  }
  container.innerHTML = rules
    .map((rule) => {
      const meta = typeMeta[rule.type];
      return `<article class="auto-rule ${rule.enabled ? 'enabled' : ''} ${rule.running ? 'running' : ''}" data-id="${rule.id}"><div class="rule-signal">${autoIcon[meta.icon]}<i></i></div><div class="rule-identity"><span>${autoEscape(meta.label)} · ${rule.enabled ? 'ACTIVE' : 'STANDBY'}</span><h3>${autoEscape(rule.name)}</h3><p>${autoEscape(meta.note)}</p></div><div class="rule-schedule"><span>SCHEDULE</span><b>${autoEscape(scheduleLabel(rule))}</b><small>${rule.enabled ? relativeTime(rule.nextRunAt) : 'Enable to schedule'}</small></div><div class="rule-last"><span>LAST SIGNAL</span><b>${rule.lastRunAt ? relativeTime(rule.lastRunAt) : 'Never run'}</b><small>${rule.running ? 'Mission currently running' : meta.verb}</small></div><div class="rule-actions"><label class="auto-switch" title="${rule.enabled ? 'Disable' : 'Enable'} automation"><input type="checkbox" data-toggle ${rule.enabled ? 'checked' : ''}><span></span></label><button data-run="dry" ${rule.running ? 'disabled' : ''}>Dry run</button><button class="run-now" data-run="live" ${rule.running ? 'disabled' : ''}>${rule.running ? 'Running…' : 'Run now'}</button><button class="rule-more" data-edit title="Edit">•••</button></div></article>`;
    })
    .join('');
  container.querySelectorAll('.auto-rule').forEach((card) =>
    bindRule(
      card,
      rules.find((rule) => rule.id === card.dataset.id),
    ),
  );
}

function renderHistory() {
  const runs = autoState.data.runs,
    container = document.querySelector('#auto-history');
  container.innerHTML = renderAutomationReports(runs, { escape: autoEscape, relativeTime, bytes: autoBytes });
  container.querySelectorAll('[data-download-run]').forEach((button) =>
    button.addEventListener('click', () => {
      const run = runs.find((item) => item.id === button.dataset.downloadRun);
      if (run) downloadAutomationResult(run);
    }),
  );
}

function downloadAutomationResult(run) {
  const payload = {
    exportedAt: new Date().toISOString(),
    application: 'Ultimate Plex Companion',
    reportVersion: 1,
    run,
  };
  const slug = String(run.ruleName || run.type || 'automation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const date = String(run.finishedAt || run.startedAt || new Date().toISOString()).slice(0, 10);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `plex-automation-${slug || 'result'}-${date}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  autoToast('Automation result downloaded');
}

function renderMetrics() {
  const { rules, runs, timezone } = autoState.data,
    enabled = rules.filter((rule) => rule.enabled),
    successes = runs.filter((run) => run.status === 'success').length,
    completed = runs.filter((run) => run.status !== 'running').length;
  document.querySelector('#auto-active').textContent = enabled.length;
  const next = enabled
    .filter((rule) => rule.nextRunAt)
    .sort((a, b) => Date.parse(a.nextRunAt) - Date.parse(b.nextRunAt))[0];
  document.querySelector('#auto-next').textContent = next
    ? relativeTime(next.nextRunAt).replace(/^in /, '').toUpperCase()
    : '—';
  document.querySelector('#auto-next-name').textContent = next ? next.name : 'Nothing scheduled';
  document.querySelector('#auto-success').textContent = completed
    ? `${Math.round((successes / completed) * 100)}%`
    : '—';
  document.querySelector('#auto-timezone').textContent = (timezone || 'Local')
    .split('/')
    .pop()
    .replaceAll('_', ' ')
    .toUpperCase();
  const paused = Boolean(autoState.data.paused),
    pauseButton = document.querySelector('#pause-scheduler'),
    scheduler = document.querySelector('#scheduler-state');
  if (pauseButton) {
    pauseButton.textContent = paused ? 'Resume core' : 'Pause core';
    pauseButton.classList.toggle('paused', paused);
  }
  if (scheduler) {
    scheduler.classList.toggle('paused', paused);
    scheduler.lastChild.textContent = paused ? ' Scheduler paused' : ' Scheduler online';
  }
}

function renderAll() {
  renderTemplates();
  renderRules();
  renderHistory();
  renderMetrics();
  renderViewTabs();
}
async function loadAutomations() {
  try {
    autoState.data = await autoRequest('/api/automations');
    autoState.loaded = true;
    renderAll();
  } catch (error) {
    document.querySelector('#auto-rules').innerHTML =
      `<div class="auto-empty error"><b>!</b><h3>Automation core offline</h3><p>${autoEscape(error.message)}</p></div>`;
  }
}

function autoToast(message, failed = false) {
  const node = document.createElement('div');
  node.className = `auto-toast ${failed ? 'failed' : ''}`;
  node.innerHTML = `${failed ? '!' : autoIcon.bolt}<span>${autoEscape(message)}</span>`;
  document.body.append(node);
  setTimeout(() => node.remove(), 3600);
}

async function mutate(path, options, message) {
  try {
    await autoRequest(path, options);
    await loadAutomations();
    autoToast(message);
    return true;
  } catch (error) {
    autoToast(error.message, true);
    return false;
  }
}
function bindRule(card, rule) {
  card
    .querySelector('[data-toggle]')
    .addEventListener('change', (event) =>
      mutate(
        `/api/automations/${rule.id}`,
        { method: 'PATCH', body: JSON.stringify({ enabled: event.target.checked }) },
        event.target.checked ? 'Automation armed' : 'Automation placed on standby',
      ),
    );
  card.querySelectorAll('[data-run]').forEach((button) =>
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = button.dataset.run === 'dry' ? 'Previewing…' : 'Running…';
      const completed = await mutate(
        `/api/automations/${rule.id}/run`,
        { method: 'POST', body: JSON.stringify({ dryRun: button.dataset.run === 'dry' }) },
        button.dataset.run === 'dry' ? 'Dry run completed' : 'Automation completed',
      );
      if (completed) setAutomationView('history', { scroll: true });
    }),
  );
  card.querySelector('[data-edit]').addEventListener('click', () => openRuleModal(rule.type, rule));
}

async function previewAll() {
  const rules = autoState.data?.rules || [];
  if (!rules.length) return autoToast('Create an automation first', true);
  const button = document.querySelector('#preview-all');
  button.disabled = true;
  button.textContent = 'Simulating…';
  try {
    for (const rule of rules)
      await autoRequest('/api/automations/' + rule.id + '/run', {
        method: 'POST',
        body: JSON.stringify({ dryRun: true }),
      });
    await loadAutomations();
    autoToast(rules.length + ' safe preview' + (rules.length === 1 ? '' : 's') + ' completed');
    setAutomationView('history', { scroll: true });
  } catch (error) {
    autoToast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = 'Dry-run all';
  }
}

async function toggleScheduler() {
  const paused = !autoState.data?.paused;
  try {
    await autoRequest('/api/automations/state', { method: 'PATCH', body: JSON.stringify({ paused }) });
    await loadAutomations();
    autoToast(paused ? 'Automation core paused' : 'Automation core resumed');
  } catch (error) {
    autoToast(error.message, true);
  }
}

function exportAutomations() {
  const payload = {
    exportedAt: new Date().toISOString(),
    timezone: autoState.data?.timezone,
    rules: autoState.data?.rules || [],
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plex-companion-automations.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  autoToast('Automation configuration exported');
}

function modalMarkup(type, rule) {
  const meta = typeMeta[type],
    editing = Boolean(rule),
    schedule = rule?.schedule || suggestedSchedules[type] || { frequency: 'daily', time: '03:00', weekday: 1 };
  const libraryOptions = (autoState.data?.libraries || [])
    .map(
      (item) =>
        `<option value="${autoEscape(item.key)}" ${rule?.libraryKey === item.key ? 'selected' : ''}>${autoEscape(item.title)} · ${autoEscape(item.type)}</option>`,
    )
    .join('');
  const recipeOptions = Object.entries(typeMeta)
    .map(
      ([value, item]) =>
        '<option value="' +
        autoEscape(value) +
        '">' +
        autoEscape(item.label) +
        ' — ' +
        autoEscape(item.note) +
        '</option>',
    )
    .join('');
  const recipeField = editing
    ? '<label>Mission name<input name="name" maxlength="80" required value="' + autoEscape(rule.name) + '"></label>'
    : '<label>Automation recipe<select name="recipe">' +
      recipeOptions +
      '</select><small>Choose what Companion should do. You can preview it safely before the first live run.</small></label>';
  return `<div class="auto-modal-wrap"><div class="auto-modal-backdrop"></div><section class="auto-modal"><button class="auto-modal-close">×</button><div class="modal-symbol">${autoIcon[meta.icon]}</div><span class="eyebrow">${editing ? 'EDIT MISSION' : 'NEW MISSION'} · ${autoEscape(meta.label).toUpperCase()}</span><h2>${editing ? 'Tune the routine.' : 'Configure the routine.'}</h2><p>${autoEscape(meta.note)}. Times use ${autoEscape(autoState.data?.timezone || 'the container timezone')}.</p><form id="auto-rule-form">${recipeField}<div class="modal-grid"><label>Frequency<select name="frequency"><option value="manual">Manual only</option><option value="hourly">Every hour</option><option value="every6h">Every six hours</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><label data-time>Start time<input name="time" type="time" value="${autoEscape(schedule.time)}"></label><label data-weekday>Day<select name="weekday">${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => `<option value="${i}">${day}</option>`).join('')}</select></label></div>${typeMeta[type]?.catalog || ['library_refresh', 'metadata_sentinel'].includes(type) ? `<label>Library<select name="libraryKey"><option value="all">All libraries</option>${libraryOptions}</select></label>` : ''}<label class="modal-enable"><input name="enabled" type="checkbox" ${rule?.enabled ? 'checked' : ''}><span></span><div><b>Enable immediately</b><small>The next run will be calculated when saved.</small></div></label><div class="modal-actions">${editing ? '<button type="button" class="auto-delete">Delete rule</button>' : ''}<button type="button" class="auto-cancel">Cancel</button><button type="submit" class="auto-primary">${editing ? 'Save changes' : 'Create mission'}</button></div></form></section></div>`;
}

function openRuleModal(type, rule = null) {
  document.body.insertAdjacentHTML('beforeend', modalMarkup(type, rule));
  const modal = document.querySelector('.auto-modal-wrap'),
    form = modal.querySelector('form');
  form.frequency.value = rule?.schedule?.frequency || suggestedSchedules[type]?.frequency || 'daily';
  if (form.recipe) {
    form.recipe.value = type;
    form.recipe.onchange = () => {
      const selected = form.recipe.value;
      modal.remove();
      openRuleModal(selected);
    };
  }
  form.weekday.value = String(rule?.schedule?.weekday ?? suggestedSchedules[type]?.weekday ?? 1);
  if (form.libraryKey) form.libraryKey.value = rule?.libraryKey || 'all';
  const fields = () => {
    modal.querySelector('[data-time]').hidden = ['manual', 'hourly', 'every6h'].includes(form.frequency.value);
    modal.querySelector('[data-weekday]').hidden = form.frequency.value !== 'weekly';
  };
  fields();
  form.frequency.onchange = fields;
  const close = () => modal.remove();
  modal.querySelector('.auto-modal-close').onclick = close;
  modal.querySelector('.auto-modal-backdrop').onclick = close;
  modal.querySelector('.auto-cancel').onclick = close;
  modal.querySelector('.auto-delete')?.addEventListener('click', async () => {
    if (!confirm(`Delete “${rule.name}”? Run history will be retained.`)) return;
    close();
    await mutate(`/api/automations/${rule.id}`, { method: 'DELETE' }, 'Automation deleted');
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const selectedType = values.recipe || type;
    const payload = {
      type: selectedType,
      name: values.name || typeMeta[selectedType].label,
      enabled: values.enabled === 'on',
      libraryKey: values.libraryKey || 'all',
      schedule: { frequency: values.frequency, time: values.time || '03:00', weekday: Number(values.weekday || 1) },
    };
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await autoRequest(rule ? `/api/automations/${rule.id}` : '/api/automations', {
        method: rule ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      close();
      await loadAutomations();
      autoToast(rule ? 'Automation updated' : 'Automation created');
      setAutomationView('rules', { scroll: true });
    } catch (error) {
      submit.disabled = false;
      autoToast(error.message, true);
    }
  };
}

function setupAutomations() {
  const page = document.querySelector('#automation-page');
  if (!page) return;
  page.classList.add('automation-page');
  page.innerHTML = shell();
  page.querySelector('[data-auto-route]').onclick = () => {
    location.hash = '#dashboard';
  };
  page.querySelector('#new-automation').onclick = () => openRuleModal('quality_guardian');
  page
    .querySelectorAll('[data-auto-view]')
    .forEach((button) =>
      button.addEventListener('click', () => setAutomationView(button.dataset.autoView, { scroll: true })),
    );
  page.querySelector('#preview-all').onclick = previewAll;
  page.querySelector('#export-automations').onclick = exportAutomations;
  page.querySelector('#pause-scheduler').onclick = toggleScheduler;
  page.querySelector('#auto-recipe-filter').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    page.querySelectorAll('[data-recipe-card]').forEach((card) => {
      card.hidden = Boolean(query) && !card.textContent.toLowerCase().includes(query);
    });
  });
  document.querySelector('[data-nav="automation"]')?.addEventListener('click', () => {
    if (!autoState.loaded) setTimeout(loadAutomations, 100);
  });
  window.addEventListener('companiondatareset', () => {
    autoState.loaded = false;
    if (location.hash === '#automation') loadAutomations();
  });
  if (location.hash === '#automation') loadAutomations();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupAutomations);
else setupAutomations();
