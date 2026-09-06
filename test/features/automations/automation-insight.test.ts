import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backlogReport,
  editionReport,
  formatReport,
  growthReport,
  newMediaReport,
  playbackDigestReport,
} from '../../../src/server/features/automations/automation-insight-server.ts';
import {
  buildExpandedAutomationReport,
  expandedAutomationTemplates,
  expandedPreviewReport,
} from '../../../src/server/features/automations/automation-expanded-server.ts';

const now = Date.UTC(2026, 8, 5, 12) / 1000;
const targets = [{ key: '1', title: 'Movies', type: 'movie' }];
const items = [
  {
    ratingKey: '1',
    title: 'Old Signal',
    year: 1999,
    addedAt: now - 500 * 86_400,
    audienceRating: 8.4,
    duration: 100 * 60_000,
    libraryTitle: 'Movies',
    Media: [
      { videoCodec: 'h264', videoResolution: '1080', Part: [{ size: 5 * 1024 ** 3 }] },
      { videoCodec: 'hevc', videoResolution: '4k', Part: [{ size: 12 * 1024 ** 3 }] },
    ],
  },
  {
    ratingKey: '2',
    title: 'New Signal',
    year: 2026,
    addedAt: now - 2 * 86_400,
    duration: 90 * 60_000,
    viewCount: 1,
    Media: [{ videoCodec: 'hevc', videoResolution: '1080', Part: [{ size: 2 * 1024 ** 3 }] }],
  },
  { ratingKey: '3', title: 'Broken Arrival', addedAt: now - 3600, Media: [] },
];

test('backlog, format and edition automations return actionable read-only findings', () => {
  const backlog = backlogReport(items, targets, now);
  assert.equal(backlog.metrics.unwatched, 2);
  assert.equal(backlog.metrics.aged, 1);
  assert.equal(backlog.items[0].title, 'Old Signal');

  const formats = formatReport(items, targets);
  assert.equal(formats.metrics.versions, 3);
  assert.equal(formats.metrics.legacy, 1);
  assert.equal(formats.metrics.fourK, 1);

  const editions = editionReport(items, targets);
  assert.equal(editions.metrics.multiVersion, 1);
  assert.equal(editions.metrics.additionalStorage, 5 * 1024 ** 3);
  assert.match(editions.items[0].value, /5\.0 GB extra/);
});

test('growth, playback and new-media automations explain recent activity', () => {
  const growth = growthReport(items, now);
  assert.equal(growth.metrics.thisWeek, 2);
  assert.equal(growth.metrics.today, 1);

  const history = [
    { title: 'Old Signal', viewedAt: now - 86_400, accountName: 'Craig' },
    { title: 'Old Signal', viewedAt: now - 2 * 86_400, accountName: 'Craig' },
    { title: 'New Signal', viewedAt: now - 9 * 86_400, accountName: 'Guest' },
  ];
  const playback = playbackDigestReport(history, now);
  assert.equal(playback.metrics.thisWeek, 2);
  assert.equal(playback.metrics.previousWeek, 1);
  assert.equal(playback.items[0].value, '2 plays');

  const integrity = newMediaReport(items);
  assert.equal(integrity.metrics.checked, 3);
  assert.equal(integrity.metrics.issues, 1);
  assert.match(integrity.items[0].detail, /No media version/);
});

test('thirty expanded automation recipes return distinct evidence reports', () => {
  assert.equal(expandedAutomationTemplates.length, 30);
  assert.equal(new Set(expandedAutomationTemplates.map((item) => item.type)).size, 30);
  assert.equal(new Set(expandedAutomationTemplates.map((item) => item.name)).size, 30);
  for (const template of expandedAutomationTemplates) {
    const preview = expandedPreviewReport(template.type);
    const report = buildExpandedAutomationReport(template.type, items, targets, now);
    assert.match(preview.headline, /ready$/);
    assert.ok(report.headline, `${template.type} needs a headline`);
    assert.ok(report.detail, `${template.type} needs detail`);
    assert.ok(Object.keys(report.metrics).length >= 2, `${template.type} needs evidence metrics`);
    assert.ok(Array.isArray(report.items), `${template.type} needs findings`);
    assert.ok(report.recommendation, `${template.type} needs advice`);
    assert.equal(report.facts.at(-1).value, 'None');
  }
});
