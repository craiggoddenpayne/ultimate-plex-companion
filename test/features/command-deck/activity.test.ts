import test from 'node:test';
import assert from 'node:assert/strict';
import { activityVisual } from '../../../src/client/features/command-deck/activity-view.ts';
import { commandDeck } from '../../../src/server/features/command-deck/command-deck-server.ts';

test('activity visuals prefer Plex artwork and retain typed fallbacks', () => {
  const artwork = activityVisual({ type: 'watched', poster: '/api/art/42' });
  assert.match(artwork, /class="activity-icon activity-visual watched"/);
  assert.match(artwork, /src="\/api\/art\/42"/);
  const fallback = activityVisual({ type: 'stream' }, 'timeline');
  assert.match(fallback, /timeline-activity-icon activity-visual stream/);
  assert.match(fallback, /<svg/);
  assert.doesNotMatch(activityVisual({ type: 'added', poster: '"><script>' }), /<script>/);
});

test('System Memory returns artwork for live, added and watched activity', async () => {
  const now = Math.floor(Date.now() / 1000);
  const plexFetch = async (_config, path) => {
    if (path === '/library/sections') return { MediaContainer: { Directory: [{ key: '1', type: 'movie' }] } };
    if (path.startsWith('/status/sessions/history'))
      return {
        MediaContainer: { Metadata: [{ ratingKey: '22', type: 'movie', title: 'Watched Film', viewedAt: now - 60 }] },
      };
    if (path.startsWith('/library/recentlyAdded'))
      return {
        MediaContainer: {
          Metadata: [{ ratingKey: '11', title: 'New Film', addedAt: now - 120, librarySectionTitle: 'Films' }],
        },
      };
    throw new Error(`Unexpected Plex path: ${path}`);
  };
  const result = await commandDeck(
    {},
    {
      plexFetch,
      overview: async () => ({
        sessions: [{ ratingKey: '33', title: 'Live Film', user: 'Craig', mode: 'Direct Play' }],
        libraryCount: 1,
        titleCount: 3,
        server: {},
      }),
      libraryItems: async () => [
        {
          ratingKey: '22',
          librarySectionID: '1',
          type: 'movie',
          title: 'Watched Film',
          duration: 7_200_000,
          Genre: [{ tag: 'Drama' }],
        },
      ],
    },
  );
  assert.equal(result.activity.find((item) => item.type === 'stream').poster, '/api/art/33');
  assert.equal(result.activity.find((item) => item.type === 'added').poster, '/api/art/11');
  assert.equal(result.activity.find((item) => item.type === 'watched').poster, '/api/art/22');
});
