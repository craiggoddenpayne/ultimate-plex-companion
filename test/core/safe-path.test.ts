import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWithin } from '../../src/server/core/safe-path.ts';

test('static path resolution permits descendants and rejects traversal', () => {
  assert.equal(resolveWithin('/app/dist', 'assets/app.js'), '/app/dist/assets/app.js');
  assert.equal(resolveWithin('/app/dist', 'index.html'), '/app/dist/index.html');
  assert.equal(resolveWithin('/app/dist', '../dist-private/token'), null);
  assert.equal(resolveWithin('/app/dist', '../../etc/passwd'), null);
});
