const DAY = 86_400;

const tags = (item, field = 'Genre') => (item[field] || []).map((value) => value.tag).filter(Boolean);
const itemMinutes = (item) => Math.round(Number(item.duration || 0) / 60_000);
const itemRating = (item) => Number(item.audienceRating || item.rating || 0);
const keyOf = (item) => String(item.ratingKey || '');

function publicItem(item, extra = {}) {
  return {
    ratingKey: keyOf(item),
    title: item.title || item.grandparentTitle || 'Untitled',
    year: Number(item.year || item.grandparentYear || 0) || null,
    poster: item.ratingKey ? `/api/art/${item.ratingKey}` : '',
    durationMinutes: itemMinutes(item),
    rating: itemRating(item),
    genres: tags(item).slice(0, 4),
    ...extra,
  };
}

function matchedHistory(items, history) {
  const byKey = new Map(items.map((item) => [keyOf(item), item]));
  const byTitle = new Map(items.map((item) => [String(item.title || '').toLowerCase(), item]));
  return history
    .map((record) => ({
      record,
      item:
        byKey.get(String(record.ratingKey || '')) ||
        byTitle.get(String(record.grandparentTitle || record.title || '').toLowerCase()),
    }))
    .filter((match) => match.item);
}

function counts(values) {
  const result = new Map();
  for (const value of values) if (value) result.set(value, (result.get(value) || 0) + 1);
  return [...result.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function mediaValues(items, field) {
  return items.flatMap((item) => (item.Media || []).map((media) => String(media[field] || 'Unknown').toUpperCase()));
}

function buildBacklog(items, matches, now) {
  const unwatched = items.filter((item) => !Number(item.viewCount || 0));
  const recentUnique = new Set(
    matches.filter(({ record }) => Number(record.viewedAt || 0) >= now - 90 * DAY).map(({ item }) => keyOf(item)),
  ).size;
  const monthlyPace = Math.max(0, Math.round(recentUnique / 3));
  return {
    titles: unwatched.length,
    hours: Math.round(unwatched.reduce((sum, item) => sum + itemMinutes(item), 0) / 60),
    monthlyPace,
    monthsToClear: monthlyPace ? Math.ceil(unwatched.length / monthlyPace) : null,
    oldest: [...unwatched]
      .sort((a, b) => Number(a.addedAt || Infinity) - Number(b.addedAt || Infinity))
      .slice(0, 8)
      .map((item) => publicItem(item, { daysWaiting: item.addedAt ? Math.floor((now - item.addedAt) / DAY) : null })),
  };
}

function buildRewatch(matches) {
  const playCounts = counts(matches.map(({ item }) => keyOf(item)));
  const repeated = playCounts.filter(([, count]) => count > 1);
  const itemByKey = new Map(matches.map(({ item }) => [keyOf(item), item]));
  const repeatedMatches = matches.filter(({ item }) => (playCounts.find(([key]) => key === keyOf(item))?.[1] || 0) > 1);
  return {
    totalPlays: matches.length,
    repeatPlays: repeated.reduce((sum, [, count]) => sum + count - 1, 0),
    repeatRate: matches.length
      ? Math.round((repeated.reduce((sum, [, count]) => sum + count - 1, 0) / matches.length) * 100)
      : 0,
    favouriteGenre: counts(repeatedMatches.flatMap(({ item }) => tags(item)))[0]?.[0] || 'Still forming',
    comfortTitles: repeated.slice(0, 8).map(([key, count]) => publicItem(itemByKey.get(key), { plays: count })),
  };
}

function buildGenreDrift(matches, now) {
  const genresFor = (from, to) =>
    counts(
      matches
        .filter(({ record }) => Number(record.viewedAt || 0) >= from && Number(record.viewedAt || 0) < to)
        .flatMap(({ item }) => tags(item)),
    );
  const recent = new Map(genresFor(now - 180 * DAY, now));
  const previous = new Map(genresFor(now - 360 * DAY, now - 180 * DAY));
  const genres = new Set([...recent.keys(), ...previous.keys()]);
  return {
    windowDays: 180,
    signals: [...genres]
      .map((genre) => ({ genre, recent: recent.get(genre) || 0, previous: previous.get(genre) || 0 }))
      .map((signal) => ({ ...signal, delta: signal.recent - signal.previous }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.recent - a.recent)
      .slice(0, 10),
  };
}

function buildChronotype(history) {
  const cells = Array.from({ length: 7 }, (_, day) =>
    Array.from(
      { length: 24 },
      (_, hour) =>
        history.filter((record) => {
          const date = new Date(Number(record.viewedAt || 0) * 1000);
          return date.getDay() === day && date.getHours() === hour;
        }).length,
    ),
  );
  let peak = { day: 0, hour: 0, count: 0 };
  cells.forEach((hours, day) =>
    hours.forEach((count, hour) => {
      if (count > peak.count) peak = { day, hour, count };
    }),
  );
  const late = history.filter((record) => {
    const hour = new Date(Number(record.viewedAt || 0) * 1000).getHours();
    return hour >= 22 || hour < 4;
  }).length;
  return {
    cells,
    peak,
    latePercent: history.length ? Math.round((late / history.length) * 100) : 0,
    weekendPercent: history.length
      ? Math.round(
          (history.filter((record) => [0, 6].includes(new Date(Number(record.viewedAt || 0) * 1000).getDay())).length /
            history.length) *
            100,
        )
      : 0,
  };
}

function buildGrowth(items, now) {
  const months = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now * 1000);
    const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - offset, 1) / 1000;
    const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - offset + 1, 1) / 1000;
    months.push({
      label: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(new Date(start * 1000)),
      count: items.filter((item) => Number(item.addedAt || 0) >= start && Number(item.addedAt || 0) < end).length,
    });
  }
  const recent = items.filter((item) => Number(item.addedAt || 0) >= now - 90 * DAY);
  return {
    months,
    addedThisYear: months.reduce((sum, month) => sum + month.count, 0),
    recentUnwatched: recent.filter((item) => !Number(item.viewCount || 0)).length,
    newest: [...items]
      .sort((a, b) => Number(b.addedAt || 0) - Number(a.addedAt || 0))
      .slice(0, 8)
      .map((item) => publicItem(item)),
  };
}

function buildRatings(items) {
  const rated = items.filter((item) => itemRating(item) > 0);
  const bandDefinitions: [string, number, number][] = [
    ['9–10', 9, 10.1],
    ['8–8.9', 8, 9],
    ['7–7.9', 7, 8],
    ['6–6.9', 6, 7],
    ['Below 6', 0, 6],
  ];
  const bands = bandDefinitions.map(([label, min, max]) => ({
    label,
    count: rated.filter((item) => itemRating(item) >= min && itemRating(item) < max).length,
  }));
  return {
    average: rated.length
      ? Number((rated.reduce((sum, item) => sum + itemRating(item), 0) / rated.length).toFixed(1))
      : 0,
    unrated: items.length - rated.length,
    bands,
    sleepers: rated
      .filter((item) => itemRating(item) >= 7.5 && !Number(item.viewCount || 0))
      .sort((a, b) => itemRating(b) - itemRating(a))
      .slice(0, 8)
      .map((item) => publicItem(item)),
  };
}

function buildCodecs(items) {
  const versions = items.flatMap((item) => (item.Media || []).map((media) => ({ item, media })));
  const legacy = new Set(['H264', 'AVC', 'MPEG2VIDEO', 'MPEG2', 'VC1', 'MPEG4']);
  return {
    versions: versions.length,
    codecs: counts(mediaValues(items, 'videoCodec'))
      .slice(0, 8)
      .map(([label, count]) => ({ label, count })),
    containers: counts(mediaValues(items, 'container'))
      .slice(0, 8)
      .map(([label, count]) => ({ label, count })),
    resolutions: counts(mediaValues(items, 'videoResolution'))
      .slice(0, 8)
      .map(([label, count]) => ({ label, count })),
    legacyTitles: new Set(
      versions
        .filter(({ media }) => legacy.has(String(media.videoCodec || '').toUpperCase()))
        .map(({ item }) => keyOf(item)),
    ).size,
  };
}

function buildStorage(items) {
  const sized = items
    .map((item) => ({
      item,
      bytes: (item.Media || []).reduce(
        (total, media) => total + (media.Part || []).reduce((sum, part) => sum + Number(part.size || 0), 0),
        0,
      ),
    }))
    .filter(({ bytes }) => bytes > 0);
  const totalBytes = sized.reduce((sum, entry) => sum + entry.bytes, 0);
  const sizeBandDefinitions: [string, number, number][] = [
    ['Under 2 GB', 0, 2],
    ['2–5 GB', 2, 5],
    ['5–10 GB', 5, 10],
    ['10–25 GB', 10, 25],
    ['Over 25 GB', 25, Infinity],
  ];
  const sizeBands = sizeBandDefinitions.map(([label, min, max]) => ({
    label,
    count: sized.filter(({ bytes }) => bytes / 1024 ** 3 >= min && bytes / 1024 ** 3 < max).length,
  }));
  return {
    totalTerabytes: Number((totalBytes / 1024 ** 4).toFixed(2)),
    averageGigabytes: sized.length ? Number((totalBytes / sized.length / 1024 ** 3).toFixed(1)) : 0,
    multiVersionTitles: items.filter((item) => (item.Media || []).length > 1).length,
    sizedTitles: sized.length,
    sizeBands,
    largest: [...sized]
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8)
      .map(({ item, bytes }) => publicItem(item, { sizeGigabytes: Number((bytes / 1024 ** 3).toFixed(1)) })),
  };
}

function buildBridges(items) {
  const pairs = [];
  for (const item of items) {
    const genres = tags(item).slice(0, 5);
    for (let a = 0; a < genres.length; a += 1)
      for (let b = a + 1; b < genres.length; b += 1) pairs.push([genres[a], genres[b]].sort().join(' × '));
  }
  return {
    pairs: counts(pairs)
      .slice(0, 10)
      .map(([label, count]) => ({ label, count })),
    connectors: items
      .filter((item) => tags(item).length >= 3)
      .sort((a, b) => tags(b).length - tags(a).length || itemRating(b) - itemRating(a))
      .slice(0, 8)
      .map((item) => publicItem(item, { bridgeCount: tags(item).length })),
  };
}

function buildPassport(items) {
  const decades = new Map();
  for (const item of items) {
    const decade = Math.floor(Number(item.year || 0) / 10) * 10;
    if (!decade) continue;
    const value = decades.get(decade) || { decade, titles: 0, watched: 0, ratingTotal: 0, rated: 0 };
    value.titles += 1;
    value.watched += Number(item.viewCount || 0) > 0 ? 1 : 0;
    if (itemRating(item)) {
      value.ratingTotal += itemRating(item);
      value.rated += 1;
    }
    decades.set(decade, value);
  }
  return {
    decades: [...decades.values()]
      .sort((a, b) => a.decade - b.decade)
      .map((value) => ({
        decade: `${value.decade}s`,
        titles: value.titles,
        watchedPercent: Math.round((value.watched / value.titles) * 100),
        averageRating: value.rated ? Number((value.ratingTotal / value.rated).toFixed(1)) : 0,
      })),
  };
}

function buildTempo(items, matches) {
  const library = items.map(itemMinutes).filter(Boolean);
  const watched = matches.map(({ item }) => itemMinutes(item)).filter(Boolean);
  const average = (values) =>
    values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const watchedAverage = average(watched);
  return {
    libraryAverage: average(library),
    watchedAverage,
    personality:
      watchedAverage < 95
        ? 'Quick-hit explorer'
        : watchedAverage > 125
          ? 'Long-form voyager'
          : 'Feature-length navigator',
    shortPlays: watched.filter((value) => value <= 90).length,
    epicPlays: watched.filter((value) => value >= 150).length,
    next: items
      .filter((item) => !Number(item.viewCount || 0) && itemMinutes(item) > 0)
      .sort((a, b) => Math.abs(itemMinutes(a) - watchedAverage) - Math.abs(itemMinutes(b) - watchedAverage))
      .slice(0, 8)
      .map((item) => publicItem(item)),
  };
}

function buildSeasons(matches) {
  const months = Array.from({ length: 12 }, (_, month) => {
    const selection = matches.filter(
      ({ record }) => new Date(Number(record.viewedAt || 0) * 1000).getMonth() === month,
    );
    return {
      month: new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(2024, month, 1)),
      plays: selection.length,
      genre: counts(selection.flatMap(({ item }) => tags(item)))[0]?.[0] || '—',
    };
  });
  return { months, peak: [...months].sort((a, b) => b.plays - a.plays)[0] };
}

export function buildFutureLabSignals(items, history, now = Math.floor(Date.now() / 1000)) {
  const matches = matchedHistory(items, history);
  return {
    backlogHorizon: buildBacklog(items, matches, now),
    rewatchDna: buildRewatch(matches),
    genreDrift: buildGenreDrift(matches, now),
    nightChronotype: buildChronotype(history),
    collectionPulse: buildGrowth(items, now),
    ratingLens: buildRatings(items),
    codecArchaeology: buildCodecs(items),
    storageTopology: buildStorage(items),
    genreBridges: buildBridges(items),
    decadePassport: buildPassport(items),
    durationDna: buildTempo(items, matches),
    seasonalEchoes: buildSeasons(matches),
  };
}
