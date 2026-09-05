import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANION_THEMES, normalizeThemePreferences } from '../../src/shared/theme-model.js';

test('theme preferences validate palettes and visual energy',()=>{
  assert.equal(COMPANION_THEMES.length,5);
  assert.deepEqual(normalizeThemePreferences({theme:'nebula',effects:'still'}),{theme:'nebula',effects:'still'});
  assert.deepEqual(normalizeThemePreferences({theme:'unknown',effects:'maximum'}),{theme:'solaris',effects:'full'});
});
