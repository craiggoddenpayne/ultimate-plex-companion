const recState = { loaded: false, includeWatched: false, data: null };
const recEscape = (value) =>
  String(value == null ? '' : value).replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
const recSpark =
  '<svg class="icon" viewBox="0 0 24 24"><path d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3z"/></svg>';
function recRuntime(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return (h ? h + 'h ' : '') + (m ? m + 'm' : '');
}

function recommendationsShell() {
  return (
    '<section class="personal-recommendations"><div class="personal-head"><div><span class="eyebrow">PERSONAL SIGNAL · POWERED BY YOUR LIBRARY</span><h2>Because your collection<br><em>already knows you.</em></h2><p>Specific recommendations derived from films you watched and the titles Plex considers genuinely similar.</p></div><div class="personal-controls"><label><input id="rec-include-watched" type="checkbox"><span></span>Include watched</label><button id="refresh-recommendations">New seeds</button></div></div><div id="recommendation-shelves" class="recommendation-shelves"><div class="rec-loading"><i></i><span></span><span></span><span></span><span></span></div></div><div class="rec-method">' +
    recSpark +
    '<p><b>How this works</b>Seeds come from your recent, watched films. Results come from Plex Similar Items, then Companion prioritizes unwatched titles, ratings, and shared genres. Recommendations never leave your server.</p></div></section>'
  );
}

function recDetail(item, seed) {
  return (
    '<div class="modal-wrap" id="rec-modal"><div class="modal-backdrop"></div><section class="rec-modal"><button class="modal-close">×</button><div class="rec-detail-poster"><img src="' +
    recEscape(item.poster) +
    '" alt=""></div><div class="rec-detail-copy"><span class="eyebrow">PERSONAL MATCH · ' +
    item.score +
    '%</span><h2>' +
    recEscape(item.title) +
    '</h2><div class="rec-detail-meta">' +
    [item.year, recRuntime(item.durationMinutes), item.rating ? '★ ' + item.rating.toFixed(1) : null]
      .filter(Boolean)
      .join(' · ') +
    '</div><div class="rec-detail-tags">' +
    item.genres.map((genre) => '<span>' + recEscape(genre) + '</span>').join('') +
    '</div><p>' +
    recEscape(item.summary || 'No synopsis is available in Plex.') +
    '</p><div class="rec-because">' +
    recSpark +
    '<span><b>Because you watched ' +
    recEscape(seed.title) +
    '</b>' +
    recEscape(item.reason) +
    '</span></div></div></section></div>'
  );
}
function openRecDetail(item, seed) {
  document.body.insertAdjacentHTML('beforeend', recDetail(item, seed));
  const modal = document.querySelector('#rec-modal');
  const close = () => modal.remove();
  modal.querySelector('.modal-backdrop').addEventListener('click', close);
  modal.querySelector('.modal-close').addEventListener('click', close);
}

function renderRecommendations(data) {
  const container = document.querySelector('#recommendation-shelves');
  if (!container) return;
  container.innerHTML = data.shelves.length
    ? data.shelves
        .map(
          (shelf, shelfIndex) =>
            '<section class="recommendation-shelf"><header><div class="seed-poster"><img src="' +
            recEscape(shelf.seed.poster) +
            '" alt=""></div><div><span>BECAUSE YOU WATCHED</span><h3>' +
            recEscape(shelf.seed.title) +
            '</h3><p>' +
            shelf.seed.genres.map(recEscape).join(' · ') +
            '</p></div><b>' +
            shelf.items.length +
            ' MATCHES</b></header><div class="rec-track">' +
            shelf.items
              .map(
                (item, itemIndex) =>
                  '<article data-shelf="' +
                  shelfIndex +
                  '" data-item="' +
                  itemIndex +
                  '"><div class="rec-poster"><img src="' +
                  recEscape(item.poster) +
                  '" alt="" loading="lazy"><span>' +
                  item.score +
                  '%</span>' +
                  (item.unwatched ? '<i>UNWATCHED</i>' : '') +
                  '</div><h4>' +
                  recEscape(item.title) +
                  '</h4><p>' +
                  [item.year, recRuntime(item.durationMinutes)].filter(Boolean).join(' · ') +
                  '</p><small>' +
                  recEscape(item.reason) +
                  '</small></article>',
              )
              .join('') +
            '</div></section>',
        )
        .join('')
    : '<div class="rec-empty"><span>' +
      recSpark +
      '</span><h3>Your personal signal is still forming</h3><p>Watch or rate a few movies in Plex and recommendation shelves will appear here.</p></div>';
  container.querySelectorAll('[data-item]').forEach((card) =>
    card.addEventListener('click', () => {
      const shelf = data.shelves[Number(card.dataset.shelf)];
      openRecDetail(shelf.items[Number(card.dataset.item)], shelf.seed);
    }),
  );
}

async function loadRecommendations(force = false) {
  const container = document.querySelector('#recommendation-shelves');
  if (!container) return;
  container.classList.add('loading');
  try {
    const params = new URLSearchParams({ includeWatched: String(recState.includeWatched) });
    if (force) params.set('refresh', '1');
    const response = await fetch('/api/recommendations?' + params);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    recState.loaded = true;
    recState.data = data;
    renderRecommendations(data);
  } catch (error) {
    container.innerHTML =
      '<div class="rec-empty error"><b>!</b><h3>Personal recommendations unavailable</h3><p>' +
      recEscape(error.message) +
      '</p></div>';
  } finally {
    container.classList.remove('loading');
  }
}
function setupRecommendations() {
  const page = document.querySelector('#radar-page');
  const method = page?.querySelector('.discovery-method');
  if (!page || !method) return;
  method.insertAdjacentHTML('afterend', recommendationsShell());
  page.querySelector('#rec-include-watched').addEventListener('change', (event) => {
    recState.includeWatched = event.target.checked;
    loadRecommendations();
  });
  page.querySelector('#refresh-recommendations').addEventListener('click', () => loadRecommendations(true));
  document.querySelector('[data-nav="radar"]').addEventListener('click', () => {
    if (!recState.loaded) setTimeout(() => loadRecommendations(), 120);
  });
  if (location.hash === '#radar') loadRecommendations();
}
setupRecommendations();
