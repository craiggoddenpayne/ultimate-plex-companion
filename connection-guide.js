export function extractPlexToken(value) {
  const text = String(value || '').trim();
  const match = text.match(/(?:^|[?&])X-Plex-Token=([^&#\s]+)/i);
  if (match) { try { return decodeURIComponent(match[1]); } catch { return match[1]; } }
  return text;
}

export function connectionAdvice(message) {
  const text = String(message || '').toLowerCase();
  if (/rejected|401|unauthor/.test(text)) return 'The server responded, but the token was refused. Copy only the value after X-Plex-Token= and try a newly generated token.';
  if (/timed out|8 seconds|timeout/.test(text)) return 'The server address did not answer. Confirm port 32400 is reachable and that a firewall is not blocking the container.';
  if (/reach|refused|fetch failed|resolve|enotfound/.test(text)) return 'Check the address from inside Docker. On Docker Desktop, try host.docker.internal; on a NAS or Linux host, use the Plex server’s LAN IP.';
  if (/json|404|not found/.test(text)) return 'Use the Plex server base address only, such as http://192.168.1.25:32400. Remove /web and any library path.';
  if (/certificate|tls|ssl/.test(text)) return 'Try the server’s HTTP LAN address on port 32400. Local self-signed HTTPS certificates may not validate inside the container.';
  return '';
}

function plexWebUrl(value) {
  try { const url = new URL(String(value || '').trim()); url.pathname = '/web'; url.search = ''; url.hash = ''; return url.toString(); }
  catch { return 'https://app.plex.tv/desktop/'; }
}

function enhanceConnectionModal(modal) {
  if (!modal || modal.dataset.connectionGuide === 'ready') return;
  modal.dataset.connectionGuide = 'ready';
  const form = modal.querySelector('#plex-settings-form');
  const urlInput = form?.elements?.plexUrl;
  const tokenInput = form?.elements?.token;
  const result = modal.querySelector('#connection-result');
  if (!form || !urlInput || !tokenInput || !result) return;

  urlInput.closest('label')?.insertAdjacentHTML('afterend', '<div class="connection-presets"><span>QUICK SERVER ADDRESSES</span><button type="button" data-plex-address="http://host.docker.internal:32400">Docker Desktop</button><button type="button" data-plex-address="http://127.0.0.1:32400">Same machine</button><small>For NAS or another computer, replace the example with that server’s LAN IP.</small></div>');
  tokenInput.closest('label')?.insertAdjacentHTML('afterend', '<div class="token-tools"><button type="button" data-token-paste>Paste from clipboard</button><button type="button" data-token-visibility>Show token</button><span>Only the companion backend stores it.</span></div>');
  modal.querySelector('details')?.replaceWith(Object.assign(document.createElement('section'), { className:'connection-guide', innerHTML:'<header><span>GUIDED CONNECTION</span><h3>Get an X-Plex-Token</h3><p>This uses Plex’s official View XML method. The token remains on your own companion server.</p></header><ol><li><b>Open Plex Web and sign in</b><small>Use the server owner or an account that can access this server.</small></li><li><b>Open any film or episode</b><small>Select More ···, then Get Info.</small></li><li><b>Select View XML</b><small>A new XML page opens. Find X-Plex-Token in its address bar.</small></li><li><b>Copy the value and paste it above</b><small>Copy only the characters after X-Plex-Token=, then test the connection.</small></li></ol><div class="connection-guide-actions"><button type="button" data-open-plex-web>Open Plex Web</button><a href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/" target="_blank" rel="noopener noreferrer">Official token guide ↗</a></div><aside>Plex describes View XML tokens as temporary. If a previously working token is rejected, repeat these steps to generate a fresh one.</aside><div class="connection-diagnosis" hidden><b>CONNECTION ADVICE</b><p></p></div>' }));

  modal.querySelectorAll('[data-plex-address]').forEach(button => button.addEventListener('click', () => { urlInput.value = button.dataset.plexAddress; urlInput.focus(); }));
  modal.querySelector('[data-open-plex-web]').addEventListener('click', () => window.open(plexWebUrl(urlInput.value), '_blank', 'noopener'));
  const pasteButton = modal.querySelector('[data-token-paste]');
  const visibilityButton = modal.querySelector('[data-token-visibility]');
  if (tokenInput.disabled) { pasteButton.disabled = true; visibilityButton.disabled = true; }
  pasteButton.addEventListener('click', async () => {
    try {
      tokenInput.value = extractPlexToken(await navigator.clipboard.readText());
      tokenInput.dispatchEvent(new Event('input', { bubbles:true }));
      tokenInput.focus();
      pasteButton.textContent = tokenInput.value ? 'Token pasted' : 'Clipboard was empty';
    } catch { pasteButton.textContent = 'Clipboard permission needed'; }
  });
  visibilityButton.addEventListener('click', () => {
    const showing = tokenInput.type === 'text';
    tokenInput.type = showing ? 'password' : 'text';
    visibilityButton.textContent = showing ? 'Show token' : 'Hide token';
  });

  const diagnosis = modal.querySelector('.connection-diagnosis');
  const updateAdvice = () => {
    const advice = connectionAdvice(result.textContent);
    diagnosis.hidden = !advice;
    diagnosis.querySelector('p').textContent = advice;
  };
  new MutationObserver(updateAdvice).observe(result, { childList:true, subtree:true, attributes:true });
}

if (typeof document !== 'undefined') {
  const scan = () => enhanceConnectionModal(document.querySelector('#settings-modal .settings-modal'));
  new MutationObserver(scan).observe(document.documentElement, { childList:true, subtree:true });
  scan();
}
