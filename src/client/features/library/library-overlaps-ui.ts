import { apiFetch } from '../../core/api-client.ts';

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
const bytes = (value) => {
  let size = Number(value) || 0,
    unit = 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  while (size >= 1024 && unit < 4) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit > 2 ? 1 : 0)} ${units[unit]}`;
};
const duration = (value) => {
  const seconds = Math.round((Number(value) || 0) / 1000);
  if (!seconds) return 'Unknown';
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};
const bitrate = (value) => (Number(value) ? `${(Number(value) / 1000).toFixed(1)} Mbps` : 'Unknown');

function qualityScore(copy) {
  const ranks = { '4K': 4, '1080p': 3, '720p': 2, SD: 1 };
  return (ranks[copy.resolution] || 0) * 1e8 + Number(copy.bitrate || 0);
}

export function renderOverlapList(data) {
  const combined = [...data.editions.duplicates, ...data.editions.versioned].slice(0, 30);
  if (!combined.length)
    return '<div class="atlas-none">No duplicate identities or multi-version titles detected.</div>';
  return combined
    .map(
      (item, index) =>
        `<article class="overlap-row"><span class="atlas-thumb">${item.poster ? `<img loading="lazy" src="${esc(item.poster)}" alt="">` : '<i>?</i>'}</span><div class="overlap-identity"><span>${esc(item.kind || 'Potential overlap')}</span><b>${esc(item.title)}</b><small>${esc([item.year, item.libraries?.join(', ') || item.library].filter(Boolean).join(' · '))}</small></div><div class="overlap-glance"><span><b>${item.copyCount || item.copies?.length || 0}</b> FILES</span><span><b>${bytes(item.size)}</b> COMBINED</span></div><button class="overlap-review" data-overlap="${index}">Compare &amp; resolve <b>→</b></button></article>`,
    )
    .join('');
}

function copyCard(copy, index, bestScore) {
  const selectable = copy.ratingKey && copy.mediaId;
  const best = qualityScore(copy) === bestScore;
  return `<article class="overlap-copy" data-copy-card="${index}">
    <header><span>COPY ${String(index + 1).padStart(2, '0')}</span>${best ? '<em>HIGHEST QUALITY</em>' : ''}<strong>${esc(copy.resolution)}</strong></header>
    <div class="copy-format"><b>${esc(copy.fileName)}</b><small>${esc(copy.library)}${copy.edition ? ` · ${esc(copy.edition)}` : ''}</small></div>
    <dl><div><dt>Size</dt><dd>${bytes(copy.size)}</dd></div><div><dt>Video</dt><dd>${esc(copy.videoCodec)} · ${bitrate(copy.bitrate)}</dd></div><div><dt>Frame</dt><dd>${copy.width && copy.height ? `${copy.width} × ${copy.height}` : esc(copy.resolution)}${copy.frameRate ? ` · ${esc(copy.frameRate)}` : ''}</dd></div><div><dt>Dynamic range</dt><dd>${esc(copy.dynamicRange)}</dd></div><div><dt>Audio</dt><dd>${esc(copy.audioCodec)}${copy.audioChannels ? ` · ${copy.audioChannels} ch` : ''}</dd></div><div><dt>Container</dt><dd>${esc(copy.container)}</dd></div><div><dt>Duration</dt><dd>${duration(copy.duration)}</dd></div><div><dt>Plex IDs</dt><dd>${esc(copy.ratingKey)} / ${esc(copy.mediaId || 'Unavailable')}</dd></div></dl>
    <div class="copy-locations"><span>FILE LOCATION${copy.locations?.length > 1 ? 'S' : ''}</span>${(copy.locations || []).map((location) => `<code title="${esc(location)}">${esc(location)}</code>`).join('') || '<code>Location unavailable from Plex</code>'}</div>
    <button type="button" data-select-copy="${index}" ${selectable ? '' : 'disabled'}>${selectable ? 'Choose this copy to delete' : 'Deletion unavailable'}</button>
  </article>`;
}

function toast(message, failed = false) {
  const node = document.createElement('div');
  node.className = `overlap-toast ${failed ? 'failed' : ''}`;
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 4200);
}

function openModal(group, onDeleted) {
  const copies = group.copies || [],
    bestScore = Math.max(...copies.map(qualityScore));
  const wrap = document.createElement('div');
  wrap.className = 'overlap-modal-wrap';
  wrap.innerHTML = `<div class="overlap-backdrop"></div><section class="overlap-modal"><button class="overlap-close" aria-label="Close">×</button><header><span class="eyebrow">EDITION GUARDIAN · DECISION CHAMBER</span><h2>Choose which copy to remove.</h2><p><b>${esc(group.title)}</b> has ${copies.length} media files. Compare every signal before selecting one.</p></header><div class="overlap-warning"><i>!</i><p><b>Plex performs the deletion</b>This removes the selected media file through Plex and cannot be undone. The other copies remain untouched.</p></div><div class="overlap-copy-grid">${copies.map((copy, index) => copyCard(copy, index, bestScore)).join('')}</div><section class="delete-console"><div><span>DELETION TARGET</span><b id="delete-target">No copy selected</b><small id="delete-location">Choose a card above. Nothing has been changed.</small></div><button id="confirm-copy-delete" disabled>Review deletion</button></section></section>`;
  document.body.append(wrap);
  const close = () => wrap.remove();
  wrap.querySelector('.overlap-close').onclick = close;
  wrap.querySelector('.overlap-backdrop').onclick = close;
  let selected = null;
  const confirm = wrap.querySelector('#confirm-copy-delete');
  const validate = () => {
    confirm.disabled = !selected;
  };
  wrap.querySelectorAll('[data-select-copy]').forEach(
    (button) =>
      (button.onclick = () => {
        selected = copies[Number(button.dataset.selectCopy)];
        wrap.querySelectorAll('.overlap-copy').forEach((card) => card.classList.remove('selected'));
        button.closest('.overlap-copy').classList.add('selected');
        wrap.querySelector('#delete-target').textContent = selected.fileName;
        wrap.querySelector('#delete-location').textContent =
          selected.locations?.[0] || 'Plex media version ' + selected.mediaId;
        confirm.textContent = 'Review deletion';
        validate();
      }),
  );
  confirm.onclick = async () => {
    if (!selected) return;
    const where = selected.locations?.[0] || 'this Plex media version';
    if (
      !window.confirm(
        'Are you sure you want to permanently delete “' +
          selected.fileName +
          '”?\n\nLocation: ' +
          where +
          '\n\nThe other copies will remain untouched.',
      )
    )
      return;
    confirm.disabled = true;
    confirm.textContent = 'Deleting through Plex…';
    try {
      const response = await apiFetch('/api/library/overlaps/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratingKey: selected.ratingKey, mediaId: selected.mediaId, confirmed: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Plex could not delete this copy.');
      close();
      toast(result.fileName + ' was deleted through Plex');
      await onDeleted();
    } catch (error) {
      toast(error.message, true);
      confirm.textContent = 'Review deletion';
      validate();
    }
  };
}

export function bindOverlapActions(data, onDeleted) {
  const combined = [...data.editions.duplicates, ...data.editions.versioned].slice(0, 30);
  document
    .querySelectorAll('[data-overlap]')
    .forEach((button) => (button.onclick = () => openModal(combined[Number(button.dataset.overlap)], onDeleted)));
}
