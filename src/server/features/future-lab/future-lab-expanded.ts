const DAY = 86_400;

const tags = (item, field) => (item?.[field] || []).map((value) => value.tag).filter(Boolean);
const rating = (item) => Number(item?.audienceRating || item?.rating || 0);
const minutes = (item) => Math.round(Number(item?.duration || 0) / 60_000);
const key = (item) => String(item?.ratingKey || '');

function publicItem(item, insight = '') {
  return {
    ratingKey: key(item),
    title: item?.title || item?.grandparentTitle || 'Untitled',
    year: Number(item?.year || item?.grandparentYear || 0) || null,
    durationMinutes: minutes(item),
    poster: item?.ratingKey ? `/api/art/${item.ratingKey}` : '',
    insight,
  };
}

function ranked(values, limit = 10) {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(String(value), (counts.get(String(value)) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function metric(value, label, note = '') {
  return { value, label, note };
}

function model(title, description, metrics, bars = [], items = [], facts = []) {
  return { title, description, metrics, bars, items, facts };
}

function historyMatches(items, history) {
  const byKey = new Map(items.map((item) => [key(item), item]));
  const byTitle = new Map(items.map((item) => [String(item.title || '').toLowerCase(), item]));
  return history
    .map((record) => ({
      record,
      item:
        byKey.get(String(record.ratingKey || '')) ||
        byTitle.get(String(record.grandparentTitle || record.title || '').toLowerCase()),
    }))
    .filter(({ item }) => item);
}

function sizeOf(item) {
  return (item.Media || []).reduce(
    (total, media) => total + (media.Part || []).reduce((sum, part) => sum + Number(part.size || 0), 0),
    0,
  );
}

function streamValues(item, type, field = 'language') {
  return (item.Media || []).flatMap((media) =>
    (media.Part || []).flatMap((part) =>
      (part.Stream || [])
        .filter((stream) => Number(stream.streamType) === type)
        .map((stream) => stream[field] || stream.languageCode || stream.codec),
    ),
  );
}

export const expandedLabTabs = [
  ['director-dna', 'Director fingerprints'],
  ['cast-map', 'Cast constellations'],
  ['studio-map', 'Studio ecosystem'],
  ['world-cinema', 'World cinema compass'],
  ['languages', 'Language landscape'],
  ['certifications', 'Certification spectrum'],
  ['franchises', 'Franchise trails'],
  ['collection-map', 'Collection architecture'],
  ['release-calendar', 'Release calendar'],
  ['watch-delay', 'Arrival-to-watch delay'],
  ['hidden-decades', 'Hidden decades'],
  ['unfinished', 'Unfinished journeys'],
  ['one-night', 'One-night wonders'],
  ['sunday-cinema', 'Sunday cinema'],
  ['midnight', 'Midnight movies'],
  ['comfort-runtime', 'Comfort runtime'],
  ['rating-trust', 'Rating reliability'],
  ['critic-gap', 'Critic-audience divide'],
  ['resolution-evolution', 'Resolution evolution'],
  ['audio-map', 'Audio soundscape'],
  ['subtitle-atlas', 'Subtitle atlas'],
  ['hdr-horizon', 'HDR horizon'],
  ['aspect-gallery', 'Aspect ratio gallery'],
  ['bitrate-outliers', 'Bitrate outliers'],
  ['container-migration', 'Container migration'],
  ['version-vault', 'Multi-version vault'],
  ['library-velocity', 'Library velocity'],
  ['watchlist-age', 'Watchlist archaeology'],
  ['serendipity-chain', 'Serendipity chain'],
  ['personal-canon', 'Personal canon'],
];

export function buildExpandedFutureLabs(items, history, now = Math.floor(Date.now() / 1000)) {
  const matches = historyMatches(items, history);
  const unwatched = items.filter((item) => !Number(item.viewCount || 0));
  const mediaRows = items.flatMap((item) => (item.Media || []).map((media) => ({ item, media })));
  const directors = ranked(items.flatMap((item) => tags(item, 'Director')));
  const roles = ranked(items.flatMap((item) => tags(item, 'Role')));
  const studios = ranked(items.map((item) => item.studio || 'Unknown studio'));
  const countries = ranked(items.flatMap((item) => tags(item, 'Country')));
  const audioLanguages = ranked(items.flatMap((item) => streamValues(item, 2)));
  const audioTaggedItems = items.filter((item) => streamValues(item, 2).length > 0);
  const certifications = ranked(items.map((item) => item.contentRating || 'Unrated'));
  const collections = ranked(items.flatMap((item) => tags(item, 'Collection')));
  const topItems = (field, label, value) =>
    items
      .filter((item) => tags(item, field).includes(value))
      .slice(0, 8)
      .map((item) => publicItem(item, label));
  const watchedCounts = new Map<string, number>();
  for (const { item } of matches) watchedCounts.set(key(item), (watchedCounts.get(key(item)) || 0) + 1);

  const releaseMonths = Array.from({ length: 12 }, (_, month) => ({
    label: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, month, 1)),
    ),
    count: items.filter((item) => {
      const date = new Date(item.originallyAvailableAt || 0);
      return Number.isFinite(date.getTime()) && date.getUTCMonth() === month;
    }).length,
  }));
  const delays = matches
    .map(({ item, record }) => ({
      item,
      days: Math.floor((Number(record.viewedAt || 0) - Number(item.addedAt || 0)) / DAY),
    }))
    .filter(({ days }) => days >= 0);
  const delayBands = [
    ['Same week', 0, 8],
    ['8–30 days', 8, 31],
    ['1–6 months', 31, 183],
    ['6–12 months', 183, 366],
    ['Over a year', 366, Infinity],
  ].map(([label, min, max]: [string, number, number]) => ({
    label,
    count: delays.filter(({ days }) => days >= min && days < max).length,
  }));
  const decadeRows = ranked(
    items.map((item) => (item.year ? `${Math.floor(Number(item.year) / 10) * 10}s` : null)),
    20,
  ).map((row) => ({
    ...row,
    unwatched: unwatched.filter((item) => `${Math.floor(Number(item.year) / 10) * 10}s` === row.label).length,
  }));
  const unfinished = items
    .filter((item) => Number(item.viewOffset || 0) > 0 && Number(item.viewOffset) < Number(item.duration || 0) * 0.95)
    .sort((a, b) => Number(b.lastViewedAt || 0) - Number(a.lastViewedAt || 0));
  const dateGroups = ranked(
    history.map((record) =>
      record.viewedAt ? new Date(Number(record.viewedAt) * 1000).toISOString().slice(0, 10) : null,
    ),
  );
  const sunday = matches.filter(({ record }) => new Date(Number(record.viewedAt || 0) * 1000).getDay() === 0);
  const midnight = matches.filter(({ record }) => {
    const hour = new Date(Number(record.viewedAt || 0) * 1000).getHours();
    return hour < 5;
  });
  const repeated = matches.filter(({ item }) => (watchedCounts.get(key(item)) || 0) > 1);
  const runtimeBands = [
    ['Under 90 min', 0, 90],
    ['90–109 min', 90, 110],
    ['110–129 min', 110, 130],
    ['130–149 min', 130, 150],
    ['150+ min', 150, Infinity],
  ].map(([label, min, max]: [string, number, number]) => ({
    label,
    count: repeated.filter(({ item }) => minutes(item) >= min && minutes(item) < max).length,
  }));
  const dualRated = items.filter((item) => Number(item.rating || 0) && Number(item.audienceRating || 0));
  const ratingGaps = dualRated
    .map((item) => ({ item, gap: Number(item.audienceRating) - Number(item.rating) }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const resolutionByDecade = ranked(
    mediaRows.map(({ item, media }) =>
      item.year
        ? `${Math.floor(Number(item.year) / 10) * 10}s · ${String(media.videoResolution || 'Unknown').toUpperCase()}`
        : null,
    ),
  );
  const audioCodecs = ranked(mediaRows.map(({ media }) => String(media.audioCodec || 'Unknown').toUpperCase()));
  const audioChannels = ranked(
    mediaRows.map(({ media }) => (media.audioChannels ? `${media.audioChannels} channels` : 'Unknown')),
  );
  const subtitleLanguages = ranked(items.flatMap((item) => streamValues(item, 3)));
  const subtitleItems = items.filter((item) => streamValues(item, 3).length > 0);
  const hdrRows = ranked(
    mediaRows.map(({ media }) =>
      String(media.videoDynamicRange || media.dynamicRange || (media.hdr ? 'HDR' : 'SDR')).toUpperCase(),
    ),
  );
  const aspectRows = ranked(mediaRows.map(({ media }) => media.aspectRatio || 'Unknown'));
  const bitrateRows = mediaRows
    .filter(({ media }) => Number(media.bitrate || 0) > 0)
    .sort((a, b) => Number(b.media.bitrate) - Number(a.media.bitrate));
  const containers = ranked(mediaRows.map(({ media }) => String(media.container || 'Unknown').toUpperCase()));
  const multiVersion = items.filter((item) => (item.Media || []).length > 1).sort((a, b) => sizeOf(b) - sizeOf(a));
  const libraries = ranked(items.map((item) => item.libraryTitle || 'Unknown library')).map((row) => ({
    ...row,
    recent: items.filter((item) => item.libraryTitle === row.label && Number(item.addedAt || 0) >= now - 90 * DAY)
      .length,
  }));
  const waiting = [...unwatched].sort((a, b) => Number(a.addedAt || Infinity) - Number(b.addedAt || Infinity));
  const diverseChain = [];
  const remaining = [...unwatched].sort((a, b) => rating(b) - rating(a));
  let previousGenre = '';
  while (remaining.length && diverseChain.length < 8) {
    const index = remaining.findIndex((item) => !previousGenre || !tags(item, 'Genre').includes(previousGenre));
    const item = remaining.splice(index < 0 ? 0 : index, 1)[0];
    diverseChain.push(item);
    previousGenre = tags(item, 'Genre')[0] || '';
  }
  const canon = [...items]
    .map((item) => ({ item, score: Number(item.viewCount || 0) * 12 + rating(item) * 3 }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    directorDna: model(
      'The filmmakers shaping your archive.',
      'Ranks directors by representation and finds the strongest directorial fingerprints in the collection.',
      [
        metric(directors.length, 'directors mapped'),
        metric(directors[0]?.label || '—', 'dominant director'),
        metric(directors[0]?.count || 0, 'leading titles'),
      ],
      directors,
      topItems('Director', 'Directed title', directors[0]?.label),
    ),
    castConstellations: model(
      'The faces connecting distant shelves.',
      'Maps recurring performers and ensemble-heavy films across the archive.',
      [
        metric(roles.length, 'performers mapped'),
        metric(roles[0]?.label || '—', 'most represented'),
        metric(items.filter((item) => tags(item, 'Role').length >= 8).length, 'large ensembles'),
      ],
      roles,
      topItems('Role', 'Cast connection', roles[0]?.label),
    ),
    studioEcosystem: model(
      'See who built the collection.',
      'Measures studio representation and titles whose production identity is missing.',
      [
        metric(studios.length, 'studios'),
        metric(studios[0]?.label || '—', 'largest presence'),
        metric(items.filter((item) => !item.studio).length, 'studio unknown'),
      ],
      studios,
      items
        .filter((item) => (studios[0]?.label === 'Unknown studio' ? !item.studio : item.studio === studios[0]?.label))
        .slice(0, 8)
        .map((item) => publicItem(item, item.studio)),
    ),
    worldCinema: model(
      'A geographic compass for the archive.',
      'Surfaces production countries and films that broaden the geographical range of the library.',
      [
        metric(countries.length, 'countries'),
        metric(countries[0]?.label || '—', 'largest territory'),
        metric(items.filter((item) => tags(item, 'Country').length > 1).length, 'co-productions'),
      ],
      countries,
      items
        .filter((item) => tags(item, 'Country').length > 1)
        .slice(0, 8)
        .map((item) => publicItem(item, tags(item, 'Country').join(' · '))),
    ),
    languageLandscape: model(
      'Listen to the languages in your files.',
      'Audits audio-stream language metadata, highlights multilingual media and identifies tags Plex does not expose.',
      [
        metric(audioLanguages.length, 'audio languages'),
        metric(audioLanguages[0]?.label || 'Unknown', 'most common'),
        metric(items.filter((item) => new Set(streamValues(item, 2)).size > 1).length, 'multilingual titles'),
        metric(items.length - audioTaggedItems.length, 'without exposed tags'),
      ],
      audioLanguages.length
        ? audioLanguages
        : [
            { label: 'Language tags exposed', count: audioTaggedItems.length },
            { label: 'No language tags exposed', count: items.length - audioTaggedItems.length },
          ],
      (audioLanguages.length
        ? items.filter((item) => new Set(streamValues(item, 2)).size > 1)
        : items.filter((item) => streamValues(item, 2).length === 0)
      )
        .slice(0, 8)
        .map((item) => publicItem(item, streamValues(item, 2).join(' · ') || 'No audio language tag exposed by Plex')),
    ),
    certificationSpectrum: model(
      'Map the age boundaries of the library.',
      'Shows content certifications and how much of the catalogue lacks a rating.',
      [
        metric(certifications.length, 'certifications'),
        metric(certifications[0]?.label || '—', 'most common'),
        metric(items.filter((item) => !item.contentRating).length, 'unrated titles'),
      ],
      certifications,
      items
        .filter((item) => !item.contentRating)
        .slice(0, 8)
        .map((item) => publicItem(item, 'No certification')),
    ),
    franchiseTrails: model(
      'Follow connected stories through the archive.',
      'Uses Plex collections to reveal the largest franchise and series groupings.',
      [
        metric(collections.length, 'named collections'),
        metric(collections[0]?.label || '—', 'largest trail'),
        metric(collections[0]?.count || 0, 'titles in largest'),
      ],
      collections,
      topItems('Collection', 'Collection member', collections[0]?.label),
    ),
    collectionArchitecture: model(
      'Measure how titles are organized.',
      'Contrasts collection membership with standalone films and unusually deep groupings.',
      [
        metric(items.filter((item) => tags(item, 'Collection').length).length, 'titles collected'),
        metric(items.filter((item) => !tags(item, 'Collection').length).length, 'standalone titles'),
        metric(collections.filter((row) => row.count >= 3).length, 'collections with 3+'),
      ],
      collections,
      items
        .filter((item) => tags(item, 'Collection').length > 1)
        .slice(0, 8)
        .map((item) => publicItem(item, `${tags(item, 'Collection').length} collections`)),
    ),
    releaseCalendar: model(
      'Discover when your cinema was released.',
      'Combines original release dates into a seasonal calendar across all represented years.',
      [
        metric(items.filter((item) => item.originallyAvailableAt).length, 'dated releases'),
        metric([...releaseMonths].sort((a, b) => b.count - a.count)[0]?.label || '—', 'peak month'),
        metric(
          releaseMonths.reduce((sum, row) => sum + row.count, 0),
          'calendar signals',
        ),
      ],
      releaseMonths,
    ),
    watchDelay: model(
      'How long do arrivals wait?',
      'Measures the delay between a title entering Plex and its sampled viewing date.',
      [
        metric(delays.length, 'matched plays'),
        metric(
          delays.length ? Math.round(delays.reduce((sum, row) => sum + row.days, 0) / delays.length) : 0,
          'average days',
        ),
        metric(delays.filter((row) => row.days <= 7).length, 'watched in a week'),
      ],
      delayBands,
      [...delays]
        .sort((a, b) => b.days - a.days)
        .slice(0, 8)
        .map(({ item, days }) => publicItem(item, `${days.toLocaleString()} days to watch`)),
    ),
    hiddenDecades: model(
      'Find eras still waiting to be explored.',
      'Ranks decades by their unwatched population rather than their total collection size.',
      [
        metric(decadeRows.length, 'decades'),
        metric([...decadeRows].sort((a, b) => b.unwatched - a.unwatched)[0]?.label || '—', 'most hidden'),
        metric(unwatched.length, 'unwatched titles'),
      ],
      [...decadeRows]
        .sort((a, b) => b.unwatched - a.unwatched)
        .map((row) => ({ label: row.label, count: row.unwatched, detail: `${row.count} owned` })),
      waiting.slice(0, 8).map((item) => publicItem(item, `${item.year || 'Unknown'} release`)),
    ),
    unfinishedJourneys: model(
      'Return to films left in orbit.',
      'Finds titles with saved playback progress and ranks the most recently touched journeys.',
      [
        metric(unfinished.length, 'unfinished titles'),
        metric(
          unfinished[0] ? Math.round((Number(unfinished[0].viewOffset) / Number(unfinished[0].duration)) * 100) : 0,
          'latest progress %',
        ),
        metric(
          unfinished.filter((item) => Number(item.viewOffset) / Number(item.duration) >= 0.75).length,
          'near completion',
        ),
      ],
      [],
      unfinished
        .slice(0, 8)
        .map((item) =>
          publicItem(item, `${Math.round((Number(item.viewOffset) / Number(item.duration)) * 100)}% complete`),
        ),
    ),
    oneNightWonders: model(
      'The busiest nights in viewing memory.',
      'Finds dates where the household moved through the most playback activity.',
      [
        metric(dateGroups.length, 'active dates sampled'),
        metric(dateGroups[0]?.label || '—', 'busiest date'),
        metric(dateGroups[0]?.count || 0, 'plays that day'),
      ],
      dateGroups,
      [...watchedCounts.entries()]
        .filter(([, count]) => count === 1)
        .slice(0, 8)
        .map(([itemKey]) =>
          publicItem(
            items.find((item) => key(item) === itemKey),
            'One sampled play',
          ),
        ),
    ),
    sundayCinema: model(
      'Decode the Sunday ritual.',
      'Isolates matched Sunday plays to reveal recurring genres and titles.',
      [
        metric(sunday.length, 'Sunday plays'),
        metric(ranked(sunday.flatMap(({ item }) => tags(item, 'Genre')))[0]?.label || '—', 'Sunday genre'),
        metric(new Set(sunday.map(({ item }) => key(item))).size, 'unique titles'),
      ],
      ranked(sunday.flatMap(({ item }) => tags(item, 'Genre'))),
      sunday.slice(0, 8).map(({ item }) => publicItem(item, 'Sunday viewing')),
    ),
    midnightMovies: model(
      'What survives after midnight?',
      'Studies matched plays between midnight and 05:00 to identify the household after-hours signature.',
      [
        metric(midnight.length, 'late-night plays'),
        metric(ranked(midnight.flatMap(({ item }) => tags(item, 'Genre')))[0]?.label || '—', 'midnight genre'),
        metric(new Set(midnight.map(({ item }) => key(item))).size, 'unique titles'),
      ],
      ranked(midnight.flatMap(({ item }) => tags(item, 'Genre'))),
      midnight.slice(0, 8).map(({ item }) => publicItem(item, 'After-midnight signal')),
    ),
    comfortRuntime: model(
      'The length of stories worth repeating.',
      'Measures runtimes among repeat plays to find the household comfort window.',
      [
        metric(repeated.length, 'repeat-play signals'),
        metric(
          repeated.length ? Math.round(repeated.reduce((sum, row) => sum + minutes(row.item), 0) / repeated.length) : 0,
          'average minutes',
        ),
        metric([...runtimeBands].sort((a, b) => b.count - a.count)[0]?.label || '—', 'comfort window'),
      ],
      runtimeBands,
      [...new Map(repeated.map(({ item }) => [key(item), item])).values()]
        .slice(0, 8)
        .map((item) => publicItem(item, `${watchedCounts.get(key(item))} plays`)),
    ),
    ratingReliability: model(
      'Measure the evidence behind quality scores.',
      'Shows rating coverage and agreement where critic and audience values both exist.',
      [
        metric(items.filter((item) => rating(item) > 0).length, 'rated titles'),
        metric(items.filter((item) => rating(item) <= 0).length, 'unrated titles'),
        metric(dualRated.length, 'dual-score titles'),
        metric(
          dualRated.length
            ? Math.round(
                (dualRated.filter((item) => Math.abs(Number(item.audienceRating) - Number(item.rating)) <= 1).length /
                  dualRated.length) *
                  100,
              )
            : 0,
          'agreement %',
        ),
      ],
      ranked(
        items.map((item) =>
          rating(item) >= 9
            ? '9–10'
            : rating(item) >= 8
              ? '8–8.9'
              : rating(item) >= 7
                ? '7–7.9'
                : rating(item) > 0
                  ? 'Below 7'
                  : 'Unrated',
        ),
      ),
    ),
    criticAudienceGap: model(
      'Where critics and audiences part company.',
      'Ranks titles by the absolute difference between Plex critic and audience ratings.',
      [
        metric(dualRated.length, 'comparable titles'),
        metric(ratingGaps[0] ? Math.abs(ratingGaps[0].gap).toFixed(1) : 0, 'largest gap'),
        metric(ratingGaps.filter((row) => row.gap > 1).length, 'audience higher'),
        metric(ratingGaps.filter((row) => row.gap < -1).length, 'critics higher'),
      ],
      ranked(
        ratingGaps.map(({ gap }) =>
          Math.abs(gap) < 0.5 ? 'Close agreement' : gap > 0 ? 'Audience higher' : 'Critics higher',
        ),
      ),
      ratingGaps
        .slice(0, 8)
        .map(({ item, gap }) => publicItem(item, `${gap > 0 ? 'Audience' : 'Critics'} +${Math.abs(gap).toFixed(1)}`)),
    ),
    resolutionEvolution: model(
      'Watch image formats move through time.',
      'Cross-references release decade with the resolution of media currently stored.',
      [
        metric(mediaRows.length, 'media versions'),
        metric(new Set(mediaRows.map(({ media }) => media.videoResolution).filter(Boolean)).size, 'resolutions'),
        metric(resolutionByDecade[0]?.label || '—', 'largest cohort'),
      ],
      resolutionByDecade,
    ),
    audioSoundscape: model(
      'Map the sonic shape of the library.',
      'Counts audio codecs and channel layouts reported by every media version.',
      [
        metric(audioCodecs.length, 'audio codecs'),
        metric(audioCodecs[0]?.label || '—', 'dominant codec'),
        metric(mediaRows.filter(({ media }) => Number(media.audioChannels || 0) >= 6).length, 'surround versions'),
      ],
      audioCodecs,
      [],
      audioChannels.slice(0, 8),
    ),
    subtitleAtlas: model(
      'See the readable languages carried by your media.',
      'Maps exposed subtitle stream languages and audits titles whose bulk metadata contains no subtitle tags.',
      [
        metric(subtitleLanguages.length, 'subtitle languages'),
        metric(subtitleItems.length, 'subtitled titles'),
        metric(items.filter((item) => streamValues(item, 3).length > 1).length, 'multi-subtitle titles'),
        metric(items.length - subtitleItems.length, 'without exposed tags'),
      ],
      subtitleLanguages.length
        ? subtitleLanguages
        : [
            { label: 'Subtitle tags exposed', count: subtitleItems.length },
            { label: 'No subtitle tags exposed', count: items.length - subtitleItems.length },
          ],
      (subtitleItems.length ? subtitleItems : items)
        .slice(0, 8)
        .map((item) =>
          publicItem(
            item,
            streamValues(item, 3).length
              ? `${streamValues(item, 3).length} subtitle streams`
              : 'No subtitle stream tag exposed by Plex',
          ),
        ),
    ),
    hdrHorizon: model(
      'Measure the dynamic-range frontier.',
      'Separates SDR, HDR and Dolby Vision signals reported across stored media versions.',
      [
        metric(mediaRows.length, 'media versions'),
        metric(
          hdrRows.filter((row) => !row.label.includes('SDR')).reduce((sum, row) => sum + row.count, 0),
          'HDR-class versions',
        ),
        metric(hdrRows[0]?.label || '—', 'dominant range'),
      ],
      hdrRows,
      mediaRows
        .filter(
          ({ media }) =>
            !String(media.videoDynamicRange || media.dynamicRange || 'SDR')
              .toUpperCase()
              .includes('SDR'),
        )
        .slice(0, 8)
        .map(({ item, media }) =>
          publicItem(item, String(media.videoDynamicRange || media.dynamicRange || 'HDR').toUpperCase()),
        ),
    ),
    aspectRatioGallery: model(
      'The frames your stories inhabit.',
      'Maps reported aspect ratios from academy and television frames to widescreen cinema.',
      [
        metric(aspectRows.length, 'aspect ratios'),
        metric(aspectRows[0]?.label || '—', 'most common'),
        metric(mediaRows.filter(({ media }) => Number(media.aspectRatio || 0) >= 2.3).length, 'ultrawide versions'),
      ],
      aspectRows,
      mediaRows
        .filter(({ media }) => Number(media.aspectRatio || 0) >= 2.3)
        .slice(0, 8)
        .map(({ item, media }) => publicItem(item, `${media.aspectRatio}:1`)),
    ),
    bitrateOutliers: model(
      'Find unusually dense media.',
      'Ranks the highest-bitrate versions and shows the overall bitrate distribution.',
      [
        metric(bitrateRows.length, 'measured versions'),
        metric(
          bitrateRows[0] ? `${Math.round(Number(bitrateRows[0].media.bitrate) / 1000)} Mbps` : '—',
          'highest bitrate',
        ),
        metric(bitrateRows.filter(({ media }) => Number(media.bitrate) >= 30_000).length, '30+ Mbps versions'),
      ],
      ranked(
        bitrateRows.map(({ media }) =>
          Number(media.bitrate) >= 40_000
            ? '40+ Mbps'
            : Number(media.bitrate) >= 20_000
              ? '20–39 Mbps'
              : Number(media.bitrate) >= 10_000
                ? '10–19 Mbps'
                : 'Under 10 Mbps',
        ),
      ),
      bitrateRows
        .slice(0, 8)
        .map(({ item, media }) => publicItem(item, `${(Number(media.bitrate) / 1000).toFixed(1)} Mbps`)),
    ),
    containerMigration: model(
      'Trace the wrappers around the archive.',
      'Shows current media containers and highlights formats that may benefit from remuxing or modernization.',
      [
        metric(containers.length, 'container families'),
        metric(containers[0]?.label || '—', 'dominant container'),
        metric(
          mediaRows.filter(({ media }) =>
            ['AVI', 'WMV', 'MPEG', 'MPG'].includes(String(media.container || '').toUpperCase()),
          ).length,
          'legacy containers',
        ),
      ],
      containers,
      mediaRows
        .filter(({ media }) => ['AVI', 'WMV', 'MPEG', 'MPG'].includes(String(media.container || '').toUpperCase()))
        .slice(0, 8)
        .map(({ item, media }) => publicItem(item, String(media.container).toUpperCase())),
    ),
    versionVault: model(
      'Explore titles with more than one physical form.',
      'Finds alternate resolutions, encodes and editions represented by multiple Plex media versions.',
      [
        metric(multiVersion.length, 'multi-version titles'),
        metric(
          multiVersion.reduce((sum, item) => sum + (item.Media || []).length, 0),
          'versions represented',
        ),
        metric(
          multiVersion.length
            ? (multiVersion.reduce((sum, item) => sum + (item.Media || []).length, 0) / multiVersion.length).toFixed(1)
            : 0,
          'versions per title',
        ),
      ],
      ranked(multiVersion.map((item) => `${(item.Media || []).length} versions`)),
      multiVersion
        .slice(0, 8)
        .map((item) =>
          publicItem(item, `${(item.Media || []).length} versions · ${(sizeOf(item) / 1024 ** 3).toFixed(1)} GB`),
        ),
    ),
    libraryVelocity: model(
      'Compare growth across every library.',
      'Measures library size alongside arrivals from the most recent ninety days.',
      [
        metric(libraries.length, 'libraries'),
        metric([...libraries].sort((a, b) => b.recent - a.recent)[0]?.label || '—', 'fastest growing'),
        metric(
          libraries.reduce((sum, row) => sum + row.recent, 0),
          '90-day arrivals',
        ),
      ],
      libraries.map((row) => ({ label: row.label, count: row.recent, detail: `${row.count} total` })),
    ),
    watchlistArchaeology: model(
      'Excavate the oldest unwatched arrivals.',
      'Measures how long untouched titles have waited since joining the server.',
      [
        metric(waiting.length, 'unwatched titles'),
        metric(waiting[0]?.addedAt ? Math.floor((now - Number(waiting[0].addedAt)) / DAY) : 0, 'oldest wait days'),
        metric(waiting.filter((item) => Number(item.addedAt || now) < now - 365 * DAY).length, 'waiting over a year'),
      ],
      ranked(
        waiting.map((item) => {
          const days = item.addedAt ? (now - Number(item.addedAt)) / DAY : 0;
          return days >= 1095 ? '3+ years' : days >= 365 ? '1–3 years' : days >= 90 ? '3–12 months' : 'Under 3 months';
        }),
      ),
      waiting
        .slice(0, 8)
        .map((item) =>
          publicItem(
            item,
            item.addedAt
              ? `${Math.floor((now - Number(item.addedAt)) / DAY).toLocaleString()} days waiting`
              : 'Arrival unknown',
          ),
        ),
    ),
    serendipityChain: model(
      'Eight films with deliberate tonal distance.',
      'Builds a high-rated unwatched path that avoids repeating the previous title’s primary genre.',
      [
        metric(diverseChain.length, 'chain links'),
        metric(new Set(diverseChain.flatMap((item) => tags(item, 'Genre'))).size, 'genres crossed'),
        metric(
          diverseChain.length ? (diverseChain.reduce((sum, item) => sum + minutes(item), 0) / 60).toFixed(1) : 0,
          'total hours',
        ),
      ],
      ranked(diverseChain.flatMap((item) => tags(item, 'Genre'))),
      diverseChain.map((item, index) =>
        publicItem(item, `Link ${index + 1} · ${tags(item, 'Genre')[0] || 'Unclassified'}`),
      ),
    ),
    personalCanon: model(
      'The titles with the strongest claim on your archive.',
      'Combines Plex play counts and ratings into an explainable personal-canon score.',
      [
        metric(canon.length, 'scored titles'),
        metric(canon[0]?.item.title || '—', 'highest claim'),
        metric(canon[0]?.score ? Math.round(canon[0].score) : 0, 'leading score'),
      ],
      ranked(canon.slice(0, 50).flatMap(({ item }) => tags(item, 'Genre'))),
      canon
        .slice(0, 8)
        .map(({ item, score }) =>
          publicItem(
            item,
            `Canon score ${Math.round(score)} · ${item.viewCount || 0} plays · ★ ${rating(item).toFixed(1)}`,
          ),
        ),
    ),
  };
}
