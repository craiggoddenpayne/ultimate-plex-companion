import { bindCommandDeckDetails, renderTasteIntelligence } from './command-deck-intelligence-ui.js';
import { activityVisual } from './activity-view.js';
const deckEscape = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);

function timeAgo(timestamp) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - Number(timestamp || 0)));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
  return Math.floor(seconds / 86400) + 'd';
}

function formatWatch(minutes) {
  const hours = minutes / 60;
  return hours >= 10 ? hours.toFixed(1) : hours.toFixed(1);
}

function updateDeck(data) {
  const dashboard = document.querySelector('#dashboard-page');
  if (!dashboard) return;
  const today = new Intl.DateTimeFormat('en-GB', { weekday:'long', day:'numeric', month:'long' }).format(new Date()).toUpperCase();
  dashboard.querySelector('.hero-row .eyebrow').textContent = today;
  dashboard.querySelector('.hero-row h1').innerHTML = data.sessions.length ? 'Your universe is<br><em>alive right now.</em>' : 'Your universe is<br><em>running quietly.</em>';
  dashboard.querySelector('.hero-row p').textContent = data.sessions.length ? data.sessions.length + ' active ' + (data.sessions.length === 1 ? 'stream' : 'streams') + ' across your Plex household.' : 'Everything is connected. Nothing is streaming right now.';

  const healthCard = dashboard.querySelector('.metric-card.featured');
  healthCard.querySelector('h2').textContent = 'Plex is ' + data.health.status.toLowerCase();
  healthCard.querySelector('p').textContent = data.health.latencyMs + ' ms command response · ' + data.health.transcodes + ' active ' + (data.health.transcodes === 1 ? 'transcode' : 'transcodes');
  healthCard.querySelector('.health-orbit strong').textContent = data.health.score;
  healthCard.querySelector('.health-orbit span').textContent = data.health.status.toUpperCase();
  healthCard.querySelector('.arc-value').style.strokeDasharray = data.health.score + ' 100';

  const watchCard = dashboard.querySelector('.metric-grid > article:nth-child(4)');
  watchCard.querySelector('.big-number').innerHTML = formatWatch(data.watch.minutes) + '<small>h</small>';
  watchCard.querySelector('p').textContent = data.watch.plays + ' matched plays in the last 7 days';
  const trend=data.watch.trendPercent;
  watchCard.querySelector('.delta').innerHTML=(trend>0?'+':'')+trend+'% <span>vs previous week</span>';
  const streamCount=dashboard.querySelector('#stream-count'),streamSummary=dashboard.querySelector('#stream-summary');
  streamCount.textContent=data.sessions.length;
  streamSummary.textContent=data.sessions.length?(data.sessions.length-data.health.transcodes)+' direct · '+data.health.transcodes+' transcodes':'No active sessions';
  document.querySelector('#nav-stream-count').textContent=data.sessions.length;
  dashboard.querySelector('#library-count').textContent=Number(data.titleCount||0).toLocaleString();
  dashboard.querySelector('#library-summary').textContent='Titles across '+data.libraryCount+' '+(data.libraryCount===1?'library':'libraries');
  const streamBars=dashboard.querySelector('.stream-bars');
  streamBars.innerHTML=(data.sessions.length?data.sessions:Array.from({length:8},()=>({progress:4}))).slice(0,8).map(session=>'<i style="height:'+Math.max(8,session.progress||4)+'%"></i>').join('');

  const bars = dashboard.querySelector('.watch-bars');
  const peak = Math.max(1, ...data.watch.daily.map(day => day.minutes));
  bars.innerHTML = data.watch.daily.map(day => '<i title="' + day.date + ': ' + day.minutes + ' min" style="height:' + Math.max(8, Math.round(day.minutes / peak * 100)) + '%"></i>').join('');

  renderTasteIntelligence(data.taste, dashboard.querySelector('.taste-body'));

  const activity = dashboard.querySelector('.activity-list');
  activity.innerHTML = data.activity.length ? data.activity.slice(0,6).map(item => '<div>' + activityVisual(item) + '<p><b>' + deckEscape(item.title) + '</b><small>' + deckEscape(item.detail) + '</small></p><time>' + timeAgo(item.at) + '</time></div>').join('') : '<div class="deck-empty">No recent activity from Plex.</div>';

  bindCommandDeckDetails(data);

  const sync = document.querySelector('#sync-state');
  sync.innerHTML = '<i></i>Live · ' + data.health.latencyMs + ' ms';
  sync.title = 'Click to refresh the Command Deck';
}

async function loadCommandDeck() {
  const sync = document.querySelector('#sync-state');
  if (sync) sync.classList.add('refreshing');
  try {
    const response = await fetch('/api/command-deck');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Command Deck unavailable');
    updateDeck(data);
  } catch (error) {
    if (sync) { sync.innerHTML = '<i class="offline"></i>Deck offline'; sync.title = error.message; }
  } finally { if (sync) sync.classList.remove('refreshing'); }
}

const syncControl = document.querySelector('#sync-state');
if (syncControl) syncControl.addEventListener('click', loadCommandDeck);
loadCommandDeck();
setInterval(() => { if (!document.hidden && location.hash !== '#library' && location.hash !== '#radar') loadCommandDeck(); }, 60000);
