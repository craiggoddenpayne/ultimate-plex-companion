import { apiFetch } from '../../core/api-client.ts';

const profileEscape = (value) =>
  String(value == null ? '' : value).replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
const profileIcons = {
  user: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  settings:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  refresh:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M20 7h-6V1M4 17h6v6"/><path d="M6.5 6.5A8 8 0 0 1 20 7M17.5 17.5A8 8 0 0 1 4 17"/></svg>',
  shield:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
};
let profileData;

async function getProfileData() {
  if (profileData) return profileData;
  const [peopleResult, configResult, encoderResult, deckResult] = await Promise.allSettled([
    apiFetch('/api/people?days=365').then((r) => r.json()),
    apiFetch('/api/config').then((r) => r.json()),
    apiFetch('/api/optimization/config').then((r) => r.json()),
    apiFetch('/api/overview').then((r) => r.json()),
  ]);
  const people = peopleResult.value || {};
  const config = configResult.value || {};
  const encoder = encoderResult.value || {};
  const deck = deckResult.value || {};
  const account = (people.people || [])[0] || {
    name: 'Administrator',
    initials: 'AD',
    plays: 0,
    movies: 0,
    episodes: 0,
  };
  profileData = { account, config, encoder, deck };
  return profileData;
}

function updateProfileIdentity(data) {
  const button = document.querySelector('.profile');
  if (!button) return;
  const display = data.account.name || 'Administrator';
  button.querySelector('.avatar').textContent = data.account.initials || display.slice(0, 2).toUpperCase();
  button.querySelector('span:nth-child(2) b').textContent = display;
  button.querySelector('span:nth-child(2) small').textContent = 'Plex administrator';
}

function menuMarkup(data) {
  return (
    '<div class="profile-popover" id="profile-popover" role="menu"><div class="popover-identity"><span>' +
    profileEscape(data.account.initials) +
    '</span><div><b>' +
    profileEscape(data.account.name) +
    '</b><small>Plex administrator</small></div><i></i></div><div class="popover-status"><span><i></i>Plex connected</span><b>' +
    profileEscape(data.deck.server?.name || 'Plex server') +
    '</b></div><button role="menuitem" data-profile-action="overview">' +
    profileIcons.user +
    '<span><b>Profile overview</b><small>Activity and access</small></span></button><button role="menuitem" data-profile-action="settings">' +
    profileIcons.settings +
    '<span><b>Connection settings</b><small>Plex and encoder</small></span></button><button role="menuitem" data-profile-action="themes">' +
    profileIcons.settings +
    '<span><b>Appearance &amp; themes</b><small>Palette and visual energy</small></span></button><button role="menuitem" data-profile-action="privacy">' +
    profileIcons.shield +
    '<span><b>Privacy & data</b><small>What stays local</small></span></button><button role="menuitem" data-profile-action="refresh">' +
    profileIcons.refresh +
    '<span><b>Refresh companion</b><small>Reload every signal</small></span></button><footer>ULTIMATE PLEX COMPANION <b>0.1.0</b></footer></div>'
  );
}

function overviewMarkup(data, privacyOnly) {
  const account = data.account;
  const deck = data.deck;
  const config = data.config;
  const encoder = data.encoder;
  return (
    '<div class="modal-wrap" id="profile-modal"><div class="modal-backdrop"></div><section class="profile-modal"><button class="modal-close">×</button><div class="profile-modal-head"><span class="large-profile-avatar">' +
    profileEscape(account.initials) +
    '</span><div><span class="eyebrow">' +
    (privacyOnly ? 'PRIVACY CENTRE' : 'ADMINISTRATOR PROFILE') +
    '</span><h2>' +
    profileEscape(privacyOnly ? 'Your data stays yours.' : account.name) +
    '</h2><p>' +
    (privacyOnly
      ? 'A transparent view of what Companion reads and where it is stored.'
      : 'The operational identity connected to your Plex universe.') +
    '</p></div></div>' +
    (privacyOnly ? privacyContent() : overviewContent(account, deck, config, encoder)) +
    '<div class="profile-modal-actions"><button class="test-button" data-close>Close</button><button class="primary-button" data-manage>Manage connection</button></div></section></div>'
  );
}

function overviewContent(account, deck, config, encoder) {
  let host = 'Not configured';
  try {
    host = new URL(config.plexUrl).host;
  } catch {}
  return (
    '<div class="profile-stat-grid"><article><span>HISTORY SAMPLE</span><b>' +
    Number(account.plays || 0).toLocaleString() +
    '</b><small>plays analysed</small></article><article><span>MOVIES</span><b>' +
    Number(account.movies || 0).toLocaleString() +
    '</b><small>recent plays</small></article><article><span>EPISODES</span><b>' +
    Number(account.episodes || 0).toLocaleString() +
    '</b><small>recent plays</small></article></div><div class="profile-connections"><div><span>' +
    profileIcons.shield +
    '</span><p><b>Plex Media Server</b><small>' +
    profileEscape(deck.server?.name || host) +
    ' · ' +
    profileEscape(deck.server?.version || 'Connected') +
    '</small></p><em>ONLINE</em></div><div><span>' +
    profileIcons.settings +
    '</span><p><b>HEVC optimization engine</b><small>CRF ' +
    profileEscape(encoder.crf || 20) +
    ' · ' +
    profileEscape(encoder.preset || 'medium') +
    ' preset</small></p><em class="' +
    (encoder.encoderAvailable ? '' : 'muted') +
    '">' +
    (encoder.encoderAvailable ? 'READY' : 'OFFLINE') +
    '</em></div></div>'
  );
}

function privacyContent() {
  return (
    '<div class="privacy-list"><div><span>' +
    profileIcons.shield +
    '</span><p><b>Plex token</b><small>Stored by the local backend with restrictive permissions. It is never returned to this browser.</small></p><em>LOCAL</em></div><div><span>' +
    profileIcons.user +
    '</span><p><b>Viewing history</b><small>Read directly from Plex to create household insights. It is not sent to an external analytics service.</small></p><em>LOCAL</em></div><div><span>' +
    profileIcons.settings +
    '</span><p><b>Media operations</b><small>Encoding happens on your machine. Original deletion always requires a clear “Are you sure?” confirmation.</small></p><em>GUARDED</em></div></div><div class="auth-notice"><b>Companion authentication is not enabled yet.</b><p>Anyone who can reach this web interface can currently use administrator controls. Keep the port private to your trusted network.</p></div>'
  );
}

function openProfileModal(data, privacyOnly = false) {
  document.querySelector('#profile-popover')?.remove();
  document.body.insertAdjacentHTML('beforeend', overviewMarkup(data, privacyOnly));
  const modal = document.querySelector('#profile-modal');
  const close = () => modal.remove();
  modal.querySelector('.modal-backdrop').addEventListener('click', close);
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('[data-close]').addEventListener('click', close);
  modal.querySelector('[data-manage]').addEventListener('click', () => {
    close();
    document.querySelector('.top-actions [data-action="settings"]').click();
  });
}

function bindMenu(data) {
  const menu = document.querySelector('#profile-popover');
  menu.querySelector('[data-profile-action="overview"]').addEventListener('click', () => openProfileModal(data));
  menu.querySelector('[data-profile-action="privacy"]').addEventListener('click', () => openProfileModal(data, true));
  menu.querySelector('[data-profile-action="settings"]').addEventListener('click', () => {
    menu.remove();
    document.querySelector('.top-actions [data-action="settings"]').click();
  });
  menu.querySelector('[data-profile-action="themes"]').addEventListener('click', () => {
    menu.remove();
    document.dispatchEvent(new CustomEvent('opencompanionthemes'));
  });
  menu.querySelector('[data-profile-action="refresh"]').addEventListener('click', () => {
    const button = menu.querySelector('[data-profile-action="refresh"] small');
    button.textContent = 'Refreshing…';
    profileData = null;
    setTimeout(() => location.reload(), 250);
  });
}

async function toggleProfile(event) {
  event.stopPropagation();
  const existing = document.querySelector('#profile-popover');
  if (existing) {
    existing.remove();
    event.currentTarget.setAttribute('aria-expanded', 'false');
    return;
  }
  const button = event.currentTarget;
  button.classList.add('loading');
  try {
    const data = await getProfileData();
    updateProfileIdentity(data);
    document.querySelector('.sidebar-foot').insertAdjacentHTML('beforeend', menuMarkup(data));
    bindMenu(data);
    button.setAttribute('aria-expanded', 'true');
  } finally {
    button.classList.remove('loading');
  }
}

const profileButton = document.querySelector('.profile');
if (profileButton) {
  profileButton.setAttribute('aria-haspopup', 'menu');
  profileButton.setAttribute('aria-expanded', 'false');
  profileButton.addEventListener('click', toggleProfile);
  getProfileData()
    .then(updateProfileIdentity)
    .catch(() => {});
}
document.addEventListener('click', (event) => {
  const target = event.target as Node;
  const menu = document.querySelector('#profile-popover');
  if (menu && !menu.contains(target) && !profileButton.contains(target)) {
    menu.remove();
    profileButton.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    document.querySelector('#profile-popover')?.remove();
    document.querySelector('#profile-modal')?.remove();
    profileButton?.setAttribute('aria-expanded', 'false');
  }
});
