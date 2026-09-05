const state = { mood: 'any', mode: 'tonight', maxMinutes: 150, unwatchedOnly: true, results: [], loaded: false };
const escapeText = (value) =>
  String(value == null ? '' : value).replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
const radarSvg =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 6-6M12 3v2M21 12h-2M12 21v-2M3 12h2"/></svg>';
const sparkSvg =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3z"/></svg>';
const plexSvg =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8"/><path d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"/></svg>';
const moods = [
  ['any', 'All signals'],
  ['intense', 'Intense'],
  ['comfort', 'Comfort'],
  ['mindbend', 'Mind-bending'],
  ['epic', 'Epic'],
  ['funny', 'Funny'],
  ['real', 'True stories'],
];
const modes = [
  ['tonight', 'Tonight'],
  ['hidden', 'Hidden gems'],
  ['top', 'Top rated'],
  ['recent', 'New arrivals'],
  ['surprise', 'Surprise me'],
];

function formatRuntime(minutes) {
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  return (hours ? hours + 'h ' : '') + (rest ? rest + 'm' : '');
}

function plexOpenUrl(item) {
  return item.plexUrl || 'https://app.plex.tv/desktop';
}

function radarMarkup() {
  return (
    '<button class="back-link" data-route="dashboard">← Command deck</button>' +
    '<div class="radar-hero"><div><span class="eyebrow">DISCOVERY RADAR · YOUR LIBRARY</span><h1>Find your next<br><em>great watch.</em></h1><p>Recommendations are calculated locally from your Plex metadata and viewing state.</p></div><div class="radar-scope"><span class="scope-ring r-one"></span><span class="scope-ring r-two"></span><span class="scope-sweep"></span><i></i><b>SCANNING<br>YOUR UNIVERSE</b></div></div>' +
    '<section class="discovery-controls panel"><div class="control-block"><span class="card-label">HOW SHOULD IT FEEL?</span><div class="mood-chips">' +
    moods
      .map(
        (item) =>
          '<button data-mood="' +
          item[0] +
          '" class="' +
          (item[0] === 'any' ? 'active' : '') +
          '">' +
          item[1] +
          '</button>',
      )
      .join('') +
    '</div></div><div class="control-row"><div class="control-block mode-block"><span class="card-label">DISCOVERY MODE</span><div class="mode-tabs">' +
    modes
      .map(
        (item) =>
          '<button data-mode="' +
          item[0] +
          '" class="' +
          (item[0] === 'tonight' ? 'active' : '') +
          '">' +
          item[1] +
          '</button>',
      )
      .join('') +
    '</div></div><div class="time-control"><span class="card-label">TIME AVAILABLE</span><div><input id="time-budget" type="range" min="60" max="240" step="15" value="150"><output id="time-output">2h 30m</output></div></div><label class="unwatched-toggle"><input id="unwatched-only" type="checkbox" checked><span></span><b>Unwatched only</b></label></div></section>' +
    '<div class="discovery-heading"><div><span class="card-label">STRONGEST SIGNALS</span><h2 id="discovery-title">Calibrating recommendations</h2></div><span id="catalog-size">Connecting to Plex…</span></div>' +
    '<div class="discovery-results" id="discovery-results">' +
    Array.from({ length: 6 }, () => '<div class="discovery-skeleton"></div>').join('') +
    '</div>' +
    '<div class="discovery-method"><span>' +
    sparkSvg +
    '</span><p><b>Why these titles?</b> Radar balances mood, audience rating, runtime, recency, and watch state. Viewing data never leaves your server.</p></div>'
  );
}

async function api(path) {
  const response = await fetch(path);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Discovery request failed.');
  return result;
}

function detailMarkup(item) {
  return (
    '<div class="modal-wrap" id="discovery-modal"><div class="modal-backdrop"></div><section class="discovery-modal"><button class="modal-close">×</button><div class="detail-poster"><img src="' +
    escapeText(item.poster) +
    '" alt=""></div><div class="detail-copy"><span class="eyebrow">RADAR MATCH · ' +
    item.score +
    '%</span><h2>' +
    escapeText(item.title) +
    '</h2><div class="detail-meta">' +
    [item.year, formatRuntime(item.durationMinutes), item.rating ? '★ ' + item.rating.toFixed(1) : null]
      .filter(Boolean)
      .join(' · ') +
    '</div><div class="detail-genres">' +
    item.genres.map((genre) => '<span>' + escapeText(genre) + '</span>').join('') +
    '</div><p>' +
    escapeText(item.summary || 'No synopsis is available in Plex.') +
    '</p><div class="why-match">' +
    sparkSvg +
    '<span><b>Why it surfaced</b>' +
    escapeText(item.reason) +
    '</span></div><div class="detail-actions"><a class="open-in-plex" href="' +
    plexOpenUrl(item) +
    '" target="_blank" rel="noopener noreferrer">Open in Plex ' +
    plexSvg +
    '</a></div></div></section></div>'
  );
}

function openDetail(item) {
  document.body.insertAdjacentHTML('beforeend', detailMarkup(item));
  const modal = document.querySelector('#discovery-modal');
  modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.remove());
  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
}

function cardMarkup(item, index) {
  return (
    '<article class="discovery-card" data-result="' +
    index +
    '"><div class="discovery-poster"><img src="' +
    escapeText(item.poster) +
    '" alt="" loading="lazy"><span>' +
    item.score +
    '% MATCH</span><i>' +
    String(index + 1).padStart(2, '0') +
    '</i><a class="discovery-open-icon" data-open-plex href="' +
    plexOpenUrl(item) +
    '" target="_blank" rel="noopener noreferrer" aria-label="Open ' +
    escapeText(item.title) +
    ' in Plex" title="Open in Plex">' +
    plexSvg +
    '</a></div><div class="discovery-card-copy"><div><h3>' +
    escapeText(item.title) +
    '</h3><span>' +
    [item.year, formatRuntime(item.durationMinutes)].filter(Boolean).join(' · ') +
    '</span></div><b>' +
    (item.rating ? '★ ' + item.rating.toFixed(1) : 'NEW') +
    '</b><p>' +
    escapeText(item.reason) +
    '</p><div>' +
    item.genres
      .slice(0, 3)
      .map((genre) => '<em>' + escapeText(genre) + '</em>')
      .join('') +
    '</div></div></article>'
  );
}

async function loadRadar(force) {
  const results = document.querySelector('#discovery-results');
  if (!results) return;
  results.classList.add('loading');
  const params = new URLSearchParams({
    mood: state.mood,
    mode: state.mode,
    maxMinutes: String(state.maxMinutes),
    unwatchedOnly: String(state.unwatchedOnly),
  });
  if (force) params.set('refresh', '1');
  try {
    const data = await api('/api/discovery?' + params);
    state.results = data.results;
    state.loaded = true;
    document.querySelector('#catalog-size').textContent = data.catalogSize.toLocaleString() + ' films in range';
    const moodButton = document.querySelector('[data-mood="' + state.mood + '"]');
    document.querySelector('#discovery-title').textContent =
      (moodButton ? moodButton.textContent : 'All signals') + ' · ' + data.results.length + ' strong matches';
    results.innerHTML = data.results.length
      ? data.results.map(cardMarkup).join('')
      : '<div class="discovery-empty"><span>' +
        radarSvg +
        '</span><h3>No signal at this range</h3><p>Try allowing watched titles, choosing a broader mood, or adding more time.</p></div>';
    results
      .querySelectorAll('[data-result]')
      .forEach((card) => card.addEventListener('click', () => openDetail(data.results[Number(card.dataset.result)])));
    results
      .querySelectorAll('[data-open-plex]')
      .forEach((link) => link.addEventListener('click', (event) => event.stopPropagation()));
  } catch (error) {
    results.innerHTML =
      '<div class="discovery-empty error"><span>!</span><h3>Radar is offline</h3><p>' +
      escapeText(error.message) +
      '</p></div>';
  } finally {
    results.classList.remove('loading');
  }
}

function setupRadar() {
  const page = document.querySelector('#radar-page');
  if (!page) return;
  page.classList.add('discovery-radar');
  page.innerHTML = radarMarkup();
  page.querySelector('[data-route="dashboard"]').addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelector('[data-nav="dashboard"]').click();
  });
  page.querySelectorAll('[data-mood]').forEach((button) =>
    button.addEventListener('click', () => {
      state.mood = button.dataset.mood;
      page.querySelectorAll('[data-mood]').forEach((item) => item.classList.toggle('active', item === button));
      loadRadar(false);
    }),
  );
  page.querySelectorAll('[data-mode]').forEach((button) =>
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      page.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
      loadRadar(false);
    }),
  );
  const budget = page.querySelector('#time-budget');
  budget.addEventListener('input', () => {
    state.maxMinutes = Number(budget.value);
    page.querySelector('#time-output').textContent = formatRuntime(state.maxMinutes);
  });
  budget.addEventListener('change', () => loadRadar(false));
  page.querySelector('#unwatched-only').addEventListener('change', (event) => {
    state.unwatchedOnly = event.target.checked;
    loadRadar(false);
  });
  document.querySelector('[data-nav="radar"]').addEventListener('click', () => {
    if (!state.loaded) setTimeout(() => loadRadar(false), 80);
  });
  if (location.hash === '#radar') loadRadar(false);
}

setupRadar();
