import test from 'node:test';
import assert from 'node:assert/strict';
import { compactStreamList, compactStreamMarkup } from '../../../src/client/features/command-deck/live-activity-view.js';

test('dashboard live activity renders Plex artwork and playback information', () => {
  const markup = compactStreamMarkup({
    title:'Arrival', meta:'4K · Direct Play', user:'Craig', device:'Living Room TV', progress:52, tone:'cyan', poster:'/api/art/42',
  });
  assert.match(markup, /<img loading="eager" src="\/api\/art\/42"/);
  assert.match(markup, /Arrival/);
  assert.match(markup, /Living Room TV/);
  assert.match(markup, /width:52%/);
  assert.match(markup, /<svg/);
});

test('dashboard live activity falls back safely when artwork is absent', () => {
  assert.doesNotMatch(compactStreamMarkup({ title:'<script>bad</script>' }), /<script>/);
  assert.match(compactStreamMarkup({ title:'No artwork' }), /<svg/);
  assert.match(compactStreamList([]), /Nothing is playing right now/);
});
