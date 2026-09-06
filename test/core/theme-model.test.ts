import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKGROUND_VISUALIZATIONS,
  COMPANION_THEMES,
  TEXT_SIZES,
  normalizeThemePreferences,
} from '../../src/shared/theme-model.ts';

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
  assert.equal(BACKGROUND_VISUALIZATIONS.filter((item) => item.id !== 'off').length, 7);
  assert.equal(new Set(BACKGROUND_VISUALIZATIONS.map((item) => item.id)).size, BACKGROUND_VISUALIZATIONS.length);
  assert.deepEqual(
    BACKGROUND_VISUALIZATIONS.map((item) => item.id),
    ['starfield', 'vortex', 'aurora', 'constellation', 'orbits', 'waves', 'embers', 'off'],
  );
  assert.deepEqual(normalizeThemePreferences({ theme: 'nebula', effects: 'still' }), {
    theme: 'nebula',
    effects: 'still',
    textSize: 'comfortable',
    background: 'starfield',
  });
  assert.deepEqual(
    normalizeThemePreferences({ theme: 'daylight', effects: 'ambient', textSize: 'large', background: 'vortex' }),
    {
      theme: 'daylight',
      effects: 'ambient',
      textSize: 'large',
      background: 'vortex',
    },
  );
  assert.deepEqual(
    normalizeThemePreferences({ theme: 'unknown', effects: 'maximum', textSize: 'enormous', background: 'noise' }),
    {
      theme: 'solaris',
      effects: 'full',
      textSize: 'comfortable',
      background: 'starfield',
    },
  );
});

test('theme preferences accept Darkula as an alias for Darcula', () => {
  assert.deepEqual(normalizeThemePreferences({ theme: 'darkula', effects: 'full' }), {
    theme: 'darcula',
    effects: 'full',
    textSize: 'comfortable',
    background: 'starfield',
  });
});
