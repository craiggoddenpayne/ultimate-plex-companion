const escapeHtml = (value) =>
  String(value == null ? '' : value).replace(
    /[&<>'"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  );
const number = (value) => Number(value || 0).toLocaleString();

function mediaCard(item, note = '') {
  return (
    '<article class="lab-media-card"><img src="' +
    escapeHtml(item.poster) +
    '" alt="" loading="lazy"><div><b>' +
    escapeHtml(item.title) +
    '</b><span>' +
    [
      item.year,
      item.durationMinutes ? item.durationMinutes + ' min' : '',
      item.rating ? '★ ' + item.rating.toFixed(1) : '',
    ]
      .filter(Boolean)
      .join(' · ') +
    '</span>' +
    (note ? '<small>' + escapeHtml(note) + '</small>' : '') +
    '</div></article>'
  );
}

function memoryView(data) {
  const memory = data.memoryLane;
  const peak = Math.max(1, ...memory.months.map((month) => month.plays));
  return (
    '<section class="lab-view experiment-view memory-view"><header><div><span class="card-label">MEMORY LANE · LAST 12 MONTHS</span><h2>Your archive remembers where you have been.</h2><p>A viewing timeline rebuilt from Plex history, connected back to the films in your library.</p></div><div class="experiment-metric"><b>' +
    escapeHtml(memory.favouriteDecade) +
    '</b><span>most visited era</span></div></header><div class="experiment-stats"><article><b>' +
    number(memory.matchedPlays) +
    '</b><span>MATCHED PLAYS</span></article><article><b>' +
    number(memory.uniqueTitles) +
    '</b><span>UNIQUE TITLES</span></article><article><b>' +
    number(memory.favouriteDecadePlays) +
    '</b><span>ERA VISITS</span></article></div><div class="memory-chart">' +
    memory.months
      .map(
        (month) =>
          '<div><i style="height:' +
          Math.max(month.plays ? 8 : 2, Math.round((month.plays / peak) * 100)) +
          '%"><span>' +
          month.plays +
          '</span></i><b>' +
          month.label +
          '</b></div>',
      )
      .join('') +
    '</div><div class="experiment-section"><span class="card-label">RECENTLY REVISITED SIGNALS</span><div class="lab-media-grid">' +
    (memory.recent.length
      ? memory.recent
          .map((item) =>
            mediaCard(
              item,
              new Date(item.viewedAt * 1000).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
            ),
          )
          .join('')
      : '<p class="experiment-empty">No history entries could be matched to the current catalogue yet.</p>') +
    '</div></div></section>'
  );
}

function moodView(data) {
  const mood = data.moodWeather;
  const peak = Math.max(1, ...mood.signals.map((signal) => Math.max(signal.recent, signal.previous)));
  const momentum = mood.momentum > 0 ? '+' + mood.momentum : String(mood.momentum);
  return (
    '<section class="lab-view experiment-view mood-view"><div class="mood-forecast mood-' +
    escapeHtml(mood.forecast.tone) +
    '"><div class="weather-orbit"><i></i><span></span><b>' +
    escapeHtml(mood.forecast.name) +
    '</b></div><span class="card-label">30-DAY MOOD WEATHER</span><h2>' +
    escapeHtml(mood.forecast.leadGenre) +
    '</h2><p>' +
    escapeHtml(mood.forecast.detail) +
    '</p><div class="mood-facts"><div><b>' +
    momentum +
    '</b><span>play momentum</span></div><div><b>' +
    mood.lateNightPercent +
    '%</b><span>after dark</span></div><div><b>' +
    mood.weekendPercent +
    '%</b><span>weekend</span></div></div></div><div class="mood-signals"><header><span class="card-label">ATMOSPHERIC PRESSURE</span><h2>What is moving in.</h2><p>Recent genre plays compared with the preceding 30-day window.</p></header><div class="signal-key"><span>PREVIOUS</span><span>NOW</span></div>' +
    (mood.signals.length
      ? mood.signals
          .map(
            (signal) =>
              '<article><div><b>' +
              escapeHtml(signal.genre) +
              '</b><span class="' +
              (signal.delta > 0 ? 'rising' : signal.delta < 0 ? 'falling' : '') +
              '">' +
              (signal.delta > 0 ? '↑ +' : signal.delta < 0 ? '↓ ' : '→ ') +
              signal.delta +
              '</span></div><div class="signal-bars"><i style="width:' +
              Math.round((signal.previous / peak) * 100) +
              '%"></i><i style="width:' +
              Math.round((signal.recent / peak) * 100) +
              '%"></i></div><small>' +
              signal.previous +
              ' → ' +
              signal.recent +
              ' plays</small></article>',
          )
          .join('')
      : '<p class="experiment-empty">Watch history from the last 60 days will create this forecast.</p>') +
    '</div></section>'
  );
}

function runtimeView(data) {
  const runtime = data.runtimeWormhole;
  const peak = Math.max(1, ...runtime.buckets.map((bucket) => bucket.count));
  return (
    '<section class="lab-view experiment-view runtime-view"><header><div><span class="card-label">RUNTIME WORMHOLE</span><h2>See time as part of the collection.</h2><p>Every runtime collapsed into useful viewing windows, from a spare half hour to an event-horizon epic.</p></div><div class="runtime-clock"><i></i><b>' +
    number(runtime.totalHours) +
    '</b><span>LIBRARY HOURS</span></div></header><div class="experiment-stats"><article><b>' +
    number(runtime.unwatchedHours) +
    'h</b><span>UNWATCHED TIME</span></article><article><b>' +
    runtime.medianMinutes +
    'm</b><span>MEDIAN RUNTIME</span></article><article><b>' +
    number(runtime.longest.length ? runtime.longest[0].durationMinutes : 0) +
    'm</b><span>LONGEST SIGNAL</span></article></div><div class="runtime-body"><div class="runtime-distribution"><span class="card-label">RUNTIME DISTRIBUTION</span>' +
    runtime.buckets
      .map(
        (bucket) =>
          '<article><div><b>' +
          escapeHtml(bucket.label) +
          '</b><span>' +
          bucket.count +
          ' titles · ' +
          number(bucket.hours) +
          'h</span></div><i><em style="width:' +
          Math.round((bucket.count / peak) * 100) +
          '%"></em></i></article>',
      )
      .join('') +
    '</div><div class="time-portals"><span class="card-label">WHAT FITS RIGHT NOW?</span>' +
    runtime.windows
      .map(
        (window) =>
          '<article><b>' +
          window.minutes +
          '<small>MIN</small></b><span>' +
          number(window.choices) +
          ' unwatched choices</span></article>',
      )
      .join('') +
    '</div></div><div class="experiment-section"><span class="card-label">BEYOND THE EVENT HORIZON</span><div class="lab-media-grid">' +
    runtime.longest.map((item) => mediaCard(item)).join('') +
    '</div></div></section>'
  );
}

function anomalyView(data) {
  const anomalies = data.archiveAnomalies;
  return (
    '<section class="lab-view experiment-view anomaly-view"><header><div><span class="card-label">ARCHIVE ANOMALIES</span><h2>The strange corners are often the best.</h2><p>Rare genres, one-off filmmakers, long-form outliers and highly rated films still waiting to be discovered.</p></div><div class="anomaly-beacon"><i></i><b>' +
    number(anomalies.highRatedWaiting) +
    '</b><span>GEMS WAITING</span></div></header><div class="anomaly-columns"><div><span class="card-label">RARE GENRE ISLANDS</span><div class="anomaly-tags">' +
    (anomalies.rareGenres.length
      ? anomalies.rareGenres
          .map((item) => '<span>' + escapeHtml(item.genre) + ' <b>' + item.count + '</b></span>')
          .join('')
      : '<small>No rare genre islands detected.</small>') +
    '</div><span class="card-label">ONE-OFF DIRECTORS</span><div class="director-signals">' +
    (anomalies.oneOffDirectors.length
      ? anomalies.oneOffDirectors.map((name) => '<span>' + escapeHtml(name) + '</span>').join('')
      : '<small>No single-title directors detected.</small>') +
    '</div></div><div><span class="card-label">OLDEST UNWATCHED SIGNALS</span><div class="anomaly-list">' +
    (anomalies.oldestUnwatched.length
      ? anomalies.oldestUnwatched
          .map(
            (item) =>
              '<div><b>' +
              escapeHtml(item.title) +
              '</b><span>' +
              item.year +
              ' · ' +
              (item.genres.map(escapeHtml).join(', ') || 'Unclassified') +
              '</span></div>',
          )
          .join('')
      : '<small>Everything with a release year has been explored.</small>') +
    '</div></div></div><div class="experiment-section"><span class="card-label">BURIED GEMS · RATED 7.5+</span><div class="lab-media-grid">' +
    (anomalies.buriedGems.length
      ? anomalies.buriedGems
          .map((item) => mediaCard(item, item.daysWaiting == null ? 'Unwatched' : item.daysWaiting + ' days waiting'))
          .join('')
      : '<p class="experiment-empty">No highly rated unwatched films are currently hiding in the archive.</p>') +
    '</div></div></section>'
  );
}

export const futureLabExperiments = {
  memory: memoryView,
  mood: moodView,
  runtime: runtimeView,
  anomalies: anomalyView,
};
