const moodGenres = {
  any: [],
  intense: ['Thriller', 'Action', 'Crime', 'Horror'],
  comfort: ['Comedy', 'Family', 'Animation', 'Romance'],
  mindbend: ['Science Fiction', 'Mystery', 'Fantasy'],
  epic: ['Adventure', 'Action', 'History', 'War'],
  funny: ['Comedy'],
  real: ['Documentary', 'History', 'Biography', 'Music'],
};

function stableNoise(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 1000) / 1000;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.floor(parsed))) : fallback;
}

export function buildDiscoveryRecommendations(catalog, options: any = {}, now = Date.now() / 1000) {
  const mood = moodGenres[options.mood] ? options.mood : 'any';
  const mode = ['tonight', 'hidden', 'top', 'recent', 'surprise'].includes(options.mode) ? options.mode : 'tonight';
  const maxMinutes = boundedInteger(options.maxMinutes, 180, 45, 300);
  const unwatchedOnly = options.unwatchedOnly !== 'false';
  const offset = boundedInteger(options.offset, 0, 0, 10_000);
  const limit = boundedInteger(options.limit, 18, 6, 48);
  const date = new Date(now * 1000).toISOString().slice(0, 10);
  const ranked = catalog
    .map((item) => {
      const genres = (item.Genre || []).map((genre) => genre.tag).filter(Boolean);
      const durationMinutes = Math.round(Number(item.duration || 0) / 60_000);
      const rating = Number(item.audienceRating || item.rating || 0);
      const watched = Number(item.viewCount || 0) > 0;
      const moodMatches = moodGenres[mood].filter((genre) => genres.includes(genre));
      let score = 35 + rating * 3 + (watched ? -5 : 8) + moodMatches.length * 8;
      const ageDays = item.addedAt ? (now - Number(item.addedAt)) / 86400 : 9999;
      if (mode === 'hidden') score += watched ? -18 : 8 + Math.min(5, rating / 2);
      if (mode === 'top') score += rating * 2;
      if (mode === 'recent') score += Math.max(0, 14 - ageDays / 20);
      if (mode === 'surprise') score += stableNoise(`${item.ratingKey}-${date}`) * 14;
      if (durationMinutes && durationMinutes <= maxMinutes)
        score += Math.max(1, 5 - (maxMinutes - durationMinutes) / 30);
      const reasons = [];
      if (moodMatches.length) reasons.push(`matches ${moodMatches.slice(0, 2).join(' + ').toLowerCase()} mood`);
      if (!watched) reasons.push('unwatched in your library');
      if (rating >= 8) reasons.push(`${rating.toFixed(1)} audience rating`);
      if (durationMinutes <= maxMinutes) reasons.push(`fits your ${maxMinutes}-minute window`);
      if (mode === 'recent' && ageDays < 90) reasons.push('recently added');
      return { item, score, genres, durationMinutes, rating, watched, reasons };
    })
    .filter(
      (result) =>
        (!unwatchedOnly || !result.watched) && result.durationMinutes > 0 && result.durationMinutes <= maxMinutes,
    )
    .sort((a, b) => b.score - a.score || String(a.item.ratingKey).localeCompare(String(b.item.ratingKey)));
  const totalMatches = ranked.length;
  const page = ranked.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < totalMatches;

  return {
    catalogSize: catalog.length,
    mood,
    mode,
    maxMinutes,
    unwatchedOnly,
    offset,
    limit,
    totalMatches,
    hasMore,
    nextOffset: hasMore ? nextOffset : null,
    results: page.map(({ item, genres, durationMinutes, rating, watched, reasons, score }) => ({
      ratingKey: item.ratingKey,
      title: item.title,
      year: item.year || null,
      summary: item.summary || '',
      library: item.libraryTitle,
      genres: genres.slice(0, 4),
      durationMinutes,
      rating,
      watched,
      score: Math.min(99, Math.max(50, Math.round(score))),
      reason: reasons.length ? reasons.slice(0, 3).join(' · ') : 'a strong fit from your Plex library',
      poster: `/api/art/${item.ratingKey}`,
      plexUrl: `/api/plex/open/${item.ratingKey}`,
    })),
  };
}
