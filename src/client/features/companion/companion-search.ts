import { navigation } from '../../../shared/feature-registry.ts';

const aliases = {
  dashboard: 'home overview status command',
  server: 'technical diagnostics network plex',
  intel: 'utilities analyzers tools',
  metadata: 'repair artwork summaries matching',
  codec: 'encode conversion queue transcode',
  library: 'storage duplicates editions pulse',
  downloads: 'save media files',
  streams: 'sessions playback bandwidth live',
  people: 'household users devices access',
  radar: 'discover recommendations movies',
  playlists: 'studio generator queues',
  automation: 'recipes scheduled rules results reports',
  lab: 'experiments cultural future',
};

export function companionDestinations(query) {
  const words = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];
  return navigation
    .filter(([id, , label]) => {
      const haystack = `${id} ${label} ${aliases[id] || ''}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    })
    .map(([id, , label]) => ({
      kind: 'route',
      route: id,
      type: 'companion page',
      title: label,
      detail: `Open ${label}`,
    }));
}
