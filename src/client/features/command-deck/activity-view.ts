const escape = (value) => String(value == null ? '' : value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]));

const icons = {
  stream: '<svg class="icon" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>',
  added: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  watched: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></svg>',
};

export function activityVisual(item, variant = 'compact') {
  const type = Object.hasOwn(icons, item?.type) ? item.type : 'added';
  const className = variant === 'timeline' ? 'timeline-activity-icon' : 'activity-icon';
  const content = item?.poster
    ? `<img loading="lazy" src="${escape(item.poster)}" alt="">`
    : icons[type];
  return `<span class="${className} activity-visual ${type}" aria-hidden="true">${content}</span>`;
}
