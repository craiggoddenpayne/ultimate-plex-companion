import { initStarfield } from './core/starfield-engine.ts';
import { featureSets, navigation as nav, pageCopy } from '../shared/feature-registry.ts';
import { compactStreamList } from './features/command-deck/live-activity-view.ts';
const icons = {
  grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  library:
    '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 5.5v15A2.5 2.5 0 0 1 6.5 18H20"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  radar:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 6-6M12 3v2M21 12h-2M12 21v-2M3 12h2"/>',
  bolt: '<path d="m13 2-9 12h8l-1 8 9-12h-8z"/>',
  flask: '<path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 15h9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.01A1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9v.01A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15z"/>',
  spark:
    '<path d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3zM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  server:
    '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  wand: '<path d="m15 4 5 5L8 21H3v-5zM12 7l5 5M6 3v3M4.5 4.5h3M19 16v4M17 18h4"/>',
};

const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
const formatBytes = (bytes) => {
  if (!Number(bytes)) return '0 GB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes),
    unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit > 2 ? 1 : 0)} ${units[unit]}`;
};

const activity = [
  ['spark', 'Collection evolved', 'Neo-noir essentials gained 3 titles', '2m'],
  ['shield', 'Quality guard', 'Replaced a low bitrate copy of Arrival', '18m'],
  ['users', 'Taste match', 'Household profiles are 84% aligned', '1h'],
  ['library', 'Library scan', '12 new items indexed and analysed', '3h'],
];

function sidebar() {
  return `<aside class="sidebar">
    <a class="brand" href="#dashboard" aria-label="Ultimate Plex Companion home">
      <span class="brand-mark"><i></i><i></i></span><span><b>ULTIMATE</b><small>PLEX COMPANION</small></span>
    </a>
    <nav>${nav.map(([id, ico, label]) => `<a href="#${id}" data-nav="${id}" class="nav-link ${id === 'dashboard' ? 'active' : ''}">${icon(ico)}<span>${label}</span>${id === 'streams' ? '<em id="nav-stream-count">—</em>' : ''}</a>`).join('')}</nav>
    <div class="sidebar-foot">
      <button class="server-chip" data-action="settings"><span class="status-dot pending" id="server-dot"></span><div><small>PLEX SERVER</small><strong id="server-name">Not connected</strong></div><span id="server-state">SET UP</span></button>
      <button class="profile"><span class="avatar">AD</span><span><b>Administrator</b><small>Administrator</small></span>${icon('chevron')}</button>
    </div>
  </aside>`;
}

function header() {
  return `<header class="topbar">
    <button class="mobile-brand" aria-label="Open navigation"><span></span><span></span></button>
    <div class="search">${icon('search')}<input id="global-search" placeholder="Search your Plex universe…" /><kbd>⌘ K</kbd></div>
    <div class="top-actions"><span class="sync" id="sync-state"><i></i>Waiting for Plex</span><button class="icon-button" data-action="notifications" aria-label="Notifications">${icon('bell')}<i class="notice"></i></button><button class="icon-button" data-action="settings" aria-label="Settings">${icon('settings')}</button></div>
  </header>`;
}

function arcChart() {
  return `<div class="health-orbit">
    <svg viewBox="0 0 180 110"><defs><linearGradient id="arc" x1="0" x2="1"><stop stop-color="#ffaf24"/><stop offset="1" stop-color="#ffe08a"/></linearGradient></defs><path class="arc-bg" d="M20 95a70 70 0 0 1 140 0"/><path class="arc-value" pathLength="100" d="M20 95a70 70 0 0 1 140 0"/></svg>
    <div><strong>94</strong><span>OPTIMAL</span></div><i class="orbit-dot"></i>
  </div>`;
}

function dashboard() {
  return `<section class="page active" id="dashboard-page">
    <div class="hero-row"><div><span class="eyebrow">SATURDAY · 5 SEPTEMBER</span><h1>Your universe is<br><em>running beautifully.</em></h1><p>Everything worth knowing, before you need to ask.</p></div>
      <button class="primary-button" data-action="ask">${icon('spark')} Ask Companion</button></div>

    <div class="metric-grid">
      <article class="metric-card featured"><div><span class="card-label">SYSTEM HEALTH</span><h2>All systems nominal</h2><p>Server, storage and network are performing above baseline.</p><button class="text-button" data-deck-detail="health">Open diagnostics ${icon('arrow')}</button></div>${arcChart()}</article>
      <article class="metric-card"><div class="metric-icon amber">${icon('play')}</div><span class="card-label">STREAMING NOW</span><strong class="big-number" id="stream-count">—</strong><p id="stream-summary">Connect Plex for live sessions</p><div class="micro-bars stream-bars"><i style="height:35%"></i><i style="height:52%"></i><i style="height:44%"></i><i style="height:78%"></i><i style="height:62%"></i><i style="height:88%"></i><i style="height:68%"></i><i style="height:95%"></i></div></article>
      <article class="metric-card"><div class="metric-icon violet">${icon('library')}</div><span class="card-label">LIBRARY</span><strong class="big-number" id="library-count">—</strong><p id="library-summary">Waiting for Plex</p><div class="delta" id="library-delta">LIVE <span>inventory</span></div></article>
      <article class="metric-card"><div class="metric-icon cyan">${icon('clock')}</div><span class="card-label">WATCH TIME</span><strong class="big-number">38.4<small>h</small></strong><p>Across your household</p><div class="watch-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="delta cyan-text">— <span>vs previous week</span></div></article>
    </div>

    <div class="content-grid">
      <section class="panel now-panel"><div class="panel-head"><div><span class="card-label">LIVE ACTIVITY</span><h2>Now playing</h2></div><button class="text-button" data-route="streams">View all ${icon('arrow')}</button></div>
        <div class="stream-list" id="stream-list"><div class="empty-state">Connect Plex to see live sessions.</div></div>
      </section>
      <section class="panel signal-panel"><div class="panel-head"><div><span class="card-label">COMPANION SIGNAL</span><h2>Worth your attention</h2></div><span class="pulse-ring"></span></div>
        <div class="signal-card"><span class="signal-kicker">SMART SUGGESTION · LIVE ANALYSIS</span><h3 id="storage-suggestion-title">Analysing your library<br><em>in the background…</em></h3><p id="storage-suggestion-body">Looking for large legacy-codec films ready for HEVC or AV1 using Plex metadata only.</p><button class="secondary-button" data-action="review">Review opportunity ${icon('arrow')}</button></div>
        <div class="signal-stats"><span><i></i>Confidence <b id="storage-confidence">—</b></span><span>Potential saving <b id="storage-saving">Calculating</b></span></div>
      </section>
    </div>

    <div class="lower-grid">
      <section class="panel taste-panel"><div class="panel-head"><div><span class="card-label">TASTE INTELLIGENCE</span><h2>Your viewing DNA</h2></div><button class="more" data-deck-detail="taste" aria-label="Open taste intelligence">•••</button></div>
        <div class="taste-body"><div class="radar-viz"><span class="r1"></span><span class="r2"></span><span class="r3"></span><i></i><b></b><em></em><div class="radar-core">YOU</div></div>
        <div class="taste-tags"><span><i class="amber-bg"></i>Sci-fi <b>92%</b></span><span><i class="violet-bg"></i>Thriller <b>84%</b></span><span><i class="cyan-bg"></i>Drama <b>78%</b></span><span><i class="rose-bg"></i>Comedy <b>61%</b></span></div></div>
      </section>
      <section class="panel activity-panel"><div class="panel-head"><div><span class="card-label">SYSTEM MEMORY</span><h2>Recent activity</h2></div><button class="more" data-deck-detail="activity" aria-label="Open activity timeline">•••</button></div>
        <div class="activity-list">${activity.map(([ico, title, body, time]) => `<div><span class="activity-icon">${icon(ico)}</span><p><b>${title}</b><small>${body}</small></p><time>${time}</time></div>`).join('')}</div>
      </section>
    </div>
  </section>`;
}

function libraryPage() {
  return `<section class="page feature-page library-intelligence" id="library-page">
    <button class="back-link" data-route="dashboard">← Command deck</button>
    <div class="feature-hero library-hero"><span class="eyebrow">LIBRARY INTELLIGENCE · READ ONLY</span><h1>Find space without<br>guessing at quality.</h1><p>Companion inspects media metadata from Plex, finds unusually large H.264, MPEG-2, MPEG-4 and VC-1 films, and estimates where a verified HEVC or AV1 conversion may be visually transparent.</p><button class="primary-button" data-action="scan-storage" id="scan-storage">${icon('radar')} Scan video libraries</button></div>
    <div class="scan-metrics">
      <article><span>ITEMS ANALYSED</span><strong id="scan-items">—</strong><small id="scan-libraries">Waiting to scan</small></article>
      <article><span>REVIEW CANDIDATES</span><strong id="scan-candidates">—</strong><small>Never automatically selected</small></article>
      <article class="saving"><span>ESTIMATED SAVING</span><strong id="scan-saving">—</strong><small>Conservative modern-codec estimate</small></article>
      <article><span>SOURCE FOOTPRINT</span><strong id="scan-footprint">—</strong><small>Candidate files only</small></article>
    </div>
    <section class="panel candidate-panel">
      <div class="panel-head"><div><span class="card-label">EXPLAINABLE RESULTS</span><h2>Optimization candidates</h2></div><span class="readonly-pill">${icon('shield')} No files changed</span></div>
      <div id="candidate-results" class="candidate-results"><div class="scan-empty"><span>${icon('radar')}</span><h3>Ready when you are</h3><p>The scan reads Plex metadata only. It does not access, modify, move, or transcode media files.</p></div></div>
    </section>
    <section class="panel jobs-panel"><div class="panel-head"><div><span class="card-label">ENCODING QUEUE</span><h2>Staged optimizations</h2></div><span class="queue-state" id="queue-state">Idle</span></div><div id="optimization-jobs" class="optimization-jobs"><div class="jobs-empty">Choose “Convert codec” on a candidate to begin. Jobs run one at a time.</div></div></section>
    <div class="safety-strip"><span>${icon('shield')}</span><div><b>Transparent quality is a target, not a guarantee.</b><p>Each job creates a separate HEVC or AV1 file, verifies duration and stream counts, reports the measured saving, and preserves the original until you approve a final “Are you sure?” step.</p></div></div>
  </section>`;
}

function genericPage(id) {
  const [eye, title, desc] = pageCopy[id];
  return `<section class="page feature-page" id="${id}-page"><button class="back-link" data-route="dashboard">← Command deck</button><div class="feature-hero"><span class="eyebrow">${eye}</span><h1>${title}</h1><p>${desc}</p><button class="primary-button" data-action="prototype">${icon(id === 'lab' ? 'flask' : 'spark')} Explore prototype</button></div>
    <div class="feature-grid">${featureSets[id].map(([name, body], i) => `<article><span>0${i + 1}</span><div class="feature-orb o${i + 1}">${icon(nav.find((n) => n[0] === id)?.[1] || 'spark')}</div><h2>${name}</h2><p>${body}</p><button data-action="feature">Open concept ${icon('arrow')}</button></article>`).join('')}</div>
    <div class="blueprint"><div><span class="card-label">PRODUCT BLUEPRINT</span><h2>Built for trust, not black boxes.</h2><p>Every suggestion shows its evidence. Every automation has a dry run. Every destructive action needs approval.</p></div><div class="blueprint-flow"><span>PLEX</span><i></i><span>COMPANION</span><i></i><span>YOU</span></div></div>
  </section>`;
}

function assistantModal() {
  return `<div class="modal-wrap" id="assistant-modal"><div class="modal-backdrop" data-action="close"></div><section class="assistant-modal"><button class="modal-close" data-action="close">×</button><span class="assistant-glyph">${icon('spark')}</span><span class="eyebrow">COMPANION INTELLIGENCE</span><h2>What would you like to know?</h2><div class="ask-input"><input autofocus placeholder="Ask about your library, streams or people…"><button data-action="send">${icon('arrow')}</button></div><div class="prompt-chips"><button>What should we watch tonight?</button><button>Why is Plex transcoding?</button><button>Find storage I can reclaim</button></div><p class="privacy-note">Answers stay inside your network. Your viewing data is yours.</p></section></div>`;
}

function settingsModal(config: any = {}) {
  const managed = config.tokenSource === 'environment';
  return `<div class="modal-wrap" id="settings-modal"><div class="modal-backdrop" data-action="close"></div><section class="settings-modal">
    <button class="modal-close" data-action="close">×</button>
    <div class="settings-title"><span class="assistant-glyph">${icon('server')}</span><div><span class="eyebrow">CONNECTION SETTINGS</span><h2>Connect Plex</h2><p>Your token is stored only by the companion backend and is never sent back to the browser.</p></div></div>
    <form id="plex-settings-form">
      <label>Plex server URL<input name="plexUrl" type="url" required placeholder="http://192.168.1.10:32400" value="${escapeHtml(config.plexUrl || '')}" ${managed ? 'disabled' : ''}><small>When running in Docker, localhost refers to this container. Use your server's LAN address or host.docker.internal.</small></label>
      <label>Plex access token<input name="token" type="password" required placeholder="Paste X-Plex-Token" autocomplete="new-password" ${managed ? 'disabled' : ''}><small>${managed ? 'Configured securely through Docker environment variables.' : 'The saved token is masked and cannot be retrieved through this interface.'}</small></label>
      <div class="connection-result" id="connection-result">${config.configured ? '<i></i> A Plex connection is configured.' : 'Enter your server details to begin.'}</div>
      <div class="settings-actions">${managed ? '' : '<button type="button" class="test-button" id="test-plex">Test connection</button><button type="submit" class="primary-button" id="save-plex">Save & connect</button>'}</div>
    </form>
    <details><summary>Where do I find my Plex token?</summary><p>In Plex Web, open any media item, choose Get Info, then View XML. Copy the value after <strong>X-Plex-Token=</strong> from the address bar.</p></details>
  </section></div>`;
}

async function request(path, options: any = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

async function openSettings() {
  document.querySelector('#settings-modal')?.remove();
  let config: any = {};
  try {
    config = await request('/api/config');
  } catch {}
  document.body.insertAdjacentHTML('beforeend', settingsModal(config));
  const modal = document.querySelector('#settings-modal');
  modal
    .querySelectorAll('[data-action="close"]')
    .forEach((button) => button.addEventListener('click', () => modal.remove()));
  const form = modal.querySelector('#plex-settings-form');
  if (!form || config.tokenSource === 'environment') return;
  const result = modal.querySelector('#connection-result');
  const credentials = () => ({ plexUrl: form.elements.plexUrl.value, token: form.elements.token.value });
  const run = async (save) => {
    result.className = 'connection-result loading';
    result.textContent = save ? 'Saving and connecting…' : 'Testing connection…';
    try {
      const response = await request(save ? '/api/config' : '/api/config/test', {
        method: 'POST',
        body: JSON.stringify(credentials()),
      });
      result.className = 'connection-result success';
      result.innerHTML = `<i></i> Connected to ${escapeHtml(response.server.name)} · Plex ${escapeHtml(response.server.version)}`;
      if (save) {
        setTimeout(() => modal.remove(), 650);
        await loadPlexOverview();
      }
    } catch (error) {
      result.className = 'connection-result error';
      result.textContent = error.message;
    }
  };
  modal.querySelector('#test-plex').addEventListener('click', () => run(false));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    run(true);
  });
}

async function loadPlexOverview() {
  const dot = document.querySelector('#server-dot');
  const serverName = document.querySelector('#server-name');
  const serverState = document.querySelector('#server-state');
  try {
    const data = await request('/api/overview');
    dot.className = 'status-dot';
    serverName.textContent = data.server.name;
    serverState.textContent = 'ONLINE';
    document.querySelector('#sync-state').innerHTML = '<i></i>Synced just now';
    document.querySelector('#library-count').textContent = data.titleCount.toLocaleString();
    document.querySelector('#library-summary').textContent =
      `Titles across ${data.libraryCount} ${data.libraryCount === 1 ? 'library' : 'libraries'}`;
    const transcodes = data.sessions.filter((session) => session.mode === 'Transcoding').length;
    document.querySelector('#stream-count').textContent = data.sessions.length;
    document.querySelector('#nav-stream-count').textContent = data.sessions.length;
    document.querySelector('#stream-summary').textContent = data.sessions.length
      ? `${data.sessions.length - transcodes} direct · ${transcodes} ${transcodes === 1 ? 'transcode' : 'transcodes'}`
      : 'No active sessions';
    document.querySelector('#stream-list').innerHTML = compactStreamList(data.sessions);
    loadStorageSignal();
  } catch (error) {
    dot.className = 'status-dot pending';
    serverName.textContent = error.message === 'Plex is not configured.' ? 'Not connected' : 'Plex unavailable';
    serverState.textContent = error.message === 'Plex is not configured.' ? 'SET UP' : 'RETRY';
    document.querySelector('#sync-state').innerHTML = '<i class="offline"></i>Waiting for Plex';
  }
}

async function loadStorageSignal() {
  try {
    const data = await request('/api/analysis/storage');
    const title = document.querySelector('#storage-suggestion-title');
    if (!title) return;
    title.innerHTML = data.candidateCount
      ? `Your library may reclaim<br><em>${formatBytes(data.estimatedSaving)}</em> at transparent quality.`
      : 'Your library is already<br><em>beautifully lean.</em>';
    document.querySelector('#storage-suggestion-body').textContent = data.candidateCount
      ? `${data.candidateCount} legacy-codec files are worth reviewing. Nothing will be changed automatically.`
      : `No files crossed the conservative optimization threshold.`;
    document.querySelector('#storage-confidence').textContent = data.candidateCount
      ? `${data.averageConfidence}%`
      : 'HIGH';
    document.querySelector('#storage-saving').textContent = formatBytes(data.estimatedSaving);
  } catch {
    document.querySelector('#storage-suggestion-title').innerHTML =
      'Connect Plex to unlock<br><em>library intelligence.</em>';
    document.querySelector('#storage-suggestion-body').textContent =
      'Companion uses read-only media metadata to find opportunities safely.';
  }
}

async function runStorageScan(force = true) {
  const button = document.querySelector('#scan-storage');
  const results = document.querySelector('#candidate-results');
  if (!button || !results) return;
  button.disabled = true;
  button.innerHTML = `${icon('radar')} Reading Plex metadata…`;
  results.innerHTML =
    '<div class="scan-empty scanning"><span class="scan-orbit"></span><h3>Mapping your library</h3><p>Large libraries can take a moment. Results are cached for ten minutes.</p></div>';
  try {
    const data = await request(`/api/analysis/storage${force ? '?refresh=1' : ''}`);
    document.querySelector('#scan-items').textContent = data.scanned.toLocaleString();
    document.querySelector('#scan-libraries').textContent =
      `Across ${data.libraries} video ${data.libraries === 1 ? 'library' : 'libraries'}`;
    document.querySelector('#scan-candidates').textContent = data.candidateCount.toLocaleString();
    document.querySelector('#scan-saving').textContent = formatBytes(data.estimatedSaving);
    document.querySelector('#scan-footprint').textContent = formatBytes(data.totalSize);
    results.innerHTML = data.candidates.length
      ? `<div class="candidate-table">
      <div class="candidate-row candidate-head"><span>Title</span><span>Source</span><span>Size</span><span>Potential</span><span>Confidence</span><span></span></div>
      ${data.candidates.map((item) => `<article class="candidate-row"><div><b>${escapeHtml(item.title)}</b><small>${[item.year, item.library].filter(Boolean).map(escapeHtml).join(' · ')}</small><em>${escapeHtml(item.reason)}</em></div><span><i>${escapeHtml(item.resolution)}</i>${escapeHtml(item.codec)}${item.bitrate ? ` · ${Math.round(item.bitrate / 1000)} Mbps` : ''}</span><span>${formatBytes(item.size)}</span><span class="candidate-saving">−${formatBytes(item.estimatedSaving)}</span><span><strong>${item.confidence}%</strong><u><i style="width:${item.confidence}%"></i></u></span><button class="encode-button" data-rating-key="${escapeHtml(item.ratingKey)}" data-title="${escapeHtml(item.title)}">Convert codec</button></article>`).join('')}
      </div>`
      : '<div class="scan-empty success"><span>✓</span><h3>Your library is already lean</h3><p>No supported legacy-codec files crossed the conservative review threshold.</p></div>';
    results
      .querySelectorAll('.encode-button')
      .forEach((button, index) =>
        button.addEventListener('click', () =>
          startOptimization(button.dataset.ratingKey, button.dataset.title, data.candidates[index].codec),
        ),
      );
    toast(`Library scan complete · ${data.candidateCount} candidates found`);
  } catch (error) {
    results.innerHTML = `<div class="scan-empty error"><span>!</span><h3>Scan could not complete</h3><p>${escapeHtml(error.message)}</p><button class="test-button" data-action="settings">Check Plex settings</button></div>`;
    results.querySelector('[data-action="settings"]')?.addEventListener('click', openSettings);
  } finally {
    button.disabled = false;
    button.innerHTML = `${icon('radar')} Scan again`;
  }
}

let jobPollTimer;

function modernizerModal(title, sourceCodec) {
  return (
    '<div class="modal-wrap" id="modernizer-modal"><div class="modal-backdrop" data-modernizer-close></div><section class="settings-modal modernizer-modal"><button class="modal-close" data-modernizer-close>×</button><span class="eyebrow">CODEC MODERNIZER · VERIFIED CONVERSION</span><h2>Choose a modern format</h2><p>Convert <b>' +
    escapeHtml(title) +
    '</b> from ' +
    escapeHtml(sourceCodec) +
    ' while copying its audio, subtitles, chapters and metadata.</p><div class="modernizer-source">ORIGINAL PRESERVED UNTIL YOU APPROVE REPLACEMENT</div><div class="modernizer-options"><label class="modernizer-option"><input type="radio" name="target-codec" value="hevc" checked><b>HEVC / H.265</b><small>Best compatibility across modern Plex clients with strong space savings.</small><em>RECOMMENDED</em></label><label class="modernizer-option"><input type="radio" name="target-codec" value="av1"><b>AV1</b><small>Higher compression efficiency, but slower encoding and newer client support.</small><em>EXPERIMENTAL</em></label></div><div class="settings-actions"><button class="test-button" data-modernizer-close>Cancel</button><button class="primary-button" id="stage-modernization">Stage conversion</button></div></section></div>'
  );
}

function startOptimization(ratingKey, title, sourceCodec) {
  document.querySelector('#modernizer-modal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modernizerModal(title, sourceCodec));
  const modal = document.querySelector('#modernizer-modal'),
    close = () => modal.remove(),
    button = modal.querySelector('#stage-modernization');
  modal.querySelectorAll('[data-modernizer-close]').forEach((item) => (item.onclick = close));
  request('/api/optimization/config')
    .then((config) => {
      for (const target of config.targets || []) {
        const input = modal.querySelector('[value="' + target.key + '"]');
        if (input) {
          input.disabled = !target.available;
          input.closest('.modernizer-option').classList.toggle('unavailable', !target.available);
        }
      }
      const available = modal.querySelector('[name="target-codec"]:not(:disabled)');
      if (modal.querySelector('[name="target-codec"]:checked')?.disabled && available) available.checked = true;
      if (!available) {
        button.disabled = true;
        button.textContent = 'No modern encoder available';
      }
    })
    .catch(() => {});
  button.onclick = async () => {
    const targetCodec = modal.querySelector('[name="target-codec"]:checked').value,
      targetLabel = targetCodec === 'av1' ? 'AV1' : 'HEVC';
    button.disabled = true;
    button.textContent = 'Checking encoder…';
    try {
      await request('/api/optimization/jobs', { method: 'POST', body: JSON.stringify({ ratingKey, targetCodec }) });
      close();
      toast(title + ' added to the ' + targetLabel + ' conversion queue');
      pollOptimizationJobs();
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Stage conversion';
      toast(error.message);
    }
  };
}

function replacementModal(job) {
  return `<div class="modal-wrap" id="replace-modal"><div class="modal-backdrop" data-action="close"></div><section class="settings-modal replacement-modal"><button class="modal-close" data-action="close">×</button><span class="assistant-glyph danger">${icon('shield')}</span><span class="eyebrow">DESTRUCTIVE FINAL STEP</span><h2>Are you sure?</h2><p>The verified modern-codec file is <strong>${formatBytes(job.saving)}</strong> smaller. This will finalize the new file and permanently delete the original.</p><div class="settings-actions"><button class="test-button" data-action="close">No, keep both</button><button class="danger-button" id="confirm-replace">Yes, delete original & replace</button></div></section></div>`;
}

function openReplacement(job) {
  document.body.insertAdjacentHTML('beforeend', replacementModal(job));
  const modal = document.querySelector('#replace-modal');
  const button = modal.querySelector('#confirm-replace');
  modal.querySelectorAll('[data-action="close"]').forEach((el) => el.addEventListener('click', () => modal.remove()));
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Replacing…';
    try {
      await request(`/api/optimization/jobs/${job.id}/replace`, {
        method: 'POST',
        body: JSON.stringify({ confirmed: true }),
      });
      modal.remove();
      toast(`${job.title}: original replaced · ${formatBytes(job.saving)} reclaimed`);
      pollOptimizationJobs();
      runStorageScan(true);
    } catch (error) {
      button.textContent = error.message;
    }
  });
}

function optimizationStatus(job) {
  const conversion = job.sourceCodec && job.targetLabel ? job.sourceCodec + ' → ' + job.targetLabel + ' · ' : '';
  if (job.cancelRequested) return 'Stopping safely · original media will be preserved';
  if (job.state === 'failed') return escapeHtml(job.error);
  if (job.state === 'cancelled') return 'Cancelled · partial output removed · original preserved';
  if (job.state === 'ready') return conversion + formatBytes(job.saving) + ' measured saving · verified';
  if (job.state === 'replaced') return formatBytes(job.reclaimed) + ' reclaimed';
  return conversion + (job.progress || 0) + '% complete' + (job.resumeCount ? ' · resumed safely' : '');
}

async function cancelOptimization(job, button) {
  const active = ['preparing', 'encoding', 'verifying'].includes(job.state);
  const warning = active
    ? `This will stop the current encode and remove its partial output. The original media will remain untouched.`
    : 'This will remove the job from the conversion queue. No media files will be changed.';
  if (!window.confirm(`Are you sure you want to cancel “${job.title}”?\n\n${warning}`)) return;
  button.disabled = true;
  button.textContent = active ? 'Stopping…' : 'Cancelling…';
  try {
    await request(`/api/optimization/jobs/${encodeURIComponent(job.id)}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'cancel' }),
    });
    toast(`${job.title}: cancellation requested`);
    pollOptimizationJobs();
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Cancel';
    toast(error.message);
  }
}

async function pollOptimizationJobs() {
  clearTimeout(jobPollTimer);
  try {
    const data = await request('/api/optimization/jobs');
    const container = document.querySelector('#optimization-jobs');
    if (!container) return;
    const active = data.jobs.some((job) => ['queued', 'preparing', 'encoding', 'verifying'].includes(job.state));
    document.querySelector('#queue-state').textContent = data.jobs.some((job) => job.cancelRequested)
      ? 'Stopping'
      : active
        ? 'Working'
        : data.jobs.length
          ? 'Up to date'
          : 'Idle';
    const orderedJobs = data.jobs.slice().reverse();
    container.innerHTML = orderedJobs.length
      ? orderedJobs
          .map((job) => {
            const cancellable = ['queued', 'preparing', 'encoding', 'verifying'].includes(job.state);
            const action =
              job.state === 'ready'
                ? '<button class="replace-button">Review & replace</button>'
                : cancellable
                  ? `<button class="cancel-job-button" ${job.cancelRequested ? 'disabled' : ''}>${job.cancelRequested ? 'Stopping…' : 'Cancel'}</button>`
                  : '';
            return `<article class="job-card ${job.state} ${job.cancelRequested ? 'cancelling' : ''}"><div class="job-status"><span>${escapeHtml(job.cancelRequested ? 'cancelling' : job.state)}</span><b>${escapeHtml(job.title)}</b><small>${optimizationStatus(job)}</small></div><div class="job-progress"><i style="width:${job.progress || 0}%"></i></div>${action}</article>`;
          })
          .join('')
      : '<div class="jobs-empty">Choose “Convert codec” on a candidate to begin. Jobs run one at a time.</div>';
    container.querySelectorAll('.job-card').forEach((card, index) => {
      const job = orderedJobs[index];
      card.querySelector('.replace-button')?.addEventListener('click', () => openReplacement(job));
      card
        .querySelector('.cancel-job-button')
        ?.addEventListener('click', (event) => cancelOptimization(job, event.currentTarget));
    });
    if (active) jobPollTimer = setTimeout(pollOptimizationJobs, 3000);
  } catch {
    jobPollTimer = setTimeout(pollOptimizationJobs, 3000);
  }
}

function render() {
  document.querySelector('#app').innerHTML =
    `<canvas id="starfield" aria-hidden="true"></canvas><div class="cosmic-haze" aria-hidden="true"></div><div class="app-shell">${sidebar()}<main>${header()}<div class="page-wrap">${dashboard()}${libraryPage()}${Object.keys(
      pageCopy,
    )
      .filter((id) => id !== 'library')
      .map(genericPage)
      .join('')}</div></main></div>`;
  bind();
  initStarfield();
  loadPlexOverview();
  pollOptimizationJobs();
}

function route(id) {
  const target = document.querySelector(`#${id}-page`) ? id : 'dashboard';
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === `${target}-page`));
  document.querySelectorAll('.nav-link').forEach((n) => n.classList.toggle('active', n.dataset.nav === target));
  document.querySelector('.sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (location.hash !== `#${target}`) history.pushState(null, '', `#${target}`);
  if (target === 'library' && document.querySelector('#scan-items')?.textContent === '—')
    setTimeout(() => runStorageScan(false), 120);
}

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon('spark')}<span>${message}</span>`;
  document.querySelector('#toast-region').append(el);
  setTimeout(() => el.remove(), 3300);
}

function bind() {
  document.querySelectorAll('[data-nav], [data-route]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      route(el.dataset.nav || el.dataset.route);
    }),
  );
  document
    .querySelector('.mobile-brand')
    .addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
  document.querySelectorAll('[data-action]').forEach((el) =>
    el.addEventListener('click', () => {
      const action = el.dataset.action;
      if (action === 'ask') document.body.insertAdjacentHTML('beforeend', assistantModal());
      else if (action === 'settings') openSettings();
      else if (action === 'scan-storage') runStorageScan(true);
      else if (action === 'close') el.closest('.modal-wrap')?.remove();
      else if (action === 'send') {
        toast('Companion query queued — Plex connection comes next.');
        document.querySelector('#assistant-modal')?.remove();
      } else if (action === 'review') {
        route('library');
        setTimeout(() => runStorageScan(false), 250);
      } else toast(action === 'notifications' ? 'You’re all caught up.' : 'Interactive prototype opened.');
    }),
  );
  document.querySelectorAll('.prompt-chips button').forEach((el) =>
    el.addEventListener('click', () => {
      const input = document.querySelector('.ask-input input');
      if (input) input.value = el.textContent;
    }),
  );
  document.querySelector('#global-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value) toast(`Searching for “${e.target.value}”`);
  });
  document.addEventListener('keydown', shortcutHandler);
  route(location.hash.slice(1) || 'dashboard');
}

function shortcutHandler(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    document.querySelector('#global-search')?.focus();
  }
  if (e.key === 'Escape') document.querySelector('#assistant-modal')?.remove();
}

window.addEventListener('hashchange', () => route(location.hash.slice(1)));
render();
