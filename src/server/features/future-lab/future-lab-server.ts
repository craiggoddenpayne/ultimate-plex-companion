import {
  buildArchiveAnomalies,
  buildMemoryLane,
  buildMoodWeather,
  buildRuntimeWormhole,
} from './future-lab-experiments.ts';
import { buildFutureLabSignals } from './future-lab-signals.ts';
import { buildExpandedFutureLabs } from './future-lab-expanded.ts';

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

function pairItem(item) {
  return {
    ratingKey: item.ratingKey,
    title: item.title,
    year: item.year || null,
    rating: Number(item.audienceRating || item.rating || 0),
    durationMinutes: Math.round(Number(item.duration) / 60000),
    genres: (item.Genre || []).map((x) => x.tag).slice(0, 3),
    summary: item.summary || '',
    poster: `/api/art/${item.ratingKey}`,
  };
}

function seededRank(value, seed) {
  let hash = seed;
  for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function deterministicPairs(items, limit = 24) {
  const candidates = items.filter(
    (item) =>
      !item.viewCount && Number(item.audienceRating || item.rating || 0) >= 7 && item.duration && item.ratingKey,
  );
  if (candidates.length < 2) return [];
  const seed = Number(new Date().toISOString().slice(0, 10).replaceAll('-', ''));
  const remaining = [...candidates].sort((a, b) => seededRank(a.ratingKey, seed) - seededRank(b.ratingKey, seed));
  const pairs = [];
  while (remaining.length > 1 && pairs.length < limit) {
    const first = remaining.shift();
    const firstGenres = new Set((first.Genre || []).map((genre) => genre.tag));
    const partnerIndex = remaining
      .map((item, index) => ({
        index,
        overlap: (item.Genre || []).filter((genre) => firstGenres.has(genre.tag)).length,
        rating: Number(item.audienceRating || item.rating || 0),
      }))
      .sort((a, b) => a.overlap - b.overlap || b.rating - a.rating || a.index - b.index)[0].index;
    const second = remaining.splice(partnerIndex, 1)[0];
    pairs.push([pairItem(first), pairItem(second)]);
  }
  return pairs;
}

function longestDayStreak(dayKeys) {
  const days = [...new Set(dayKeys)].map((day) => Date.parse(`${day}T00:00:00Z`) / 86_400_000).sort((a, b) => a - b);
  let longest = 0,
    current = 0,
    previous = null;
  for (const day of days) {
    current = previous != null && day === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}

export function buildViewingOracle(items, history, now = Math.floor(Date.now() / 1000)) {
  const itemByKey: Map<string, any> = new Map(items.map((item) => [String(item.ratingKey), item]));
  const plays = history.filter((entry) => Number(entry.viewedAt || 0) > 0);
  const matched = plays
    .map((entry) => ({ entry, item: itemByKey.get(String(entry.ratingKey)) }))
    .filter((play) => play.item);
  const hourCounts = Array(24).fill(0),
    dayCounts = Array(7).fill(0),
    dateCounts = new Map(),
    titleCounts = new Map(),
    genreCounts = new Map(),
    decadeCounts = new Map();
  for (const entry of plays) {
    const date = new Date(Number(entry.viewedAt) * 1000);
    hourCounts[date.getHours()] += 1;
    dayCounts[date.getDay()] += 1;
    const dayKey = date.toISOString().slice(0, 10);
    dateCounts.set(dayKey, (dateCounts.get(dayKey) || 0) + 1);
    const titleKey = String(entry.ratingKey || entry.title || 'Unknown');
    const title = entry.title || itemByKey.get(String(entry.ratingKey))?.title || 'Unknown title';
    const current = titleCounts.get(titleKey) || { title, plays: 0 };
    current.plays += 1;
    titleCounts.set(titleKey, current);
  }
  for (const { item } of matched) {
    for (const genre of item.Genre || [])
      if (genre.tag) genreCounts.set(genre.tag, (genreCounts.get(genre.tag) || 0) + 1);
    if (item.year) {
      const decade = `${Math.floor(Number(item.year) / 10) * 10}s`;
      decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + 1);
    }
  }
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const peakDay = dayCounts.indexOf(Math.max(...dayCounts));
  const uniqueTitles = new Set(plays.map((entry) => String(entry.ratingKey || entry.title))).size;
  const recentPlays = plays.filter((entry) => Number(entry.viewedAt) >= now - 30 * 86_400).length;
  const previousPlays = plays.filter(
    (entry) => Number(entry.viewedAt) >= now - 60 * 86_400 && Number(entry.viewedAt) < now - 30 * 86_400,
  ).length;
  const watchedItems = items.filter((item) => Number(item.viewCount || 0) > 0);
  const runtimes = matched.map(({ item }) => Number(item.duration || 0) / 60_000).filter((minutes) => minutes > 0);
  const averageRuntimeMinutes = runtimes.length
    ? Math.round(runtimes.reduce((sum, minutes) => sum + minutes, 0) / runtimes.length)
    : 0;
  const sortedTimestamps = plays.map((entry) => Number(entry.viewedAt)).sort((a, b) => a - b);
  const ranked = (counts, label): any[] =>
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .map(([name, count]) => ({ [label]: name, count }));
  const topGenres = ranked(genreCounts, 'genre').slice(0, 8);
  return {
    peakHour,
    peakHourPlays: hourCounts[peakHour] || 0,
    peakDay,
    peakDayPlays: dayCounts[peakDay] || 0,
    favouriteGenre: topGenres[0]?.genre || 'Still emerging',
    favouriteGenreCount: topGenres[0]?.count || 0,
    watchedMovies: watchedItems.length,
    unwatchedMovies: items.length - watchedItems.length,
    confidence: plays.length ? Math.min(98, 55 + Math.round(Math.log10(plays.length + 1) * 13)) : 40,
    sample: {
      plays: plays.length,
      matchedPlays: matched.length,
      uniqueTitles,
      activeDays: dateCounts.size,
      firstViewedAt: sortedTimestamps[0] || null,
      lastViewedAt: sortedTimestamps.at(-1) || null,
    },
    hourDistribution: hourCounts.map((count, hour) => ({ hour, count })),
    dayDistribution: dayCounts.map((count, day) => ({ day, count })),
    timeBands: [
      { label: 'Late night', hours: '00–05', count: hourCounts.slice(0, 6).reduce((a, b) => a + b, 0) },
      { label: 'Morning', hours: '06–11', count: hourCounts.slice(6, 12).reduce((a, b) => a + b, 0) },
      { label: 'Afternoon', hours: '12–17', count: hourCounts.slice(12, 18).reduce((a, b) => a + b, 0) },
      { label: 'Evening', hours: '18–23', count: hourCounts.slice(18, 24).reduce((a, b) => a + b, 0) },
    ],
    cadence: {
      recent30Days: recentPlays,
      previous30Days: previousPlays,
      change: recentPlays - previousPlays,
      weekendPlays: dayCounts[0] + dayCounts[6],
      weekdayPlays: dayCounts.slice(1, 6).reduce((a, b) => a + b, 0),
      longestDailyStreak: longestDayStreak([...dateCounts.keys()]),
      busiestDate: ranked(dateCounts, 'date')[0] || null,
    },
    behaviour: {
      repeatPlays: Math.max(0, plays.length - uniqueTitles),
      rewatchRate: plays.length ? Math.round(((plays.length - uniqueTitles) / plays.length) * 100) : 0,
      averageRuntimeMinutes,
      runtimeSignature:
        averageRuntimeMinutes >= 150
          ? 'Long-form explorer'
          : averageRuntimeMinutes >= 115
            ? 'Feature-length devotee'
            : averageRuntimeMinutes
              ? 'Compact-story rhythm'
              : 'Still emerging',
    },
    topGenres,
    topDecades: ranked(decadeCounts, 'decade').slice(0, 6),
    topTitles: [...titleCounts.values()]
      .sort((a, b) => b.plays - a.plays || a.title.localeCompare(b.title))
      .slice(0, 6),
  };
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
  const doubleFeatures = deterministicPairs(items);
  const data = {
    schemaVersion: 5,
    generatedAt: new Date().toISOString(),
    catalogSize: items.length,
    historySample: history.length,
    graph: buildGraph(items),
    eras: decadeData,
    oldest,
    newest,
    doubleFeature: doubleFeatures[0] || [],
    doubleFeatures,
    oracle: buildViewingOracle(items, history, now),
    memoryLane: buildMemoryLane(items, history, now),
    moodWeather: buildMoodWeather(items, history, now),
    runtimeWormhole: buildRuntimeWormhole(items),
    archiveAnomalies: buildArchiveAnomalies(items, now),
    ...buildFutureLabSignals(items, history, now),
    expandedLabs: buildExpandedFutureLabs(items, history, now),
  };
  labCache = { createdAt: Date.now(), data };
  return data;
}
