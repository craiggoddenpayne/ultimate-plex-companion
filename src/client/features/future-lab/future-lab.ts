import { renderFutureLabExperiment } from './future-lab-experiments.ts';
import { renderFutureLabSignal } from './future-lab-signals.ts';
import { expandedTabNames, renderExpandedFutureLab } from './future-lab-expanded.ts';
import { apiFetch } from '../../core/api-client.ts';

const labState = {
  data: null,
  tab: 'constellation',
  graphViewport: { zoom: 1, x: 0, y: 0 },
  serendipityIndex: 0,
};
const labEscape = (value) =>
  String(value == null ? '' : value).replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
const labIcons = {
  flask:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 15h9"/></svg>',
  spark:
    '<svg class="icon" viewBox="0 0 24 24"><path d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3z"/></svg>',
  clock: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  radar:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m12 12 6-6"/></svg>',
};
const tabNames = [
  ['constellation', 'Cultural constellation'],
  ['capsule', 'Time capsule'],
  ['serendipity', 'Serendipity engine'],
  ['oracle', 'Viewing oracle'],
  ['mood', 'Mood weather'],
  ['memory', 'Memory lane'],
  ['runtime', 'Runtime wormhole'],
  ['anomalies', 'Archive anomalies'],
  ['backlog', 'Backlog horizon'],
  ['rewatch', 'Rewatch DNA'],
  ['drift', 'Genre drift'],
  ['chronotype', 'Night observatory'],
  ['growth', 'Collection pulse'],
  ['ratings', 'Rating lens'],
  ['codecs', 'Codec archaeology'],
  ['storage', 'Storage topology'],
  ['bridges', 'Genre bridges'],
  ['passport', 'Decade passport'],
  ['tempo', 'Duration DNA'],
  ['seasons', 'Seasonal echoes'],
  ...expandedTabNames.map(([id, label]) => [id, label]),
];

function labShell() {
  return (
    '<button class="back-link" data-lab-back>← Command deck</button><div class="lab-hero"><div><span class="eyebrow">FUTURE LAB · EXPERIMENTAL</span><h1>Ideas from the<br><em>edge of your library.</em></h1><p>Local experiments built from the cultural shape and memory of your Plex universe.</p></div><div class="lab-reactor"><span>' +
    labIcons.flask +
    '</span><i></i><b>LIVE<br>EXPERIMENTS</b></div></div><div class="lab-status"><span><i></i>Read-only laboratory</span><b id="lab-catalog">Calibrating with Plex…</b><button id="refresh-lab">Recalculate</button></div><nav class="lab-tabs">' +
    tabNames
      .map(
        (tab, index) =>
          '<button data-lab-tab="' +
          tab[0] +
          '" class="' +
          (index === 0 ? 'active' : '') +
          '"><i>' +
          String(index + 1).padStart(2, '0') +
          '</i>' +
          tab[1] +
          '</button>',
      )
      .join('') +
    '</nav><div class="lab-tools"><label><span>FILTER 50 EXPERIMENTS</span><input type="search" id="lab-filter" placeholder="Directors, formats, history…"></label><button type="button" id="lab-surprise">Surprise experiment</button><button type="button" id="lab-export">Export lab report</button></div><div class="lab-stage" id="lab-stage"><div class="lab-loading"><span></span><h3>Mapping the edges</h3><p>Analysing relationships across your movie archive.</p></div></div>'
  );
}

function constellationView(data) {
  return (
    '<section class="lab-view constellation-view"><div class="view-copy"><span class="card-label">CULTURAL GRAPH</span><h2>Your library has a shape.</h2><p>Zoom, drag or use the navigation pad to explore. Hover over a signal to inspect it, or click to keep its strongest relationships isolated.</p><div class="graph-legend"><span><i></i>Genre</span><span><i></i>Director</span></div><div class="graph-top">' +
    data.graph.nodes
      .slice(0, 6)
      .map((node) => '<div><b>' + labEscape(node.label) + '</b><span>' + node.count + ' titles</span></div>')
      .join('') +
    '</div></div><div class="graph-wrap"><canvas id="culture-graph" tabindex="0" aria-label="Interactive cultural relationship graph. Use arrow keys to navigate and plus or minus to zoom."></canvas><div class="graph-toolbar" aria-label="Graph zoom controls"><button type="button" data-graph-action="zoom-out" aria-label="Zoom out" title="Zoom out">−</button><output id="graph-zoom" aria-live="polite">100%</output><button type="button" data-graph-action="zoom-in" aria-label="Zoom in" title="Zoom in">+</button><button type="button" class="graph-fit" data-graph-action="fit" aria-label="Fit graph to view" title="Fit graph to view">FIT</button></div><div class="graph-navigator" aria-label="Graph navigation controls"><button type="button" data-graph-action="up" aria-label="Navigate up">↑</button><button type="button" data-graph-action="left" aria-label="Navigate left">←</button><button type="button" data-graph-action="centre" aria-label="Centre graph" title="Centre graph">•</button><button type="button" data-graph-action="right" aria-label="Navigate right">→</button><button type="button" data-graph-action="down" aria-label="Navigate down">↓</button></div><div class="graph-gesture-hint">SCROLL TO ZOOM · DRAG TO NAVIGATE</div><div id="graph-tooltip"></div></div></section>'
  );
}

function capsuleView(data) {
  const peak = Math.max(1, ...data.eras.map((item) => item.count));
  return (
    '<section class="lab-view capsule-view"><div class="capsule-heading"><div><span class="card-label">LIBRARY TIME CAPSULE</span><h2>' +
    data.eras[0]?.decade +
    's → ' +
    data.eras[data.eras.length - 1]?.decade +
    's</h2><p>' +
    data.catalogSize.toLocaleString() +
    ' films arranged across cinematic time.</p></div>' +
    labIcons.clock +
    '</div><div class="era-chart">' +
    data.eras
      .map(
        (item) =>
          '<div><i style="height:' +
          Math.max(4, Math.round((item.count / peak) * 100)) +
          '%"><span>' +
          item.count +
          '</span></i><b>' +
          String(item.decade).slice(2) +
          's</b></div>',
      )
      .join('') +
    '</div><div class="capsule-shelves"><div><span class="card-label">EARLIEST SIGNALS</span>' +
    data.oldest.map((item) => capsuleCard(item)).join('') +
    '</div><div><span class="card-label">NEWEST ARRIVALS</span>' +
    data.newest.map((item) => capsuleCard(item)).join('') +
    '</div></div></section>'
  );
}
function capsuleCard(item) {
  return (
    '<article><img src="' +
    labEscape(item.poster) +
    '" alt="" loading="lazy"><p><b>' +
    labEscape(item.title) +
    '</b><small>' +
    item.year +
    '</small></p></article>'
  );
}

function serendipityView(data) {
  const pairs = data.doubleFeatures?.length
    ? data.doubleFeatures
    : data.doubleFeature?.length
      ? [data.doubleFeature]
      : [];
  const index = pairs.length ? labState.serendipityIndex % pairs.length : 0;
  const pair = pairs[index] || [];
  return (
    '<section class="lab-view serendipity-view"><div class="serendipity-copy"><span class="card-label">SERENDIPITY ENGINE · PAIRING SEQUENCE</span><h2>Two films that should<br>never have met.</h2><p>Radar deliberately crosses distant genres to create unexpected double features from unwatched, highly rated films you already own.</p><div class="pair-equation"><span>CONTRAST</span><i>+</i><span>QUALITY</span><i>+</i><span>CURIOSITY</span></div>' +
    (pairs.length
      ? '<div class="serendipity-controls"><span>PAIRING <b>' +
        (index + 1) +
        '</b> OF ' +
        pairs.length +
        '</span><button type="button" data-serendipity-next ' +
        (pairs.length < 2 ? 'disabled' : '') +
        '>NEXT PAIRING <i>→</i></button></div>'
      : '') +
    '</div><div class="double-feature" aria-live="polite">' +
    (pair.length === 2
      ? pair
          .map(
            (item, index) =>
              '<article><div><img src="' +
              labEscape(item.poster) +
              '" alt=""><span>FEATURE ' +
              (index + 1) +
              '</span></div><h3>' +
              labEscape(item.title) +
              '</h3><p>' +
              item.year +
              ' · ' +
              item.durationMinutes +
              ' min · ★ ' +
              item.rating.toFixed(1) +
              '</p><small>' +
              item.genres.map(labEscape).join(' · ') +
              '</small></article>',
          )
          .join('<i class="pair-link">×</i>')
      : '<div class="lab-empty">More rated, unwatched films are needed to create a pairing.</div>') +
    '</div></section>'
  );
}

function oracleView(data) {
  const oracle = data.oracle;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hour = oracle.peakHour;
  const time = (hour % 12 || 12) + (hour >= 12 ? ' PM' : ' AM');
  const watchedTotal = oracle.watchedMovies + oracle.unwatchedMovies;
  const watchedPercent = watchedTotal ? Math.round((oracle.watchedMovies / watchedTotal) * 100) : 0;
  const sample = oracle.sample || {},
    cadence = oracle.cadence || {},
    behaviour = oracle.behaviour || {},
    hourDistribution = oracle.hourDistribution || [],
    dayDistribution = oracle.dayDistribution || [],
    maxHour = Math.max(1, ...hourDistribution.map((item) => item.count)),
    maxDay = Math.max(1, ...dayDistribution.map((item) => item.count)),
    maxGenre = Math.max(1, ...(oracle.topGenres || []).map((item) => item.count));
  const dateText = (timestamp) =>
    timestamp ? new Date(Number(timestamp) * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'No signal';
  const momentum = Number(cadence.change || 0);
  return `<section class="lab-view oracle-view">
    <div class="oracle-overview">
      <div class="oracle-core"><span class="oracle-r1"></span><span class="oracle-r2"></span><i>${oracle.confidence}%</i><b>SIGNAL<br>CONFIDENCE</b><small>${Number(sample.plays || 0).toLocaleString()} PLAYS ANALYSED</small></div>
      <div class="oracle-copy"><span class="card-label">VIEWING ORACLE · EVIDENCE PROFILE</span><h2>Your habits leave<br>a detailed signature.</h2><p>Pattern recognition from your private Plex history. Every reading below describes observed behavior rather than predicting what you will do next.</p><div class="oracle-grid">
        <article><span>PEAK HOUR</span><b>${time}</b><small>${oracle.peakHourPlays} sampled plays</small></article>
        <article><span>PEAK DAY</span><b>${days[oracle.peakDay]}</b><small>${oracle.peakDayPlays} sampled plays</small></article>
        <article><span>STRONGEST GENRE</span><b>${labEscape(oracle.favouriteGenre)}</b><small>${oracle.favouriteGenreCount} matched plays</small></article>
        <article><span>LIBRARY EXPLORED</span><b>${watchedPercent}%</b><small>${oracle.unwatchedMovies.toLocaleString()} films still waiting</small></article>
        <article><span>REWATCH RATE</span><b>${behaviour.rewatchRate || 0}%</b><small>${Number(behaviour.repeatPlays || 0).toLocaleString()} repeat plays</small></article>
        <article><span>RUNTIME SIGNATURE</span><b>${labEscape(behaviour.runtimeSignature || 'Still emerging')}</b><small>${behaviour.averageRuntimeMinutes || 0} min observed average</small></article>
        <article><span>30-DAY MOMENTUM</span><b class="${momentum >= 0 ? 'oracle-up' : 'oracle-down'}">${momentum > 0 ? '+' : ''}${momentum}</b><small>${cadence.recent30Days || 0} recent vs ${cadence.previous30Days || 0} previous</small></article>
        <article><span>LONGEST STREAK</span><b>${cadence.longestDailyStreak || 0} days</b><small>${sample.activeDays || 0} active dates in sample</small></article>
      </div></div>
    </div>
    <div class="oracle-detail-grid">
      <article class="oracle-panel oracle-time-panel"><header><span class="card-label">24-HOUR SIGNATURE</span><b>Server local time</b></header><div class="oracle-hours">${hourDistribution.map((item) => `<span style="--strength:${Math.max(0.08, item.count / maxHour)}" title="${String(item.hour).padStart(2, '0')}:00 · ${item.count} plays"><i></i><small>${item.hour % 3 === 0 ? String(item.hour).padStart(2, '0') : ''}</small></span>`).join('')}</div><div class="oracle-time-bands">${(oracle.timeBands || []).map((band) => `<div><span>${labEscape(band.label)}</span><b>${band.count}</b><small>${labEscape(band.hours)}</small></div>`).join('')}</div></article>
      <article class="oracle-panel oracle-week-panel"><header><span class="card-label">WEEKLY RHYTHM</span><b>${cadence.weekendPlays || 0} weekend plays</b></header><div class="oracle-days">${dayDistribution.map((item) => `<div><span>${days[item.day].slice(0, 3)}</span><i><b style="width:${Math.round((item.count / maxDay) * 100)}%"></b></i><strong>${item.count}</strong></div>`).join('')}</div><div class="oracle-week-split"><span>WEEKDAY <b>${cadence.weekdayPlays || 0}</b></span><span>WEEKEND <b>${cadence.weekendPlays || 0}</b></span></div></article>
      <article class="oracle-panel oracle-taste-panel"><header><span class="card-label">TASTE EVIDENCE</span><b>Play-weighted</b></header><div class="oracle-genres">${(oracle.topGenres || []).map((genre) => `<div><span>${labEscape(genre.genre)}</span><i><b style="width:${Math.round((genre.count / maxGenre) * 100)}%"></b></i><strong>${genre.count}</strong></div>`).join('')}</div><div class="oracle-decades">${(oracle.topDecades || []).map((decade) => `<span><b>${labEscape(decade.decade)}</b>${decade.count} plays</span>`).join('')}</div></article>
      <article class="oracle-panel oracle-evidence-panel"><header><span class="card-label">SAMPLE EVIDENCE</span><b>${sample.matchedPlays || 0} catalogue matches</b></header><dl><div><dt>Unique titles</dt><dd>${sample.uniqueTitles || 0}</dd></div><div><dt>History coverage</dt><dd>${sample.plays ? Math.round((sample.matchedPlays / sample.plays) * 100) : 0}%</dd></div><div><dt>First sampled play</dt><dd>${dateText(sample.firstViewedAt)}</dd></div><div><dt>Latest sampled play</dt><dd>${dateText(sample.lastViewedAt)}</dd></div><div><dt>Busiest sampled date</dt><dd>${cadence.busiestDate ? `${labEscape(cadence.busiestDate.date)} · ${cadence.busiestDate.count}` : 'No signal'}</dd></div></dl><div class="oracle-top-titles">${(oracle.topTitles || []).map((item, index) => `<div><i>${String(index + 1).padStart(2, '0')}</i><span>${labEscape(item.title)}</span><b>${item.plays} plays</b></div>`).join('')}</div></article>
    </div>
  </section>`;
}

function drawGraph(graph) {
  const canvas = document.querySelector<HTMLCanvasElement>('#culture-graph');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const width = wrap.clientWidth,
    height = Math.max(420, wrap.clientHeight);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const cx = width / 2,
    cy = height / 2;
  const viewport = labState.graphViewport;
  const genres = graph.nodes.filter((n) => n.type === 'genre'),
    directors = graph.nodes.filter((n) => n.type === 'director');
  const positioned = [];
  genres.forEach((node, index) => {
    const a = (index / genres.length) * Math.PI * 2 - Math.PI / 2;
    positioned.push({
      ...node,
      x: cx + Math.cos(a) * Math.min(width * 0.34, 190),
      y: cy + Math.sin(a) * 165,
      r: Math.max(7, Math.min(16, 5 + Math.sqrt(node.count))),
    });
  });
  directors.forEach((node, index) => {
    const a = (index / directors.length) * Math.PI * 2 - Math.PI / 2 + 0.32;
    positioned.push({
      ...node,
      x: cx + Math.cos(a) * Math.min(width * 0.19, 100),
      y: cy + Math.sin(a) * 92,
      r: Math.max(5, Math.min(11, 4 + Math.sqrt(node.count) * 0.5)),
    });
  });
  const byId = new Map(positioned.map((n) => [n.id, n]));
  let hovered = null,
    selected = null,
    dragging = false,
    moved = false,
    pointerX = 0,
    pointerY = 0;
  const screenPosition = (node) => ({
    x: cx + viewport.x + (node.x - cx) * viewport.zoom,
    y: cy + viewport.y + (node.y - cy) * viewport.zoom,
  });
  function paint(focus = selected || hovered) {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(cx + viewport.x, cy + viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);
    ctx.translate(-cx, -cy);
    for (const edge of graph.edges) {
      const a = byId.get(edge.source),
        b = byId.get(edge.target);
      if (!a || !b) continue;
      const active = !focus || a.id === focus.id || b.id === focus.id;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = active ? 'rgba(245,173,46,.3)' : 'rgba(110,122,140,.07)';
      ctx.lineWidth = Math.min(2, 0.35 + edge.weight / 12);
      ctx.lineWidth /= viewport.zoom;
      ctx.stroke();
    }
    for (const node of positioned) {
      const active =
        !focus ||
        node.id === focus.id ||
        graph.edges.some(
          (e) => (e.source === focus.id && e.target === node.id) || (e.target === focus.id && e.source === node.id),
        );
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fillStyle =
        node.type === 'genre'
          ? 'rgba(245,173,46,' + (active ? 0.86 : 0.16) + ')'
          : 'rgba(80,214,209,' + (active ? 0.82 : 0.14) + ')';
      ctx.shadowColor = node.type === 'genre' ? '#f5ad2e' : '#50d6d1';
      ctx.shadowBlur = active ? 13 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (node.r > 10) {
        ctx.fillStyle = active ? '#d8d9d5' : '#646c78';
        ctx.font = '7px DM Mono';
        ctx.textAlign = 'center';
        ctx.fillText(node.label.slice(0, 18), node.x, node.y + node.r + 12);
      }
    }
    ctx.restore();
    canvas.style.cursor = dragging ? 'grabbing' : hovered ? 'pointer' : 'grab';
    const zoomOutput = document.querySelector('#graph-zoom');
    if (zoomOutput) zoomOutput.textContent = Math.round(viewport.zoom * 100) + '%';
  }
  const clampViewport = () => {
    viewport.zoom = Math.max(0.65, Math.min(3.25, viewport.zoom));
    viewport.x = Math.max(-width * 1.25, Math.min(width * 1.25, viewport.x));
    viewport.y = Math.max(-height * 1.25, Math.min(height * 1.25, viewport.y));
  };
  const zoomAt = (nextZoom, screenX = cx, screenY = cy) => {
    const oldZoom = viewport.zoom;
    const worldX = (screenX - cx - viewport.x) / oldZoom + cx;
    const worldY = (screenY - cy - viewport.y) / oldZoom + cy;
    viewport.zoom = nextZoom;
    clampViewport();
    viewport.x = screenX - cx - (worldX - cx) * viewport.zoom;
    viewport.y = screenY - cy - (worldY - cy) * viewport.zoom;
    clampViewport();
    paint();
  };
  const hitAt = (screenX, screenY) => {
    const worldX = (screenX - cx - viewport.x) / viewport.zoom + cx;
    const worldY = (screenY - cy - viewport.y) / viewport.zoom + cy;
    return positioned.find((node) => Math.hypot(node.x - worldX, node.y - worldY) < node.r + 7 / viewport.zoom);
  };
  const showTooltip = (node) => {
    const tip = document.querySelector('#graph-tooltip');
    if (!tip) return;
    if (!node) {
      tip.classList.remove('visible');
      return;
    }
    const point = screenPosition(node);
    tip.textContent = node.label + ' · ' + node.count + ' titles' + (node === selected ? ' · locked' : '');
    tip.style.left = Math.max(8, Math.min(width - 170, point.x + 12)) + 'px';
    tip.style.top = Math.max(8, Math.min(height - 36, point.y - 10)) + 'px';
    tip.classList.add('visible');
  };
  paint();
  canvas.onpointerdown = (event) => {
    dragging = true;
    moved = false;
    pointerX = event.clientX;
    pointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    paint();
  };
  canvas.onpointermove = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left,
      y = event.clientY - rect.top;
    if (dragging) {
      const dx = event.clientX - pointerX,
        dy = event.clientY - pointerY;
      moved ||= Math.abs(dx) + Math.abs(dy) > 2;
      viewport.x += dx;
      viewport.y += dy;
      pointerX = event.clientX;
      pointerY = event.clientY;
      clampViewport();
      hovered = null;
      showTooltip(null);
      paint();
      return;
    }
    hovered = hitAt(x, y) || null;
    paint();
    showTooltip(selected || hovered);
  };
  canvas.onpointerup = (event) => {
    if (!moved) {
      const rect = canvas.getBoundingClientRect();
      const hit = hitAt(event.clientX - rect.left, event.clientY - rect.top) || null;
      selected = selected?.id === hit?.id ? null : hit;
      hovered = hit;
      showTooltip(selected || hovered);
    }
    dragging = false;
    canvas.releasePointerCapture(event.pointerId);
    paint();
  };
  canvas.onpointercancel = () => {
    dragging = false;
    paint();
  };
  canvas.onmouseleave = () => {
    if (dragging) return;
    hovered = null;
    paint();
    if (!selected) showTooltip(null);
  };
  canvas.onwheel = (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoomAt(viewport.zoom * (event.deltaY < 0 ? 1.15 : 0.87), event.clientX - rect.left, event.clientY - rect.top);
  };
  const navigate = (x, y) => {
    viewport.x += x;
    viewport.y += y;
    clampViewport();
    paint();
    showTooltip(selected || hovered);
  };
  const reset = () => {
    viewport.zoom = 1;
    viewport.x = 0;
    viewport.y = 0;
    selected = null;
    hovered = null;
    showTooltip(null);
    paint();
  };
  wrap.querySelectorAll('[data-graph-action]').forEach((button) => {
    button.onclick = () => {
      const action = button.dataset.graphAction;
      if (action === 'zoom-in') zoomAt(viewport.zoom * 1.2);
      if (action === 'zoom-out') zoomAt(viewport.zoom / 1.2);
      if (action === 'fit' || action === 'centre') reset();
      if (action === 'up') navigate(0, 48);
      if (action === 'down') navigate(0, -48);
      if (action === 'left') navigate(48, 0);
      if (action === 'right') navigate(-48, 0);
      canvas.focus({ preventScroll: true });
    };
  });
  canvas.onkeydown = (event) => {
    const actions = {
      ArrowUp: () => navigate(0, 48),
      ArrowDown: () => navigate(0, -48),
      ArrowLeft: () => navigate(48, 0),
      ArrowRight: () => navigate(-48, 0),
      '+': () => zoomAt(viewport.zoom * 1.2),
      '=': () => zoomAt(viewport.zoom * 1.2),
      '-': () => zoomAt(viewport.zoom / 1.2),
      '0': reset,
      Escape: () => {
        selected = null;
        showTooltip(null);
        paint();
      },
    };
    if (!actions[event.key]) return;
    event.preventDefault();
    actions[event.key]();
  };
}

function renderLab() {
  const stage = document.querySelector('#lab-stage');
  if (!stage || !labState.data) return;
  const views = {
    constellation: constellationView,
    capsule: capsuleView,
    serendipity: serendipityView,
    oracle: oracleView,
  };
  const view = views[labState.tab];
  stage.innerHTML =
    (view ? view(labState.data) : renderFutureLabSignal(labState.tab, labState.data)) ||
    renderExpandedFutureLab(labState.tab, labState.data) ||
    renderFutureLabExperiment(labState.tab, labState.data);
  if (labState.tab === 'constellation') requestAnimationFrame(() => drawGraph(labState.data.graph));
  stage.querySelector('[data-serendipity-next]')?.addEventListener('click', () => {
    const pairs = labState.data.doubleFeatures || [];
    if (pairs.length < 2) return;
    labState.serendipityIndex = (labState.serendipityIndex + 1) % pairs.length;
    renderLab();
  });
  stage.querySelectorAll('.runtime-distribution-trigger, .runtime-window-trigger').forEach((button) =>
    button.addEventListener('click', () => {
      const list = button.parentElement?.querySelector('.runtime-title-list');
      if (!list) return;
      const opening = list.hidden;
      list.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
      const cue = button.querySelector(':scope > small');
      if (cue) cue.textContent = opening ? 'Hide titles' : 'View titles';
    }),
  );
  stage.querySelectorAll('[data-runtime-title]').forEach((button) =>
    button.addEventListener('click', () => {
      const ratingKey = String(button.dataset.runtimeTitle || '');
      const runtime = labState.data?.runtimeWormhole;
      const items = [
        ...(runtime?.buckets || []).flatMap((bucket) => bucket.titles || []),
        ...(runtime?.windows || []).flatMap((window) => window.titles || []),
        ...(runtime?.longest || []),
      ];
      const item = items.find((candidate) => String(candidate.ratingKey) === ratingKey);
      if (item) showRuntimeTitle(item);
    }),
  );
}

function showRuntimeTitle(item) {
  document.querySelector('.runtime-detail-wrap')?.remove();
  const facts = [
    item.year,
    item.durationMinutes ? item.durationMinutes + ' min' : '',
    item.rating ? '★ ' + Number(item.rating).toFixed(1) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const modal = document.createElement('div');
  modal.className = 'modal-wrap runtime-detail-wrap';
  modal.innerHTML =
    '<div class="modal-backdrop" data-runtime-close></div><section class="runtime-detail-modal" role="dialog" aria-modal="true" aria-labelledby="runtime-detail-title"><button type="button" class="modal-close" data-runtime-close aria-label="Close">×</button><img src="' +
    labEscape(item.poster) +
    '" alt=""><div><span class="card-label">RUNTIME SIGNAL</span><h2 id="runtime-detail-title">' +
    labEscape(item.title) +
    '</h2><p class="runtime-detail-facts">' +
    labEscape(facts) +
    '</p><p class="runtime-detail-genres">' +
    labEscape((item.genres || []).join(' · ') || 'Unclassified') +
    '</p><a href="/api/plex/open/' +
    encodeURIComponent(item.ratingKey) +
    '">Open in Plex ↗</a></div></section>';
  document.body.append(modal);
  const close = () => modal.remove();
  modal.querySelectorAll('[data-runtime-close]').forEach((element) => element.addEventListener('click', close));
  modal.querySelector('.modal-close')?.focus();
}
async function loadLab(force = false) {
  const stage = document.querySelector('#lab-stage');
  if (!stage) return;
  stage.classList.add('loading');
  try {
    const response = await apiFetch('/api/lab' + (force ? '?refresh=1' : ''));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    labState.data = data;
    labState.serendipityIndex = 0;
    document.querySelector('#lab-catalog').textContent =
      data.catalogSize.toLocaleString() + ' films · ' + data.historySample.toLocaleString() + ' history signals';
    renderLab();
  } catch (error) {
    stage.innerHTML =
      '<div class="lab-empty"><b>Experiment interrupted</b><p>' + labEscape(error.message) + '</p></div>';
  } finally {
    stage.classList.remove('loading');
  }
}
function setupLab() {
  const page = document.querySelector('#lab-page');
  if (!page) return;
  page.classList.add('future-lab');
  page.innerHTML = labShell();
  page.querySelector('[data-lab-back]').addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelector('[data-nav="dashboard"]').click();
  });
  page.querySelectorAll('[data-lab-tab]').forEach((button) =>
    button.addEventListener('click', () => {
      labState.tab = button.dataset.labTab;
      page.querySelectorAll('[data-lab-tab]').forEach((item) => item.classList.toggle('active', item === button));
      renderLab();
    }),
  );
  page.querySelector('#refresh-lab').addEventListener('click', () => loadLab(true));
  page.querySelector('#lab-filter').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    page.querySelectorAll('[data-lab-tab]').forEach((button) => {
      button.hidden = Boolean(query) && !button.textContent.toLowerCase().includes(query);
    });
  });
  page.querySelector('#lab-surprise').addEventListener('click', () => {
    page.querySelector('#lab-filter').value = '';
    page.querySelectorAll('[data-lab-tab]').forEach((button) => {
      button.hidden = false;
    });
    const choices = tabNames.filter(([tab]) => tab !== labState.tab);
    const selected = choices[Math.floor(Math.random() * choices.length)]?.[0] || 'constellation';
    labState.tab = selected;
    page
      .querySelectorAll('[data-lab-tab]')
      .forEach((button) => button.classList.toggle('active', button.dataset.labTab === selected));
    renderLab();
    page.querySelector('#lab-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  page.querySelector('#lab-export').addEventListener('click', () => {
    if (!labState.data) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(labState.data, null, 2)], { type: 'application/json' }));
    link.download = `ultimate-plex-lab-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  });
  document.querySelector('[data-nav="lab"]').addEventListener('click', () => {
    if (!labState.data) setTimeout(() => loadLab(), 70);
  });
  if (location.hash === '#lab') loadLab();
  window.addEventListener(
    'resize',
    () => {
      if (labState.tab === 'constellation' && labState.data) drawGraph(labState.data.graph);
    },
    { passive: true },
  );
}
setupLab();
