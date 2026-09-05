const DAY = 86_400;

const tags = (item, field = 'Genre') => (item[field] || []).map(value => value.tag).filter(Boolean);
const rating = item => Number(item.audienceRating || item.rating || 0);
const minutes = item => Math.round(Number(item.duration || 0) / 60_000);
const normalise = value => String(value || '').trim().toLocaleLowerCase();

function publicItem(item, extra = {}) {
  return {
    ratingKey:String(item.ratingKey || ''), title:item.title || item.grandparentTitle || 'Untitled',
    year:Number(item.year || item.grandparentYear || 0) || null, poster:item.ratingKey ? `/api/art/${item.ratingKey}` : '',
    rating:rating(item), durationMinutes:minutes(item), genres:tags(item).slice(0, 3), ...extra,
  };
}

function matchHistory(items, history) {
  const byKey = new Map(items.map(item => [String(item.ratingKey || ''), item]));
  const byTitle = new Map();
  for (const item of items) {
    for (const title of [item.title, item.grandparentTitle]) if (title && !byTitle.has(normalise(title))) byTitle.set(normalise(title), item);
  }
  return history.map(record => {
    const media = byKey.get(String(record.ratingKey || ''))
      || byTitle.get(normalise(record.grandparentTitle || record.title));
    return media ? { record, media } : null;
  }).filter(Boolean).sort((a, b) => Number(b.record.viewedAt || 0) - Number(a.record.viewedAt || 0));
}

function countGenres(matches) {
  const counts = new Map();
  for (const { media } of matches) for (const genre of tags(media)) counts.set(genre, (counts.get(genre) || 0) + 1);
  return counts;
}

function calendarMonths(history, nowSeconds) {
  const now = new Date(nowSeconds * 1000);
  const months = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1) / 1000;
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 1) / 1000;
    months.push({
      key:new Date(start * 1000).toISOString().slice(0, 7),
      label:new Intl.DateTimeFormat('en', { month:'short', timeZone:'UTC' }).format(new Date(start * 1000)),
      plays:history.filter(item => Number(item.viewedAt || 0) >= start && Number(item.viewedAt || 0) < end).length,
    });
  }
  return months;
}

export function buildMemoryLane(items, history, nowSeconds = Math.floor(Date.now() / 1000)) {
  const matches = matchHistory(items, history);
  const decades = new Map();
  for (const { media } of matches) {
    if (!Number(media.year)) continue;
    const decade = Math.floor(Number(media.year) / 10) * 10;
    decades.set(decade, (decades.get(decade) || 0) + 1);
  }
  const favourite = [...decades.entries()].sort((a, b) => b[1] - a[1])[0];
  const recent = [];
  const seen = new Set();
  for (const { record, media } of matches) {
    const key = String(media.ratingKey || normalise(media.title));
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push(publicItem(media, { viewedAt:Number(record.viewedAt || 0) }));
    if (recent.length === 8) break;
  }
  return {
    matchedPlays:matches.length, uniqueTitles:new Set(matches.map(({ media }) => String(media.ratingKey || normalise(media.title)))).size,
    favouriteDecade:favourite ? `${favourite[0]}s` : 'Still forming', favouriteDecadePlays:favourite?.[1] || 0,
    months:calendarMonths(history, nowSeconds), recent,
  };
}

function moodForecast(genre, playCount) {
  if (!playCount) return { name:'Quiet orbit', detail:'No recent viewing pressure. The atmosphere is open for something new.', tone:'quiet' };
  if (/horror|thriller|crime|mystery/i.test(genre)) return { name:'Electric storm', detail:'Tension and mystery are dominating your recent viewing climate.', tone:'storm' };
  if (/comedy|animation|family|romance/i.test(genre)) return { name:'Warm front', detail:'Lighter, warmer stories are moving through your recent history.', tone:'warm' };
  if (/sci|fantasy|adventure/i.test(genre)) return { name:'Cosmic pressure', detail:'Expansive worlds and speculative stories are pulling the strongest signal.', tone:'cosmic' };
  if (/documentary|history|biography/i.test(genre)) return { name:'Clear focus', detail:'Curiosity and real-world stories are defining the current atmosphere.', tone:'clear' };
  return { name:'Mixed skies', detail:`${genre} currently leads an otherwise varied viewing climate.`, tone:'mixed' };
}

export function buildMoodWeather(items, history, nowSeconds = Math.floor(Date.now() / 1000)) {
  const matches = matchHistory(items, history);
  const recent = matches.filter(({ record }) => Number(record.viewedAt || 0) >= nowSeconds - 30 * DAY);
  const previous = matches.filter(({ record }) => {
    const viewedAt = Number(record.viewedAt || 0);
    return viewedAt >= nowSeconds - 60 * DAY && viewedAt < nowSeconds - 30 * DAY;
  });
  const recentGenres = countGenres(recent), previousGenres = countGenres(previous);
  const genreNames = new Set([...recentGenres.keys(), ...previousGenres.keys()]);
  const signals = [...genreNames].map(genre => ({
    genre, recent:recentGenres.get(genre) || 0, previous:previousGenres.get(genre) || 0,
    delta:(recentGenres.get(genre) || 0) - (previousGenres.get(genre) || 0),
  })).sort((a, b) => b.recent - a.recent || b.delta - a.delta).slice(0, 7);
  const lead = signals[0]?.genre || 'Uncharted';
  const recentRecords = recent.map(({ record }) => record);
  const lateNight = recentRecords.filter(record => {
    const hour = new Date(Number(record.viewedAt || 0) * 1000).getHours();
    return hour >= 22 || hour < 4;
  }).length;
  const weekends = recentRecords.filter(record => [0, 6].includes(new Date(Number(record.viewedAt || 0) * 1000).getDay())).length;
  return {
    periodDays:30, recentPlays:recent.length, previousPlays:previous.length, momentum:recent.length - previous.length,
    lateNightPercent:recent.length ? Math.round(lateNight / recent.length * 100) : 0,
    weekendPercent:recent.length ? Math.round(weekends / recent.length * 100) : 0,
    forecast:{ ...moodForecast(lead, recent.length), leadGenre:lead }, signals,
  };
}

export function buildRuntimeWormhole(items) {
  const timed = items.filter(item => minutes(item) > 0);
  const unwatched = timed.filter(item => !Number(item.viewCount || 0));
  const definitions: [string, number, number][] = [
    ['Short signal', 0, 45], ['Compact', 45, 90], ['Feature', 90, 120], ['Epic', 120, 180], ['Event horizon', 180, Infinity],
  ];
  const buckets = definitions.map(([label, min, max]) => {
    const selection = timed.filter(item => minutes(item) > min && minutes(item) <= max);
    return { label, minMinutes:min, maxMinutes:Number.isFinite(max) ? max : null, count:selection.length, hours:Math.round(selection.reduce((sum, item) => sum + minutes(item), 0) / 60) };
  });
  const sortedMinutes = timed.map(minutes).sort((a, b) => a - b);
  const medianMinutes = sortedMinutes.length ? sortedMinutes[Math.floor(sortedMinutes.length / 2)] : 0;
  return {
    totalHours:Math.round(sortedMinutes.reduce((sum, value) => sum + value, 0) / 60),
    unwatchedHours:Math.round(unwatched.reduce((sum, item) => sum + minutes(item), 0) / 60), medianMinutes,
    buckets,
    windows:[30, 60, 90, 120].map(limit => ({ minutes:limit, choices:unwatched.filter(item => minutes(item) <= limit).length })),
    longest:[...timed].sort((a, b) => minutes(b) - minutes(a)).slice(0, 5).map(item => publicItem(item)),
  };
}

export function buildArchiveAnomalies(items, nowSeconds = Math.floor(Date.now() / 1000)) {
  const genreCounts = new Map();
  const directorCounts = new Map();
  for (const item of items) {
    for (const genre of tags(item)) genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    for (const director of tags(item, 'Director')) directorCounts.set(director, (directorCounts.get(director) || 0) + 1);
  }
  const unwatched = items.filter(item => !Number(item.viewCount || 0));
  const buriedGems = unwatched.filter(item => rating(item) >= 7.5).map(item => ({
    item, daysWaiting:item.addedAt ? Math.max(0, Math.floor((nowSeconds - Number(item.addedAt)) / DAY)) : null,
  })).sort((a, b) => rating(b.item) - rating(a.item) || (b.daysWaiting || 0) - (a.daysWaiting || 0)).slice(0, 6)
    .map(({ item, daysWaiting }) => publicItem(item, { daysWaiting }));
  const oldestUnwatched = [...unwatched].filter(item => Number(item.year)).sort((a, b) => Number(a.year) - Number(b.year)).slice(0, 5).map(item => publicItem(item));
  return {
    rareGenres:[...genreCounts.entries()].filter(([, count]) => count <= 2).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([genre, count]) => ({ genre, count })),
    oneOffDirectors:[...directorCounts.entries()].filter(([, count]) => count === 1).map(([director]) => director).sort().slice(0, 10),
    buriedGems, oldestUnwatched,
    longest:[...items].filter(item => minutes(item) > 0).sort((a, b) => minutes(b) - minutes(a)).slice(0, 5).map(item => publicItem(item)),
    highRatedWaiting:unwatched.filter(item => rating(item) >= 7.5).length,
  };
}
