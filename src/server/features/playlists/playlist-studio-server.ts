const DAY = 86_400;

const genres = (item) => (item.Genre || []).map((entry) => entry.tag).filter(Boolean);
const rating = (item) => Number(item.audienceRating || item.rating || 0);
const criticRating = (item) => Number(item.rating || 0);
const audienceRating = (item) => Number(item.audienceRating || 0);
const minutes = (item) => Math.round(Number(item.duration || 0) / 60_000);
const unwatched = (item) => Number(item.viewCount || 0) === 0;
const watched = (item) => Number(item.viewCount || 0) > 0;
const resolution = (item) => String(item.Media?.[0]?.videoResolution || '').toLowerCase();
const videoCodec = (item) => String(item.Media?.[0]?.videoCodec || '').toLowerCase();
const bitrate = (item) => Math.max(0, ...(item.Media || []).map((media) => Number(media.bitrate || 0)));
const versionCount = (item) => (item.Media || []).length;
const year = (item) => Number(item.year || item.originallyAvailableAt?.slice?.(0, 4) || 0);
const progress = (item) => (Number(item.duration) ? Number(item.viewOffset || 0) / Number(item.duration) : 0);
const title = (item) =>
  item.grandparentTitle ? `${item.grandparentTitle} · ${item.title}` : item.title || 'Unknown title';
const audioChannels = (item) =>
  Math.max(
    0,
    ...(item.Media || []).flatMap((media) => [
      Number(media.audioChannels || 0),
      ...(media.Part || []).flatMap((part) =>
        (part.Stream || [])
          .filter((stream) => Number(stream.streamType) === 2)
          .map((stream) => Number(stream.channels || 0)),
      ),
    ]),
  );
const hdr = (item) =>
  (item.Media || []).some((media) =>
    /hdr|dolby vision|dovi|smpte2084|arib-std-b67/i.test(
      [
        media.videoDynamicRange,
        ...(media.Part || []).flatMap((part) =>
          (part.Stream || [])
            .filter((stream) => Number(stream.streamType) === 1)
            .flatMap((stream) => [
              stream.dynamicRange,
              stream.displayTitle,
              stream.extendedDisplayTitle,
              stream.colorTrc,
            ]),
        ),
      ]
        .filter(Boolean)
        .join(' '),
    ),
  );

const baseDefinitions = [
  {
    id: 'fresh',
    category: 'Discovery',
    name: 'Fresh & Unwatched',
    eyebrow: 'NEW ARRIVALS',
    description: 'Recently added titles nobody has finished yet.',
    tone: 'cyan',
    test: (item, now) => unwatched(item) && Number(item.addedAt || 0) > now - 30 * DAY,
    sort: (a, b) => Number(b.addedAt || 0) - Number(a.addedAt || 0),
  },
  {
    id: 'essentials',
    category: 'Discovery',
    name: 'Unwatched Essentials',
    eyebrow: 'QUALITY QUEUE',
    description: 'Your strongest-rated unwatched films and episodes.',
    tone: 'amber',
    test: (item) => unwatched(item) && rating(item) >= 7.5,
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'finish',
    category: 'Progress',
    name: 'Finish Line',
    eyebrow: 'CONTINUE WATCHING',
    description: 'Partially watched stories closest to completion.',
    tone: 'violet',
    test: (item) => progress(item) >= 0.05 && progress(item) < 0.9,
    sort: (a, b) => progress(b) - progress(a),
  },
  {
    id: 'short',
    category: 'Runtime',
    name: 'Under 105 Minutes',
    eyebrow: 'QUICK WATCH',
    description: 'Compact unwatched films for a shorter evening.',
    tone: 'cyan',
    test: (item) => item.type === 'movie' && unwatched(item) && minutes(item) > 0 && minutes(item) <= 105,
    sort: (a, b) => rating(b) - rating(a) || minutes(a) - minutes(b),
  },
  {
    id: 'epic',
    category: 'Runtime',
    name: 'Weekend Epics',
    eyebrow: 'LONG FORM',
    description: 'Highly rated films that deserve an unhurried night.',
    tone: 'rose',
    test: (item) => item.type === 'movie' && minutes(item) >= 140 && rating(item) >= 7,
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'showcase',
    category: 'Cinema',
    name: '4K Showcase',
    eyebrow: 'DISPLAY MODE',
    description: 'The sharpest 4K titles available on your server.',
    tone: 'violet',
    test: (item) => resolution(item).includes('4k'),
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'scifi',
    category: 'Mood',
    name: 'Science-Fiction Voyage',
    eyebrow: 'GENRE SIGNAL',
    description: 'Science fiction ranked by audience response.',
    tone: 'cyan',
    test: (item) => genres(item).includes('Science Fiction'),
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'comfort',
    category: 'Mood',
    name: 'Comfort Queue',
    eyebrow: 'MOOD · LIGHT',
    description: 'Comedy, animation and romance with an easy tone.',
    tone: 'amber',
    test: (item) => genres(item).some((value) => ['Comedy', 'Animation', 'Romance'].includes(value)),
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'horror',
    category: 'Mood',
    name: 'After Dark',
    eyebrow: 'MOOD · DARK',
    description: 'Horror and thriller titles for a late-night run.',
    tone: 'rose',
    test: (item) => genres(item).some((value) => ['Horror', 'Thriller'].includes(value)),
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'family',
    category: 'Household',
    name: 'Family Night',
    eyebrow: 'HOUSEHOLD PICK',
    description: 'Family and animation titles suitable for a shared screen.',
    tone: 'violet',
    test: (item) => genres(item).some((value) => ['Family', 'Animation'].includes(value)),
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'hidden-gems',
    category: 'Discovery',
    name: 'Hidden Gems',
    eyebrow: 'DEEP LIBRARY SIGNAL',
    description: 'Highly rated unwatched titles that have been waiting for six months.',
    tone: 'amber',
    test: (item, now) =>
      unwatched(item) && rating(item) >= 7 && Number(item.addedAt || 0) > 0 && Number(item.addedAt) < now - 180 * DAY,
    sort: (a, b) => rating(b) - rating(a) || Number(a.addedAt || 0) - Number(b.addedAt || 0),
  },
  {
    id: 'rediscover',
    category: 'Progress',
    name: 'Rediscover Favourites',
    eyebrow: 'LONG-TIME NO SEE',
    description: 'Strongly rated titles you watched before, but not in the last six months.',
    tone: 'violet',
    test: (item, now) =>
      watched(item) &&
      rating(item) >= 7.5 &&
      Number(item.lastViewedAt || 0) > 0 &&
      Number(item.lastViewedAt) < now - 180 * DAY,
    sort: (a, b) => Number(a.lastViewedAt || 0) - Number(b.lastViewedAt || 0),
  },
  {
    id: 'acclaimed',
    category: 'Discovery',
    name: 'Critics’ Circle',
    eyebrow: 'CRITICAL SIGNAL',
    description: 'Unwatched titles carrying an exceptional Plex critic rating.',
    tone: 'amber',
    test: (item) => unwatched(item) && criticRating(item) >= 8,
    sort: (a, b) => criticRating(b) - criticRating(a) || rating(b) - rating(a),
  },
  {
    id: 'hdr',
    category: 'Cinema',
    name: 'HDR Lightstorm',
    eyebrow: 'DYNAMIC RANGE',
    description: 'HDR and Dolby Vision titles ready to light up a capable display.',
    tone: 'cyan',
    test: (item) => hdr(item),
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'surround',
    category: 'Cinema',
    name: 'Surround Soundstage',
    eyebrow: 'AUDIO SHOWCASE',
    description: 'Titles with 5.1-channel or better audio for the cinema room.',
    tone: 'violet',
    test: (item) => audioChannels(item) >= 6,
    sort: (a, b) => audioChannels(b) - audioChannels(a) || rating(b) - rating(a),
  },
  {
    id: 'quick-episodes',
    category: 'Runtime',
    name: 'Quick Episode Run',
    eyebrow: 'UNDER 35 MINUTES',
    description: 'Short unwatched episodes for a compact viewing session.',
    tone: 'cyan',
    test: (item) => item.type === 'episode' && unwatched(item) && minutes(item) > 0 && minutes(item) <= 35,
    sort: (a, b) => rating(b) - rating(a) || minutes(a) - minutes(b),
  },
  {
    id: 'documentary',
    category: 'Mood',
    name: 'Documentary Lens',
    eyebrow: 'REAL STORIES',
    description: 'Documentary films and episodes ranked by audience response.',
    tone: 'amber',
    test: (item) => genres(item).includes('Documentary'),
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'crime',
    category: 'Mood',
    name: 'Crime Files',
    eyebrow: 'MYSTERY SIGNAL',
    description: 'Crime, mystery and detective stories for an investigative run.',
    tone: 'rose',
    test: (item) => genres(item).some((value) => ['Crime', 'Mystery'].includes(value)),
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'eighties',
    category: 'Era',
    name: 'Eighties Rewind',
    eyebrow: '1980—1989',
    description: 'The strongest signals from your neon decade collection.',
    tone: 'rose',
    test: (item) => year(item) >= 1980 && year(item) <= 1989,
    sort: (a, b) => rating(b) - rating(a) || year(a) - year(b),
  },
  {
    id: 'nineties',
    category: 'Era',
    name: 'Nineties Time Capsule',
    eyebrow: '1990—1999',
    description: 'A ranked trip through the films and television of the nineties.',
    tone: 'violet',
    test: (item) => year(item) >= 1990 && year(item) <= 1999,
    sort: (a, b) => rating(b) - rating(a) || year(a) - year(b),
  },
  {
    id: 'modern-classics',
    category: 'Era',
    name: 'Modern Classics',
    eyebrow: '2000—2014',
    description: 'Exceptional turn-of-the-century titles rated eight or better.',
    tone: 'amber',
    test: (item) => year(item) >= 2000 && year(item) <= 2014 && rating(item) >= 8,
    sort: (a, b) => rating(b) - rating(a) || year(a) - year(b),
  },
  {
    id: 'latest-releases',
    category: 'Discovery',
    name: 'Latest Releases',
    eyebrow: 'NEW CINEMA',
    description: 'Unwatched titles released within the last two calendar years.',
    tone: 'cyan',
    test: (item, now) => unwatched(item) && year(item) >= new Date(now * 1000).getUTCFullYear() - 1,
    sort: (a, b) => year(b) - year(a) || rating(b) - rating(a),
  },
];

const genreDefinitions = [
  ['action-surge', 'Action Surge', 'HIGH VELOCITY', 'Action ranked for maximum momentum.', ['Action'], 'rose'],
  [
    'adventure-map',
    'Adventure Map',
    'WIDE HORIZONS',
    'Expeditions, quests and journeys across the collection.',
    ['Adventure'],
    'amber',
  ],
  [
    'drama-depths',
    'Drama Depths',
    'CHARACTER SIGNAL',
    'The strongest character-led stories in your archive.',
    ['Drama'],
    'violet',
  ],
  [
    'fantasy-realms',
    'Fantasy Realms',
    'OTHER WORLDS',
    'Magic, myth and impossible worlds ranked by response.',
    ['Fantasy'],
    'violet',
  ],
  ['romance-orbit', 'Romance Orbit', 'HEART SIGNAL', 'Romance stories for a warmer viewing run.', ['Romance'], 'rose'],
  [
    'animation-vault',
    'Animation Vault',
    'DRAWN WORLDS',
    'Animation across every era, ranked by audience response.',
    ['Animation'],
    'cyan',
  ],
  [
    'history-war',
    'History at Scale',
    'PAST & CONFLICT',
    'History and war stories with broad historical scope.',
    ['History', 'War'],
    'amber',
  ],
  [
    'music-stage',
    'Music on Screen',
    'SOUND & PERFORMANCE',
    'Music, concert and performance-led stories.',
    ['Music', 'Musical'],
    'cyan',
  ],
  [
    'western-trails',
    'Western Trails',
    'FRONTIER SIGNAL',
    'Classic and modern westerns from the open range.',
    ['Western'],
    'amber',
  ],
  [
    'remarkable-lives',
    'Remarkable Lives',
    'PEOPLE & PURSUIT',
    'Biography and sport stories shaped by real achievement.',
    ['Biography', 'Sport'],
    'violet',
  ],
].map(([id, name, eyebrow, description, genreNames, tone]) => ({
  id,
  category: 'Genre',
  name,
  eyebrow,
  description,
  tone,
  test: (item) => genres(item).some((value) => genreNames.includes(value)),
  sort: (a, b) => rating(b) - rating(a) || year(b) - year(a),
}));

const eraSignals: [string, string, string, string, number, number, string][] = [
  [
    'golden-age',
    'Golden Age Archive',
    'BEFORE 1960',
    'The strongest surviving signals from cinema before 1960.',
    0,
    1959,
    'amber',
  ],
  [
    'sixties-scope',
    'Sixties Scope',
    '1960—1969',
    'A widescreen trip through the cultural shifts of the sixties.',
    1960,
    1969,
    'cyan',
  ],
  [
    'seventies-grit',
    'Seventies Grit',
    '1970—1979',
    'Bold, restless and influential stories from the seventies.',
    1970,
    1979,
    'rose',
  ],
  [
    'twenty-tens',
    '2010s Reframed',
    '2010—2019',
    'The most highly rated titles from the previous decade.',
    2010,
    2019,
    'violet',
  ],
];
const eraDefinitions = eraSignals.map(([id, name, eyebrow, description, from, to, tone]) => ({
  id,
  category: 'Era',
  name,
  eyebrow,
  description,
  tone,
  test: (item) => year(item) >= from && year(item) <= to,
  sort: (a, b) => rating(b) - rating(a) || year(a) - year(b),
}));

const additionalDefinitions = [
  ...genreDefinitions,
  ...eraDefinitions,
  {
    id: 'current-decade',
    category: 'Era',
    name: 'Current Decade Pulse',
    eyebrow: '2020—NOW',
    description: 'Recent-decade releases ranked by audience response.',
    tone: 'cyan',
    test: (item, now) => year(item) >= Math.floor(new Date(now * 1000).getUTCFullYear() / 10) * 10,
    sort: (a, b) => rating(b) - rating(a) || year(b) - year(a),
  },
  {
    id: 'ninety-minute-window',
    category: 'Runtime',
    name: 'Ninety-Minute Window',
    eyebrow: '76—95 MINUTES',
    description: 'Unwatched films that fit a precise compact feature window.',
    tone: 'cyan',
    test: (item) => item.type === 'movie' && unwatched(item) && minutes(item) >= 76 && minutes(item) <= 95,
    sort: (a, b) => rating(b) - rating(a) || minutes(a) - minutes(b),
  },
  {
    id: 'two-hour-sweet-spot',
    category: 'Runtime',
    name: 'Two-Hour Sweet Spot',
    eyebrow: '106—125 MINUTES',
    description: 'Unwatched films built for a conventional feature-length evening.',
    tone: 'amber',
    test: (item) => item.type === 'movie' && unwatched(item) && minutes(item) >= 106 && minutes(item) <= 125,
    sort: (a, b) => rating(b) - rating(a) || minutes(a) - minutes(b),
  },
  {
    id: 'mini-episodes',
    category: 'Runtime',
    name: 'Mini Episode Stack',
    eyebrow: '22 MINUTES OR LESS',
    description: 'Very short unwatched episodes for a rapid viewing stack.',
    tone: 'cyan',
    test: (item) => item.type === 'episode' && unwatched(item) && minutes(item) > 0 && minutes(item) <= 22,
    sort: (a, b) => minutes(a) - minutes(b) || rating(b) - rating(a),
  },
  {
    id: 'prestige-episodes',
    category: 'Runtime',
    name: 'Prestige Episode Run',
    eyebrow: '40—65 MINUTES',
    description: 'Longer-form episodes ranked for a focused television session.',
    tone: 'violet',
    test: (item) => item.type === 'episode' && minutes(item) >= 40 && minutes(item) <= 65,
    sort: (a, b) => rating(b) - rating(a) || minutes(a) - minutes(b),
  },
  {
    id: 'audience-nines',
    category: 'Quality',
    name: 'Audience Nines',
    eyebrow: 'RATED 9+',
    description: 'The rare titles carrying an audience rating of nine or higher.',
    tone: 'amber',
    test: (item) => audienceRating(item) >= 9,
    sort: (a, b) => audienceRating(b) - audienceRating(a) || year(b) - year(a),
  },
  {
    id: 'critical-consensus',
    category: 'Quality',
    name: 'Critical Consensus',
    eyebrow: 'DUAL 8+ SIGNAL',
    description: 'Titles where critics and audiences both score eight or better.',
    tone: 'violet',
    test: (item) => criticRating(item) >= 8 && audienceRating(item) >= 8,
    sort: (a, b) => criticRating(b) + audienceRating(b) - criticRating(a) - audienceRating(a),
  },
  {
    id: 'audience-defenders',
    category: 'Quality',
    name: 'Audience Defenders',
    eyebrow: 'VIEWERS DISAGREE',
    description: 'Films audiences rate substantially higher than critics.',
    tone: 'rose',
    test: (item) =>
      audienceRating(item) > 0 && criticRating(item) > 0 && audienceRating(item) - criticRating(item) >= 1.5,
    sort: (a, b) => audienceRating(b) - criticRating(b) - (audienceRating(a) - criticRating(a)),
  },
  {
    id: 'critic-champions',
    category: 'Quality',
    name: 'Critic Champions',
    eyebrow: 'CRITICS DISAGREE',
    description: 'Films critics rate substantially higher than audiences.',
    tone: 'cyan',
    test: (item) =>
      audienceRating(item) > 0 && criticRating(item) > 0 && criticRating(item) - audienceRating(item) >= 1.5,
    sort: (a, b) => criticRating(b) - audienceRating(b) - (criticRating(a) - audienceRating(a)),
  },
  {
    id: 'unrated-frontier',
    category: 'Quality',
    name: 'Unrated Frontier',
    eyebrow: 'NO SCORE · UNWATCHED',
    description: 'Unwatched titles with no audience or critic score to guide the choice.',
    tone: 'violet',
    test: (item) => unwatched(item) && audienceRating(item) === 0 && criticRating(item) === 0,
    sort: (a, b) => Number(b.addedAt || 0) - Number(a.addedAt || 0),
  },
  {
    id: 'full-hd-showcase',
    category: 'Cinema',
    name: 'Full HD Showcase',
    eyebrow: '1080P SIGNAL',
    description: 'The strongest 1080p titles for screens without a 4K requirement.',
    tone: 'cyan',
    test: (item) => resolution(item).includes('1080'),
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'sd-rescue',
    category: 'Cinema',
    name: 'SD Rescue Shelf',
    eyebrow: 'RESTORATION CANDIDATES',
    description: 'Standard-definition titles worth reviewing for a better edition.',
    tone: 'rose',
    test: (item) => Boolean(resolution(item)) && !/4k|2160|1080|720/.test(resolution(item)),
    sort: (a, b) => rating(b) - rating(a) || year(a) - year(b),
  },
  {
    id: 'hevc-showcase',
    category: 'Cinema',
    name: 'HEVC Efficiency Reel',
    eyebrow: 'H.265 · HEVC',
    description: 'Modern HEVC-encoded titles ranked for a quality showcase.',
    tone: 'cyan',
    test: (item) => /hevc|h265|x265/.test(videoCodec(item)),
    sort: (a, b) => rating(b) - rating(a) || bitrate(b) - bitrate(a),
  },
  {
    id: 'av1-future',
    category: 'Cinema',
    name: 'AV1 Future Reel',
    eyebrow: 'NEXT-GEN CODEC',
    description: 'AV1 titles from the most efficient edge of the library.',
    tone: 'violet',
    test: (item) => videoCodec(item).includes('av1'),
    sort: (a, b) => rating(b) - rating(a) || bitrate(b) - bitrate(a),
  },
  {
    id: 'high-bitrate',
    category: 'Cinema',
    name: 'High-Bitrate Theatre',
    eyebrow: '15 MBPS+',
    description: 'High-bandwidth media intended for a capable local cinema setup.',
    tone: 'amber',
    test: (item) => bitrate(item) >= 15_000,
    sort: (a, b) => bitrate(b) - bitrate(a) || rating(b) - rating(a),
  },
  {
    id: 'multi-version',
    category: 'Cinema',
    name: 'Edition Choice',
    eyebrow: 'MULTIPLE VERSIONS',
    description: 'Titles with more than one media version available in Plex.',
    tone: 'violet',
    test: (item) => versionCount(item) > 1,
    sort: (a, b) => versionCount(b) - versionCount(a) || rating(b) - rating(a),
  },
  {
    id: 'barely-started',
    category: 'Progress',
    name: 'Second Chance Starts',
    eyebrow: '5—25% WATCHED',
    description: 'Stories started briefly and left near the beginning.',
    tone: 'violet',
    test: (item) => progress(item) >= 0.05 && progress(item) <= 0.25,
    sort: (a, b) => progress(a) - progress(b) || rating(b) - rating(a),
  },
  {
    id: 'almost-finished',
    category: 'Progress',
    name: 'Final Stretch',
    eyebrow: '75—95% WATCHED',
    description: 'Nearly completed titles that need one final session.',
    tone: 'amber',
    test: (item) => progress(item) >= 0.75 && progress(item) < 0.95,
    sort: (a, b) => progress(b) - progress(a),
  },
  {
    id: 'frequent-rewatches',
    category: 'Progress',
    name: 'Household Classics',
    eyebrow: 'WATCHED 2+ TIMES',
    description: 'Titles the household returns to repeatedly.',
    tone: 'rose',
    test: (item) => Number(item.viewCount || 0) >= 2,
    sort: (a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0) || rating(b) - rating(a),
  },
  {
    id: 'recently-loved',
    category: 'Progress',
    name: 'Recently Loved',
    eyebrow: 'LAST 90 DAYS',
    description: 'Highly rated titles watched recently and ready for another orbit.',
    tone: 'cyan',
    test: (item, now) => watched(item) && rating(item) >= 7.5 && Number(item.lastViewedAt || 0) >= now - 90 * DAY,
    sort: (a, b) => Number(b.lastViewedAt || 0) - Number(a.lastViewedAt || 0),
  },
  {
    id: 'feel-good',
    category: 'Mood',
    name: 'Feel-Good Frequency',
    eyebrow: 'UPLIFT MODE',
    description: 'Comedy, family and music signals for a lighter session.',
    tone: 'amber',
    test: (item) => genres(item).some((value) => ['Comedy', 'Family', 'Music', 'Musical'].includes(value)),
    sort: (a, b) => rating(b) - rating(a) || minutes(a) - minutes(b),
  },
  {
    id: 'adrenaline',
    category: 'Mood',
    name: 'Adrenaline Circuit',
    eyebrow: 'MAXIMUM MOMENTUM',
    description: 'Action, thriller and war stories ranked for intensity.',
    tone: 'rose',
    test: (item) => genres(item).some((value) => ['Action', 'Thriller', 'War'].includes(value)),
    sort: (a, b) => rating(b) - rating(a) || minutes(b) - minutes(a),
  },
  {
    id: 'rainy-day',
    category: 'Mood',
    name: 'Rainy-Day Stories',
    eyebrow: 'SLOW-BURN MODE',
    description: 'Drama and mystery for a patient, atmospheric afternoon.',
    tone: 'violet',
    test: (item) => genres(item).some((value) => ['Drama', 'Mystery'].includes(value)) && minutes(item) >= 90,
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'date-night',
    category: 'Household',
    name: 'Date-Night Signal',
    eyebrow: 'SHARED SCREEN',
    description: 'Romance and comedy with a strong audience response.',
    tone: 'rose',
    test: (item) => rating(item) >= 6.5 && genres(item).some((value) => ['Romance', 'Comedy'].includes(value)),
    sort: (a, b) => rating(b) - rating(a) || minutes(a) - minutes(b),
  },
  {
    id: 'mind-benders',
    category: 'Mood',
    name: 'Mind-Bender Matrix',
    eyebrow: 'REALITY OPTIONAL',
    description: 'Highly rated science fiction and mystery built to provoke debate.',
    tone: 'cyan',
    test: (item) => rating(item) >= 7 && genres(item).some((value) => ['Science Fiction', 'Mystery'].includes(value)),
    sort: (a, b) => rating(b) - rating(a),
  },
  {
    id: 'true-stories',
    category: 'Mood',
    name: 'True Story Current',
    eyebrow: 'REAL-WORLD SIGNAL',
    description: 'Documentary, biography and history grounded in real events.',
    tone: 'amber',
    test: (item) => genres(item).some((value) => ['Documentary', 'Biography', 'History'].includes(value)),
    sort: (a, b) => rating(b) - rating(a) || year(b) - year(a),
  },
];

const definitions = [...baseDefinitions, ...additionalDefinitions];

function publicItem(item) {
  return {
    ratingKey: String(item.ratingKey),
    title: title(item),
    year: item.year || null,
    type: item.type || 'video',
    library: item.libraryTitle || '',
    rating: rating(item),
    minutes: minutes(item),
    progress: Math.round(progress(item) * 100),
    detail: [
      item.year,
      item.type,
      minutes(item) ? `${minutes(item)} min` : '',
      rating(item) ? `★ ${rating(item).toFixed(1)}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    poster: `/api/art/${item.ratingKey}`,
    plexUrl: `/api/plex/open/${item.ratingKey}`,
  };
}

export function buildPlaylistGenerators(items, now = Date.now() / 1000) {
  const usable = items.filter((item) => item.ratingKey && ['movie', 'episode'].includes(item.type));
  return definitions.map((definition) => {
    const matches = usable.filter((item) => definition.test(item, now)).sort(definition.sort);
    return {
      ...definition,
      count: matches.length,
      totalMinutes: matches.reduce((sum, item) => sum + minutes(item), 0),
      items: matches,
    };
  });
}

const composerTypes = new Set(['all', 'movie', 'episode']);
const composerWatchStates = new Set(['all', 'unwatched', 'watched', 'in-progress']);
const composerSorts = new Set(['rating', 'newest', 'shortest', 'recently-added']);

export function normalizeComposerCriteria(input: any = {}) {
  const type = composerTypes.has(input.type) ? input.type : 'all';
  const watchState = composerWatchStates.has(input.watchState) ? input.watchState : 'all';
  const sort = composerSorts.has(input.sort) ? input.sort : 'rating';
  const genre = String(input.genre || '')
    .trim()
    .slice(0, 60);
  const resolutionValue = String(input.resolution || 'all').toLowerCase();
  const resolutionFilter = ['all', '4k', '1080', '720', 'sd'].includes(resolutionValue) ? resolutionValue : 'all';
  const decadeValue = Number(input.decade || 0);
  const decade = decadeValue >= 1900 && decadeValue <= 2090 && decadeValue % 10 === 0 ? decadeValue : 0;
  const minRating = Math.min(10, Math.max(0, Number(input.minRating || 0)));
  const maxMinutes = Math.min(600, Math.max(0, Number(input.maxMinutes || 0)));
  return { type, watchState, genre, decade, minRating, maxMinutes, resolution: resolutionFilter, sort };
}

export function composePlaylist(items, input: any = {}) {
  const criteria = normalizeComposerCriteria(input);
  const expectedGenre = criteria.genre.toLowerCase();
  const matches = items.filter((item) => {
    if (!item.ratingKey || !['movie', 'episode'].includes(item.type)) return false;
    if (criteria.type !== 'all' && item.type !== criteria.type) return false;
    if (criteria.watchState === 'unwatched' && !unwatched(item)) return false;
    if (criteria.watchState === 'watched' && !watched(item)) return false;
    if (criteria.watchState === 'in-progress' && !(progress(item) >= 0.05 && progress(item) < 0.95)) return false;
    if (expectedGenre && !genres(item).some((value) => value.toLowerCase() === expectedGenre)) return false;
    if (criteria.decade && !(year(item) >= criteria.decade && year(item) <= criteria.decade + 9)) return false;
    if (criteria.minRating && rating(item) < criteria.minRating) return false;
    if (criteria.maxMinutes && (!minutes(item) || minutes(item) > criteria.maxMinutes)) return false;
    const itemResolution = resolution(item);
    if (criteria.resolution === '4k' && !itemResolution.includes('4k')) return false;
    if (criteria.resolution === '1080' && !itemResolution.includes('1080')) return false;
    if (criteria.resolution === '720' && !itemResolution.includes('720')) return false;
    if (criteria.resolution === 'sd' && /4k|1080|720/.test(itemResolution)) return false;
    return true;
  });
  const sorters = {
    rating: (a, b) => rating(b) - rating(a) || year(b) - year(a),
    newest: (a, b) => year(b) - year(a) || rating(b) - rating(a),
    shortest: (a, b) => (minutes(a) || Infinity) - (minutes(b) || Infinity) || rating(b) - rating(a),
    'recently-added': (a, b) => Number(b.addedAt || 0) - Number(a.addedAt || 0) || rating(b) - rating(a),
  };
  return { criteria, items: matches.sort(sorters[criteria.sort]) };
}

export function playlistComposerFacets(items) {
  const usable = items.filter((item) => item.ratingKey && ['movie', 'episode'].includes(item.type));
  const genreCounts = new Map<string, number>();
  for (const item of usable)
    for (const value of genres(item)) genreCounts.set(value, (genreCounts.get(value) || 0) + 1);
  const availableDecades: number[] = [
    ...new Set<number>(
      usable.map((item) => Math.floor(year(item) / 10) * 10).filter((value) => value >= 1900 && value <= 2090),
    ),
  ].sort((a, b) => b - a);
  return {
    genres: [...genreCounts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count })),
    decades: availableDecades,
    resolutions: [...new Set(usable.map(resolution).filter(Boolean))].sort(),
  };
}

export async function previewPlaylistComposition(config, dependencies, input) {
  const items = await catalog(config, dependencies);
  const composed = composePlaylist(items, input);
  return {
    criteria: composed.criteria,
    count: composed.items.length,
    totalMinutes: composed.items.reduce((sum, item) => sum + minutes(item), 0),
    sample: composed.items.slice(0, 20).map(publicItem),
  };
}

export function playlistCreatePath(machineIdentifier, playlistTitle, ratingKeys) {
  const machine = String(machineIdentifier || '').trim();
  const name = String(playlistTitle || '')
    .trim()
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 80);
  const keys = ratingKeys.map(String).filter((key) => /^\d+$/.test(key));
  if (!machine) throw new Error('Plex did not provide its server identifier.');
  if (!name) throw new Error('Give the playlist a name.');
  if (!keys.length) throw new Error('This generator has no matching titles.');
  const uri = `server://${machine}/com.plexapp.plugins.library/library/metadata/${keys.join(',')}`;
  return `/playlists?type=video&smart=0&title=${encodeURIComponent(name)}&uri=${encodeURIComponent(uri)}`;
}

async function catalog(config, { plexFetch, libraryItems }) {
  const sections = await plexFetch(config, '/library/sections');
  const libraries = (sections.MediaContainer?.Directory || []).filter((item) => ['movie', 'show'].includes(item.type));
  return (await Promise.all(libraries.map((library) => libraryItems(config, library)))).flat();
}

function publicGenerator(generator) {
  const { items } = generator;
  const safe = { ...generator };
  delete safe.test;
  delete safe.sort;
  delete safe.items;
  return { ...safe, available: items.length > 0, sample: items.slice(0, 12).map(publicItem) };
}

export async function playlistStudio(config, dependencies) {
  const items = await catalog(config, dependencies);
  let existing = [];
  try {
    const response = await dependencies.plexFetch(config, '/playlists?playlistType=video');
    existing = (response.MediaContainer?.Metadata || response.MediaContainer?.Directory || []).map((item) => ({
      ratingKey: String(item.ratingKey || ''),
      title: item.title || 'Untitled playlist',
      itemCount: Number(item.leafCount || item.childCount || 0),
      durationMinutes: Math.round(Number(item.duration || 0) / 60_000),
      poster: item.thumb ? `/api/art/${item.ratingKey}` : '',
    }));
  } catch {
    /* Playlist generation remains available if Plex cannot list existing playlists. */
  }
  return {
    catalogSize: items.length,
    existing,
    generators: buildPlaylistGenerators(items).map(publicGenerator),
    composer: playlistComposerFacets(items),
    generatedAt: new Date().toISOString(),
  };
}

export async function createGeneratedPlaylist(config, dependencies, input) {
  if (input?.confirmed !== true) throw new Error('Confirm playlist creation before continuing.');
  const items = await catalog(config, dependencies);
  const custom = input.generatorId === 'custom';
  const generator = custom
    ? { id: 'custom', name: 'Custom Signal', items: composePlaylist(items, input.criteria).items }
    : buildPlaylistGenerators(items).find((entry) => entry.id === input.generatorId);
  if (!generator) throw new Error('Unknown playlist generator.');
  const limit = Math.min(100, Math.max(1, Number(input.limit || 30)));
  const selected = generator.items.slice(0, limit);
  const identity = await dependencies.inspectPlex(config);
  const playlistTitle = String(input.title || generator.name).trim();
  await dependencies.plexCommand(
    config,
    playlistCreatePath(
      identity.machineIdentifier,
      playlistTitle,
      selected.map((item) => item.ratingKey),
    ),
    'POST',
  );
  return {
    title: playlistTitle.slice(0, 80),
    itemCount: selected.length,
    generatorId: generator.id,
    items: selected.slice(0, 12).map(publicItem),
  };
}
