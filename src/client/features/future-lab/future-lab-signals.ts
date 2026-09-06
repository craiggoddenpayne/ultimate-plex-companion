const escapeHtml = (value) =>
  String(value == null ? '' : value).replace(
    /[&<>'"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  );
const number = (value) => Number(value || 0).toLocaleString();

function metric(value, label, note = '') {
  return `<article><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span>${note ? `<small>${escapeHtml(note)}</small>` : ''}</article>`;
}

function shell(label, title, description, metrics, body) {
  return `<section class="lab-view signal-view"><header><div><span class="card-label">${escapeHtml(label)}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><span class="signal-orbit" aria-hidden="true"><i></i><b>LIVE</b></span></header><div class="signal-metrics">${metrics.join('')}</div>${body}</section>`;
}

function bars(items, valueKey = 'count', labelKey = 'label', detail = (item) => item[valueKey]) {
  const peak = Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)));
  return `<div class="signal-bars-list">${items
    .map(
      (item) =>
        `<article><div><b>${escapeHtml(item[labelKey])}</b><span>${escapeHtml(detail(item))}</span></div><i><em style="width:${Math.round((Number(item[valueKey] || 0) / peak) * 100)}%"></em></i></article>`,
    )
    .join('')}</div>`;
}

function media(items, note = null) {
  if (!items?.length) return '<p class="experiment-empty">No matching titles have formed this signal yet.</p>';
  return `<div class="signal-media-grid">${items
    .map(
      (item) =>
        `<a href="/api/plex/open/${encodeURIComponent(item.ratingKey)}"><img src="${escapeHtml(item.poster)}" alt="" loading="lazy"><div><b>${escapeHtml(item.title)}</b><span>${escapeHtml([item.year, item.durationMinutes ? `${item.durationMinutes} min` : ''].filter(Boolean).join(' · '))}</span>${note ? `<small>${escapeHtml(note(item))}</small>` : ''}</div></a>`,
    )
    .join('')}</div>`;
}

function section(title, content) {
  return `<div class="signal-section"><span class="card-label">${escapeHtml(title)}</span>${content}</div>`;
}

function backlog(data) {
  const months = data.monthsToClear == null ? '∞' : number(data.monthsToClear);
  return shell(
    'BACKLOG HORIZON',
    'Measure the gravity of everything waiting.',
    'Forecasts how long your unwatched library would take to explore at your recent unique-title pace.',
    [
      metric(number(data.titles), 'unwatched titles'),
      metric(`${number(data.hours)}h`, 'watch time'),
      metric(data.monthlyPace, 'titles per month'),
      metric(months, 'months to clear'),
    ],
    section(
      'OLDEST WAITING SIGNALS',
      media(data.oldest, (item) =>
        item.daysWaiting == null ? 'Arrival unknown' : `${number(item.daysWaiting)} days waiting`,
      ),
    ),
  );
}

function rewatch(data) {
  return shell(
    'REWATCH DNA',
    'Find the stories your household orbits.',
    'Separates exploration from repeat viewing and reveals the genre behind your comfort watches.',
    [
      metric(number(data.totalPlays), 'matched plays'),
      metric(number(data.repeatPlays), 'repeat plays'),
      metric(`${data.repeatRate}%`, 'repeat rate'),
      metric(data.favouriteGenre, 'comfort genre'),
    ],
    section(
      'MOST REVISITED',
      media(data.comfortTitles, (item) => `${item.plays} plays`),
    ),
  );
}

function drift(data) {
  return shell(
    'GENRE DRIFT',
    'See how your taste is changing course.',
    `Compares the latest ${data.windowDays} days with the preceding ${data.windowDays}-day window.`,
    [
      metric(data.signals.filter((item) => item.delta > 0).length, 'genres rising'),
      metric(data.signals.filter((item) => item.delta < 0).length, 'genres cooling'),
      metric(data.signals[0]?.genre || '—', 'largest shift'),
    ],
    section(
      'TASTE PRESSURE',
      bars(
        data.signals,
        'recent',
        'genre',
        (item) => `${item.previous} → ${item.recent} (${item.delta > 0 ? '+' : ''}${item.delta})`,
      ),
    ),
  );
}

function chronotype(data) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const blockTotals = data.cells.flatMap((hours) =>
    [0, 4, 8, 12, 16, 20].map((start) => hours.slice(start, start + 4).reduce((sum, count) => sum + count, 0)),
  );
  const peak = Math.max(1, ...blockTotals);
  const grid = `<div class="chronotype-grid"><span></span>${[0, 4, 8, 12, 16, 20].map((hour) => `<b>${String(hour).padStart(2, '0')}</b>`).join('')}${data.cells
    .map(
      (hours, day) =>
        `<span>${days[day]}</span>${[0, 4, 8, 12, 16, 20]
          .map((start) => {
            const value = hours.slice(start, start + 4).reduce((sum, count) => sum + count, 0);
            return `<i title="${days[day]} ${start}:00 · ${value} plays" style="--heat:${Math.max(0.06, value / peak)}"></i>`;
          })
          .join('')}`,
    )
    .join('')}</div>`;
  return shell(
    'NIGHT OBSERVATORY',
    'Map your viewing chronotype.',
    'Turns viewing timestamps into a weekly heatmap without sending activity outside your server.',
    [
      metric(`${String(data.peak.hour).padStart(2, '0')}:00`, 'peak hour'),
      metric(days[data.peak.day], 'peak day'),
      metric(`${data.latePercent}%`, 'late night'),
      metric(`${data.weekendPercent}%`, 'weekend'),
    ],
    section('WEEKLY ORBIT · FOUR-HOUR WINDOWS', grid),
  );
}

function growth(data) {
  return shell(
    'COLLECTION PULSE',
    'Watch the archive grow in real time.',
    'Measures arrivals over the last twelve calendar months and flags new additions still waiting to be watched.',
    [
      metric(number(data.addedThisYear), '12-month arrivals'),
      metric(number(data.recentUnwatched), 'new and unwatched'),
      metric(number(data.newest.length), 'latest signals'),
    ],
    section('ARRIVAL VELOCITY', bars(data.months, 'count', 'label')) + section('NEWEST ARRIVALS', media(data.newest)),
  );
}

function ratings(data) {
  return shell(
    'RATING LENS',
    'Calibrate quality across the collection.',
    'Shows the shape of audience ratings and surfaces highly rated films that remain unwatched.',
    [
      metric(data.average.toFixed(1), 'average rating'),
      metric(number(data.unrated), 'unrated titles'),
      metric(number(data.sleepers.length), 'sleepers surfaced'),
    ],
    section('RATING DISTRIBUTION', bars(data.bands)) +
      section(
        'HIGH-RATED SLEEPERS',
        media(data.sleepers, (item) => `★ ${item.rating.toFixed(1)}`),
      ),
  );
}

function codecs(data) {
  return shell(
    'CODEC ARCHAEOLOGY',
    'Excavate the technical eras inside your library.',
    'Maps codecs, containers and resolutions, while counting titles that may benefit from Codec Studio review.',
    [
      metric(number(data.versions), 'media versions'),
      metric(number(data.legacyTitles), 'legacy titles'),
      metric(number(data.codecs.length), 'codec families'),
    ],
    `<div class="signal-columns">${section('VIDEO CODECS', bars(data.codecs))}${section('CONTAINERS', bars(data.containers))}${section('RESOLUTIONS', bars(data.resolutions))}</div>`,
  );
}

function storage(data) {
  return shell(
    'STORAGE TOPOLOGY',
    'See where the physical weight of the archive lives.',
    'Maps title sizes, multi-version storage and the largest individual signals without scanning media files.',
    [
      metric(`${data.totalTerabytes} TB`, 'catalogue footprint'),
      metric(`${data.averageGigabytes} GB`, 'average title'),
      metric(number(data.multiVersionTitles), 'multi-version titles'),
      metric(number(data.sizedTitles), 'sized titles'),
    ],
    section('SIZE DISTRIBUTION', bars(data.sizeBands)) +
      section(
        'HEAVIEST SIGNALS',
        media(data.largest, (item) => `${item.sizeGigabytes} GB`),
      ),
  );
}

function bridges(data) {
  return shell(
    'GENRE BRIDGES',
    'Find the films connecting distant shelves.',
    'Detects recurring genre pairings and titles that act as high-connectivity bridges across the catalogue.',
    [
      metric(number(data.pairs.length), 'strong pairings'),
      metric(number(data.connectors.length), 'connectors surfaced'),
      metric(data.pairs[0]?.label || '—', 'strongest bridge'),
    ],
    section('RECURRING CONNECTIONS', bars(data.pairs)) +
      section(
        'CONNECTOR TITLES',
        media(data.connectors, (item) => `${item.bridgeCount} genres`),
      ),
  );
}

function passport(data) {
  const least = [...data.decades]
    .filter((item) => item.titles >= 3)
    .sort((a, b) => a.watchedPercent - b.watchedPercent)[0];
  return shell(
    'DECADE PASSPORT',
    'Track how far you have travelled through film history.',
    'Combines collection size, exploration and rating strength for every represented decade.',
    [
      metric(data.decades.length, 'decades represented'),
      metric(least?.decade || '—', 'least explored'),
      metric(least ? `${least.watchedPercent}%` : '—', 'passport progress'),
    ],
    section(
      'ERA STAMPS',
      `<div class="passport-grid">${data.decades.map((item) => `<article><b>${escapeHtml(item.decade)}</b><i><em style="width:${item.watchedPercent}%"></em></i><span>${item.watchedPercent}% watched · ${item.titles} titles · ★ ${item.averageRating}</span></article>`).join('')}</div>`,
    ),
  );
}

function tempo(data) {
  return shell(
    'DURATION DNA',
    'Learn the tempo your viewing naturally follows.',
    'Compares the collection runtime with what is actually watched, then finds unwatched titles near your preferred pace.',
    [
      metric(data.personality, 'runtime personality'),
      metric(`${data.watchedAverage}m`, 'watched average'),
      metric(`${data.libraryAverage}m`, 'library average'),
      metric(`${data.shortPlays} / ${data.epicPlays}`, 'short / epic plays'),
    ],
    section('MATCHED TO YOUR TEMPO', media(data.next)),
  );
}

function seasons(data) {
  return shell(
    'SEASONAL ECHOES',
    'Reveal the annual rhythm of your taste.',
    'Combines the same calendar months across years to show when viewing rises and which genre owns each month.',
    [
      metric(data.peak?.month || '—', 'peak month'),
      metric(number(data.peak?.plays), 'peak plays'),
      metric(data.peak?.genre || '—', 'peak genre'),
    ],
    section(
      'YEARLY RHYTHM',
      bars(data.months, 'plays', 'month', (item) => `${item.plays} · ${item.genre}`),
    ),
  );
}

const views = {
  backlog,
  rewatch,
  drift,
  chronotype,
  growth,
  ratings,
  codecs,
  storage,
  bridges,
  passport,
  tempo,
  seasons,
};
const keys = {
  backlog: 'backlogHorizon',
  rewatch: 'rewatchDna',
  drift: 'genreDrift',
  chronotype: 'nightChronotype',
  growth: 'collectionPulse',
  ratings: 'ratingLens',
  codecs: 'codecArchaeology',
  storage: 'storageTopology',
  bridges: 'genreBridges',
  passport: 'decadePassport',
  tempo: 'durationDna',
  seasons: 'seasonalEchoes',
};

export function renderFutureLabSignal(tab, data) {
  const view = views[tab];
  const model = data?.[keys[tab]];
  if (!view) return null;
  if (!model)
    return '<section class="lab-view lab-version-warning"><span class="card-label">SERVER UPDATE REQUIRED</span><h2>This signal needs the latest analysis model.</h2><p>Restart or update Ultimate Plex Companion, then select <b>Recalculate</b>.</p></section>';
  return view(model);
}
