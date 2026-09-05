const escape = (value) => String(value == null ? '' : value).replace(/[&<>'"]/g, (character) => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;',
}[character]));

const duration = (minutes) => Number(minutes) >= 60 ? `${Math.floor(Number(minutes) / 60)}h ${Number(minutes) % 60}m` : `${Number(minutes) || 0} min`;

function options(values, label) {
  return `<option value="">${label}</option>${values.map(item => `<option value="${escape(item.value ?? item)}">${escape(item.value ?? item)}${item.count ? ` (${item.count})` : ''}</option>`).join('')}`;
}

function criteria(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function previewMarkup(data) {
  if (!data.count) return '<div class="composer-empty"><b>No titles match this signal</b><span>Relax one or two filters and preview again.</span></div>';
  return `<div class="composer-preview-head"><span><b>${data.count.toLocaleString()}</b> MATCHES</span><span><b>${duration(data.totalMinutes)}</b> TOTAL RUNTIME</span><small>Showing the first ${data.sample.length}</small></div><div class="composer-preview-track">${data.sample.map(item => `<article><img loading="lazy" src="${escape(item.poster)}" alt=""><span><b>${escape(item.title)}</b><small>${escape(item.detail)}</small></span></article>`).join('')}</div>`;
}

export function renderPlaylistComposer(facets: any = {}, onCreated = () => {}) {
  const root = document.querySelector('#playlist-composer');
  if (!root) return;
  root.innerHTML = `<header><div><span>CUSTOM SIGNAL</span><h2>Compose your own queue</h2><p>Combine live Plex metadata, preview every match, then create it as a normal playlist.</p></div><b>8 SIGNAL CONTROLS</b></header><form id="playlist-composer-form"><div class="composer-controls"><label>Media type<select name="type"><option value="all">Movies & episodes</option><option value="movie">Movies only</option><option value="episode">Episodes only</option></select></label><label>Watch state<select name="watchState"><option value="all">Any watch state</option><option value="unwatched">Unwatched</option><option value="watched">Previously watched</option><option value="in-progress">In progress</option></select></label><label>Genre<select name="genre">${options(facets.genres || [], 'Any genre')}</select></label><label>Decade<select name="decade">${options((facets.decades || []).map(value => ({ value, count:0 })), 'Any decade')}</select></label><label>Minimum rating<select name="minRating"><option value="0">Any rating</option><option value="6">6+</option><option value="7">7+</option><option value="7.5">7.5+</option><option value="8">8+</option><option value="9">9+</option></select></label><label>Maximum runtime<select name="maxMinutes"><option value="0">Any runtime</option><option value="30">30 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option><option value="120">2 hours</option><option value="180">3 hours</option></select></label><label>Resolution<select name="resolution"><option value="all">Any resolution</option><option value="4k">4K</option><option value="1080">1080p</option><option value="720">720p</option><option value="sd">SD</option></select></label><label>Rank by<select name="sort"><option value="rating">Highest rated</option><option value="newest">Newest release</option><option value="shortest">Shortest first</option><option value="recently-added">Recently added</option></select></label></div><button class="composer-preview-button" type="submit">Preview custom signal</button></form><div class="composer-result" id="composer-result"><div class="composer-idle"><i></i><b>Ready to combine signals</b><span>Choose any filters above. Previewing never changes Plex.</span></div></div><footer class="composer-create-bar"><label>Playlist name<input id="composer-name" maxlength="80" value="My Custom Signal"></label><label>Maximum items<select id="composer-limit"><option>10</option><option selected>20</option><option>30</option><option>50</option><option>100</option></select></label><button id="composer-create" type="button" disabled>Create in Plex</button></footer>`;

  const form = root.querySelector('#playlist-composer-form');
  const result = root.querySelector('#composer-result');
  const create = root.querySelector('#composer-create');
  let preview = null;

  form.addEventListener('change', () => {
    preview = null;
    create.disabled = true;
    result.innerHTML = '<div class="composer-idle"><i></i><b>Signal changed</b><span>Preview again to validate the new criteria.</span></div>';
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('.composer-preview-button');
    button.disabled = true;
    button.textContent = 'Reading Plex…';
    try {
      const response = await fetch('/api/playlists/preview', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(criteria(form)) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Custom preview failed');
      preview = data;
      result.innerHTML = previewMarkup(data);
      create.disabled = data.count === 0;
    } catch (error) {
      result.innerHTML = `<div class="composer-empty error"><b>Preview unavailable</b><span>${escape(error.message)}</span></div>`;
    } finally {
      button.disabled = false;
      button.textContent = 'Preview custom signal';
    }
  });
  create.addEventListener('click', async () => {
    if (!preview?.count) return;
    const title = root.querySelector('#composer-name').value.trim();
    const limit = Number(root.querySelector('#composer-limit').value);
    if (!title) return root.querySelector('#composer-name').focus();
    if (!window.confirm(`Are you sure you want to create “${title}” with up to ${Math.min(limit, preview.count)} matching items?`)) return;
    create.disabled = true;
    create.textContent = 'Creating…';
    try {
      const response = await fetch('/api/playlists/generate', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ generatorId:'custom', criteria:preview.criteria, title, limit, confirmed:true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Playlist creation failed');
      window.alert(`Created “${data.playlist.title}” with ${data.playlist.itemCount} items in Plex.`);
      onCreated();
    } catch (error) {
      window.alert(error.message);
      create.disabled = false;
    } finally { create.textContent = 'Create in Plex'; }
  });
}
