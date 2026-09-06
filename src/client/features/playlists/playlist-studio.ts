import { renderPlaylistComposer } from './playlist-composer.ts';
import { apiFetch } from '../../core/api-client.ts';

const playlistState = { data: null, selected: null, filter: 'All', query: '' };
const playlistEscape = (value) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character],
  );
const playlistDuration = (minutes) => {
  const value = Number(minutes) || 0;
  return value >= 60 ? `${Math.floor(value / 60)}h ${value % 60}m` : `${value} min`;
};
const playlistIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h10M5 11h10M5 16h6"/><path d="m16 14 4 3-4 3z"/></svg>';

function studioShell() {
  return `
    <button class="back-link" type="button" data-playlist-back>← Command deck</button>
    <header class="playlist-hero">
      <div>
        <span class="eyebrow">PLAYLIST STUDIO · LIVE PLEX GENERATORS</span>
        <h1>Build the queue.<br><em>Set the mood.</em></h1>
        <p>Turn library signals into real Plex playlists. Every generator is explainable, previewed and created only after confirmation.</p>
      </div>
      <div class="playlist-orbit" aria-hidden="true"><i></i><i></i><span>${playlistIcon}</span><b>AUTO MIX</b></div>
    </header>
    <section class="playlist-stats" aria-label="Playlist Studio summary">
      <article><span>CATALOG MAPPED</span><b id="playlist-catalog">—</b><small>Video items</small></article>
      <article><span>GENERATORS READY</span><b id="playlist-generators">—</b><small>Live criteria</small></article>
      <article><span>EXISTING PLAYLISTS</span><b id="playlist-existing-count">—</b><small>Currently in Plex</small></article>
      <article><span>SAFETY</span><b>PREVIEW</b><small>Confirm before creation</small></article>
    </section>
    <section class="playlist-composer" id="playlist-composer"></section>
    <section class="playlist-section">
      <header>
        <div><span>AUTO-GENERATE</span><h2>Choose a signal</h2><p>Buttons are enabled only when your library has matching titles.</p></div>
        <button id="playlist-refresh" type="button">Refresh criteria</button>
      </header>
      <div class="playlist-signal-toolbar"><label><span>SEARCH SIGNALS</span><input id="playlist-signal-search" type="search" placeholder="Genre, mood, era or format…" autocomplete="off"></label><nav class="playlist-signal-filters" id="playlist-signal-filters" aria-label="Filter playlist signals"></nav></div>
      <div class="playlist-generators" id="playlist-generators-grid" aria-live="polite">
        <div class="playlist-loading"><i></i><span>Reading Plex criteria…</span></div>
      </div>
    </section>
    <section class="playlist-section">
      <header><div><span>PLEX PLAYLISTS</span><h2>Already created</h2></div></header>
      <div class="playlist-existing" id="playlist-existing"><div class="playlist-empty">Loading existing playlists…</div></div>
    </section>`;
}

function samplePoster(item) {
  return `<article title="${playlistEscape(item.title)}"><img src="${playlistEscape(item.poster)}" loading="lazy" alt=""><span>${playlistEscape(item.title)}</span></article>`;
}

function generatorCard(generator) {
  const available = generator.available;
  return `
    <article class="playlist-generator ${playlistEscape(generator.tone)} ${available ? '' : 'unavailable'}">
      <header><span>${playlistEscape(generator.eyebrow)}</span><b>${generator.count.toLocaleString()} matches</b></header>
      <div class="playlist-generator-icon">${playlistIcon}</div>
      <h3>${playlistEscape(generator.name)}</h3>
      <p>${playlistEscape(generator.description)}</p>
      <div class="playlist-samples">${generator.sample.slice(0, 4).map(samplePoster).join('')}</div>
      <footer>
        <small>${playlistDuration(generator.totalMinutes)} total</small>
        <button type="button" data-playlist-generate="${playlistEscape(generator.id)}" ${available ? '' : 'disabled'}>${available ? 'Auto generate' : 'No matches'}</button>
      </footer>
    </article>`;
}

function renderGeneratorGrid() {
  const data = playlistState.data;
  const grid = document.querySelector('#playlist-generators-grid');
  if (!data || !grid) return;
  const categoryMatches =
    playlistState.filter === 'All'
      ? data.generators
      : data.generators.filter((item) => item.category === playlistState.filter);
  const query = playlistState.query.trim().toLowerCase();
  const visible = query
    ? categoryMatches.filter((item) =>
        [item.name, item.eyebrow, item.description, item.category].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(query),
        ),
      )
    : categoryMatches;
  grid.innerHTML =
    visible.map(generatorCard).join('') ||
    '<div class="playlist-empty">No playlist signals match this search and category.</div>';
  grid.querySelectorAll('[data-playlist-generate]').forEach((button) => {
    button.addEventListener('click', () =>
      openGenerator(data.generators.find((item) => item.id === button.dataset.playlistGenerate)),
    );
  });
}

function renderStudio() {
  const data = playlistState.data;
  if (!data) return;
  document.querySelector('#playlist-catalog').textContent = data.catalogSize.toLocaleString();
  document.querySelector('#playlist-generators').textContent = data.generators.filter((item) => item.available).length;
  document.querySelector('#playlist-existing-count').textContent = data.existing.length;
  renderPlaylistComposer(data.composer, () => loadStudio(true));

  const categories = ['All', ...new Set(data.generators.map((item) => item.category).filter(Boolean))];
  if (!categories.includes(playlistState.filter)) playlistState.filter = 'All';
  const filters = document.querySelector('#playlist-signal-filters');
  filters.innerHTML = categories
    .map((category) => {
      const count =
        category === 'All'
          ? data.generators.length
          : data.generators.filter((item) => item.category === category).length;
      return `<button type="button" data-playlist-filter="${playlistEscape(category)}" class="${playlistState.filter === category ? 'active' : ''}">${playlistEscape(category)} <b>${count}</b></button>`;
    })
    .join('');
  filters.querySelectorAll('[data-playlist-filter]').forEach((button) =>
    button.addEventListener('click', () => {
      playlistState.filter = button.dataset.playlistFilter;
      filters.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
      renderGeneratorGrid();
    }),
  );
  const search = document.querySelector('#playlist-signal-search');
  search.value = playlistState.query;
  search.addEventListener('input', () => {
    playlistState.query = search.value;
    renderGeneratorGrid();
  });
  renderGeneratorGrid();

  const existing = document.querySelector('#playlist-existing');
  existing.innerHTML = data.existing.length
    ? data.existing
        .map(
          (item) =>
            `<article><span>${playlistIcon}</span><div><b>${playlistEscape(item.title)}</b><small>${item.itemCount} items${item.durationMinutes ? ` · ${playlistDuration(item.durationMinutes)}` : ''}</small></div></article>`,
        )
        .join('')
    : '<div class="playlist-empty">No video playlists returned by Plex yet. Create your first one above.</div>';
}

function previewItem(item, index) {
  return `<article><span>${String(index + 1).padStart(2, '0')}</span><img src="${playlistEscape(item.poster)}" loading="lazy" alt=""><div><b>${playlistEscape(item.title)}</b><small>${playlistEscape(item.detail)}</small></div><a href="${playlistEscape(item.plexUrl)}" aria-label="Open ${playlistEscape(item.title)} in Plex">Plex ↗</a></article>`;
}

function openGenerator(generator) {
  playlistState.selected = generator;
  document.querySelector('.playlist-modal-wrap')?.remove();
  const previousFocus = document.activeElement;
  document.body.insertAdjacentHTML(
    'beforeend',
    `
    <div class="playlist-modal-wrap">
      <div class="playlist-modal-backdrop"></div>
      <section class="playlist-modal" role="dialog" aria-modal="true" aria-labelledby="playlist-dialog-title">
        <button class="playlist-modal-close" type="button" aria-label="Close playlist preview">×</button>
        <header>
          <span>${playlistEscape(generator.eyebrow)} · ${generator.count} MATCHES</span>
          <h2 id="playlist-dialog-title">${playlistEscape(generator.name)}</h2>
          <p>${playlistEscape(generator.description)}</p>
        </header>
        <div class="playlist-create-fields">
          <label>Playlist name<input id="playlist-name" maxlength="80" value="${playlistEscape(generator.name)}"></label>
          <label>Maximum items<select id="playlist-limit">${[10, 20, 30, 50, 100].map((value) => `<option value="${value}" ${value === 30 ? 'selected' : ''}>${Math.min(value, generator.count)} items</option>`).join('')}</select></label>
        </div>
        <div class="playlist-preview-label"><span>PREVIEW · FIRST ${Math.min(12, generator.sample.length)}</span><small>Final order follows the criterion ranking.</small></div>
        <div class="playlist-preview">${generator.sample.map(previewItem).join('')}</div>
        <footer><button class="playlist-cancel" type="button">Cancel</button><button class="playlist-create" type="button">Create in Plex</button></footer>
      </section>
    </div>`,
  );

  const wrap = document.querySelector('.playlist-modal-wrap');
  const close = () => {
    document.removeEventListener('keydown', onKeydown);
    wrap.remove();
    previousFocus?.focus?.();
  };
  const onKeydown = (event) => {
    if (event.key === 'Escape') close();
  };
  wrap.querySelector('.playlist-modal-backdrop').addEventListener('click', close);
  wrap.querySelector('.playlist-modal-close').addEventListener('click', close);
  wrap.querySelector('.playlist-cancel').addEventListener('click', close);
  wrap.querySelector('.playlist-create').addEventListener('click', () => createPlaylist(wrap, generator, close));
  document.addEventListener('keydown', onKeydown);
  requestAnimationFrame(() => wrap.querySelector('#playlist-name').focus());
}

async function createPlaylist(wrap, generator, close) {
  const nameField = wrap.querySelector('#playlist-name');
  const title = nameField.value.trim();
  const limit = Number(wrap.querySelector('#playlist-limit').value);
  if (!title) return nameField.focus();
  if (
    !window.confirm(
      `Are you sure you want to create “${title}” in Plex with up to ${Math.min(limit, generator.count)} items?`,
    )
  )
    return;

  const button = wrap.querySelector('.playlist-create');
  button.disabled = true;
  button.textContent = 'Creating…';
  try {
    const response = await apiFetch('/api/playlists/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generatorId: generator.id, title, limit, confirmed: true }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Playlist creation failed');
    close();
    await loadStudio(true);
    window.alert(`Created “${data.playlist.title}” with ${data.playlist.itemCount} items in Plex.`);
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Create in Plex';
    window.alert(error.message);
  }
}

async function loadStudio(force = false) {
  const grid = document.querySelector('#playlist-generators-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="playlist-loading"><i></i><span>Evaluating playlist criteria…</span></div>';
  try {
    const response = await apiFetch(`/api/playlists/studio${force ? '?refresh=1' : ''}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Playlist Studio unavailable');
    playlistState.data = data;
    renderStudio();
  } catch (error) {
    grid.innerHTML = `<div class="playlist-empty error"><b>Playlist Studio is offline</b><span>${playlistEscape(error.message)}</span></div>`;
  }
}

function setupPlaylistStudio() {
  const page = document.querySelector('#playlists-page');
  if (!page) return;
  page.classList.add('playlist-studio');
  page.innerHTML = studioShell();
  page
    .querySelector('[data-playlist-back]')
    .addEventListener('click', () => document.querySelector('[data-nav="dashboard"]').click());
  page.querySelector('#playlist-refresh').addEventListener('click', () => loadStudio(true));
  document.querySelector('[data-nav="playlists"]')?.addEventListener('click', () => {
    if (!playlistState.data) setTimeout(() => loadStudio(), 80);
  });
  if (location.hash === '#playlists') loadStudio();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupPlaylistStudio);
else setupPlaylistStudio();
