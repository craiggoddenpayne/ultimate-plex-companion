import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, errorResponse } from '../../src/server/core/http.ts';

test('HTTP errors retain intentional status and machine-readable codes', () => {
  assert.deepEqual(errorResponse(new HttpError(413, 'Too large.', 'PAYLOAD_TOO_LARGE')), {
    status: 413,
    body: { error: 'Too large.', code: 'PAYLOAD_TOO_LARGE' },
  });
});

test('connection failures are represented as upstream failures', () => {
  const error = Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' });
  assert.deepEqual(errorResponse(error), {
    status: 502,
    body: { error: 'Could not reach Plex at that address.', code: 'PLEX_UNAVAILABLE' },
  });
});
