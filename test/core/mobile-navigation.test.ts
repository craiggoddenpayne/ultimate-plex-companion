import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileNavShouldLock } from '../../src/client/core/mobile-navigation.ts';

test('page scrolling is locked only for an open mobile navigation drawer', () => {
  assert.equal(mobileNavShouldLock(true, true), true);
  assert.equal(mobileNavShouldLock(true, false), false);
  assert.equal(mobileNavShouldLock(false, true), false);
});
