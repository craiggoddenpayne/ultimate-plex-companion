import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSidebarState } from '../../src/client/core/sidebar-collapse.js';

test('sidebar state accepts only the persisted collapsed value', () => {
  assert.equal(normalizeSidebarState('collapsed'), 'collapsed');
  assert.equal(normalizeSidebarState('expanded'), 'expanded');
  assert.equal(normalizeSidebarState('unexpected'), 'expanded');
  assert.equal(normalizeSidebarState(null), 'expanded');
});
