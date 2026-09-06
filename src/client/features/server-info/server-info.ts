import { apiFetch } from '../../core/api-client.ts';

let serverReport = null;
const serverEscape = (value) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );

function dateTime(value) {
  if (!Number(value)) return 'Unavailable';
  return new Date(Number(value) * 1000).toLocaleString();
}

function duration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0))),
    days = Math.floor(total / 86400),
    hours = Math.floor((total % 86400) / 3600),
    minutes = Math.floor((total % 3600) / 60);
  return [days ? days + 'd' : '', hours ? hours + 'h' : '', minutes + 'm'].filter(Boolean).join(' ');
}

function valueText(value) {
  if (value === true) return 'Enabled';
  if (value === false) return 'Disabled';
  if (value == null || value === '') return 'Not set';
  if (Array.isArray(value)) return value.join(', ') || 'None';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function fact(label, value, className = '') {
  return `<div class="server-fact ${className}"><dt>${serverEscape(label)}</dt><dd>${serverEscape(valueText(value))}</dd></div>`;
}

function shell() {
  return `<button class="back-link" data-server-back>← Command deck</button><header class="server-intel-hero"><div><span class="eyebrow">PLEX SERVER · TECHNICAL INTELLIGENCE</span><h1 id="server-intel-name">Reading server identity…</h1><p id="server-intel-subtitle">Probing Plex subsystems, resource telemetry and configuration.</p><div class="server-intel-status"><i></i><span id="server-intel-status">CONNECTING</span><code id="server-intel-version">—</code></div></div><div class="server-intel-actions"><button id="copy-server-report">Copy report</button><button id="export-server-report">Export JSON</button><button class="primary-button" id="refresh-server-report">Refresh live data</button></div></header><section class="server-intel-metrics"><article><span>PLEX RESPONSE</span><b id="server-latency">—</b><small>Median successful probe</small></article><article><span>LIBRARIES</span><b id="server-library-count">—</b><small id="server-item-count">Reading indexes</small></article><article><span>REGISTERED CLIENTS</span><b id="server-device-count">—</b><small id="server-platform-count">Across known platforms</small></article><article><span>ACTIVE SESSIONS</span><b id="server-session-count">—</b><small id="server-transcode-count">Reading transcodes</small></article><article><span>HOST LOAD</span><b id="server-host-load">—</b><small>Latest Plex sample</small></article></section><div id="server-intel-content"><div class="server-intel-loading"><i></i><span>Interrogating Plex Media Server…</span></div></div>`;
}

function resourcePanel(resources) {
  const latest = resources.latest || {},
    cpuBars = resources.samples
      .slice(-36)
      .map(
        (sample) =>
          `<i title="${serverEscape(dateTime(sample.at))} · ${sample.hostCpu.toFixed(1)}% host CPU" style="height:${Math.max(3, Math.min(100, sample.hostCpu))}%"></i>`,
      )
      .join('');
  return `<section class="panel server-resource-panel"><div class="panel-head"><div><span class="card-label">RESOURCE TELEMETRY</span><h2>Host and Plex process</h2></div><span>${resources.samples.length} samples</span></div><div class="resource-numbers"><div><span>HOST CPU</span><b>${Number(latest.hostCpu || 0).toFixed(1)}%</b><small>avg ${resources.average.hostCpu}% · peak ${resources.peak.hostCpu}%</small></div><div><span>PLEX CPU</span><b>${Number(latest.processCpu || 0).toFixed(2)}%</b><small>avg ${resources.average.processCpu}% · peak ${resources.peak.processCpu}%</small></div><div><span>HOST MEMORY</span><b>${Number(latest.hostMemory || 0).toFixed(1)}%</b><small>avg ${resources.average.hostMemory}% · peak ${resources.peak.hostMemory}%</small></div><div><span>PLEX MEMORY</span><b>${Number(latest.processMemory || 0).toFixed(2)}%</b><small>avg ${resources.average.processMemory}% · peak ${resources.peak.processMemory}%</small></div></div><div class="server-resource-chart">${cpuBars || '<span>No resource samples returned.</span>'}</div><div class="resource-axis"><span>OLDER</span><span>HOST CPU HISTORY</span><span>NOW</span></div></section>`;
}

function identityPanel(data) {
  const identity = data.identity,
    account = data.plexAccount,
    connection = data.connection;
  return `<section class="panel server-fact-panel"><div class="panel-head"><div><span class="card-label">IDENTITY MATRIX</span><h2>Immutable server facts</h2></div><b class="claim-state ${identity.claimed ? 'good' : 'warn'}">${identity.claimed ? 'CLAIMED' : 'UNCLAIMED'}</b></div><dl class="server-fact-grid">${fact('Friendly name', identity.name)}${fact('PMS version', identity.version, 'mono')}${fact('Platform', identity.platform)}${fact('Platform version', identity.platformVersion, 'mono')}${fact('API version', identity.apiVersion, 'mono')}${fact('Machine identifier', identity.machineIdentifier, 'mono wide')}${fact('Country code', identity.countryCode.toUpperCase())}${fact('Server updated', dateTime(identity.updatedAt))}${fact('Plex account', account.connected)}${fact('Sign-in state', account.signInState)}${fact('Mapping state', account.mappingState)}${fact('Plex Pass', account.subscription)}${fact('Multi-user', account.multiuser)}${fact('Generated', new Date(data.generatedAt).toLocaleString())}</dl></section><section class="panel server-fact-panel"><div class="panel-head"><div><span class="card-label">CONNECTION PATH</span><h2>Companion → Plex</h2></div><b class="claim-state good">LIVE</b></div><dl class="server-fact-grid">${fact('Origin', connection.origin, 'mono wide')}${fact('Protocol', connection.protocol)}${fact('Hostname', connection.hostname, 'mono')}${fact('Port', connection.port, 'mono')}${fact('Base path', connection.path, 'mono')}${fact('Certificate advertised', connection.certificateAvailable)}${fact('Secure policy', ['Disabled', 'Preferred', 'Required'][Number(connection.secureConnections)] || connection.secureConnections)}${fact('IP stack', connection.networkType)}${fact('IPv6', connection.ipv6)}${fact('Preferred interface', connection.preferredInterface)}${fact('GDM discovery', connection.localDiscovery)}${fact('Plex Relay', connection.relay)}${fact('Strict TLS', connection.strictTls)}${fact('Webhooks', connection.webhooks)}${fact('Event stream', connection.eventStream)}</dl></section>`;
}

function capabilitiesPanel(data) {
  const brain = data.streamingBrain;
  return `<section class="panel server-capability-panel"><div class="panel-head"><div><span class="card-label">CAPABILITY REGISTER</span><h2>Advertised server functions</h2></div><span>Streaming Brain ${brain.version} · ABR ${brain.abrVersion}</span></div><div class="capability-grid">${data.capabilities
    .map(
      (item) =>
        `<div class="server-capability ${item.enabled ? 'enabled' : 'disabled'}"><i></i><span><b>${serverEscape(item.label)}</b><small>${serverEscape(item.detail || (item.enabled ? 'Available' : 'Unavailable'))}</small></span></div>`,
    )
    .join(
      '',
    )}</div><div class="streaming-brain"><span><b>${brain.videoBitrates.length}</b> advertised bitrate tiers</span><span><b>${brain.videoResolutions.length}</b> resolution profiles</span><span><b>${brain.activeVideoSessions}</b> active video transcodes reported at root</span><code>${serverEscape(brain.videoBitrates.join(', ') || 'No bitrate ladder returned')} kbps</code></div></section>`;
}

function librariesPanel(data) {
  return `<section class="panel server-library-panel"><div class="panel-head"><div><span class="card-label">LIBRARY TOPOLOGY</span><h2>Scanners, agents, indexes and storage roots</h2></div><span>${data.librarySummary.indexedItems.toLocaleString()} primary items</span></div><div class="server-library-list">${data.libraries
    .map((library) => {
      const counts = Object.entries(library.counts)
        .map(([label, count]) => `<span><b>${Number(count).toLocaleString()}</b>${serverEscape(label)}</span>`)
        .join('');
      return `<article class="server-library-card ${library.refreshing ? 'refreshing' : ''}"><header><div><span>${serverEscape(library.type)}</span><h3>${serverEscape(library.title)}</h3></div><b>${library.refreshing ? 'SCANNING' : 'IDLE'}</b></header><div class="library-counts">${counts || '<span><b>—</b>count unavailable</span>'}</div><dl>${fact('Section key', library.key, 'mono')}${fact('Language', library.language)}${fact('Scanner', library.scanner)}${fact('Metadata agent', library.agent, 'mono')}${fact('UUID', library.uuid, 'mono wide')}${fact('Last scan', dateTime(library.scannedAt))}${fact('Metadata updated', dateTime(library.updatedAt))}${fact('Content changed', dateTime(library.contentChangedAt))}${fact('Created', dateTime(library.createdAt))}${fact('Sync allowed', library.allowSync)}${fact('Hidden', library.hidden)}</dl><div class="library-paths"><small>MEDIA ROOTS</small>${library.locations.map((location) => `<code>${serverEscape(location.path)}</code>`).join('') || '<code>No location returned</code>'}</div></article>`;
    })
    .join('')}</div></section>`;
}

function activityPanel(data) {
  const activity = data.activity,
    devices = data.devices;
  return `<section class="panel server-activity-panel"><div class="panel-head"><div><span class="card-label">OPERATIONAL STATE</span><h2>Sessions, history and clients</h2></div><span>Live sample</span></div><div class="operational-grid"><div><span>ACTIVE STREAMS</span><b>${activity.sessions}</b><small>${(activity.estimatedBandwidthKbps / 1000).toFixed(1)} Mbps estimated</small></div><div><span>TRANSCODE SESSIONS</span><b>${activity.transcodes}</b><small>Current transcode endpoint</small></div><div><span>HISTORY RECORDS</span><b>${activity.historyRecords.toLocaleString()}</b><small>Records reported by Plex</small></div><div><span>PLAYLISTS</span><b>${activity.playlists.toLocaleString()}</b><small>Server-side playlists</small></div><div><span>REGISTERED CLIENTS</span><b>${devices.registered}</b><small>${devices.platforms.length} platforms</small></div><div><span>BACKGROUND TASKS</span><b>${activity.backgroundTasks.length}</b><small>Scanner and maintenance work</small></div></div><div class="platform-register">${devices.platforms.map((item) => `<span><b>${item.count}</b>${serverEscape(item.platform)}</span>`).join('')}</div>${activity.backgroundTasks.length ? `<div class="server-task-list">${activity.backgroundTasks.map((task) => `<div><b>${serverEscape(task.title || task.type)}</b><span>${serverEscape(task.subtitle)}</span><i style="width:${Math.max(0, Math.min(100, task.progress))}%"></i></div>`).join('')}</div>` : '<div class="server-quiet">No Plex background activities are running.</div>'}</section>`;
}

function preferencesPanel(data) {
  const groups: Record<string, any[]> = {};
  for (const setting of data.preferences) (groups[setting.group] ||= []).push(setting);
  return `<section class="panel server-preference-panel"><div class="panel-head"><div><span class="card-label">CONFIGURATION REGISTRY</span><h2>Safe Plex preferences and overrides</h2></div><span>${data.preferences.length} exposed settings · credentials excluded</span></div><div class="preference-groups">${Object.entries(
    groups,
  )
    .map(
      ([group, settings], index) =>
        `<details ${index < 3 ? 'open' : ''}><summary><span>${serverEscape(group)}</span><b>${settings.length} SETTINGS</b></summary><div class="preference-list">${settings
          .map(
            (setting) =>
              `<div class="preference-row ${setting.changed ? 'changed' : ''}"><span><b>${serverEscape(setting.label)}</b><code>${serverEscape(setting.id)}</code></span><span><small>CURRENT</small><strong>${serverEscape(valueText(setting.value))}</strong></span><span><small>DEFAULT</small><strong>${serverEscape(valueText(setting.default))}</strong></span><em>${setting.changed ? 'OVERRIDDEN' : setting.advanced ? 'ADVANCED' : 'DEFAULT'}</em></div>`,
          )
          .join('')}</div></details>`,
    )
    .join('')}</div></section>`;
}

function bridgeAndProbes(data) {
  const bridge = data.companionBridge,
    successful = data.probes.filter((probe) => probe.ok).length;
  return `<section class="panel server-bridge-panel"><div class="panel-head"><div><span class="card-label">COMPANION BRIDGE</span><h2>Runtime and path translation</h2></div><span>Node ${serverEscape(bridge.node)}</span></div><dl class="server-fact-grid">${fact('Runtime platform', bridge.platform)}${fact('Architecture', bridge.architecture)}${fact('Companion uptime', duration(bridge.uptimeSeconds))}${fact('Configuration source', bridge.configSource)}${fact('Plex media prefix', bridge.mediaMapping.plexPathRoot, 'mono wide')}${fact('Container media root', bridge.mediaMapping.mediaPathRoot, 'mono wide')}${fact('Optimization CRF', bridge.mediaMapping.crf)}${fact('Encoder preset', bridge.mediaMapping.preset)}</dl><div class="bridge-checks">${Object.entries(
    bridge.checks,
  )
    .map(
      ([name, state]) =>
        `<span class="${state === 'available' || state === 'connected' || state === 'read-write' || state === 'private' ? 'good' : 'warn'}"><i></i>${serverEscape(name)} · ${serverEscape(state)}</span>`,
    )
    .join(
      '',
    )}</div></section><section class="panel server-probe-panel"><div class="panel-head"><div><span class="card-label">ENDPOINT PROBES</span><h2>Plex API surface health</h2></div><span>${successful}/${data.probes.length} responding</span></div><div class="probe-list">${data.probes.map((probe) => `<div class="${probe.ok ? 'good' : 'bad'}"><i></i><span><b>${serverEscape(probe.name)}</b><code>${serverEscape(probe.path)}</code></span><strong>${probe.latencyMs.toFixed(1)} ms</strong><em>${probe.ok ? 'HTTP OK' : serverEscape(probe.error || 'Unavailable')}</em></div>`).join('')}</div></section>`;
}

function render(data) {
  serverReport = data;
  const latencies = data.probes
      .filter((probe) => probe.ok)
      .map((probe) => probe.latencyMs)
      .sort((a, b) => a - b),
    median = latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0,
    latest = data.resources.latest;
  document.querySelector('#server-intel-name').textContent = data.identity.name;
  document.querySelector('#server-intel-subtitle').textContent =
    `${data.identity.platform} ${data.identity.platformVersion} · API ${data.identity.apiVersion} · ${data.connection.origin}`;
  document.querySelector('#server-intel-status').textContent = data.identity.claimed
    ? 'ONLINE · CLAIMED'
    : 'ONLINE · UNCLAIMED';
  document.querySelector('#server-intel-version').textContent = 'PMS ' + data.identity.version;
  document.querySelector('#server-latency').textContent = median.toFixed(1) + ' ms';
  document.querySelector('#server-library-count').textContent = data.librarySummary.libraries;
  document.querySelector('#server-item-count').textContent =
    data.librarySummary.indexedItems.toLocaleString() + ' indexed items';
  document.querySelector('#server-device-count').textContent = data.devices.registered;
  document.querySelector('#server-platform-count').textContent = data.devices.platforms.length + ' client platforms';
  document.querySelector('#server-session-count').textContent = data.activity.sessions;
  document.querySelector('#server-transcode-count').textContent = data.activity.transcodes + ' transcode sessions';
  document.querySelector('#server-host-load').textContent = latest ? latest.hostCpu.toFixed(1) + '%' : '—';
  document.querySelector('#server-intel-content').innerHTML =
    `<div class="server-intel-grid">${identityPanel(data)}${resourcePanel(data.resources)}${activityPanel(data)}</div>${capabilitiesPanel(data)}${librariesPanel(data)}${preferencesPanel(data)}<div class="server-intel-grid lower">${bridgeAndProbes(data)}</div>`;
}

async function loadServerReport() {
  const button = document.querySelector('#refresh-server-report'),
    content = document.querySelector('#server-intel-content');
  if (!button || !content) return;
  button.disabled = true;
  button.textContent = 'Probing Plex…';
  try {
    const response = await apiFetch('/api/server-intelligence'),
      data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Server intelligence unavailable.');
    render(data);
  } catch (error) {
    content.innerHTML = `<div class="server-intel-error"><b>Server interrogation failed</b><p>${serverEscape(error.message)}</p></div>`;
  } finally {
    button.disabled = false;
    button.textContent = 'Refresh live data';
  }
}

function downloadReport() {
  if (!serverReport) return;
  const blob = new Blob([JSON.stringify(serverReport, null, 2)], { type: 'application/json' }),
    link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `plex-server-report-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
}

async function copyReport(button) {
  if (!serverReport) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(serverReport, null, 2));
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Copy unavailable';
  }
  setTimeout(() => (button.textContent = 'Copy report'), 1600);
}

function setupServerInfo() {
  const page = document.querySelector('#server-page');
  if (!page) return;
  page.classList.add('server-intelligence-page');
  page.innerHTML = shell();
  page.querySelector('[data-server-back]').onclick = () => document.querySelector('[data-nav="dashboard"]').click();
  page.querySelector('#refresh-server-report').onclick = loadServerReport;
  page.querySelector('#export-server-report').onclick = downloadReport;
  page.querySelector('#copy-server-report').onclick = (event) => copyReport(event.currentTarget);
  document.querySelector('[data-nav="server"]')?.addEventListener('click', () => setTimeout(loadServerReport, 60));
  if (location.hash === '#server') loadServerReport();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupServerInfo);
else setupServerInfo();
