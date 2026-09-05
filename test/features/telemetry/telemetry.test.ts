import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionDetail } from '../../../src/server/features/telemetry/telemetry-server.ts';
import { sessionMarkup, sessionFormatters } from '../../../src/client/features/telemetry/stream-session-view.ts';

const plexSession = {
  ratingKey: '42',
  title: 'The Signal',
  year: 2026,
  type: 'movie',
  duration: 7_200_000,
  viewOffset: 1_800_000,
  User: [{ id: 7, title: 'Craig' }],
  Session: [{ id: 'session-42', bandwidth: 18_400, location: 'lan' }],
  Player: [{ title: 'Living Room', product: 'Plex for Apple TV', platform: 'tvOS', platformVersion: '20.0', version: '8.1', address: '192.168.1.20', local: true, secure: true, state: 'playing' }],
  Media: [{
    videoResolution: '4k', width: 3840, height: 2160, videoCodec: 'hevc', videoProfile: 'main 10', audioCodec: 'eac3', audioChannels: 6, bitrate: 26_000, container: 'mkv', videoDecision: 'transcode', audioDecision: 'copy', subtitleDecision: 'burn',
    Part: [{ Stream: [
      { streamType: 1, selected: true, codec: 'hevc', bitDepth: 10, frameRate: '23.976', colorTrc: 'smpte2084', displayTitle: '4K HEVC Main 10 HDR' },
      { streamType: 2, selected: true, codec: 'eac3', channels: 6, language: 'English', samplingRate: 48_000, displayTitle: 'English E-AC-3 5.1' },
      { streamType: 3, selected: true, codec: 'srt', language: 'English', displayTitle: 'English (SRT)' },
    ] }],
  }],
  TranscodeSession: [{ videoDecision: 'transcode', audioDecision: 'copy', subtitleDecision: 'burn', videoCodec: 'h264', audioCodec: 'eac3', container: 'mpegts', protocol: 'hls', speed: 2.4, progress: 31, transcodeHwRequested: true }],
};

test('live session telemetry exposes source, delivery, client and network facts', () => {
  const session = sessionDetail(plexSession);
  assert.equal(session.mode, 'Transcoding');
  assert.equal(session.dimensions, '3840×2160');
  assert.equal(session.dynamicRange, 'HDR');
  assert.equal(session.audioChannels, 6);
  assert.equal(session.subtitleLanguage, 'English');
  assert.equal(session.bandwidth, 18_400);
  assert.equal(session.outputVideoCodec, 'h264');
  assert.equal(session.protocol, 'hls');
  assert.equal(session.hardware, true);
  assert.equal(session.progress, 25);
});

test('live session card renders the technical grid and transcode pipeline safely', () => {
  const session = sessionDetail({ ...plexSession, title: '<script>unsafe</script>' });
  const markup = sessionMarkup(session);
  assert.match(markup, /session-tech-grid/);
  assert.match(markup, /Picture/);
  assert.match(markup, /English E-AC-3 5\.1/);
  assert.match(markup, /Plex for Apple TV/);
  assert.match(markup, /HW accelerated/);
  assert.match(markup, /HEVC \+ E-AC-3/);
  assert.doesNotMatch(markup, /<script>/);
});

test('session formatters keep bandwidth and decisions readable', () => {
  assert.equal(sessionFormatters.bitrate(18_400), '18.4 Mbps');
  assert.equal(sessionFormatters.decision('copy'), 'Direct stream');
  assert.equal(sessionFormatters.codec('eac3'), 'E-AC-3');
});

test('container-only remuxes are reported as direct streams, not transcodes', () => {
  const session = sessionDetail({
    ...plexSession,
    Media: [{ ...plexSession.Media[0], videoDecision: 'copy', audioDecision: 'copy', subtitleDecision: 'none' }],
    TranscodeSession: [{ videoDecision: 'copy', audioDecision: 'copy', subtitleDecision: 'none', container: 'mpegts' }],
  });
  assert.equal(session.mode, 'Direct Stream');
  assert.equal(session.hardware, false);
});
