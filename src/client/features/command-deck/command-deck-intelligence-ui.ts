import { activityVisual } from './activity-view.ts';

const escape = (value) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
const ago = (value) => {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - Number(value || 0)));
  return seconds < 3600
    ? `${Math.max(1, Math.floor(seconds / 60))}m ago`
    : seconds < 86400
      ? `${Math.floor(seconds / 3600)}h ago`
      : `${Math.floor(seconds / 86400)}d ago`;
};

function radarGeometry(genres) {
  const values = Array.from({ length: 6 }, (_, index) => genres[index]?.affinity || 0),
    point = (radius, index, value = 100) => {
      const angle = -Math.PI / 2 + (index * Math.PI) / 3,
        scaled = (radius * value) / 100;
      return `${90 + Math.cos(angle) * scaled},${78 + Math.sin(angle) * scaled}`;
    };
  return {
    rings: [1, 0.67, 0.34].map((scale) => Array.from({ length: 6 }, (_, index) => point(58 * scale, index)).join(' ')),
    axes: Array.from({ length: 6 }, (_, index) => point(58, index)),
    shape: values.map((value, index) => point(58, index, value)).join(' '),
    dots: values.map((value, index) => point(58, index, value)),
  };
}

export function renderTasteIntelligence(taste, container) {
  if (!container) return;
  const geometry = radarGeometry(taste.genres || []);
  const colours = ['amber-bg', 'violet-bg', 'cyan-bg', 'rose-bg', 'cyan-bg', 'violet-bg'];
  container.innerHTML = `<div class="taste-radar"><svg viewBox="0 0 180 156" aria-label="Taste affinity radar"><defs><linearGradient id="taste-fill" x1="0" y1="0" x2="1" y2="1"><stop stop-color="var(--theme-primary,var(--amber))"/><stop offset="1" stop-color="var(--theme-secondary,var(--cyan))"/></linearGradient></defs>${geometry.rings.map((points) => `<polygon class="taste-ring" points="${points}"/>`).join('')}${geometry.axes.map((point) => `<line class="taste-axis" x1="90" y1="78" x2="${point.split(',')[0]}" y2="${point.split(',')[1]}"/>`).join('')}<polygon class="taste-shape" points="${geometry.shape}"/>${geometry.dots.map((point) => `<circle cx="${point.split(',')[0]}" cy="${point.split(',')[1]}" r="2.2"/>`).join('')}</svg><div class="taste-core"><b>${taste.confidence || 0}%</b><span>CONFIDENCE</span></div><small>${escape(taste.archetype)}</small></div><div class="taste-profile"><span class="taste-archetype">${escape(taste.summary)}</span><div class="taste-tags">${
    (taste.genres || [])
      .slice(0, 5)
      .map(
        (item, index) => `<span><i class="${colours[index]}"></i>${escape(item.genre)}<b>${item.affinity}%</b></span>`,
      )
      .join('') || '<span class="taste-empty">Watch history will shape this signal.</span>'
  }</div><footer><span><b>${taste.diversity || 0}%</b> DIVERSITY</span><span><b>${escape(taste.favouriteEra)}</b> ERA</span></footer></div>`;
}

function tasteDetails(data) {
  const taste = data.taste;
  return `<header><span class="eyebrow">TASTE INTELLIGENCE · 90-DAY SIGNAL</span><h2>${escape(taste.archetype)}</h2><p>${escape(taste.summary)}. Affinity balances play frequency, runtime and recency.</p></header><div class="deck-detail-stats"><article><span>CONFIDENCE</span><b>${taste.confidence}%</b><small>${taste.samplePlays} matched plays</small></article><article><span>DIVERSITY</span><b>${taste.diversity}%</b><small>Across ${taste.genres.length} leading genres</small></article><article><span>FAVOURITE ERA</span><b>${escape(taste.favouriteEra)}</b><small>Most represented decade</small></article><article><span>FORMAT MIX</span><b>${taste.formats.movies}/${taste.formats.episodes}</b><small>Movies / episodes</small></article></div><section class="deck-detail-section"><span>GENRE AFFINITY</span><div class="taste-detail-bars">${taste.genres.map((item) => `<div><label><b>${escape(item.genre)}</b><small>${item.plays} plays · ${item.minutes} min</small></label><i><b style="width:${item.affinity}%"></b></i><em>${item.affinity}%</em></div>`).join('')}</div></section><section class="deck-detail-section"><span>RECENT INFLUENCES</span><div class="influence-list">${taste.influences.map((item) => `<div><i></i><p><b>${escape(item.title)}</b><small>${escape(item.detail)}</small></p><time>${ago(item.viewedAt)}</time></div>`).join('') || '<p>No matched viewing history yet.</p>'}</div></section>`;
}
function activityDetails(data) {
  return `<header><span class="eyebrow">SYSTEM MEMORY · LIVE TIMELINE</span><h2>What changed recently.</h2><p>Playback, new arrivals and current sessions combined into one Plex timeline.</p></header><section class="deck-detail-section"><div class="deck-timeline">${data.activity.map((item) => `<article>${activityVisual(item, 'timeline')}<div><b>${escape(item.title)}</b><small>${escape(item.detail)}</small></div><time>${ago(item.at)}</time></article>`).join('') || '<p>No recent activity returned by Plex.</p>'}</div></section>`;
}
function healthDetails(data) {
  const direct = data.sessions.length - data.health.transcodes;
  return `<header><span class="eyebrow">SYSTEM HEALTH · LIVE DIAGNOSTICS</span><h2>Plex is ${escape(data.health.status.toLowerCase())}.</h2><p>This score combines command latency and current transcode pressure. It is an operational signal, not a disk-health test.</p></header><div class="deck-detail-stats"><article><span>HEALTH SCORE</span><b>${data.health.score}</b><small>${escape(data.health.status)}</small></article><article><span>RESPONSE</span><b>${data.health.latencyMs} ms</b><small>Plex overview round trip</small></article><article><span>DIRECT PLAY</span><b>${direct}</b><small>Active direct sessions</small></article><article><span>TRANSCODES</span><b>${data.health.transcodes}</b><small>Active conversions</small></article></div><section class="deck-detail-section"><span>SERVER IDENTITY</span><div class="health-facts"><div><small>SERVER</small><b>${escape(data.server?.name || 'Plex')}</b></div><div><small>VERSION</small><b>${escape(data.server?.version || 'Unknown')}</b></div><div><small>LIBRARIES</small><b>${data.libraryCount}</b></div><div><small>TITLES</small><b>${Number(data.titleCount || 0).toLocaleString()}</b></div></div></section>`;
}

function openDetails(kind, data) {
  document.querySelector('.deck-detail-wrap')?.remove();
  const content =
    kind === 'taste' ? tasteDetails(data) : kind === 'activity' ? activityDetails(data) : healthDetails(data);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="deck-detail-wrap"><div class="deck-detail-backdrop"></div><section class="deck-detail-modal profile-modal"><button class="deck-detail-close">×</button>${content}<footer><span>Signals remain inside your network</span><button>Close</button></footer></section></div>`,
  );
  const wrap = document.querySelector('.deck-detail-wrap'),
    close = () => wrap.remove();
  wrap.querySelector('.deck-detail-backdrop').onclick = close;
  wrap.querySelector('.deck-detail-close').onclick = close;
  wrap.querySelector('footer button').onclick = close;
}

export function bindCommandDeckDetails(data) {
  document
    .querySelectorAll('[data-deck-detail]')
    .forEach((button) => (button.onclick = () => openDetails(button.dataset.deckDetail, data)));
}
