import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArchiveAnomalies, buildMemoryLane, buildMoodWeather, buildRuntimeWormhole } from '../../../src/server/features/future-lab/future-lab-experiments.ts';

const now = Date.UTC(2026, 8, 5, 12) / 1000;
const items = [
  { ratingKey:'1', title:'Bright Future', year:2021, duration:100 * 60_000, audienceRating:8.2, addedAt:now - 500 * 86_400, Genre:[{ tag:'Science Fiction' }], Director:[{ tag:'Ada North' }] },
  { ratingKey:'2', title:'Night Signal', year:1984, duration:130 * 60_000, audienceRating:8.0, addedAt:now - 300 * 86_400, Genre:[{ tag:'Thriller' }], Director:[{ tag:'Bea West' }] },
  { ratingKey:'3', title:'Small Laugh', year:1988, duration:42 * 60_000, viewCount:1, Genre:[{ tag:'Comedy' }], Director:[{ tag:'Cy East' }] },
  { ratingKey:'4', title:'Long Orbit', year:1965, duration:205 * 60_000, audienceRating:6.5, Genre:[{ tag:'Science Fiction' }], Director:[{ tag:'Ada North' }] },
  { ratingKey:'5', title:'Rare Earth', year:2015, duration:88 * 60_000, audienceRating:7.7, Genre:[{ tag:'Geology' }], Director:[{ tag:'Dee South' }] },
];
const history = [
  { ratingKey:'1', title:'Bright Future', viewedAt:now - 2 * 86_400 },
  { ratingKey:'2', title:'Night Signal', viewedAt:now - 5 * 86_400 },
  { ratingKey:'2', title:'Night Signal', viewedAt:now - 12 * 86_400 },
  { ratingKey:'3', title:'Small Laugh', viewedAt:now - 40 * 86_400 },
  { ratingKey:'3', title:'Small Laugh', viewedAt:now - 200 * 86_400 },
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
  assert.deepEqual(result.signals.find(signal => signal.genre === 'Comedy'), { genre:'Comedy', recent:0, previous:1, delta:-1 });
});

test('Runtime Wormhole builds duration bands and instant viewing choices', () => {
  const result = buildRuntimeWormhole(items);
  assert.equal(result.medianMinutes, 100);
  assert.equal(result.buckets.find(bucket => bucket.label === 'Short signal').count, 1);
  assert.equal(result.buckets.find(bucket => bucket.label === 'Event horizon').count, 1);
  assert.equal(result.windows.find(window => window.minutes === 90).choices, 1);
  assert.equal(result.longest[0].title, 'Long Orbit');
});

test('Archive Anomalies finds rare genres, one-off directors and buried gems', () => {
  const result = buildArchiveAnomalies(items, now);
  assert.deepEqual(result.rareGenres.find(item => item.genre === 'Geology'), { genre:'Geology', count:1 });
  assert.ok(result.oneOffDirectors.includes('Dee South'));
  assert.equal(result.highRatedWaiting, 3);
  assert.equal(result.buriedGems[0].title, 'Bright Future');
  assert.equal(result.oldestUnwatched[0].title, 'Long Orbit');
});
