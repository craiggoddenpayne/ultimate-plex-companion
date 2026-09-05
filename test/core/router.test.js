import test from 'node:test';
import assert from 'node:assert/strict';
import { composeFeatureRouters } from '../../src/server/core/router.js';

test('feature routers stop at the first handler that owns a request', async () => {
  const visited = [];
  const router = composeFeatureRouters([
    async () => { visited.push('first'); return false; },
    async () => { visited.push('owner'); return true; },
    async () => { visited.push('late'); return true; },
  ]);
  assert.equal(await router({ pathname:'/api/example' }), true);
  assert.deepEqual(visited, ['first','owner']);
});
