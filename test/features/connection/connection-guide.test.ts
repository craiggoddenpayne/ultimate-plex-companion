import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionAdvice, extractPlexToken } from '../../../src/client/features/connection/connection-guide.ts';
import { friendlyConnectionError } from '../../../src/server/core/errors.ts';

test('connection guide extracts either a token or the token within an XML URL', () => {
  assert.equal(extractPlexToken('abc123'), 'abc123');
  assert.equal(extractPlexToken('http://plex/library/metadata/1?foo=1&X-Plex-Token=abc%20123'), 'abc 123');
  assert.match(connectionAdvice('Plex rejected the access token'), /token was refused/);
  assert.match(connectionAdvice('Could not reach Plex'), /Docker/);
});

test('connection failures are translated into actionable Plex advice', () => {
  assert.match(friendlyConnectionError({ cause: { code: 'ECONNREFUSED' } }), /Docker/);
  assert.match(friendlyConnectionError({ cause: { code: 'ENOTFOUND' } }), /LAN IP/);
  assert.match(friendlyConnectionError({ name: 'AbortError' }), /32400/);
});
