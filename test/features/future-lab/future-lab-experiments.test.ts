import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArchiveAnomalies,
  buildMemoryLane,
  buildMoodWeather,
  buildRuntimeWormhole,
} from '../../../src/server/features/future-lab/future-lab-experiments.ts';
import { buildFutureLabSignals } from '../../../src/server/features/future-lab/future-lab-signals.ts';
import {
  buildExpandedFutureLabs,
  expandedLabTabs,
} from '../../../src/server/features/future-lab/future-lab-expanded.ts';
import {
  buildViewingOracle,
  deterministicPairs,
  futureLab,
} from '../../../src/server/features/future-lab/future-lab-server.ts';
import { renderFutureLabExperiment } from '../../../src/client/features/future-lab/future-lab-experiments.ts';
import { renderFutureLabSignal } from '../../../src/client/features/future-lab/future-lab-signals.ts';

const now = Date.UTC(2026, 8, 5, 12) / 1000;
const items = [
  {
    ratingKey: '1',
    title: 'Bright Future',
    year: 2021,
    duration: 100 * 60_000,
    audienceRating: 8.2,
    addedAt: now - 500 * 86_400,
    Genre: [{ tag: 'Science Fiction' }],
    Director: [{ tag: 'Ada North' }],
  },
  {
    ratingKey: '2',
    title: 'Night Signal',
    year: 1984,
    duration: 130 * 60_000,
    audienceRating: 8.0,
    addedAt: now - 300 * 86_400,
    Genre: [{ tag: 'Thriller' }],
    Director: [{ tag: 'Bea West' }],
  },
  {
    ratingKey: '3',
    title: 'Small Laugh',
    year: 1988,
    duration: 42 * 60_000,
    viewCount: 1,
    Genre: [{ tag: 'Comedy' }],
    Director: [{ tag: 'Cy East' }],
  },
  {
    ratingKey: '4',
    title: 'Long Orbit',
    year: 1965,
    duration: 205 * 60_000,
    audienceRating: 6.5,
    Genre: [{ tag: 'Science Fiction' }],
    Director: [{ tag: 'Ada North' }],
  },
  {
    ratingKey: '5',
    title: 'Rare Earth',
    year: 2015,
    duration: 88 * 60_000,
    audienceRating: 7.7,
    Genre: [{ tag: 'Geology' }],
    Director: [{ tag: 'Dee South' }],
  },
];
const history = [
  { ratingKey: '1', title: 'Bright Future', viewedAt: now - 2 * 86_400 },
  { ratingKey: '2', title: 'Night Signal', viewedAt: now - 5 * 86_400 },
  { ratingKey: '2', title: 'Night Signal', viewedAt: now - 12 * 86_400 },
  { ratingKey: '3', title: 'Small Laugh', viewedAt: now - 40 * 86_400 },
  { ratingKey: '3', title: 'Small Laugh', viewedAt: now - 200 * 86_400 },
];

test('Memory Lane connects Plex plays to catalogue eras and calendar months', () => {
  const result = buildMemoryLane(items, history, now);
  assert.equal(result.matchedPlays, 5);
  assert.equal(result.uniqueTitles, 3);
  assert.equal(result.favouriteDecade, '1980s');
  assert.equal(result.months.length, 12);
  assert.equal(result.recent[0].title, 'Bright Future');
});

test('Mood Weather compares recent genre pressure with the previous window', () => {
  const result = buildMoodWeather(items, history, now);
  assert.equal(result.recentPlays, 3);
  assert.equal(result.previousPlays, 1);
  assert.equal(result.momentum, 2);
  assert.equal(result.forecast.leadGenre, 'Thriller');
  assert.equal(result.forecast.name, 'Electric storm');
  assert.deepEqual(
    result.signals.find((signal) => signal.genre === 'Comedy'),
    { genre: 'Comedy', recent: 0, previous: 1, delta: -1 },
  );
});

test('Runtime Wormhole builds duration bands and instant viewing choices', () => {
  const result = buildRuntimeWormhole(items);
  assert.equal(result.medianMinutes, 100);
  assert.equal(result.buckets.find((bucket) => bucket.label === 'Short signal').count, 1);
  assert.equal(result.buckets.find((bucket) => bucket.label === 'Event horizon').count, 1);
  assert.equal(result.buckets.find((bucket) => bucket.label === 'Event horizon').titles[0].title, 'Long Orbit');
  assert.equal(result.windows.find((window) => window.minutes === 90).choices, 1);
  assert.equal(result.windows.find((window) => window.minutes === 90).titles.length, 1);
  assert.equal(result.longest[0].title, 'Long Orbit');
});

test('Archive Anomalies finds rare genres, one-off directors and buried gems', () => {
  const result = buildArchiveAnomalies(items, now);
  assert.deepEqual(
    result.rareGenres.find((item) => item.genre === 'Geology'),
    { genre: 'Geology', count: 1 },
  );
  assert.ok(result.oneOffDirectors.includes('Dee South'));
  assert.equal(result.highRatedWaiting, 3);
  assert.equal(result.buriedGems[0].title, 'Bright Future');
  assert.equal(result.oldestUnwatched[0].title, 'Long Orbit');
});

test('Future Lab response includes every experiment model', async () => {
  const result = await futureLab(
    {},
    {
      discoveryCatalog: async () => items,
      plexFetch: async () => ({ MediaContainer: { Metadata: history } }),
    },
    true,
  );
  assert.equal(result.schemaVersion, 5);
  assert.deepEqual(result.doubleFeature, result.doubleFeatures[0]);
  for (const key of ['memoryLane', 'moodWeather', 'runtimeWormhole', 'archiveAnomalies']) assert.ok(result[key]);
  for (const key of [
    'backlogHorizon',
    'rewatchDna',
    'genreDrift',
    'nightChronotype',
    'collectionPulse',
    'ratingLens',
    'codecArchaeology',
    'storageTopology',
    'genreBridges',
    'decadePassport',
    'durationDna',
    'seasonalEchoes',
  ])
    assert.ok(result[key], `${key} should be included`);
  assert.equal(Object.keys(result.expandedLabs).length, 30);
});

test('thirty expanded experiments expose live metrics with stable navigation identifiers', () => {
  const models = buildExpandedFutureLabs(items, history, now);
  assert.equal(expandedLabTabs.length, 30);
  assert.equal(new Set(expandedLabTabs.map(([id]) => id)).size, 30);
  assert.equal(Object.keys(models).length, 30);
  for (const [key, model] of Object.entries(models)) {
    assert.ok(model.title, `${key} needs a title`);
    assert.ok(model.description, `${key} needs an explanation`);
    assert.ok(model.metrics.length >= 3, `${key} needs evidence metrics`);
    assert.ok(Array.isArray(model.bars), `${key} needs a distribution`);
    assert.ok(Array.isArray(model.items), `${key} needs a title collection`);
  }
});

test('Serendipity Engine builds an iterable queue without repeating titles', () => {
  const candidates = Array.from({ length: 8 }, (_, index) => ({
    ratingKey: String(index + 20),
    title: `Candidate ${index + 1}`,
    year: 2000 + index,
    duration: (90 + index) * 60_000,
    audienceRating: 7.2 + index / 10,
    Genre: [{ tag: index % 2 ? 'Drama' : 'Science Fiction' }, { tag: `Signal ${index}` }],
  }));
  const pairs = deterministicPairs(candidates);
  assert.equal(pairs.length, 4);
  assert.ok(pairs.every((pair) => pair.length === 2));
  const keys = pairs.flat().map((item) => item.ratingKey);
  assert.equal(new Set(keys).size, keys.length);
});

test('Viewing Oracle exposes detailed, evidence-backed history patterns', () => {
  const oracle = buildViewingOracle(items, history, now);
  assert.equal(oracle.sample.plays, 5);
  assert.equal(oracle.sample.matchedPlays, 5);
  assert.equal(oracle.sample.uniqueTitles, 3);
  assert.equal(oracle.behaviour.repeatPlays, 2);
  assert.equal(oracle.behaviour.rewatchRate, 40);
  assert.equal(oracle.cadence.recent30Days, 3);
  assert.equal(oracle.cadence.previous30Days, 1);
  assert.equal(oracle.hourDistribution.length, 24);
  assert.equal(oracle.dayDistribution.length, 7);
  assert.equal(
    oracle.timeBands.reduce((sum, band) => sum + band.count, 0),
    history.length,
  );
  assert.equal(oracle.topGenres[0].count, 2);
  assert.equal(oracle.topTitles[0].plays, 2);
});

test('twelve advanced lab signals derive useful catalogue and history evidence', () => {
  const signals = buildFutureLabSignals(items, history, now);
  assert.equal(Object.keys(signals).length, 12);
  assert.equal(signals.backlogHorizon.titles, 4);
  assert.equal(signals.rewatchDna.comfortTitles[0].title, 'Night Signal');
  assert.equal(signals.genreBridges.connectors.length, 0);
  assert.equal(signals.decadePassport.decades.length, 4);
  assert.equal(signals.durationDna.next.length, 4);
  assert.equal(signals.seasonalEchoes.months.length, 12);
  assert.equal(signals.nightChronotype.cells.length, 7);
});

test('all advanced lab signals render live, named views', () => {
  const data = buildFutureLabSignals(items, history, now);
  for (const tab of [
    'backlog',
    'rewatch',
    'drift',
    'chronotype',
    'growth',
    'ratings',
    'codecs',
    'storage',
    'bridges',
    'passport',
    'tempo',
    'seasons',
  ]) {
    const markup = renderFutureLabSignal(tab, data);
    assert.match(markup, /signal-view/, `${tab} should render`);
    assert.doesNotMatch(markup, /SERVER UPDATE REQUIRED/);
  }
});

test('new experiment tabs explain a stale server payload instead of crashing', () => {
  const staleMarkup = renderFutureLabExperiment('mood', {});
  assert.match(staleMarkup, /SERVER UPDATE REQUIRED/);
  const currentMarkup = renderFutureLabExperiment('mood', { moodWeather: buildMoodWeather(items, history, now) });
  assert.match(currentMarkup, /30-DAY MOOD WEATHER/);
});

test('Runtime Wormhole renders expandable title lists for distributions and time windows', () => {
  const markup = renderFutureLabExperiment('runtime', { runtimeWormhole: buildRuntimeWormhole(items) });
  assert.match(markup, /runtime-distribution-trigger/);
  assert.match(markup, /runtime-window-trigger/);
  assert.match(markup, /data-runtime-title=/);
  assert.match(markup, /Long Orbit/);
  assert.match(markup, /View titles/);
});
