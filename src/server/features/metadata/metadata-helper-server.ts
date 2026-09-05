const typeCodes = { movie: 1, show: 2, season: 3, episode: 4, artist: 8, album: 9, track: 10 };
const textFields = ['title', 'summary', 'tagline', 'contentRating', 'studio', 'originallyAvailableAt'];

function cleanText(value, max = 500) {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z'));
}

export function publicMetadata(item) {
  const genres = (item.Genre || []).map((entry) => entry.tag).filter(Boolean);
  const missing = [];
  if (!item.thumb) missing.push('artwork');
  if (!item.summary) missing.push('summary');
  if (!item.year && !item.grandparentYear) missing.push('year');
  if (item.type === 'movie' && !genres.length) missing.push('genres');
  return {
    ratingKey: String(item.ratingKey || ''),
    libraryKey: String(item.librarySectionID || ''),
    type: item.type || 'movie',
    title: item.title || '',
    parentTitle: item.grandparentTitle || '',
    summary: item.summary || '',
    year: item.year || null,
    genres,
    tagline: item.tagline || '',
    contentRating: item.contentRating || '',
    studio: item.studio || '',
    originallyAvailableAt: item.originallyAvailableAt || '',
    poster: item.thumb ? `/api/art/${item.ratingKey}` : null,
    missing,
  };
}

export function metadataUpdate(item, input: any = {}) {
  const ratingKey = String(item.ratingKey || '');
  const libraryKey = String(item.librarySectionID || input.libraryKey || '');
  const type = typeCodes[item.type] || Number(input.typeCode) || 1;
  if (!/^\d+$/.test(ratingKey) || !/^\d+$/.test(libraryKey))
    throw new Error('Plex metadata identifiers are unavailable for this item.');
  const params = new URLSearchParams({ type: String(type), id: ratingKey });
  const changed = [];
  for (const field of textFields) {
    if (!(field in input)) continue;
    const value = cleanText(input[field], field === 'summary' ? 10000 : 500);
    if (field === 'title' && !value) throw new Error('Title cannot be empty.');
    if (field === 'originallyAvailableAt' && value && !validDate(value))
      throw new Error('Release date must use YYYY-MM-DD.');
    params.set(`${field}.value`, value);
    params.set(`${field}.locked`, '1');
    changed.push(field);
  }
  if ('year' in input) {
    const year = Number(input.year);
    if (!Number.isInteger(year) || year < 1870 || year > 2200) throw new Error('Year must be between 1870 and 2200.');
    params.set('year.value', String(year));
    params.set('year.locked', '1');
    changed.push('year');
  }
  if ('genres' in input) {
    const genres: string[] = [
      ...new Set<string>(
        (Array.isArray(input.genres) ? input.genres : String(input.genres).split(','))
          .map((value) => cleanText(value, 80))
          .filter(Boolean),
      ),
    ].slice(0, 12);
    if (!genres.length) throw new Error('Add at least one genre.');
    params.set('genre.locked', '1');
    genres.forEach((genre, index) => params.set(`genre[${index}].tag.tag`, genre));
    changed.push('genres');
  }
  let posterUrl = null;
  if ('posterUrl' in input && cleanText(input.posterUrl, 2048)) {
    const parsed = new URL(cleanText(input.posterUrl, 2048));
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Artwork must use an HTTP or HTTPS URL.');
    posterUrl = parsed.toString();
    changed.push('artwork');
  }
  if (!changed.length) throw new Error('Make at least one metadata change.');
  return {
    path: `/library/sections/${libraryKey}/all?${params}`,
    posterPath: posterUrl ? `/library/metadata/${ratingKey}/posters?${new URLSearchParams({ url: posterUrl })}` : null,
    changed,
  };
}
