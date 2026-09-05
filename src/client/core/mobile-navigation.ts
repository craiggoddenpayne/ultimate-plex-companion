export function mobileNavShouldLock(isMobile, isOpen) {
  return Boolean(isMobile && isOpen);
}

function setupMobileNavigation() {
  const sidebar = document.querySelector('.sidebar');
  const launcher = document.querySelector('.mobile-brand');
  if (!sidebar || !launcher) return false;
  if (document.querySelector('.mobile-nav-backdrop')) return true;

  document.body.insertAdjacentHTML(
    'beforeend',
    '<button class="mobile-nav-backdrop" type="button" aria-label="Close navigation"></button>',
  );
  sidebar.insertAdjacentHTML(
    'beforeend',
    '<button class="mobile-nav-close" type="button" aria-label="Close navigation"><span></span><span></span></button>',
  );
  const backdrop = document.querySelector('.mobile-nav-backdrop');
  const closeButton = sidebar.querySelector('.mobile-nav-close');
  const mobile = window.matchMedia('(max-width: 760px)');

  const sync = () => {
    const open = sidebar.classList.contains('open');
    document.body.classList.toggle('mobile-nav-open', mobileNavShouldLock(mobile.matches, open));
    launcher.setAttribute('aria-expanded', String(mobile.matches && open));
  };
  const close = () => {
    sidebar.classList.remove('open');
    sync();
  };

  launcher.setAttribute('aria-controls', 'primary-navigation');
  launcher.setAttribute('aria-expanded', 'false');
  sidebar.querySelector('nav')?.setAttribute('id', 'primary-navigation');
  launcher.addEventListener('click', () => requestAnimationFrame(sync));
  backdrop.addEventListener('click', close);
  closeButton.addEventListener('click', close);
  sidebar.querySelectorAll('[data-nav]').forEach((link) => link.addEventListener('click', close));
  mobile.addEventListener?.('change', () => {
    if (!mobile.matches) close();
    else sync();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('mobile-nav-open')) close();
  });
  return true;
}

if (typeof document !== 'undefined') {
  const boot = () => {
    if (setupMobileNavigation()) return;
    const observer = new MutationObserver(() => {
      if (setupMobileNavigation()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
