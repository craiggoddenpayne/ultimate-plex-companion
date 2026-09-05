import { bindOverlapActions, renderOverlapList } from './library-overlaps-ui.ts';
const atlasState = { data: null, tab: 'quality' };
const atlasEscape = (value) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
const atlasBytes = (bytes) => {
  let value = Number(bytes) || 0,
    unit = 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  while (value >= 1024 && unit < 4) {
    value /= 1024;
    unit++;
  }
  return value.toFixed(unit > 2 ? 1 : 0) + ' ' + units[unit];
};

function atlasShell() {
  return '<section class="library-atlas"><header class="atlas-head"><div><span class="eyebrow">LIBRARY ATLAS · DEEP TELEMETRY</span><h2>See the shape beneath<br><em>your collection.</em></h2><p>Quality, editions, metadata integrity and growth—mapped directly from Plex.</p></div><div class="atlas-orbit" aria-hidden="true"><i></i><i></i><span>ATLAS<br>ONLINE</span></div></header><div class="atlas-summary"><article><span>TITLES MAPPED</span><b id="atlas-items">—</b><small>Movies and episodes</small></article><article><span>STORAGE MAPPED</span><b id="atlas-size">—</b><small>Known Plex media</small></article><article><span>METADATA HEALTH</span><b id="atlas-health">—</b><small>Complete records</small></article><article><span>EDITIONS & COPIES</span><b id="atlas-editions">—</b><small>Worth reviewing</small></article></div><nav class="atlas-tabs"><button class="active" data-atlas="quality">Quality Matrix</button><button data-atlas="editions">Edition Guardian</button><button data-atlas="metadata">Metadata Lens</button><button data-atlas="growth">Growth Forecast</button><button id="refresh-atlas">↻</button></nav><div class="atlas-stage" id="atlas-stage"><div class="atlas-loading"><i></i><h3>Mapping media signatures</h3><p>This first scan may take a moment on large libraries.</p></div></div></section>';
}

function qualityView(data) {
  const total = Math.max(1, data.itemCount),
    colours = ['#54e6df', '#a77aff', '#f5ad2e', '#ef7190'];
  const resolution = data.quality.resolution;
  let cursor = 0;
  const gradient = resolution
    .map((item, index) => {
      const start = cursor;
      cursor += (item.count / total) * 100;
      return colours[index % 4] + ' ' + start + '% ' + cursor + '%';
    })
    .join(',');
  const peak = Math.max(1, ...resolution.map((item) => item.count));
  return (
    '<div class="quality-layout"><section class="atlas-panel resolution-panel"><div class="atlas-panel-title"><span>RESOLUTION CONSTELLATION</span><h3>Visual quality ladder</h3></div><div class="quality-core"><div class="quality-donut" style="--quality-gradient:' +
    gradient +
    '"><span><b>' +
    data.itemCount.toLocaleString() +
    '</b>FILES</span></div><div class="quality-legend">' +
    resolution
      .map(
        (item, index) =>
          '<span><i style="background:' +
          colours[index % 4] +
          '"></i>' +
          atlasEscape(item.label) +
          '<b>' +
          item.count.toLocaleString() +
          '</b><small>' +
          Math.round((item.count / total) * 100) +
          '%</small></span>',
      )
      .join('') +
    '</div></div></section><section class="atlas-panel codec-panel"><div class="atlas-panel-title"><span>CODEC DISTRIBUTION</span><h3>Encoding landscape</h3></div><div class="atlas-bars">' +
    data.quality.codecs
      .map(
        (item) =>
          '<div><span>' +
          atlasEscape(item.label) +
          '</span><i><b style="width:' +
          Math.max(3, Math.round((item.count / peak) * 100)) +
          '%"></b></i><em>' +
          item.count.toLocaleString() +
          '</em></div>',
      )
      .join('') +
    '</div><footer><span><b>' +
    data.quality.hdrCount.toLocaleString() +
    '</b> HDR TITLES</span><span><b>' +
    data.quality.hdrPercent +
    '%</b> HDR SHARE</span><span><b>' +
    Math.round(data.quality.averageBitrate / 1000) +
    '</b> AVG MBPS</span></footer></section></div>'
  );
}
function mediaRow(item, kind) {
  return (
    '<article class="atlas-media-row" data-rating-key="' +
    atlasEscape(item.ratingKey) +
    '"><span class="atlas-thumb">' +
    (item.poster ? '<img loading="lazy" src="' + atlasEscape(item.poster) + '" alt="">' : '<i>?</i>') +
    '</span><div><b>' +
    atlasEscape(item.title) +
    '</b><small>' +
    atlasEscape([item.year, item.library].filter(Boolean).join(' · ')) +
    '</small></div>' +
    (kind === 'metadata'
      ? '<div class="metadata-row-actions"><div class="missing-tags">' +
        item.missing.map((value) => '<span>' + atlasEscape(value) + '</span>').join('') +
        '</div><button class="metadata-edit-button" data-rating-key="' +
        atlasEscape(item.ratingKey) +
        '">Fix metadata</button></div>'
      : '<div class="edition-facts"><span>' +
        item.copies +
        ' COPIES</span><span>' +
        atlasBytes(item.size) +
        '</span></div>') +
    '</article>'
  );
}
function editionsView(data) {
  return (
    '<div class="atlas-callouts"><article><span>DUPLICATE IDENTITIES</span><b>' +
    data.editions.duplicateCount +
    '</b><small>' +
    atlasBytes(data.editions.duplicateBytes) +
    ' represented across copies</small></article><article><span>MULTI-VERSION TITLES</span><b>' +
    data.editions.versionedCount +
    '</b><small>Alternate files or named editions</small></article><div><i></i><p><b>Protected resolution workflow</b>Compare every file, then explicitly select and confirm one version for Plex to delete.</p></div></div><section class="atlas-panel atlas-list"><div class="atlas-panel-title"><span>EDITION SIGNATURES</span><h3>Potential overlaps</h3></div>' +
    renderOverlapList(data) +
    '</section>'
  );
}
function metadataView(data) {
  const complete = data.metadata.completeness;
  return (
    '<div class="metadata-layout"><section class="atlas-panel metadata-score"><div class="score-ring" style="--score:' +
    complete * 3.6 +
    'deg"><span><b>' +
    complete +
    '%</b>COMPLETE</span></div><h3>' +
    data.metadata.completeCount.toLocaleString() +
    ' healthy records</h3><p>' +
    data.metadata.issueCount.toLocaleString() +
    ' titles need one or more metadata fields.</p></section><section class="atlas-panel atlas-list"><div class="atlas-panel-title"><span>WEAK SIGNALS</span><h3>Records needing attention</h3></div>' +
    (data.metadata.issues.length
      ? data.metadata.issues.map((item) => mediaRow(item, 'metadata')).join('')
      : '<div class="atlas-none">Every scanned record contains artwork, summary, year and genres.</div>') +
    '</section></div>'
  );
}
function growthView(data) {
  const libraries = data.growth.libraries,
    peak = Math.max(1, ...libraries.map((item) => item.size));
  return (
    '<div class="growth-cards"><article><span>LAST 90 DAYS</span><b>' +
    data.growth.recentItems.toLocaleString() +
    '</b><small>' +
    atlasBytes(data.growth.recentBytes) +
    ' added</small></article><article><span>MONTHLY VELOCITY</span><b>' +
    atlasBytes(data.growth.monthlyBytes) +
    '</b><small>Based on the last 90 days</small></article><article class="forecast"><span>12-MONTH PROJECTION</span><b>+' +
    atlasBytes(data.growth.annualProjectionBytes) +
    '</b><small>If the current pace continues</small></article></div><section class="atlas-panel"><div class="atlas-panel-title"><span>LIBRARY MASS</span><h3>Storage by collection</h3></div><div class="library-mass">' +
    libraries
      .map(
        (item) =>
          '<div><span><b>' +
          atlasEscape(item.title) +
          '</b><small>' +
          item.count.toLocaleString() +
          ' items · ' +
          item.recent +
          ' new this month</small></span><i><b style="width:' +
          Math.max(2, Math.round((item.size / peak) * 100)) +
          '%"></b></i><em>' +
          atlasBytes(item.size) +
          '</em></div>',
      )
      .join('') +
    '</div></section>'
  );
}
function renderAtlas() {
  const data = atlasState.data,
    stage = document.querySelector('#atlas-stage');
  if (!data || !stage) return;
  document
    .querySelectorAll('[data-atlas]')
    .forEach((button) => button.classList.toggle('active', button.dataset.atlas === atlasState.tab));
  stage.innerHTML =
    atlasState.tab === 'quality'
      ? qualityView(data)
      : atlasState.tab === 'editions'
        ? editionsView(data)
        : atlasState.tab === 'metadata'
          ? metadataView(data)
          : growthView(data);
  if (atlasState.tab === 'editions') bindOverlapActions(data, () => loadAtlas(true));
}
async function loadAtlas(force = false) {
  const stage = document.querySelector('#atlas-stage');
  if (!stage) return;
  stage.innerHTML =
    '<div class="atlas-loading"><i></i><h3>Mapping media signatures</h3><p>Reading quality, editions, metadata and growth from Plex.</p></div>';
  try {
    const response = await fetch('/api/library/insights' + (force ? '?refresh=1' : ''));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    atlasState.data = data;
    document.querySelector('#atlas-items').textContent = data.itemCount.toLocaleString();
    document.querySelector('#atlas-size').textContent = atlasBytes(data.totalBytes);
    document.querySelector('#atlas-health').textContent = data.metadata.completeness + '%';
    document.querySelector('#atlas-editions').textContent = (
      data.editions.duplicateCount + data.editions.versionedCount
    ).toLocaleString();
    renderAtlas();
  } catch (error) {
    stage.innerHTML =
      '<div class="atlas-none error"><b>!</b><h3>Atlas could not complete</h3><p>' +
      atlasEscape(error.message) +
      '</p></div>';
  }
}
function setupAtlas() {
  const page = document.querySelector('#library-page'),
    anchor = page?.querySelector('.safety-strip');
  if (!page || !anchor) return;
  anchor.insertAdjacentHTML('afterend', atlasShell());
  page.querySelectorAll('[data-atlas]').forEach(
    (button) =>
      (button.onclick = () => {
        atlasState.tab = button.dataset.atlas;
        renderAtlas();
      }),
  );
  page.querySelector('#refresh-atlas').onclick = () => loadAtlas(true);
  document.querySelector('[data-nav="library"]')?.addEventListener('click', () => {
    if (!atlasState.data) setTimeout(() => loadAtlas(), 160);
  });
  if (location.hash === '#library') loadAtlas();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupAtlas);
else setupAtlas();
