import test from 'node:test';
import assert from 'node:assert/strict';
import { plexServerIntelligence } from '../../../src/server/features/server-info/server-intelligence-server.ts';

test('server intelligence exposes deep Plex telemetry without credentials', async () => {
  const now = Math.floor(Date.now() / 1000);
  const plexFetch = async (_config, path) => {
    if (path === '/')
      return {
        MediaContainer: {
          friendlyName: 'Nerd Plex',
          version: '1.43.3',
          platform: 'Linux',
          platformVersion: '6.8',
          machineIdentifier: 'machine-42',
          apiVersion: '1.2.2',
          myPlex: true,
          myPlexSigninState: 'ok',
          myPlexMappingState: 'mapped',
          myPlexSubscription: true,
          multiuser: true,
          certificate: true,
          eventStream: true,
          transcoderVideo: true,
          transcoderAudio: true,
          allowMediaDeletion: true,
          streamingBrainVersion: 2,
          streamingBrainABRVersion: 3,
          transcoderVideoBitrates: '1000,2000',
          transcoderVideoResolutions: '720,1080',
        },
      };
    if (path === '/identity')
      return { MediaContainer: { claimed: true, version: '1.43.3', machineIdentifier: 'machine-42' } };
    if (path === '/library/sections')
      return {
        MediaContainer: {
          Directory: [
            {
              key: '1',
              title: 'Movies',
              type: 'movie',
              uuid: 'library-1',
              agent: 'tv.plex.agents.movie',
              scanner: 'Plex Movie',
              language: 'en-GB',
              scannedAt: now,
              Location: [{ id: 1, path: '/media/movies' }],
            },
          ],
        },
      };
    if (path.startsWith('/library/sections/1/all')) return { MediaContainer: { totalSize: 123 } };
    if (path === '/status/sessions') return { MediaContainer: { Metadata: [{ Session: [{ bandwidth: 12_000 }] }] } };
    if (path === '/transcode/sessions') return { MediaContainer: { TranscodeSession: [{}] } };
    if (path === '/devices')
      return { MediaContainer: { Device: [{ id: 1, platform: 'tvOS', createdAt: now - 1000 }] } };
    if (path === '/:/prefs')
      return {
        MediaContainer: {
          Setting: [
            { id: 'EnableIPv6', label: 'IPv6', group: 'network', type: 'bool', value: true, default: false },
            { id: 'HardwareAcceleratedCodecs', group: 'transcoder', value: true, default: true },
            { id: 'LogTokensForDebug', group: 'general', value: 'secret-token', default: false },
          ],
        },
      };
    if (path.startsWith('/statistics/resources'))
      return {
        MediaContainer: {
          StatisticsResources: [
            {
              at: now,
              hostCpuUtilization: 42.5,
              processCpuUtilization: 3.2,
              hostMemoryUtilization: 61,
              processMemoryUtilization: 1.4,
            },
          ],
        },
      };
    if (path.startsWith('/status/sessions/history')) return { MediaContainer: { totalSize: 900 } };
    if (path.startsWith('/playlists/all')) return { MediaContainer: { totalSize: 12 } };
    return { MediaContainer: {} };
  };
  const diagnostics = async () => ({
    application: { node: 'v24', platform: 'linux', architecture: 'arm64', uptimeSeconds: 3600 },
    setup: {
      configSource: 'saved',
      checks: { plexConnection: 'connected' },
      optimization: { plexPathRoot: '/media', mediaPathRoot: '/media', crf: 20, preset: 'medium' },
    },
  });

  const result = await plexServerIntelligence(
    { plexUrl: 'https://plex.example:32400', token: 'secret-token' },
    { plexFetch, diagnostics },
  );
  assert.equal(result.identity.name, 'Nerd Plex');
  assert.equal(result.identity.claimed, true);
  assert.equal(result.connection.protocol, 'HTTPS');
  assert.equal(result.libraries[0].counts.movies, 123);
  assert.equal(result.librarySummary.indexedItems, 123);
  assert.equal(result.activity.estimatedBandwidthKbps, 12_000);
  assert.equal(result.activity.historyRecords, 900);
  assert.equal(result.resources.latest.hostCpu, 42.5);
  assert.equal(
    result.preferences.some((setting) => setting.id === 'LogTokensForDebug'),
    false,
  );
  assert.doesNotMatch(JSON.stringify(result), /secret-token/);
  assert.ok(result.probes.every((probe) => probe.ok));
});
