import { apiFetch } from '../../core/api-client.ts';

const studioState = {
  analysis: null,
  config: null,
  jobs: [],
  query: '',
  source: 'all',
  target: 'hevc',
  timer: null,
  paused: false,
  summary: null,
  queueFilter: 'all',
  controlsAvailable: false,
};
const studioEscape = (value) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
const studioBytes = (bytes) => {
  let value = Number(bytes) || 0,
    unit = 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  while (value >= 1024 && unit < 4) {
    value /= 1024;
    unit++;
  }
  return value.toFixed(unit > 2 ? 1 : 0) + ' ' + units[unit];
};
const studioDuration = (seconds) => {
  seconds = Math.max(0, Number(seconds) || 0);
  if (seconds < 60) return Math.ceil(seconds) + ' sec';
  if (seconds < 3600) return Math.ceil(seconds / 60) + ' min';
  const hours = Math.floor(seconds / 3600),
    minutes = Math.ceil((seconds % 3600) / 60);
  return hours + 'h ' + minutes + 'm';
};
const studioBitrate = (kbps) => {
  const value = Number(kbps) || 0;
  return value >= 1000 ? (value / 1000).toFixed(2) + ' Mbps' : Math.round(value) + ' kbps';
};
const studioFrameRate = (value) => {
  const [numerator, denominator] = String(value || '')
    .split('/')
    .map(Number);
  if (!numerator) return 'Unknown';
  return (denominator ? numerator / denominator : numerator).toFixed(2) + ' fps';
};

function shell() {
  return '<button class="back-link" data-studio-back>← Command deck</button><header class="codec-studio-hero"><div><span class="eyebrow">CODEC STUDIO · VERIFIED MEDIA CONVERSION</span><h1>Smaller files.<br><em>Your quality target.</em></h1><p>Modernize legacy films into HEVC, AV1 or VP9 while preserving audio, subtitles, chapters, metadata and the original source.</p></div><div class="codec-reactor" aria-hidden="true"><i></i><i></i><span>01</span><b>ENCODE CORE</b></div></header><section class="codec-stats"><article><span>CONVERSION CANDIDATES</span><b id="studio-count">—</b><small>Legacy-codec media</small></article><article><span>SOURCE FOOTPRINT</span><b id="studio-size">—</b><small>Review candidates</small></article><article><span>POTENTIAL SAVING</span><b id="studio-saving">—</b><small>Conservative estimate</small></article><article><span>ACTIVE QUEUE</span><b id="studio-active">—</b><small id="studio-active-note">Persistent jobs</small></article></section><section class="studio-live-telemetry" id="studio-live-telemetry" hidden></section><section class="studio-targets" id="studio-targets"><div class="studio-loading-line">Checking modern encoders…</div></section><section class="studio-controls"><label><input id="studio-search" placeholder="Search conversion candidates…"></label><select id="studio-source"><option value="all">All source codecs</option></select><button id="studio-refresh">Refresh scan</button></section><div class="codec-studio-layout"><section class="studio-candidates"><header><div><span>CONVERSION MATRIX</span><h2>Films ready to modernize</h2></div><em>OUTPUT · MKV</em></header><div id="studio-candidate-list"><div class="studio-loading"><i></i><span>Mapping legacy codecs…</span></div></div></section><aside class="studio-queue"><header><div><span>PERSISTENT PIPELINE</span><h2>Conversion queue</h2></div><div class="studio-queue-tools" id="studio-queue-tools" hidden><button id="studio-pause">Pause after current</button><select id="studio-filter"><option value="all">All jobs</option><option value="active">Active queue</option><option value="review">Ready to review</option><option value="attention">Needs attention</option></select></div></header><div class="studio-queue-summary" id="studio-queue-summary" hidden><span><b id="studio-queued-count">0</b><small>WAITING</small></span><span><b id="studio-queue-saving">—</b><small>EST. SAVING</small></span><span><b id="studio-ready-count">0</b><small>READY</small></span><button id="studio-clear">Clear history</button></div><div id="studio-job-list"><div class="studio-empty">No conversion jobs yet.</div></div></aside></div><div class="studio-safety"><b>Original-first safety</b><p>Every conversion is written beside the source, then checked for codec, duration, size, audio and subtitle streams. Replacement always requires an explicit “Are you sure?” decision.</p></div>';
}

function renderTargets() {
  const box = document.querySelector('#studio-targets');
  if (!box || !studioState.config) return;
  const targets = studioState.config.targets || [];
  box.innerHTML = targets
    .map(
      (target, index) =>
        '<label class="studio-target ' +
        (!target.available ? 'unavailable' : '') +
        '"><input type="radio" name="studio-target" value="' +
        studioEscape(target.key) +
        '" ' +
        (target.key === studioState.target ? 'checked' : '') +
        ' ' +
        (!target.available ? 'disabled' : '') +
        '><span><b>' +
        studioEscape(target.label) +
        '</b><small>' +
        ({
          hevc: 'Best overall Plex compatibility and strong compression.',
          av1: 'Highest efficiency for newer playback devices.',
          vp9: 'Open modern format with useful web-device support.',
        }[target.key] || 'Modern video output.') +
        '</small></span><em>' +
        (!target.available ? 'UNAVAILABLE' : index === 0 ? 'RECOMMENDED' : 'EXPERIMENTAL') +
        '</em></label>',
    )
    .join('');
  const selected = box.querySelector('input:checked:not(:disabled)') || box.querySelector('input:not(:disabled)');
  if (selected) {
    selected.checked = true;
    studioState.target = selected.value;
  }
  box.querySelectorAll('input').forEach(
    (input) =>
      (input.onchange = () => {
        studioState.target = input.value;
        renderCandidates();
      }),
  );
}
function candidates() {
  if (!studioState.analysis) return [];
  const query = studioState.query.toLowerCase();
  return studioState.analysis.candidates.filter(
    (item) =>
      (studioState.source === 'all' || item.codec === studioState.source) &&
      (!query || `${item.title} ${item.library} ${item.codec}`.toLowerCase().includes(query)),
  );
}
function renderCandidates() {
  const list = document.querySelector('#studio-candidate-list');
  if (!list || !studioState.analysis) return;
  const items = candidates();
  list.innerHTML = items.length
    ? items
        .map(
          (item) =>
            '<article class="studio-candidate"><span class="studio-codec">' +
            studioEscape(item.codec) +
            '<small>' +
            studioEscape(item.resolution) +
            '</small></span><div><b>' +
            studioEscape(item.title) +
            '</b><small>' +
            studioEscape(
              [item.year, item.library, item.bitrate ? Math.round(item.bitrate / 1000) + ' Mbps' : '']
                .filter(Boolean)
                .join(' · '),
            ) +
            '</small><p>' +
            studioEscape(item.reason) +
            '</p></div><dl><span><dt>Source</dt><dd>' +
            studioBytes(item.size) +
            '</dd></span><span><dt>Potential</dt><dd>−' +
            studioBytes(item.estimatedSaving) +
            '</dd></span><span><dt>Confidence</dt><dd>' +
            item.confidence +
            '%</dd></span></dl><button data-studio-convert="' +
            studioEscape(item.ratingKey) +
            '" data-title="' +
            studioEscape(item.title) +
            '">Convert → ' +
            studioEscape(
              (studioState.config?.targets || []).find((target) => target.key === studioState.target)?.label ||
                studioState.target.toUpperCase(),
            ) +
            '</button></article>',
        )
        .join('')
    : '<div class="studio-empty">No candidates match these filters.</div>';
  list.querySelectorAll('[data-studio-convert]').forEach((button) => (button.onclick = () => stage(button)));
}
async function stage(button) {
  const target = studioState.config.targets.find((item) => item.key === studioState.target),
    title = button.dataset.title;
  if (!target?.available) return;
  if (
    !window.confirm(
      'Are you sure you want to stage “' +
        title +
        '” for ' +
        target.label +
        ' conversion?\n\nThe original will remain untouched and temporary disk space will be required.',
    )
  )
    return;
  button.disabled = true;
  button.textContent = 'Staging…';
  try {
    const response = await apiFetch('/api/optimization/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratingKey: button.dataset.studioConvert, targetCodec: target.key }),
      }),
      data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Conversion could not be staged');
    await loadJobs();
  } catch (error) {
    button.disabled = false;
    button.textContent = error.message;
  }
}

function jobText(job) {
  if (job.cancelRequested) return 'Stopping safely · original media preserved';
  if (job.state === 'failed') return job.error;
  if (job.state === 'cancelled') return 'Cancelled · partial output removed · original preserved';
  if (job.state === 'ready') return studioBytes(job.saving) + ' saved · verified';
  if (job.state === 'replaced') return studioBytes(job.reclaimed) + ' reclaimed';
  if (job.state === 'encoding' && job.etaSeconds != null)
    return (job.progress || 0) + '% complete · about ' + studioDuration(job.etaSeconds) + ' remaining';
  if (job.state === 'queued' && job.estimatedSaving) return 'Estimated saving ' + studioBytes(job.estimatedSaving);
  return (job.progress || 0) + '% complete';
}
function filteredJobs() {
  const states = {
    active: ['queued', 'preparing', 'encoding', 'verifying'],
    review: ['ready'],
    attention: ['failed', 'cancelled', 'replacement-partial'],
  }[studioState.queueFilter];
  return states ? studioState.jobs.filter((job) => states.includes(job.state)) : studioState.jobs;
}
function jobButtons(job) {
  if (!studioState.controlsAvailable)
    return job.state === 'ready'
      ? '<button data-studio-replace="' + studioEscape(job.id) + '">Review & replace</button>'
      : '';
  if (job.cancelRequested) return '<div class="studio-job-actions"><button disabled>Stopping…</button></div>';
  if (job.state === 'queued')
    return (
      '<div class="studio-job-actions"><button data-studio-action="up" data-job="' +
      job.id +
      '" title="Move earlier">↑</button><button data-studio-action="down" data-job="' +
      job.id +
      '" title="Move later">↓</button><button data-studio-action="remove" data-job="' +
      job.id +
      '">Remove from queue</button></div>'
    );
  if (['preparing', 'encoding', 'verifying'].includes(job.state))
    return (
      '<div class="studio-job-actions"><button data-studio-action="cancel" data-job="' +
      job.id +
      '">Cancel encode</button></div>'
    );
  if (['failed', 'cancelled'].includes(job.state))
    return (
      '<div class="studio-job-actions"><button data-studio-action="retry" data-job="' +
      job.id +
      '">Retry</button><button data-studio-action="remove" data-job="' +
      job.id +
      '">Remove</button></div>'
    );
  if (job.state === 'ready')
    return '<button data-studio-replace="' + studioEscape(job.id) + '">Review & replace</button>';
  return '';
}
function renderLiveTelemetry() {
  const panel = document.querySelector('#studio-live-telemetry');
  if (!panel) return;
  const activeId = studioState.summary?.activeJob,
    job = studioState.jobs.find((item) => item.id === activeId);
  if (!job || !['preparing', 'encoding', 'verifying'].includes(job.state)) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  const telemetry = job.telemetry || {},
    source = job.sourceTechnical || {},
    video = source.video || {},
    settings = job.encodingSettings || {},
    elapsedSeconds = job.startedAt ? Math.max(0, (Date.now() - Date.parse(job.startedAt)) / 1000) : 0,
    encodedSeconds = Number(telemetry.encodedSeconds || 0),
    fraction = job.duration ? encodedSeconds / Number(job.duration) : Number(job.progress || 0) / 100,
    projectedBytes = fraction > 0.005 ? Number(telemetry.outputBytes || 0) / fraction : 0,
    projectedSaving = projectedBytes ? Math.max(0, Number(job.sourceSize || 0) - projectedBytes) : 0,
    streams = source.streams || {},
    sampleAge = telemetry.sampledAt
      ? Math.max(0, Math.round((Date.now() - Date.parse(telemetry.sampledAt)) / 1000))
      : null;
  panel.hidden = false;
  panel.innerHTML = `<header><div><span class="studio-live-label"><i></i>LIVE ENCODE TELEMETRY</span><h2>${studioEscape(job.title)}</h2><p>${studioEscape(job.sourceCodec || video.codec || 'SOURCE')} → ${studioEscape(job.targetLabel || job.targetCodec)} · ${studioEscape(job.state).toUpperCase()}</p></div><code>${studioEscape(job.id.slice(0, 8))}</code></header>
    <div class="studio-live-progress"><i><b style="width:${Math.max(0, Math.min(100, job.progress || 0))}%"></b></i><span><b>${job.progress || 0}%</b><small>${studioDuration(encodedSeconds)} encoded of ${studioDuration(job.duration)}</small></span></div>
    <div class="studio-live-metrics">
      <article><span>PROCESSING SPEED</span><b>${telemetry.speed ? Number(telemetry.speed).toFixed(2) + '×' : '—'}</b><small>Relative to real time</small></article>
      <article><span>ENCODE RATE</span><b>${telemetry.fps ? Number(telemetry.fps).toFixed(1) + ' fps' : '—'}</b><small>${Number(telemetry.frame || 0).toLocaleString()} frames emitted</small></article>
      <article><span>OUTPUT BITRATE</span><b>${telemetry.bitrateKbps ? studioBitrate(telemetry.bitrateKbps) : '—'}</b><small>Current muxed average</small></article>
      <article><span>OUTPUT WRITTEN</span><b>${telemetry.outputBytes ? studioBytes(telemetry.outputBytes) : '—'}</b><small>${projectedBytes ? studioBytes(projectedBytes) + ' projected final' : 'Waiting for sample'}</small></article>
      <article><span>ELAPSED</span><b>${studioDuration(elapsedSeconds)}</b><small>Since encoder start</small></article>
      <article><span>ETA</span><b>${job.etaSeconds != null ? studioDuration(job.etaSeconds) : 'Calculating'}</b><small>Based on observed progress</small></article>
      <article><span>QUALITY VALUE</span><b>${telemetry.quality != null ? Number(telemetry.quality).toFixed(1) : '—'}</b><small>Live encoder quantizer</small></article>
      <article><span>PROJECTED SAVING</span><b>${projectedSaving ? studioBytes(projectedSaving) : '—'}</b><small>${projectedBytes && job.sourceSize ? Math.max(0, Math.round((projectedSaving / job.sourceSize) * 100)) + '% below source' : 'Estimate stabilizing'}</small></article>
    </div>
    <div class="studio-live-detail">
      <article><header><span>INPUT TOPOLOGY</span><b>${studioBytes(job.sourceSize)}</b></header><dl><div><dt>Container</dt><dd>${studioEscape(source.container || 'Unknown')}</dd></div><div><dt>Video codec</dt><dd>${studioEscape(video.codec || job.sourceCodec || 'Unknown')}</dd></div><div><dt>Profile</dt><dd>${studioEscape(video.profile || 'Unknown')}</dd></div><div><dt>Raster</dt><dd>${video.width && video.height ? `${video.width} × ${video.height}` : 'Unknown'}</dd></div><div><dt>Pixel format</dt><dd>${studioEscape(video.pixelFormat || 'Unknown')}</dd></div><div><dt>Frame rate</dt><dd>${studioFrameRate(video.frameRate)}</dd></div><div><dt>Source bitrate</dt><dd>${source.bitrate ? studioBitrate(source.bitrate / 1000) : 'Unknown'}</dd></div><div><dt>Streams</dt><dd>${Number(streams.video || 0)}V · ${Number(streams.audio || 0)}A · ${Number(streams.subtitle || 0)}S</dd></div></dl></article>
      <article><header><span>ENCODER PIPELINE</span><b>${studioEscape(settings.encoder || 'Initializing')}</b></header><dl><div><dt>Target</dt><dd>${studioEscape(job.targetLabel || job.targetCodec)}</dd></div><div><dt>Container</dt><dd>${studioEscape(settings.container || 'Matroska')}</dd></div><div><dt>CRF</dt><dd>${settings.crf ?? '—'}</dd></div><div><dt>Preset</dt><dd>${studioEscape(settings.preset || '—')}</dd></div><div><dt>CPU tuning</dt><dd>${studioEscape(settings.cpuUsed ?? 'Default')}</dd></div><div><dt>Stream policy</dt><dd>${studioEscape((settings.copiedStreams || []).join(', ') || 'Initializing')}</dd></div><div><dt>Restarts</dt><dd>${job.resumeCount || 0}</dd></div><div><dt>Telemetry age</dt><dd>${sampleAge == null ? 'Waiting' : sampleAge + ' sec'}</dd></div><div><dt>Dropped / duplicate</dt><dd>${telemetry.droppedFrames || 0} / ${telemetry.duplicateFrames || 0}</dd></div><div><dt>FFmpeg phase</dt><dd>${studioEscape(telemetry.phase || job.state)}</dd></div></dl></article>
    </div>`;
}
function renderJobs() {
  const list = document.querySelector('#studio-job-list');
  if (!list) return;
  const active = studioState.jobs.filter((job) => ['queued', 'preparing', 'encoding', 'verifying'].includes(job.state));
  document.querySelector('#studio-active').textContent = String(active.length);
  document.querySelector('#studio-active-note').textContent = studioState.paused
    ? 'Paused after current'
    : 'Persistent jobs';
  const tools = document.querySelector('#studio-queue-tools'),
    summaryBox = document.querySelector('#studio-queue-summary');
  tools.hidden = !studioState.controlsAvailable;
  summaryBox.hidden = !studioState.controlsAvailable;
  if (studioState.controlsAvailable) {
    document.querySelector('#studio-pause').textContent = studioState.paused ? 'Resume queue' : 'Pause after current';
    document.querySelector('#studio-pause').classList.toggle('is-paused', studioState.paused);
    document.querySelector('#studio-queued-count').textContent = String(studioState.summary?.counts?.queued || 0);
    document.querySelector('#studio-ready-count').textContent = String(studioState.summary?.counts?.ready || 0);
    document.querySelector('#studio-queue-saving').textContent = studioBytes(studioState.summary?.estimatedSaving || 0);
  }
  const navCount = document.querySelector('#nav-codec-count');
  if (navCount) {
    const queued = Number(studioState.summary?.counts?.queued || 0);
    navCount.textContent = queued > 99 ? '99+' : String(queued);
    navCount.setAttribute('aria-label', queued + (queued === 1 ? ' codec job queued' : ' codec jobs queued'));
    navCount.title = queued + (queued === 1 ? ' item waiting to encode' : ' items waiting to encode');
  }
  renderLiveTelemetry();
  const visible = filteredJobs();
  list.innerHTML = visible.length
    ? visible
        .map(
          (job) =>
            '<article class="studio-job ' +
            studioEscape(job.state) +
            '"><header><span>' +
            studioEscape(job.state) +
            '</span><em>' +
            studioEscape(job.sourceCodec || 'LEGACY') +
            ' → ' +
            studioEscape(job.targetLabel || 'HEVC') +
            '</em></header><b>' +
            studioEscape(job.title) +
            '</b><small>' +
            studioEscape(jobText(job)) +
            '</small><i><b style="width:' +
            (job.progress || 0) +
            '%"></b></i>' +
            jobButtons(job) +
            '</article>',
        )
        .join('')
    : '<div class="studio-empty">No jobs match this view.</div>';
  list
    .querySelectorAll('[data-studio-replace]')
    .forEach(
      (button) =>
        (button.onclick = () => replaceJob(studioState.jobs.find((job) => job.id === button.dataset.studioReplace))),
    );
  list.querySelectorAll('[data-studio-action]').forEach((button) => (button.onclick = () => jobAction(button)));
  clearTimeout(studioState.timer);
  if (active.length) studioState.timer = setTimeout(loadJobs, location.hash === '#codec' ? 3000 : 15_000);
}

async function requestQueue(url, options) {
  const response = await apiFetch(url, options),
    data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Queue operation failed');
  return data;
}
async function setQueuePaused() {
  const button = document.querySelector('#studio-pause');
  button.disabled = true;
  try {
    const data = await requestQueue('/api/optimization/queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: !studioState.paused }),
    });
    studioState.paused = data.paused;
    studioState.summary = data.summary;
    renderJobs();
  } catch (error) {
    window.alert(error.message);
  } finally {
    button.disabled = false;
  }
}
async function jobAction(button) {
  const action = button.dataset.studioAction,
    job = studioState.jobs.find((item) => item.id === button.dataset.job);
  if (action === 'cancel') {
    const active = ['preparing', 'encoding', 'verifying'].includes(job.state),
      warning = active
        ? 'This stops the encoder and removes its partial output. The original media remains untouched.'
        : 'This removes the job from the queue. No media files will be changed.';
    if (!window.confirm('Are you sure you want to cancel “' + job.title + '”?\n\n' + warning)) return;
  }
  if (
    action === 'remove' &&
    !window.confirm(
      'Remove “' +
        job.title +
        '” from the optimization queue?\n\nOnly the queue record will be removed. The media file will remain untouched and you can stage it again later.',
    )
  )
    return;
  button.disabled = true;
  if (action === 'cancel') button.textContent = 'Stopping…';
  if (action === 'remove') button.textContent = 'Removing…';
  try {
    await requestQueue('/api/optimization/jobs/' + encodeURIComponent(job.id) + '/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    await loadJobs();
  } catch (error) {
    window.alert(error.message);
    button.disabled = false;
  }
}
async function clearHistory() {
  if (
    !window.confirm(
      'Are you sure you want to clear failed, cancelled and completed conversion history?\n\nMedia files are not changed.',
    )
  )
    return;
  try {
    await requestQueue('/api/optimization/queue/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    await loadJobs();
  } catch (error) {
    window.alert(error.message);
  }
}
async function replaceJob(job) {
  if (
    !window.confirm(
      'Are you sure you want to replace the original “' +
        job.title +
        '”?\n\nThe verified ' +
        (job.targetLabel || 'modern-codec') +
        ' copy is ' +
        studioBytes(job.saving) +
        ' smaller. This permanently deletes the original.',
    )
  )
    return;
  try {
    await requestQueue('/api/optimization/jobs/' + encodeURIComponent(job.id) + '/replace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    await Promise.all([loadJobs(), loadAnalysis(true)]);
  } catch (error) {
    window.alert(error.message);
  }
}
async function loadJobs() {
  try {
    const response = await apiFetch('/api/optimization/jobs'),
      data = await response.json();
    if (!response.ok) throw new Error(data.error);
    studioState.jobs = data.jobs || [];
    studioState.controlsAvailable = Object.hasOwn(data, 'paused') && Boolean(data.summary);
    studioState.paused = data.paused === true;
    studioState.summary = data.summary || null;
    renderJobs();
  } catch {
    studioState.timer = setTimeout(loadJobs, 3000);
  }
}
async function loadAnalysis(force = false) {
  const list = document.querySelector('#studio-candidate-list');
  if (list) list.innerHTML = '<div class="studio-loading"><i></i><span>Mapping legacy codecs…</span></div>';
  try {
    const [analysisResponse, configResponse] = await Promise.all([
        apiFetch('/api/analysis/storage' + (force ? '?refresh=1' : '')),
        apiFetch('/api/optimization/config'),
      ]),
      analysis = await analysisResponse.json(),
      config = await configResponse.json();
    if (!analysisResponse.ok) throw new Error(analysis.error);
    if (!configResponse.ok) throw new Error(config.error);
    studioState.analysis = analysis;
    studioState.config = config;
    document.querySelector('#studio-count').textContent = analysis.candidateCount.toLocaleString();
    document.querySelector('#studio-size').textContent = studioBytes(analysis.totalSize);
    document.querySelector('#studio-saving').textContent = studioBytes(analysis.estimatedSaving);
    const codecs = [...new Set(analysis.candidates.map((item) => item.codec))].sort();
    document.querySelector('#studio-source').innerHTML =
      '<option value="all">All source codecs</option>' +
      codecs
        .map((codec) => '<option value="' + studioEscape(codec) + '">' + studioEscape(codec) + '</option>')
        .join('');
    renderTargets();
    renderCandidates();
  } catch (error) {
    list.innerHTML = '<div class="studio-empty error">' + studioEscape(error.message) + '</div>';
  }
}
function setupStudio() {
  const page = document.querySelector('#codec-page');
  if (!page) return;
  page.classList.add('codec-studio');
  page.innerHTML = shell();
  page.querySelector('[data-studio-back]').onclick = () => document.querySelector('[data-nav="dashboard"]').click();
  page.querySelector('#studio-search').oninput = (event) => {
    studioState.query = event.target.value;
    renderCandidates();
  };
  page.querySelector('#studio-source').onchange = (event) => {
    studioState.source = event.target.value;
    renderCandidates();
  };
  page.querySelector('#studio-refresh').onclick = () => loadAnalysis(true);
  page.querySelector('#studio-pause').onclick = setQueuePaused;
  page.querySelector('#studio-filter').onchange = (event) => {
    studioState.queueFilter = event.target.value;
    renderJobs();
  };
  page.querySelector('#studio-clear').onclick = clearHistory;
  document.querySelector('[data-nav="codec"]')?.addEventListener('click', () => {
    if (!studioState.analysis) loadAnalysis();
    loadJobs();
  });
  loadJobs();
  if (location.hash === '#codec') loadAnalysis();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupStudio);
else setupStudio();
