import { apiFetch } from '../../core/api-client.ts';

const suiteState = { data: null, query: '' };
const suiteEscape = (value) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
const suiteBytes = (bytes) => {
  let value = Number(bytes) || 0,
    unit = 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  while (value >= 1024 && unit < 4) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit > 2 ? 1 : 0)} ${units[unit]}`;
};
const suiteIcon = '<svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>';

function shell() {
  return `<button class="back-link" data-suite-back>← Command deck</button><header class="suite-hero"><div><span class="eyebrow">UTILITY MATRIX · 15 LIVE ANALYZERS</span><h1>Useful signals.<br><em>Ready when you are.</em></h1><p>A read-only toolkit that turns your Plex catalogue and viewing history into decisions you can actually use.</p></div><div class="suite-core" aria-hidden="true"><i></i><i></i><span>15</span><b>MODULES ONLINE</b></div></header><section class="suite-stats"><article><span>MEDIA MAPPED</span><b id="suite-items">—</b><small>Films and episodes</small></article><article><span>LIBRARIES</span><b id="suite-libraries">—</b><small>Video sources</small></article><article><span>HISTORY SAMPLE</span><b id="suite-history">—</b><small>Plex events</small></article><article><span>SAFETY</span><b>READ ONLY</b><small>No automatic changes</small></article></section><div class="suite-toolbar"><label><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="suite-search" placeholder="Find a utility…"></label><button id="suite-export">Export report</button><button id="suite-refresh">Refresh signals</button></div><main class="suite-grid" id="suite-grid"><div class="suite-loading"><i></i><span>Assembling utility matrix…</span></div></main>`;
}
function value(item) {
  return item.format === 'bytes' ? suiteBytes(item.value) : (item.value ?? '');
}
function render() {
  const grid = document.querySelector('#suite-grid');
  if (!grid || !suiteState.data) return;
  const query = suiteState.query.toLowerCase(),
    modules = suiteState.data.modules.filter(
      (item) => !query || `${item.name} ${item.eyebrow} ${item.description}`.toLowerCase().includes(query),
    );
  grid.innerHTML = modules.length
    ? modules
        .map(
          (item, index) =>
            `<article class="suite-module ${item.tone}" data-suite-module="${item.id}"><header><span>${String(index + 1).padStart(2, '0')} · ${suiteEscape(item.eyebrow)}</span><i></i></header><div class="suite-module-icon">${suiteIcon}</div><h2>${suiteEscape(item.name)}</h2><p>${suiteEscape(item.description)}</p><div class="suite-metric"><b>${Number(item.metric).toLocaleString()}</b><span>${suiteEscape(item.unit)}</span></div><footer><span>${item.items.length} details</span><button>Open utility <b>→</b></button></footer></article>`,
        )
        .join('')
    : `<div class="suite-none"><h3>No utilities match “${suiteEscape(suiteState.query)}”</h3><p>Try a broader name or signal.</p></div>`;
  grid
    .querySelectorAll('[data-suite-module]')
    .forEach(
      (card) =>
        (card.onclick = () => openModule(suiteState.data.modules.find((item) => item.id === card.dataset.suiteModule))),
    );
}
function itemMarkup(item, index) {
  return `<article class="suite-result"><span class="suite-result-index">${String(index + 1).padStart(2, '0')}</span>${item.poster ? `<img src="${suiteEscape(item.poster)}" loading="lazy" alt="">` : '<span class="suite-result-glyph">◇</span>'}<div><b>${suiteEscape(item.title)}</b><small>${suiteEscape(item.detail || [item.year, item.library, ...(item.genres || [])].filter(Boolean).join(' · '))}</small></div><em>${suiteEscape(value(item))}</em></article>`;
}
function openModule(module) {
  document.querySelector('.suite-modal-wrap')?.remove();
  const selectable = module.items.filter((item) => item.ratingKey);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="suite-modal-wrap"><div class="suite-modal-backdrop"></div><section class="suite-modal profile-modal ${module.tone}"><button class="suite-modal-close">×</button><header><span>${suiteEscape(module.eyebrow)}</span><h2>${suiteEscape(module.name)}</h2><p>${suiteEscape(module.description)}</p></header><div class="suite-modal-signal"><strong>${Number(module.metric).toLocaleString()}</strong><span>${suiteEscape(module.unit)}</span><p>${suiteEscape(module.insight)}</p></div><div class="suite-decision" hidden><span>COMPANION PICK</span><b></b><small></small></div><section class="suite-results">${module.items.length ? module.items.map(itemMarkup).join('') : '<div class="suite-empty">No matching items in the current Plex snapshot.</div>'}</section><footer>${selectable.length ? '<button class="suite-surprise">Choose for me</button>' : ''}${module.route ? '<button class="suite-route">Open related workspace</button>' : ''}<button class="suite-done">Done</button></footer></section></div>`,
  );
  const wrap = document.querySelector('.suite-modal-wrap'),
    close = () => wrap.remove();
  wrap.querySelector('.suite-modal-backdrop').onclick = close;
  wrap.querySelector('.suite-modal-close').onclick = close;
  wrap.querySelector('.suite-done').onclick = close;
  wrap.querySelector('.suite-surprise')?.addEventListener('click', () => {
    const pick = selectable[Math.floor(Math.random() * selectable.length)],
      decision = wrap.querySelector('.suite-decision');
    decision.hidden = false;
    decision.querySelector('b').textContent = pick.title;
    decision.querySelector('small').textContent = pick.detail || [pick.year, pick.library].filter(Boolean).join(' · ');
    decision.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  wrap.querySelector('.suite-route')?.addEventListener('click', () => {
    close();
    document.querySelector(`[data-nav="${module.route}"]`)?.click();
  });
}
async function load(force = false) {
  const grid = document.querySelector('#suite-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="suite-loading"><i></i><span>Reading library and history signals…</span></div>';
  try {
    const response = await apiFetch(`/api/utility-suite${force ? '?refresh=1' : ''}`),
      data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Utility Matrix unavailable');
    suiteState.data = data;
    document.querySelector('#suite-items').textContent = data.itemCount.toLocaleString();
    document.querySelector('#suite-libraries').textContent = data.libraryCount;
    document.querySelector('#suite-history').textContent = data.historySample.toLocaleString();
    render();
  } catch (error) {
    grid.innerHTML = `<div class="suite-none error"><h3>Utility Matrix offline</h3><p>${suiteEscape(error.message)}</p></div>`;
  }
}
function exportSuite() {
  if (!suiteState.data) return;
  const payload = {
      ...suiteState.data,
      modules: suiteState.data.modules.map(({ poster: _poster, ...module }) => ({
        ...module,
        items: module.items.map(({ poster: _poster, ...item }) => item),
      })),
    },
    url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })),
    link = document.createElement('a');
  link.href = url;
  link.download = 'plex-utility-matrix.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function setup() {
  const page = document.querySelector('#intel-page');
  if (!page) return;
  page.classList.add('utility-suite');
  page.innerHTML = shell();
  page.querySelector('[data-suite-back]').onclick = () => document.querySelector('[data-nav="dashboard"]').click();
  page.querySelector('#suite-search').oninput = (event) => {
    suiteState.query = event.target.value;
    render();
  };
  page.querySelector('#suite-refresh').onclick = () => load(true);
  page.querySelector('#suite-export').onclick = exportSuite;
  document.querySelector('[data-nav="intel"]')?.addEventListener('click', () => {
    if (!suiteState.data) setTimeout(() => load(), 80);
  });
  if (location.hash === '#intel') load();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
else setup();
