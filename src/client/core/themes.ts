import { BACKGROUND_VISUALIZATIONS, COMPANION_THEMES, normalizeThemePreferences } from '../../shared/theme-model.ts';

const storageKey = 'ultimate-plex-companion:appearance';
const themeEscape = (value) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[char],
  );

let preferences = loadPreferences();

function loadPreferences() {
  try {
    return normalizeThemePreferences(JSON.parse(localStorage.getItem(storageKey) || '{}'));
  } catch {
    return normalizeThemePreferences();
  }
}

function applyPreferences(next, { persist = true, announce = false } = {}) {
  preferences = normalizeThemePreferences(next);
  const selected = COMPANION_THEMES.find((item) => item.id === preferences.theme);
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.dataset.themeMode = selected.mode;
  document.documentElement.dataset.effects = preferences.effects;
  document.documentElement.dataset.textSize = preferences.textSize;
  document.documentElement.dataset.background = preferences.background;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', selected.preview[0]);
  if (persist) localStorage.setItem(storageKey, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent('companionthemechange', { detail: { ...preferences, mode: selected.mode } }));
  if (announce) themeToast(`${selected.name} theme active`);
}

function paletteIcon() {
  return '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18h1.3a1.7 1.7 0 0 0 0-3.4h-.7a1.4 1.4 0 0 1 0-2.8H15A6 6 0 0 0 21 9c0-3.3-4-6-9-6Z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="10" cy="6.8" r=".8"/><circle cx="15" cy="7" r=".8"/></svg>';
}

function themeCard(item) {
  const active = item.id === preferences.theme;
  const style = `--preview:${item.colour};--preview-bg:${item.preview[0]};--preview-panel:${item.preview[1]}`;
  return `<button class="theme-card ${item.mode}-preview ${active ? 'active' : ''}" data-theme-choice="${item.id}" style="${style}" aria-pressed="${active}"><span class="theme-card-preview"><i></i><i></i><i></i><em></em></span><span class="theme-card-heading"><b>${themeEscape(item.name)}</b><mark>${item.mode}</mark></span><small>${themeEscape(item.tagline)}</small><span class="theme-swatches">${item.swatches.map((colour) => `<i style="background:${colour}"></i>`).join('')}</span><strong>${active ? 'ACTIVE' : 'SELECT'}</strong></button>`;
}

function modalMarkup() {
  const effectOptions = [
    ['full', 'Full energy'],
    ['ambient', 'Ambient'],
    ['still', 'Still'],
  ]
    .map(
      ([value, label]) =>
        `<button data-effect-choice="${value}" class="${preferences.effects === value ? 'active' : ''}"><i></i>${label}</button>`,
    )
    .join('');
  const textOptions = [
    ['standard', 'Standard'],
    ['comfortable', 'Comfortable'],
    ['large', 'Large'],
    ['extra-large', 'Extra large'],
  ]
    .map(
      ([value, label]) =>
        `<button data-text-choice="${value}" class="${preferences.textSize === value ? 'active' : ''}" aria-pressed="${preferences.textSize === value}"><i></i>${label}</button>`,
    )
    .join('');
  const backgroundOptions = BACKGROUND_VISUALIZATIONS.map(
    (item) =>
      `<button data-background-choice="${item.id}" class="background-choice ${preferences.background === item.id ? 'active' : ''}" aria-pressed="${preferences.background === item.id}"><span class="background-preview ${item.id}"><i></i><i></i><i></i></span><b>${themeEscape(item.name)}</b><small>${themeEscape(item.tagline)}</small></button>`,
  ).join('');
  return `<div class="theme-modal-wrap"><div class="theme-backdrop"></div><section class="theme-modal" role="dialog" aria-modal="true" aria-labelledby="theme-title"><button class="theme-close" aria-label="Close">×</button><header><div class="theme-prism"><i></i><i></i><i></i></div><div><span class="eyebrow">VISUAL SYSTEM · 15 ENVIRONMENTS</span><h2 id="theme-title">Choose your universe.</h2><p>Every command surface, signal and ambient light responds instantly.</p></div></header><div class="theme-grid">${COMPANION_THEMES.map(themeCard).join('')}</div><section class="background-control"><div><span>BACKGROUND VISUALIZER</span><h3>Set the space behind your library</h3><p>One lightweight canvas renders the selected scene behind every control.</p></div><div class="background-options">${backgroundOptions}</div></section><div class="theme-preference-grid"><section class="effect-control"><div><span>VISUAL ENERGY</span><h3>Control ambient motion</h3><p>Still mode pauses decorative animation while preserving the complete interface.</p></div><div class="effect-options">${effectOptions}</div></section><section class="effect-control typography-control"><div><span>TEXT SIZE</span><h3>Make every signal readable</h3><p>Adjust type independently without enlarging artwork, panels or navigation.</p></div><div class="effect-options text-options">${textOptions}</div></section></div><footer><span>Saved on this browser · No account data leaves your network</span><button class="theme-reset">Restore defaults</button><button class="theme-done">Done</button></footer></section></div>`;
}

function themeToast(message) {
  let region = document.querySelector('#toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    document.body.append(region);
  }
  const node = document.createElement('div');
  node.className = 'toast theme-toast';
  node.innerHTML = `${paletteIcon()}<span>${themeEscape(message)}</span>`;
  region.append(node);
  setTimeout(() => node.remove(), 3000);
}

function refreshThemeCards(wrap) {
  wrap.querySelectorAll('.theme-card').forEach((card) => {
    const active = card.dataset.themeChoice === preferences.theme;
    card.classList.toggle('active', active);
    card.setAttribute('aria-pressed', String(active));
    card.querySelector('strong').textContent = active ? 'ACTIVE' : 'SELECT';
  });
}

export function openThemeStudio() {
  document.querySelector('.theme-modal-wrap')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalMarkup());
  const wrap = document.querySelector('.theme-modal-wrap');
  const close = () => wrap.remove();
  wrap.querySelector('.theme-close').onclick = close;
  wrap.querySelector('.theme-backdrop').onclick = close;
  wrap.querySelector('.theme-done').onclick = close;
  wrap.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.onclick = () => {
      applyPreferences({ ...preferences, theme: button.dataset.themeChoice }, { announce: true });
      refreshThemeCards(wrap);
    };
  });
  wrap.querySelectorAll('[data-effect-choice]').forEach((button) => {
    button.onclick = () => {
      applyPreferences({ ...preferences, effects: button.dataset.effectChoice });
      wrap
        .querySelectorAll('[data-effect-choice]')
        .forEach((item) => item.classList.toggle('active', item.dataset.effectChoice === preferences.effects));
    };
  });
  wrap.querySelectorAll('[data-background-choice]').forEach((button) => {
    button.onclick = () => {
      applyPreferences({ ...preferences, background: button.dataset.backgroundChoice });
      wrap.querySelectorAll('[data-background-choice]').forEach((item) => {
        const active = item.dataset.backgroundChoice === preferences.background;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
    };
  });
  wrap.querySelectorAll('[data-text-choice]').forEach((button) => {
    button.onclick = () => {
      applyPreferences({ ...preferences, textSize: button.dataset.textChoice });
      themeToast(`${button.textContent.trim()} text active`);
      wrap.querySelectorAll('[data-text-choice]').forEach((item) => {
        const active = item.dataset.textChoice === preferences.textSize;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
    };
  });
  wrap.querySelector('.theme-reset').onclick = () => {
    close();
    applyPreferences(
      { theme: 'solaris', effects: 'full', textSize: 'comfortable', background: 'starfield' },
      { announce: true },
    );
  };
  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  wrap.querySelector('.theme-close').focus();
}

function installLaunchers() {
  const actions = document.querySelector('.top-actions');
  if (actions && !actions.querySelector('[data-action="themes"]')) {
    const button = document.createElement('button');
    button.className = 'icon-button theme-launcher';
    button.dataset.action = 'themes';
    button.setAttribute('aria-label', 'Appearance and themes');
    button.innerHTML = paletteIcon();
    button.onclick = openThemeStudio;
    actions.insertBefore(button, actions.lastElementChild);
  }
  document.addEventListener('opencompanionthemes', openThemeStudio);
  document.addEventListener('keydown', (event) => {
    if (event.shiftKey && event.key.toLowerCase() === 't' && !/input|textarea|select/i.test(event.target.tagName)) {
      event.preventDefault();
      openThemeStudio();
    }
  });
}

applyPreferences(preferences, { persist: false });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installLaunchers);
else installLaunchers();
