import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANION_THEMES, TEXT_SIZES, normalizeThemePreferences } from '../../src/shared/theme-model.ts';

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

test('theme preferences validate palettes, visual energy and text size', () => {
  assert.deepEqual(TEXT_SIZES, ['standard', 'comfortable', 'large', 'extra-large']);
  assert.deepEqual(normalizeThemePreferences({ theme: 'nebula', effects: 'still' }), {
    theme: 'nebula',
    effects: 'still',
    textSize: 'comfortable',
  });
  assert.deepEqual(normalizeThemePreferences({ theme: 'daylight', effects: 'ambient', textSize: 'large' }), {
    theme: 'daylight',
    effects: 'ambient',
    textSize: 'large',
  });
  assert.deepEqual(normalizeThemePreferences({ theme: 'unknown', effects: 'maximum', textSize: 'enormous' }), {
    theme: 'solaris',
    effects: 'full',
    textSize: 'comfortable',
  });
});

test('theme preferences accept Darkula as an alias for Darcula', () => {
  assert.deepEqual(normalizeThemePreferences({ theme: 'darkula', effects: 'full' }), {
    theme: 'darcula',
    effects: 'full',
    textSize: 'comfortable',
  });
});
