export function normalizeSidebarState(value) {
  return value === 'collapsed' ? 'collapsed' : 'expanded';
}

const storageKey = 'ultimate-plex-companion:sidebar';

function readPreference() {
  try { return normalizeSidebarState(localStorage.getItem(storageKey)); }
  catch { return 'expanded'; }
}

function savePreference(value) {
  try { localStorage.setItem(storageKey, value); }
  catch { /* The layout still works when browser storage is unavailable. */ }
}

function applyState(value, button) {
  const state = normalizeSidebarState(value);
  document.documentElement.dataset.sidebar = state;
  const collapsed = state === 'collapsed';
  button.setAttribute('aria-expanded', String(!collapsed));
  button.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
  button.title = collapsed ? 'Expand navigation' : 'Collapse navigation';
  button.querySelector('span').textContent = collapsed ? 'Expand navigation' : 'Collapse navigation';
}

function setupSidebarCollapse() {
  const sidebar = document.querySelector('.sidebar');
  const brand = sidebar?.querySelector('.brand');
  if (!sidebar || !brand) return false;
  if (sidebar.querySelector('.sidebar-collapse-toggle')) return true;
  brand.insertAdjacentHTML('afterend', '<button class="sidebar-collapse-toggle" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg><span>Collapse navigation</span></button>');
  const button = sidebar.querySelector('.sidebar-collapse-toggle');
  sidebar.querySelectorAll('.nav-link').forEach(link => {
    const label = link.querySelector('span')?.textContent?.trim();
    if (label) { link.dataset.label = label; link.title = label; }
  });
  applyState(readPreference(), button);
  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.sidebar === "collapsed" ? "expanded" : "collapsed";
    applyState(next, button);
    savePreference(next);
  });
  return true;
}

if (typeof document !== 'undefined') {
  const boot = () => {
    document.documentElement.dataset.sidebar = readPreference();
    if (setupSidebarCollapse()) return;
    const observer = new MutationObserver(() => { if (setupSidebarCollapse()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList:true, subtree:true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
