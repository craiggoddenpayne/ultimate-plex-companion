import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscoveryRecommendations } from '../../../src/server/features/discovery/discovery-recommendations.ts';

const movie = (id, extra = {}) => ({
  ratingKey: String(id),
  type: 'movie',
  title: `Film ${id}`,
  duration: 100 * 60_000,
  audienceRating: 8,
  viewCount: 0,
  Genre: [{ tag: 'Comedy' }],
  ...extra,
});

test('discovery recommendations paginate through the ranked catalogue without overlap', () => {
  const catalog = Array.from({ length: 45 }, (_, index) => movie(index + 1, { audienceRating: 9 - index / 100 }));
  const first = buildDiscoveryRecommendations(catalog, { limit: '18', offset: '0' }, 1_800_000_000);
  const second = buildDiscoveryRecommendations(catalog, { limit: '18', offset: '18' }, 1_800_000_000);
  const final = buildDiscoveryRecommendations(catalog, { limit: '18', offset: '36' }, 1_800_000_000);

  assert.equal(first.totalMatches, 45);
  assert.equal(first.results.length, 18);
  assert.equal(first.nextOffset, 18);
  assert.equal(first.hasMore, true);
  assert.equal(second.results.length, 18);
  assert.equal(new Set([...first.results, ...second.results].map((item) => item.ratingKey)).size, 36);
  assert.equal(final.results.length, 9);
  assert.equal(final.nextOffset, null);
  assert.equal(final.hasMore, false);
});

test('discovery pagination keeps mood, runtime and watch-state filters active', () => {
  const catalog = [
    movie(1),
    movie(2, { Genre: [{ tag: 'Drama' }] }),
    movie(3, { viewCount: 1 }),
    movie(4, { duration: 180 * 60_000 }),
  ];
  const result = buildDiscoveryRecommendations(
    catalog,
    { mood: 'comfort', maxMinutes: '120', unwatchedOnly: 'true', limit: '18' },
    1_800_000_000,
  );

  assert.equal(result.totalMatches, 2);
  assert.deepEqual(
    result.results.map((item) => item.ratingKey),
    ['1', '2'],
  );
  assert.match(result.results[0].reason, /comedy mood/);
});
