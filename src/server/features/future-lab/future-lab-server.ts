import {
  buildArchiveAnomalies,
  buildMemoryLane,
  buildMoodWeather,
  buildRuntimeWormhole,
} from './future-lab-experiments.ts';

let labCache;

function countTags(items, field) {
  const counts = new Map();
  for (const item of items)
    for (const value of item[field] || []) if (value.tag) counts.set(value.tag, (counts.get(value.tag) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function buildGraph(items) {
  const genres = countTags(items, 'Genre').slice(0, 9);
  const directors = countTags(items, 'Director').slice(0, 7);
  const genreNames = new Set(genres.map((item) => item[0]));
  const directorNames = new Set(directors.map((item) => item[0]));
  const nodes = [
    ...genres.map(([label, count], index) => ({ id: `g-${index}`, label, count, type: 'genre' })),
    ...directors.map(([label, count], index) => ({ id: `d-${index}`, label, count, type: 'director' })),
  ];
  const idByLabel = new Map(nodes.map((node) => [node.label, node.id]));
  const edgeCounts = new Map();
  for (const item of items) {
    const itemGenres = (item.Genre || [])
      .map((x) => x.tag)
      .filter((x) => genreNames.has(x))
      .slice(0, 3);
    const itemDirectors = (item.Director || [])
      .map((x) => x.tag)
      .filter((x) => directorNames.has(x))
      .slice(0, 2);
    for (const genre of itemGenres)
      for (const director of itemDirectors) {
        const key = idByLabel.get(genre) + '|' + idByLabel.get(director);
        edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
      }
    for (let a = 0; a < itemGenres.length; a++)
      for (let b = a + 1; b < itemGenres.length; b++) {
        const key = [idByLabel.get(itemGenres[a]), idByLabel.get(itemGenres[b])].sort().join('|');
        edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
      }
  }
  const edges = [...edgeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 38)
    .map(([key, weight]) => {
      const [source, target] = key.split('|');
      return { source, target, weight };
    });
  return { nodes, edges };
}

function deterministicPair(items) {
  const candidates = items.filter(
    (item) =>
      !item.viewCount && Number(item.audienceRating || item.rating || 0) >= 7 && item.duration && item.ratingKey,
  );
  if (candidates.length < 2) return [];
  const seed = Number(new Date().toISOString().slice(0, 10).replaceAll('-', ''));
  const first = candidates[seed % candidates.length];
  const firstGenres = new Set((first.Genre || []).map((x) => x.tag));
  const contrasts = candidates.filter(
    (item) => item !== first && !(item.Genre || []).some((x) => firstGenres.has(x.tag)),
  );
  const second = (contrasts.length ? contrasts : candidates.filter((item) => item !== first))[
    (seed * 7) % (contrasts.length || candidates.length - 1)
  ];
  return [first, second].filter(Boolean).map((item) => ({
    ratingKey: item.ratingKey,
    title: item.title,
    year: item.year || null,
    rating: Number(item.audienceRating || item.rating || 0),
    durationMinutes: Math.round(Number(item.duration) / 60000),
    genres: (item.Genre || []).map((x) => x.tag).slice(0, 3),
    summary: item.summary || '',
    poster: `/api/art/${item.ratingKey}`,
  }));
}

export async function futureLab(config, dependencies, force = false) {
  if (!force && labCache && Date.now() - labCache.createdAt < 15 * 60_000) return labCache.data;
  const { plexFetch, discoveryCatalog } = dependencies;
  const [catalog, historyData] = await Promise.all([
    discoveryCatalog(config, force),
    plexFetch(
      config,
      '/status/sessions/history/all?X-Plex-Container-Start=0&X-Plex-Container-Size=1000&sort=viewedAt%3Adesc',
    ),
  ]);
  const items = catalog.filter((item) => item.year && item.ratingKey);
  const history = historyData.MediaContainer?.Metadata || [];
  const decades = new Map();
  for (const item of items) {
    const decade = Math.floor(Number(item.year) / 10) * 10;
    decades.set(decade, (decades.get(decade) || 0) + 1);
  }
  const decadeData = [...decades.entries()].sort((a, b) => a[0] - b[0]).map(([decade, count]) => ({ decade, count }));
  const viewedItems = items.filter((item) => Number(item.viewCount || 0) > 0);
  const favouriteGenres = countTags(viewedItems, 'Genre');
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: history.filter((item) => new Date(Number(item.viewedAt || 0) * 1000).getHours() === hour).length,
  }));
  const days = Array.from({ length: 7 }, (_, day) => ({
    day,
    count: history.filter((item) => new Date(Number(item.viewedAt || 0) * 1000).getDay() === day).length,
  }));
  const peakHour = hours.sort((a, b) => b.count - a.count)[0] || { hour: 20, count: 0 };
  const peakDay = days.sort((a, b) => b.count - a.count)[0] || { day: 6, count: 0 };
  const oldest = [...items]
    .sort((a, b) => a.year - b.year)
    .slice(0, 5)
    .map((item) => ({
      title: item.title,
      year: item.year,
      ratingKey: item.ratingKey,
      poster: `/api/art/${item.ratingKey}`,
    }));
  const newest = [...items]
    .sort((a, b) => Number(b.addedAt || 0) - Number(a.addedAt || 0))
    .slice(0, 5)
    .map((item) => ({
      title: item.title,
      year: item.year,
      addedAt: item.addedAt,
      ratingKey: item.ratingKey,
      poster: `/api/art/${item.ratingKey}`,
    }));
  const now = Math.floor(Date.now() / 1000);
  const data = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    catalogSize: items.length,
    historySample: history.length,
    graph: buildGraph(items),
    eras: decadeData,
    oldest,
    newest,
    doubleFeature: deterministicPair(items),
    oracle: {
      peakHour: peakHour.hour,
      peakHourPlays: peakHour.count,
      peakDay: peakDay.day,
      peakDayPlays: peakDay.count,
      favouriteGenre: favouriteGenres[0]?.[0] || 'Still emerging',
      favouriteGenreCount: favouriteGenres[0]?.[1] || 0,
      watchedMovies: viewedItems.length,
      unwatchedMovies: items.length - viewedItems.length,
      confidence: history.length ? Math.min(96, 65 + Math.round(Math.log10(history.length) * 10)) : 50,
    },
    memoryLane: buildMemoryLane(items, history, now),
    moodWeather: buildMoodWeather(items, history, now),
    runtimeWormhole: buildRuntimeWormhole(items),
    archiveAnomalies: buildArchiveAnomalies(items, now),
  };
  labCache = { createdAt: Date.now(), data };
  return data;
}
