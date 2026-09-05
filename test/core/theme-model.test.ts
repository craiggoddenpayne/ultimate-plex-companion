import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANION_THEMES, normalizeThemePreferences } from '../../src/shared/theme-model.ts';

test('theme collection has fifteen valid and unique palettes', () => {
  assert.equal(COMPANION_THEMES.length, 15);
  assert.equal(new Set(COMPANION_THEMES.map((theme) => theme.id)).size, 15);
  assert.equal(COMPANION_THEMES.filter((theme) => theme.mode === 'light').length, 5);
  assert.ok(COMPANION_THEMES.some((theme) => theme.id === 'darcula'));
  for (const theme of COMPANION_THEMES) {
    assert.match(theme.id, /^[a-z][a-z-]*$/);
    assert.match(theme.colour, /^#[0-9a-f]{6}$/i);
    assert.ok(['light', 'dark'].includes(theme.mode));
    assert.equal(theme.preview.length, 2);
    assert.equal(theme.swatches.length, 3);
  }
});

test('theme preferences validate palettes and visual energy', () => {
  assert.deepEqual(normalizeThemePreferences({ theme: 'nebula', effects: 'still' }), {
    theme: 'nebula',
    effects: 'still',
  });
  assert.deepEqual(normalizeThemePreferences({ theme: 'daylight', effects: 'ambient' }), {
    theme: 'daylight',
    effects: 'ambient',
  });
  assert.deepEqual(normalizeThemePreferences({ theme: 'unknown', effects: 'maximum' }), {
    theme: 'solaris',
    effects: 'full',
  });
});

test('theme preferences accept Darkula as an alias for Darcula', () => {
  assert.deepEqual(normalizeThemePreferences({ theme: 'darkula', effects: 'full' }), {
    theme: 'darcula',
    effects: 'full',
  });
});
