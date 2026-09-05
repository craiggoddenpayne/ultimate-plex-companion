import { sessionMarkup } from './stream-session-view.ts';
import { apiFetch } from '../../core/api-client.ts';

const telemetryEscape = (value) =>
  String(value == null ? '' : value).replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
const streamIcon = '<svg class="icon" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>';
const usersIcon =
  '<svg class="icon" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87"/></svg>';
let peopleDays = 365;

function telemetryTimeAgo(timestamp) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - Number(timestamp || 0)));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

function bindBack(page) {
  page.querySelector('[data-back]').addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelector('[data-nav="dashboard"]').click();
  });
}

function streamsShell() {
  return (
    '<button class="back-link" data-back>← Command deck</button><div class="telemetry-hero"><div><span class="eyebrow">LIVE STREAM OBSERVATORY</span><h1>Every session.<br><em>Every decision.</em></h1><p>Playback quality, network route, and transcode pressure updated every eight seconds.</p></div><span class="live-beacon"><i></i>LIVE TELEMETRY</span></div>' +
    '<div class="telemetry-metrics"><article><span>ACTIVE STREAMS</span><strong id="live-active">—</strong><small id="live-direct">Reading Plex</small></article><article><span>TRANSCODES</span><strong id="live-transcodes">—</strong><small id="live-hardware">Hardware status</small></article><article><span>EST. BANDWIDTH</span><strong id="live-bandwidth">—</strong><small>Across active sessions</small></article><article><span>PLEX RESPONSE</span><strong id="live-latency">—</strong><small>Last telemetry sample</small></article></div>' +
    '<section class="panel sessions-panel"><div class="panel-head"><div><span class="card-label">NOW PLAYING</span><h2>Session paths</h2></div><button class="telemetry-refresh" id="refresh-streams">Refresh now</button></div><div id="live-session-list" class="live-session-list"><div class="telemetry-loading"></div></div></section>' +
    '<section class="panel playback-history"><div class="panel-head"><div><span class="card-label">PLAYBACK MEMORY</span><h2>Recently watched</h2></div></div><div id="playback-history-list"></div></section>'
  );
}

function renderStreams(data) {
  document.querySelector('#live-active').textContent = data.summary.active;
  document.querySelector('#live-direct').textContent = data.summary.direct + ' direct sessions';
  document.querySelector('#live-transcodes').textContent = data.summary.transcodes;
  document.querySelector('#live-hardware').textContent = data.summary.transcodes
    ? data.summary.hardware + ' hardware accelerated'
    : 'No encoder pressure';
  document.querySelector('#live-bandwidth').textContent = data.summary.totalBandwidth
    ? (data.summary.totalBandwidth / 1000).toFixed(1) + ' Mbps'
    : '0 Mbps';
  document.querySelector('#live-latency').textContent = data.summary.latencyMs + ' ms';
  const list = document.querySelector('#live-session-list');
  list.innerHTML = data.sessions.length
    ? data.sessions.map(sessionMarkup).join('')
    : '<div class="observatory-empty"><span>' +
      streamIcon +
      '</span><h3>The observatory is quiet</h3><p>Plex is connected and healthy. Active sessions will appear here automatically.</p><i></i></div>';
  const history = document.querySelector('#playback-history-list');
  history.innerHTML = data.recent.length
    ? data.recent
        .map((item) => {
          const meta = [
            item.detail,
            item.subtitle,
            item.year,
            item.durationMinutes ? item.durationMinutes + ' min' : null,
          ]
            .filter(Boolean)
            .join(' · ');
          const facts = [
            item.type === 'episode' ? 'TV episode' : 'Film',
            item.resolution,
            item.container ? item.container.toUpperCase() : null,
            item.rating ? '★ ' + Number(item.rating).toFixed(1) : null,
          ].filter(Boolean);
          return (
            '<article class="watch-history-row"><div class="watch-thumb">' +
            (item.poster
              ? '<img loading="lazy" src="' + telemetryEscape(item.poster) + '" alt="">'
              : '<span>' + streamIcon + '</span>') +
            '<i>' +
            telemetryEscape(item.type) +
            '</i></div><div class="watch-copy"><div class="watch-title"><h3>' +
            telemetryEscape(item.title) +
            '</h3>' +
            (item.user ? '<span>' + telemetryEscape(item.user) + '</span>' : '') +
            '</div><p>' +
            telemetryEscape(meta) +
            '</p><div class="watch-facts">' +
            facts.map((fact) => '<span>' + telemetryEscape(fact) + '</span>').join('') +
            '</div></div><time><b>' +
            telemetryTimeAgo(item.viewedAt) +
            '</b><small>' +
            new Date(item.viewedAt * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
            '</small></time></article>'
          );
        })
        .join('')
    : '<div class="history-none">No playback history returned by Plex.</div>';
}

async function loadStreams() {
  try {
    const response = await apiFetch('/api/streams');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    renderStreams(data);
  } catch (error) {
    document.querySelector('#live-session-list').innerHTML =
      '<div class="observatory-empty error"><b>!</b><h3>Telemetry unavailable</h3><p>' +
      telemetryEscape(error.message) +
      '</p></div>';
  }
}

function peopleShell() {
  return (
    '<button class="back-link" data-back>← Command deck</button><div class="telemetry-hero people-hero"><div><span class="eyebrow">HOUSEHOLD SIGNAL</span><h1>The people behind<br><em>the play button.</em></h1><p>Private, local viewing patterns that help the library serve everyone better.</p></div><div class="period-tabs"><button data-days="30">30 days</button><button data-days="90">90 days</button><button class="active" data-days="365">1 year</button></div></div>' +
    '<div class="people-summary"><span><b id="people-count">—</b>PLEX ACCOUNTS</span><span><b id="people-plays">—</b>RECENT PLAYS</span><span><b id="people-active">—</b>WATCHING NOW</span></div><div id="people-grid" class="people-grid"><div class="telemetry-loading"></div></div>' +
    '<div class="people-insights"><section class="panel"><div class="panel-head"><div><span class="card-label">HOUSEHOLD RHYTHM</span><h2>When watching happens</h2></div></div><div id="hour-chart" class="hour-chart"></div><div class="chart-axis"><span>MIDNIGHT</span><span>6 AM</span><span>NOON</span><span>6 PM</span><span>MIDNIGHT</span></div></section><section class="panel privacy-panel"><span>' +
    usersIcon +
    '</span><h2>Designed for a household,<br>not surveillance.</h2><p>These signals stay inside Companion and come only from Plex history. They are used to improve shared discovery and operational decisions.</p><div><i></i>Local data only</div></section></div>'
  );
}

function renderPeople(data) {
  document.querySelector('#people-count').textContent = data.people.length;
  document.querySelector('#people-plays').textContent = data.totalPlays;
  document.querySelector('#people-active').textContent = data.activeNow;
  const grid = document.querySelector('#people-grid');
  grid.innerHTML = data.people.length
    ? data.people
        .map(
          (person) =>
            '<article class="person-card ' +
            person.tone +
            '"><div class="person-avatar">' +
            telemetryEscape(person.initials) +
            '<i class="' +
            (person.active ? 'online' : '') +
            '"></i></div><div class="person-name"><h3>' +
            telemetryEscape(person.name) +
            '</h3><span>' +
            (person.active
              ? 'Watching ' + telemetryEscape(person.nowPlaying)
              : person.lastSeen
                ? 'Last active ' + telemetryTimeAgo(person.lastSeen)
                : 'No recent activity') +
            '</span></div><div class="person-stats"><span><b>' +
            person.plays +
            '</b>plays</span><span><b>' +
            person.movies +
            '</b>movies</span><span><b>' +
            person.episodes +
            '</b>episodes</span></div><div class="share-bar"><i style="width:' +
            person.share +
            '%"></i></div><small>' +
            person.share +
            '% of household activity</small></article>',
        )
        .join('')
    : '<div class="observatory-empty"><span>' +
      usersIcon +
      '</span><h3>No managed accounts found</h3><p>Plex did not return any household accounts.</p></div>';
  const peak = Math.max(1, ...data.hours.map((item) => item.plays));
  document.querySelector('#hour-chart').innerHTML = data.hours
    .map(
      (item) =>
        '<i title="' +
        item.hour +
        ':00 · ' +
        item.plays +
        ' plays" style="height:' +
        Math.max(5, Math.round((item.plays / peak) * 100)) +
        '%"></i>',
    )
    .join('');
}

async function loadPeople() {
  try {
    const response = await apiFetch('/api/people?days=' + peopleDays);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    renderPeople(data);
  } catch (error) {
    document.querySelector('#people-grid').innerHTML =
      '<div class="observatory-empty error"><b>!</b><h3>People signal unavailable</h3><p>' +
      telemetryEscape(error.message) +
      '</p></div>';
  }
}

function setupTelemetryPages() {
  const streams = document.querySelector('#streams-page');
  const people = document.querySelector('#people-page');
  if (!streams || !people) return;
  streams.classList.add('telemetry-page');
  streams.innerHTML = streamsShell();
  bindBack(streams);
  streams.querySelector('#refresh-streams').addEventListener('click', loadStreams);
  people.classList.add('telemetry-page');
  people.innerHTML = peopleShell();
  bindBack(people);
  people.querySelectorAll('[data-days]').forEach((button) =>
    button.addEventListener('click', () => {
      peopleDays = Number(button.dataset.days);
      people.querySelectorAll('[data-days]').forEach((item) => item.classList.toggle('active', item === button));
      loadPeople();
    }),
  );
  document.querySelector('[data-nav="streams"]').addEventListener('click', () => setTimeout(loadStreams, 60));
  document.querySelector('[data-nav="people"]').addEventListener('click', () => setTimeout(loadPeople, 60));
  if (location.hash === '#streams') loadStreams();
  if (location.hash === '#people') loadPeople();
  setInterval(() => {
    if (!document.hidden && location.hash === '#streams') loadStreams();
  }, 8000);
}
setupTelemetryPages();
