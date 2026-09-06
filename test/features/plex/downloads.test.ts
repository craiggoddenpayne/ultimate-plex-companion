import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlexRoutes } from '../../../src/server/features/plex/routes.ts';

const config = { plexUrl: 'http://plex.local', token: 'secret' };

test('download search returns only downloadable video result types', async () => {
  let response;
  const handled = await createPlexRoutes()({
    pathname: '/api/downloads/search',
    req: { method: 'GET', url: '/api/downloads/search?q=arrival' },
    res: {},
    savedConfig: async () => config,
    json: (_res, status, value) => {
      response = { status, value };
    },
    plexFetch: async () => ({
      MediaContainer: {
        Hub: [
          {
            Metadata: [
              { ratingKey: '99', title: 'Arrival', type: 'movie', year: 2016 },
              { ratingKey: '100', title: 'Arrival Collection', type: 'collection' },
            ],
          },
        ],
      },
    }),
  });
  assert.equal(handled, true);
  assert.equal(response.status, 200);
  assert.deepEqual(
    response.value.results.map((item) => item.title),
    ['Arrival'],
  );
});

test('download item lists exact Plex media versions without exposing source paths', async () => {
  let response;
  await createPlexRoutes()({
    pathname: '/api/downloads/item/99',
    req: { method: 'GET', url: '/api/downloads/item/99' },
    res: {},
    savedConfig: async () => config,
    json: (_res, status, value) => {
      response = { status, value };
    },
    plexFetch: async () => ({
      MediaContainer: {
        Metadata: [
          {
            ratingKey: '99',
            title: 'Arrival',
            type: 'movie',
            Media: [
              {
                container: 'mkv',
                videoResolution: '4k',
                Part: [{ id: 12, file: '/private/movies/Arrival.mkv', size: 1234 }],
              },
            ],
          },
        ],
      },
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.value.versions[0].fileName, 'Arrival.mkv');
  assert.equal(response.value.versions[0].resolution, '4K');
  assert.doesNotMatch(JSON.stringify(response.value), /private\/movies/);
});
