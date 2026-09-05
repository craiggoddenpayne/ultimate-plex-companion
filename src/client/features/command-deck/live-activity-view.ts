const escape = (value) => String(value == null ? '' : value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]));

const playIcon = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';

export function compactStreamMarkup(stream) {
  const progress = Math.min(100, Math.max(0, Number(stream.progress || 0)));
  const user = String(stream.user || 'Unknown');
  const artwork = stream.poster ? `<img loading="eager" src="${escape(stream.poster)}" alt="">` : '';
  return `<article class="stream-card ${escape(stream.tone || 'amber')}"><div class="poster">${artwork}<span>${playIcon}</span></div><div class="stream-main"><div class="stream-title"><div><h3>${escape(stream.title || 'Unknown title')}</h3><p>${escape(stream.meta || stream.mode || '')}</p></div><span class="live-pill">LIVE</span></div><div class="stream-person"><span class="mini-avatar">${escape(user.charAt(0).toUpperCase())}</span><span>${escape(user)}<small>${escape(stream.device || 'Plex client')}</small></span><b>${Math.round(progress)}%</b></div><div class="progress"><i style="width:${progress}%"></i></div></div></article>`;
}

export function compactStreamList(sessions = []) {
  return sessions.length
    ? sessions.map(compactStreamMarkup).join('')
    : '<div class="empty-state connected">Plex is connected. Nothing is playing right now.</div>';
}
