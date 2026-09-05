import test from 'node:test';
import assert from 'node:assert/strict';
import { arrivalReport } from '../../../src/server/features/automations/automation-report-server.ts';
import { renderAutomationReports } from '../../../src/client/features/automations/automation-report-ui.ts';

const escape = (value) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  );

test('arrival digest retains and renders every Plex media path', () => {
  const result = arrivalReport([
    {
      ratingKey: '42',
      title: 'Arrival',
      year: 2016,
      type: 'movie',
      addedAt: 1_700_000_000,
      Media: [
        { Part: [{ file: '/media/Films/Arrival/Arrival.mkv' }] },
        { Part: [{ file: '/archive/Arrival <4K>.mkv' }] },
      ],
    },
  ]);
  assert.equal(result.items[0].path, '/media/Films/Arrival/Arrival.mkv');
  assert.deepEqual(result.items[0].paths, ['/media/Films/Arrival/Arrival.mkv', '/archive/Arrival <4K>.mkv']);
  const html = renderAutomationReports([{ id: 'run-1', ruleName: 'Arrival Digest', status: 'success', result }], {
    escape,
    relativeTime: () => 'now',
    bytes: String,
  });
  assert.match(html, /PATH 1/);
  assert.match(html, /\/media\/Films\/Arrival\/Arrival\.mkv/);
  assert.match(html, /\/archive\/Arrival &lt;4K&gt;\.mkv/);
});
