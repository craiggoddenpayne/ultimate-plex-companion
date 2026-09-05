import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlexClient } from '../../src/server/core/plex-client.ts';
import { normalizePlexConfig } from '../../src/server/core/validation.ts';

test('Plex configuration validation strips trailing slashes and rejects embedded credentials', () => {
  assert.deepEqual(normalizePlexConfig({ plexUrl: 'http://plex.local:32400/', token: ' token ' }), {
    plexUrl: 'http://plex.local:32400',
    token: 'token',
  });
  assert.throws(
    () => normalizePlexConfig({ plexUrl: 'http://user:pass@plex.local', token: 'token' }),
    /Do not include credentials/,
  );
});

test('Plex client injects identity and keeps the token at the transport boundary', async () => {
  let request;
  const client = createPlexClient(async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ MediaContainer: { size: 1 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  const result = await client.fetchJson({ plexUrl: 'http://plex.local', token: 'secret' }, '/identity');
  assert.equal(result.MediaContainer.size, 1);
  assert.equal(request.url, 'http://plex.local/identity');
  assert.equal(request.options.headers['X-Plex-Token'], 'secret');
  assert.equal(request.options.headers['X-Plex-Product'], 'Ultimate Plex Companion');
});
