let metadataCenterCache;
const currentYear = new Date().getFullYear();

function title(item) {
  return item.grandparentTitle ? `${item.grandparentTitle} · ${item.title}` : item.title || 'Untitled record';
}
function issue(code, label, kind, severity = 'medium') {
  return { code, label, kind, severity };
}
function validCalendarDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  );
}
function inspect(item, library) {
  const genres = (item.Genre || []).map((entry) => entry.tag).filter(Boolean),
    year = Number(item.year || item.grandparentYear || 0),
    releaseDate = String(item.originallyAvailableAt || ''),
    summary = String(item.summary || '').trim(),
    name = String(item.title || '').trim(),
    media = item.Media || [],
    duration = Number(item.duration || media.find((entry) => Number(entry.duration || 0))?.duration || 0),
    problems = [];
  if (!item.thumb) problems.push(issue('missing-artwork', 'Missing artwork', 'missing', 'high'));
  if (!summary) problems.push(issue('missing-summary', 'Missing summary', 'missing'));
  else if (library.type === 'movie' && summary.length < 35)
    problems.push(issue('weak-summary', 'Summary is unusually short', 'invalid', 'low'));
  if (!year) problems.push(issue('missing-year', 'Missing year', 'missing'));
  else if (year < 1888 || year > currentYear + 2)
    problems.push(issue('invalid-year', `Suspicious year: ${year}`, 'invalid', 'high'));
  if (library.type === 'movie' && !genres.length) problems.push(issue('missing-genres', 'Missing genres', 'missing'));
  if (!name) problems.push(issue('missing-title', 'Missing title', 'missing', 'high'));
  else if (/[._]{2,}|\b(2160p|1080p|720p|bluray|webrip|x26[45])\b/i.test(name))
    problems.push(issue('filename-title', 'Title resembles a filename', 'invalid', 'medium'));
  if (!releaseDate) problems.push(issue('missing-release-date', 'Missing release date', 'missing'));
  else if (!validCalendarDate(releaseDate))
    problems.push(issue('invalid-date', 'Invalid release date', 'invalid', 'high'));
  else if (year && Number(releaseDate.slice(0, 4)) !== year)
    problems.push(issue('year-date-mismatch', `Year conflicts with release date: ${releaseDate}`, 'invalid', 'high'));
  if (!String(item.contentRating || '').trim())
    problems.push(issue('missing-content-rating', 'Missing content rating', 'missing', 'low'));
  if (library.type === 'movie' && !String(item.studio || '').trim())
    problems.push(issue('missing-studio', 'Missing studio', 'missing', 'low'));
  if (library.type === 'movie' && !String(item.tagline || '').trim())
    problems.push(issue('missing-tagline', 'Missing tagline', 'missing', 'low'));
  if (!media.length) problems.push(issue('missing-media', 'No media file attached', 'missing', 'high'));
  else if (!Number.isFinite(duration) || duration <= 0)
    problems.push(issue('invalid-runtime', 'Missing or invalid runtime', 'invalid', 'high'));
  if (item.type === 'episode') {
    if (item.parentIndex == null || !Number.isInteger(Number(item.parentIndex)) || Number(item.parentIndex) < 0)
      problems.push(issue('missing-season-number', 'Missing season number', 'missing', 'high'));
    if (item.index == null || !Number.isInteger(Number(item.index)) || Number(item.index) < 0)
      problems.push(issue('missing-episode-number', 'Missing episode number', 'missing', 'high'));
  }
  if (!item.guid || String(item.guid).startsWith('local://'))
    problems.push(issue('local-match', 'No external metadata match', 'invalid', 'low'));
  if (!problems.length) return null;
  const severity = problems.some((entry) => entry.severity === 'high')
    ? 'high'
    : problems.some((entry) => entry.severity === 'medium')
      ? 'medium'
      : 'low';
  return {
    ratingKey: String(item.ratingKey || ''),
    title: title(item),
    year: year || null,
    libraryKey: String(library.key || ''),
    library: library.title,
    type: item.type || library.type,
    poster: item.thumb ? `/api/art/${item.ratingKey}` : null,
    plexUrl: item.ratingKey ? `/api/plex/open/${item.ratingKey}` : null,
    summary,
    genres,
    problems,
    severity,
  };
}

export function invalidateMetadataCenter() {
  metadataCenterCache = null;
}

export async function metadataCenter(config, { plexFetch, libraryItems }, force = false) {
  if (!force && metadataCenterCache && Date.now() - metadataCenterCache.createdAt < 10 * 60_000)
    return metadataCenterCache.data;
  const sections = await plexFetch(config, '/library/sections'),
    libraries = (sections.MediaContainer?.Directory || []).filter((item) => ['movie', 'show'].includes(item.type));
  const catalogs = await Promise.all(libraries.map((library) => libraryItems(config, library)));
  const batches = catalogs.map((items, index) => items.map((item) => inspect(item, libraries[index])).filter(Boolean));
  const issues = batches
    .flat()
    .sort(
      (a, b) =>
        ({ high: 3, medium: 2, low: 1 })[b.severity] - { high: 3, medium: 2, low: 1 }[a.severity] ||
        b.problems.length - a.problems.length,
    );
  const counts = new Map();
  for (const item of issues)
    for (const problem of item.problems)
      counts.set(problem.code, { ...problem, count: (counts.get(problem.code)?.count || 0) + 1 });
  const categories = [...counts.values()].sort((a, b) => b.count - a.count);
  const missing = issues.filter((item) => item.problems.some((problem) => problem.kind === 'missing')).length,
    invalid = issues.filter((item) => item.problems.some((problem) => problem.kind === 'invalid')).length;
  const totalItems = catalogs.reduce((sum, items) => sum + items.length, 0);
  const libraryHealth = libraries.map((library, index) => {
    const scanned = catalogs[index].length;
    const libraryIssues = batches[index];
    const healthy = Math.max(0, scanned - libraryIssues.length);
    return {
      key: String(library.key),
      title: library.title,
      type: library.type,
      scanned,
      issues: libraryIssues.length,
      highPriority: libraryIssues.filter((item) => item.severity === 'high').length,
      health: scanned ? Math.round((healthy / scanned) * 100) : 100,
    };
  });
  const data = {
    generatedAt: new Date().toISOString(),
    scanned: totalItems,
    healthy: Math.max(0, totalItems - issues.length),
    health: totalItems ? Math.round((Math.max(0, totalItems - issues.length) / totalItems) * 100) : 100,
    issueCount: issues.length,
    missing,
    invalid,
    libraries: libraryHealth,
    categories,
    issues: issues.slice(0, 500),
  };
  metadataCenterCache = { createdAt: Date.now(), data };
  return data;
}
