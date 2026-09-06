const expandedEscape = (value) =>
  String(value == null ? '' : value).replace(
    /[&<>'"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  );

export const expandedTabNames = [
  ['director-dna', 'Director fingerprints', 'directorDna'],
  ['cast-map', 'Cast constellations', 'castConstellations'],
  ['studio-map', 'Studio ecosystem', 'studioEcosystem'],
  ['world-cinema', 'World cinema compass', 'worldCinema'],
  ['languages', 'Language landscape', 'languageLandscape'],
  ['certifications', 'Certification spectrum', 'certificationSpectrum'],
  ['franchises', 'Franchise trails', 'franchiseTrails'],
  ['collection-map', 'Collection architecture', 'collectionArchitecture'],
  ['release-calendar', 'Release calendar', 'releaseCalendar'],
  ['watch-delay', 'Arrival-to-watch delay', 'watchDelay'],
  ['hidden-decades', 'Hidden decades', 'hiddenDecades'],
  ['unfinished', 'Unfinished journeys', 'unfinishedJourneys'],
  ['one-night', 'One-night wonders', 'oneNightWonders'],
  ['sunday-cinema', 'Sunday cinema', 'sundayCinema'],
  ['midnight', 'Midnight movies', 'midnightMovies'],
  ['comfort-runtime', 'Comfort runtime', 'comfortRuntime'],
  ['rating-trust', 'Rating reliability', 'ratingReliability'],
  ['critic-gap', 'Critic-audience divide', 'criticAudienceGap'],
  ['resolution-evolution', 'Resolution evolution', 'resolutionEvolution'],
  ['audio-map', 'Audio soundscape', 'audioSoundscape'],
  ['subtitle-atlas', 'Subtitle atlas', 'subtitleAtlas'],
  ['hdr-horizon', 'HDR horizon', 'hdrHorizon'],
  ['aspect-gallery', 'Aspect ratio gallery', 'aspectRatioGallery'],
  ['bitrate-outliers', 'Bitrate outliers', 'bitrateOutliers'],
  ['container-migration', 'Container migration', 'containerMigration'],
  ['version-vault', 'Multi-version vault', 'versionVault'],
  ['library-velocity', 'Library velocity', 'libraryVelocity'],
  ['watchlist-age', 'Watchlist archaeology', 'watchlistArchaeology'],
  ['serendipity-chain', 'Serendipity chain', 'serendipityChain'],
  ['personal-canon', 'Personal canon', 'personalCanon'],
];

function renderMetrics(metrics) {
  return `<div class="signal-metrics">${metrics
    .map(
      (item) =>
        `<article><b>${expandedEscape(item.value)}</b><span>${expandedEscape(item.label)}</span>${item.note ? `<small>${expandedEscape(item.note)}</small>` : ''}</article>`,
    )
    .join('')}</div>`;
}

function renderBars(items) {
  if (!items?.length)
    return '<p class="experiment-empty">This signal has not formed from the available metadata yet.</p>';
  const peak = Math.max(1, ...items.map((item) => Number(item.count || 0)));
  return `<div class="signal-bars-list">${items
    .map(
      (item) =>
        `<article><div><b>${expandedEscape(item.label)}</b><span>${expandedEscape(item.detail || item.count)}</span></div><i><em style="width:${Math.round((Number(item.count || 0) / peak) * 100)}%"></em></i></article>`,
    )
    .join('')}</div>`;
}

function renderItems(items) {
  if (!items?.length) return '';
  return `<div class="signal-media-grid">${items
    .map(
      (item) =>
        `<a href="/api/plex/open/${encodeURIComponent(item.ratingKey)}"><img src="${expandedEscape(item.poster)}" alt="" loading="lazy"><div><b>${expandedEscape(item.title)}</b><span>${expandedEscape([item.year, item.durationMinutes ? `${item.durationMinutes} min` : ''].filter(Boolean).join(' · '))}</span><small>${expandedEscape(item.insight)}</small></div></a>`,
    )
    .join('')}</div>`;
}

function renderFacts(items) {
  if (!items?.length) return '';
  return `<div class="expanded-facts">${items
    .map((item) => `<span><b>${expandedEscape(item.label)}</b><small>${expandedEscape(item.count)}</small></span>`)
    .join('')}</div>`;
}

export function renderExpandedFutureLab(tab, data) {
  const definition = expandedTabNames.find(([id]) => id === tab);
  if (!definition) return null;
  const model = data?.expandedLabs?.[definition[2]];
  if (!model)
    return '<section class="lab-view lab-version-warning"><span class="card-label">SERVER UPDATE REQUIRED</span><h2>This experiment needs the expanded laboratory model.</h2><p>Restart or update Ultimate Plex Companion, then select <b>Recalculate</b>.</p></section>';
  return `<section class="lab-view signal-view expanded-lab-view"><header><div><span class="card-label">FUTURE LAB · EXPERIMENT ${String(expandedTabNames.indexOf(definition) + 21).padStart(2, '0')}</span><h2>${expandedEscape(model.title)}</h2><p>${expandedEscape(model.description)}</p></div><span class="signal-orbit" aria-hidden="true"><i></i><b>LIVE</b></span></header>${renderMetrics(model.metrics)}<div class="expanded-lab-columns"><section class="signal-section"><span class="card-label">SIGNAL DISTRIBUTION</span>${renderBars(model.bars)}</section>${model.facts?.length ? `<section class="signal-section"><span class="card-label">TECHNICAL FACETS</span>${renderFacts(model.facts)}</section>` : ''}</div>${model.items?.length ? `<section class="signal-section"><span class="card-label">TITLES BEHIND THE SIGNAL</span>${renderItems(model.items)}</section>` : ''}</section>`;
}
