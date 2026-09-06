import test from 'node:test';
import assert from 'node:assert/strict';
import { metadataCenter } from '../../../src/server/features/metadata/metadata-center-server.ts';

test('metadata center detects missing and invalid Plex metadata', async () => {
  const items = [
    {
      ratingKey: '1',
      type: 'movie',
      title: 'Film.1080p.x265',
      year: 2099,
      summary: 'Short',
      guid: 'local://1',
      Genre: [],
    },
    {
      ratingKey: '2',
      type: 'movie',
      title: 'Healthy Film',
      year: 2020,
      summary: 'A complete and sufficiently descriptive summary for this well matched film.',
      thumb: '/thumb',
      guid: 'tmdb://2',
      Genre: [{ tag: 'Drama' }],
      originallyAvailableAt: '2020-04-12',
      contentRating: 'PG-13',
      studio: 'North Studio',
      tagline: 'A complete record.',
      duration: 7_200_000,
      Media: [{ duration: 7_200_000 }],
    },
  ];
  const plexFetch = async (_config, path) =>
    path === '/library/sections'
      ? { MediaContainer: { Directory: [{ key: '7', title: 'Movies', type: 'movie' }] } }
      : { MediaContainer: { totalSize: 2 } };
  const data = await metadataCenter({}, { plexFetch, libraryItems: async () => items }, true);
  assert.equal(data.scanned, 2);
  assert.equal(data.issueCount, 1);
  assert.equal(data.missing, 1);
  assert.equal(data.invalid, 1);
  assert.ok(data.issues[0].problems.some((item) => item.code === 'missing-artwork'));
  assert.ok(data.issues[0].problems.some((item) => item.code === 'invalid-year'));
  assert.ok(data.issues[0].problems.some((item) => item.code === 'missing-release-date'));
  assert.ok(data.issues[0].problems.some((item) => item.code === 'missing-content-rating'));
  assert.ok(data.issues[0].problems.some((item) => item.code === 'missing-studio'));
  assert.ok(data.issues[0].problems.some((item) => item.code === 'missing-tagline'));
  assert.ok(data.issues[0].problems.some((item) => item.code === 'missing-media'));
  assert.ok(data.categories.length >= 4);
  assert.deepEqual(data.libraries, [
    { key: '7', title: 'Movies', type: 'movie', scanned: 2, issues: 1, highPriority: 1, health: 50 },
  ]);
});

test('metadata center detects impossible dates, conflicting years and missing episode numbering', async () => {
  const episode = {
    ratingKey: '10',
    type: 'episode',
    title: 'A Broken Calendar',
    grandparentTitle: 'Signals',
    year: 2024,
    summary: 'An episode with metadata inconsistencies that should be reviewed.',
    thumb: '/thumb',
    guid: 'plex://episode/10',
    originallyAvailableAt: '2025-02-30',
    contentRating: 'TV-14',
    duration: 3_600_000,
    Media: [{ duration: 3_600_000 }],
  };
  const plexFetch = async (_config, path) =>
    path === '/library/sections'
      ? { MediaContainer: { Directory: [{ key: '9', title: 'Television', type: 'show' }] } }
      : { MediaContainer: {} };
  const data = await metadataCenter({}, { plexFetch, libraryItems: async () => [episode] }, true);
  const codes = data.issues[0].problems.map((item) => item.code);
  assert.ok(codes.includes('invalid-date'));
  assert.ok(codes.includes('missing-season-number'));
  assert.ok(codes.includes('missing-episode-number'));

  episode.originallyAvailableAt = '2025-02-20';
  const mismatch = await metadataCenter({}, { plexFetch, libraryItems: async () => [episode] }, true);
  assert.ok(mismatch.issues[0].problems.some((item) => item.code === 'year-date-mismatch'));
});
