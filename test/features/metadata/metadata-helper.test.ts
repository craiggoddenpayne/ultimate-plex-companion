import test from 'node:test';
import assert from 'node:assert/strict';
import { metadataUpdate, publicMetadata } from '../../../src/server/features/metadata/metadata-helper-server.ts';

test('metadata helper builds locked Plex edits and artwork requests', () => {
  const item = { ratingKey: '42', librarySectionID: '3', type: 'movie', title: 'Primer', Genre: [] };
  const view = publicMetadata(item);
  assert.deepEqual(view.missing, [
    'artwork',
    'summary',
    'year',
    'genres',
    'release date',
    'content rating',
    'studio',
    'tagline',
  ]);
  const update = metadataUpdate(item, {
    summary: 'Time travel engineers.',
    year: 2004,
    genres: ['Science Fiction', 'Thriller'],
    posterUrl: 'https://example.com/primer.jpg',
  });
  const url = new URL(update.path, 'http://plex');
  assert.equal(url.pathname, '/library/sections/3/all');
  assert.equal(url.searchParams.get('summary.locked'), '1');
  assert.equal(url.searchParams.get('year.value'), '2004');
  assert.equal(url.searchParams.get('genre[1].tag.tag'), 'Thriller');
  assert.match(update.posterPath, /\/library\/metadata\/42\/posters/);
  assert.deepEqual(update.changed, ['summary', 'year', 'genres', 'artwork']);
});

test('metadata helper rejects invalid dates and artwork protocols', () => {
  const item = { ratingKey: '42', librarySectionID: '3', type: 'movie' };
  assert.throws(() => metadataUpdate(item, { originallyAvailableAt: 'tomorrow' }), /YYYY-MM-DD/);
  assert.throws(() => metadataUpdate(item, { originallyAvailableAt: '2025-02-30' }), /YYYY-MM-DD/);
  assert.throws(() => metadataUpdate(item, { posterUrl: 'file:///tmp/poster.jpg' }), /HTTP or HTTPS/);
});
