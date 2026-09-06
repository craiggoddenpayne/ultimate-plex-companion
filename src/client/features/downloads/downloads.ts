import { apiFetch } from '../../core/api-client.ts';

const escape = (value) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  );

function bytes(value) {
  if (!Number(value)) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = Number(value),
    unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(unit > 2 ? 1 : 0)} ${units[unit]}`;
}

async function json(path) {
  const response = await apiFetch(path);
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || 'The download request failed.');
  return value;
}

function shell() {
  return `<button class="back-link" data-download-back>← Command deck</button>
    <div class="download-hero"><div><span class="eyebrow">MEDIA DOWNLOADS · ORIGINAL FILES</span><h1>Take your media<br><em>where you want it.</em></h1><p>Search Plex, choose the exact file, then select a destination on this device. Companion streams the original without exposing your Plex token.</p></div></div>
    <section class="panel download-panel"><form id="download-search"><label><span>FIND A FILM OR EPISODE</span><div><input name="query" type="search" minlength="2" required placeholder="Search your Plex library…" autocomplete="off"><button type="submit">Search</button></div></label></form><div id="download-results" class="download-results"><div class="download-empty"><b>READY TO SEARCH</b><p>Results include films and individual episodes available to your Plex account.</p></div></div></section>`;
}

function resultMarkup(item) {
  return `<button type="button" class="download-result" data-download-item="${escape(item.ratingKey)}"><img src="${escape(item.poster)}" alt="" loading="lazy"><span><b>${escape(item.title)}</b><small>${escape([item.year, item.type].filter(Boolean).join(' · '))}</small></span><i>Choose file →</i></button>`;
}

function versionMarkup(version) {
  const detail = [version.resolution, version.container?.toUpperCase(), version.videoCodec, version.audioCodec]
    .filter(Boolean)
    .join(' · ');
  return `<article class="download-version"><div><b>${escape(version.fileName)}</b><span>${escape(detail || 'Original Plex media')} · ${bytes(version.size)}</span></div><button type="button" data-save-file="${escape(version.partId)}">Choose destination</button></article>`;
}

async function saveFile(item, version, button) {
  const path = `/api/downloads/file/${encodeURIComponent(item.ratingKey)}/${encodeURIComponent(version.partId)}`;
  const browserDownload = () => window.location.assign(path);
  if (!window.showSaveFilePicker) return browserDownload();
  let handle;
  try {
    handle = await window.showSaveFilePicker({ suggestedName: version.fileName });
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (/not allowed|not supported|current context|user agent|platform/i.test(error.message)) return browserDownload();
    throw error;
  }
  button.disabled = true;
  button.textContent = 'Downloading…';
  try {
    const response = await fetch(path, { credentials: 'same-origin' });
    if (!response.ok || !response.body) {
      const value = await response.json().catch(() => ({}));
      throw new Error(value.error || `Download failed (${response.status}).`);
    }
    await response.body.pipeTo(await handle.createWritable());
    button.textContent = 'Saved';
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Try again';
    throw error;
  }
}

async function openItem(ratingKey, host) {
  host.innerHTML = '<div class="download-empty"><b>READING MEDIA VERSIONS…</b></div>';
  const item = await json(`/api/downloads/item/${encodeURIComponent(ratingKey)}`);
  host.innerHTML = `<div class="download-selection"><button type="button" data-download-again>← Search results</button><header><img src="${escape(item.poster)}" alt=""><div><span>SELECT ORIGINAL FILE</span><h2>${escape(item.title)}</h2><p>${item.versions.length} media ${item.versions.length === 1 ? 'version' : 'versions'} available</p></div></header><div class="download-versions">${item.versions.map(versionMarkup).join('') || '<div class="download-empty"><b>NO DOWNLOADABLE FILES</b><p>Plex did not provide an original media part for this item.</p></div>'}</div></div>`;
  host
    .querySelector('[data-download-again]')
    ?.addEventListener('click', () =>
      (document.querySelector('#download-search') as HTMLFormElement | null)?.requestSubmit(),
    );
  host.querySelectorAll('[data-save-file]').forEach((button) =>
    button.addEventListener('click', async () => {
      const version = item.versions.find((entry) => entry.partId === button.dataset.saveFile);
      try {
        await saveFile(item, version, button);
      } catch (error) {
        if (error.name !== 'AbortError') window.alert(error.message);
      }
    }),
  );
}

function setupDownloads() {
  const page = document.querySelector('#downloads-page');
  if (!page) return;
  page.classList.add('downloads-page');
  page.innerHTML = shell();
  page
    .querySelector('[data-download-back]')
    .addEventListener('click', () => document.querySelector('[data-nav="dashboard"]')?.click());
  const form = page.querySelector('#download-search') as HTMLFormElement,
    host = page.querySelector('#download-results');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = String(new FormData(form).get('query') || '').trim();
    if (query.length < 2) return;
    host.innerHTML = '<div class="download-empty"><b>SEARCHING PLEX…</b></div>';
    try {
      const data = await json(`/api/downloads/search?q=${encodeURIComponent(query)}`);
      host.innerHTML = data.results.length
        ? data.results.map(resultMarkup).join('')
        : '<div class="download-empty"><b>NO MATCHES</b><p>Try a different title or search term.</p></div>';
      host.querySelectorAll('[data-download-item]').forEach((button) =>
        button.addEventListener('click', async () => {
          try {
            await openItem(button.dataset.downloadItem, host);
          } catch (error) {
            host.innerHTML = `<div class="download-empty error"><b>MEDIA UNAVAILABLE</b><p>${escape(error.message)}</p></div>`;
          }
        }),
      );
    } catch (error) {
      host.innerHTML = `<div class="download-empty error"><b>SEARCH UNAVAILABLE</b><p>${escape(error.message)}</p></div>`;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupDownloads);
} else {
  setupDownloads();
}
