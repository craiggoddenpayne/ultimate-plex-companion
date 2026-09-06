import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePlexAccountDevices,
  peopleTelemetry,
  revokePlexClient,
  sessionDetail,
} from '../../../src/server/features/telemetry/telemetry-server.ts';
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
  Player: [
    {
      title: 'Living Room',
      product: 'Plex for Apple TV',
      platform: 'tvOS',
      platformVersion: '20.0',
      version: '8.1',
      machineIdentifier: 'client-apple-tv',
      address: '192.168.1.20',
      local: true,
      secure: true,
      state: 'playing',
    },
  ],
  Media: [
    {
      videoResolution: '4k',
      width: 3840,
      height: 2160,
      videoCodec: 'hevc',
      videoProfile: 'main 10',
      audioCodec: 'eac3',
      audioChannels: 6,
      bitrate: 26_000,
      container: 'mkv',
      videoDecision: 'transcode',
      audioDecision: 'copy',
      subtitleDecision: 'burn',
      Part: [
        {
          Stream: [
            {
              streamType: 1,
              selected: true,
              codec: 'hevc',
              bitDepth: 10,
              frameRate: '23.976',
              colorTrc: 'smpte2084',
              displayTitle: '4K HEVC Main 10 HDR',
            },
            {
              streamType: 2,
              selected: true,
              codec: 'eac3',
              channels: 6,
              language: 'English',
              samplingRate: 48_000,
              displayTitle: 'English E-AC-3 5.1',
            },
            { streamType: 3, selected: true, codec: 'srt', language: 'English', displayTitle: 'English (SRT)' },
          ],
        },
      ],
    },
  ],
  TranscodeSession: [
    {
      videoDecision: 'transcode',
      audioDecision: 'copy',
      subtitleDecision: 'burn',
      videoCodec: 'h264',
      audioCodec: 'eac3',
      container: 'mpegts',
      protocol: 'hls',
      speed: 2.4,
      progress: 31,
      transcodeHwRequested: true,
    },
  ],
};

test('live session telemetry exposes source, delivery, client and network facts', () => {
  const session = sessionDetail(plexSession);
  assert.equal(session.mode, 'Transcoding');
  assert.equal(session.dimensions, '3840×2160');
  assert.equal(session.dynamicRange, 'HDR');
  assert.equal(session.audioChannels, 6);
  assert.equal(session.subtitleLanguage, 'English');
  assert.equal(session.bandwidth, 18_400);
  assert.equal(session.clientIdentifier, 'client-apple-tv');
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

test('people telemetry derives private taste and viewing signals for each account', async () => {
  const now = Math.floor(Date.now() / 1000);
  const plexFetch = async (_config, path) => {
    if (path === '/accounts') return { MediaContainer: { Account: [{ id: 7, name: 'Craig' }] } };
    if (path === '/status/sessions') return { MediaContainer: { Metadata: [] } };
    if (path.startsWith('/status/sessions/history'))
      return {
        MediaContainer: {
          Metadata: [
            { ratingKey: '42', accountID: 7, type: 'movie', viewedAt: now, duration: 7_200_000 },
            { ratingKey: '43', accountID: 7, type: 'movie', viewedAt: now - 3600, duration: 5_400_000 },
          ],
        },
      };
    return { MediaContainer: { Metadata: [{ Genre: [{ tag: 'Science Fiction' }, { tag: 'Drama' }] }] } };
  };
  const result = await peopleTelemetry({}, plexFetch, 30);
  assert.equal(result.people[0].favouriteGenre, 'Drama');
  assert.deepEqual(
    result.people[0].preferredGenres.map((item) => item.genre),
    ['Drama', 'Science Fiction'],
  );
  assert.equal(result.people[0].minutesWatched, 210);
  assert.equal(result.people[0].preferredFormat, 'Films');
});

test('people telemetry keeps historical devices separate and exposes live network evidence', async () => {
  const now = Math.floor(Date.now() / 1000);
  const plexFetch = async (_config, path) => {
    if (path === '/accounts') return { MediaContainer: { Account: [{ id: 7, name: 'Craig' }] } };
    if (path === '/devices')
      return {
        MediaContainer: {
          Device: [
            { id: 5, name: 'Living Room TV', platform: 'tvOS', clientIdentifier: 'client-apple-tv' },
            { id: 6, name: 'Firefox', platform: 'Firefox', clientIdentifier: 'browser-6' },
          ],
        },
      };
    if (path === '/status/sessions') return { MediaContainer: { Metadata: [plexSession] } };
    if (path.startsWith('/status/sessions/history'))
      return {
        MediaContainer: {
          Metadata: [
            { ratingKey: '142', accountID: 7, deviceID: 5, type: 'movie', viewedAt: now },
            { ratingKey: '143', accountID: 7, deviceID: 5, type: 'episode', viewedAt: now - 3600 },
            { ratingKey: '144', accountID: 7, deviceID: 6, type: 'movie', viewedAt: now - 7200 },
          ],
        },
      };
    return { MediaContainer: { Metadata: [] } };
  };

  const result = await peopleTelemetry({}, plexFetch, 30, [
    {
      id: '1614167829',
      name: 'Firefox',
      product: 'Plex Web',
      clientIdentifier: 'browser-6',
      lastSeenAt: now,
    },
  ]);
  const television = result.deviceHistory.find((device) => device.id === '5');
  const browser = result.deviceHistory.find((device) => device.id === '6');
  assert.equal(television.name, 'Living Room TV');
  assert.equal(television.plays, 2);
  assert.deepEqual(television.people, ['Craig']);
  assert.equal(television.active, true);
  assert.equal(television.localAddress, '192.168.1.20');
  assert.equal(browser.active, false);
  assert.equal(browser.localAddress, '');
  assert.equal(browser.revocable, true);
  assert.equal(browser.authorizationStatus, 'authorized');
  assert.equal(television.revocable, false);
  assert.equal(television.authorizationStatus, 'not_authorized');
});

test('Plex account device revocation resolves the exact client and requires confirmation', async () => {
  const xml = `<?xml version="1.0"?><MediaContainer><Device name="Firefox &amp; TV" product="Plex Web" clientIdentifier="browser-6" id="1614167829" lastSeenAt="1788642973"></Device><Device name="iPhone" product="Plex for iOS" clientIdentifier="phone-1" id="1311711193"></Device></MediaContainer>`;
  assert.deepEqual(parsePlexAccountDevices(xml)[0], {
    id: '1614167829',
    name: 'Firefox & TV',
    product: 'Plex Web',
    platform: '',
    clientIdentifier: 'browser-6',
    createdAt: null,
    lastSeenAt: 1788642973,
  });
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, method: options.method });
    return options.method === 'GET'
      ? new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml' } })
      : new Response(null, { status: 204 });
  };
  await assert.rejects(() => revokePlexClient({ token: 'secret' }, 'browser-6', false, fetchImpl), /Confirm/);
  const result = await revokePlexClient({ token: 'secret' }, 'browser-6', true, fetchImpl);
  assert.equal(result.revoked, true);
  assert.equal(result.name, 'Firefox & TV');
  assert.deepEqual(requests, [
    { url: 'https://plex.tv/devices.xml', method: 'GET' },
    { url: 'https://plex.tv/devices/1614167829.xml', method: 'DELETE' },
  ]);
});
