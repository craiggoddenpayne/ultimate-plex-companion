const preferenceIds = new Set([
  'FSEventLibraryUpdatesEnabled',
  'FSEventLibraryPartialScanEnabled',
  'ScheduledLibraryUpdatesEnabled',
  'ScheduledLibraryUpdateInterval',
  'autoEmptyTrash',
  'allowMediaDeletion',
  'allowMediaDeletionLanOnly',
  'OnDeckWindow',
  'OnDeckLimit',
  'LibraryVideoPlayedThreshold',
  'ScannerLowPriority',
  'EnableIPv6',
  'IPNetworkType',
  'secureConnections',
  'PreferredNetworkInterface',
  'DisableTLSv1_0',
  'GdmEnabled',
  'RelayEnabled',
  'WanPerStreamMaxUploadRate',
  'WanTotalMaxUploadRate',
  'WanPerUserStreamCount',
  'LanNetworksBandwidth',
  'TreatWanIpAsLocal',
  'WebHooksEnabled',
  'TranscoderQuality',
  'SegmentedTranscoderTimeout',
  'TranscoderTempDirectory',
  'TranscoderDefaultDuration',
  'TranscoderThrottleBuffer',
  'TranscoderPruneBuffer',
  'TranscoderH264Preset',
  'TranscoderH264BackgroundPreset',
  'TranscoderH264MinimumCRF',
  'TranscoderToneMapping',
  'TranscoderToneMappingAgorithm',
  'TranscoderCanOnlyRemuxVideo',
  'HardwareAcceleratedCodecs',
  'HardwareAcceleratedEncoders',
  'TranscoderHEVCEncoding',
  'TranscoderHEVCEncodingMode',
  'TranscoderHEVCOptimize',
  'TranscodeCountLimit',
  'OptimizerTranscodeCountLimit',
  'DlnaEnabled',
  'ButlerStartHour',
  'ButlerEndHour',
  'ButlerTaskBackupDatabase',
  'logDebug',
  'LogVerbose',
  'LogMemoryUse',
]);

const countTypes = {
  movie: [[1, 'movies']],
  show: [
    [2, 'shows'],
    [4, 'episodes'],
  ],
  artist: [
    [8, 'artists'],
    [9, 'albums'],
    [10, 'tracks'],
  ],
  photo: [[13, 'photos']],
};

const truthy = (value) => value === true || value === 1 || value === '1' || value === 'true';
const timestamp = (value) => (Number(value || 0) > 0 ? Number(value) : null);

function aggregateResources(samples) {
  const normalized = samples
    .map((sample) => ({
      at: timestamp(sample.at),
      hostCpu: Number(sample.hostCpuUtilization || 0),
      processCpu: Number(sample.processCpuUtilization || 0),
      hostMemory: Number(sample.hostMemoryUtilization || 0),
      processMemory: Number(sample.processMemoryUtilization || 0),
    }))
    .filter((sample) => sample.at);
  const average = (field) =>
    normalized.length
      ? Math.round((normalized.reduce((sum, sample) => sum + sample[field], 0) / normalized.length) * 100) / 100
      : 0;
  const peak = (field) => Math.round(Math.max(0, ...normalized.map((sample) => sample[field])) * 100) / 100;
  return {
    samples: normalized.slice(-60),
    latest: normalized.at(-1) || null,
    average: {
      hostCpu: average('hostCpu'),
      processCpu: average('processCpu'),
      hostMemory: average('hostMemory'),
      processMemory: average('processMemory'),
    },
    peak: {
      hostCpu: peak('hostCpu'),
      processCpu: peak('processCpu'),
      hostMemory: peak('hostMemory'),
      processMemory: peak('processMemory'),
    },
  };
}

function publicPreferences(settings) {
  return settings
    .filter((setting) => preferenceIds.has(setting.id))
    .map((setting) => ({
      id: setting.id,
      label: setting.label || setting.id,
      group: setting.group || 'advanced',
      type: setting.type || typeof setting.value,
      value: setting.value,
      default: setting.default,
      changed: String(setting.value) !== String(setting.default),
      advanced: truthy(setting.advanced),
      summary: setting.summary || '',
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
}

function capability(label, value, detail = '') {
  return { label, enabled: truthy(value), value, detail };
}

export async function plexServerIntelligence(config, { plexFetch, diagnostics }) {
  const probes = [];
  async function probe(name, path, fallback = {}) {
    const started = performance.now();
    try {
      const response = await plexFetch(config, path);
      probes.push({ name, path, ok: true, latencyMs: Math.round((performance.now() - started) * 10) / 10 });
      return response.MediaContainer || fallback;
    } catch (error) {
      probes.push({
        name,
        path,
        ok: false,
        latencyMs: Math.round((performance.now() - started) * 10) / 10,
        error: error instanceof Error ? error.message : String(error),
      });
      return fallback;
    }
  }

  const [
    root,
    identity,
    sectionRoot,
    sessionRoot,
    transcodeRoot,
    deviceRoot,
    preferenceRoot,
    resourceRoot,
    activityRoot,
    historyRoot,
    playlistRoot,
    updaterRoot,
    companion,
  ] = await Promise.all([
    probe('Server root', '/'),
    probe('Identity', '/identity'),
    probe('Library sections', '/library/sections'),
    probe('Active sessions', '/status/sessions'),
    probe('Transcode sessions', '/transcode/sessions'),
    probe('Registered devices', '/devices'),
    probe('Preferences', '/:/prefs'),
    probe('Resource telemetry', '/statistics/resources?timespan=6'),
    probe('Background activities', '/activities'),
    probe('Playback history', '/status/sessions/history/all?X-Plex-Container-Start=0&X-Plex-Container-Size=0'),
    probe('Playlists', '/playlists/all?X-Plex-Container-Start=0&X-Plex-Container-Size=0'),
    probe('Updater', '/updater/status'),
    diagnostics(),
  ]);

  const sections = sectionRoot.Directory || [];
  const libraries = await Promise.all(
    sections.map(async (section) => {
      const types = countTypes[section.type] || [];
      const counts = Object.fromEntries(
        await Promise.all(
          types.map(async ([type, label]) => {
            const result = await probe(
              `${section.title} ${label}`,
              `/library/sections/${encodeURIComponent(section.key)}/all?type=${type}&X-Plex-Container-Start=0&X-Plex-Container-Size=0`,
            );
            return [label, Number(result.totalSize ?? result.size ?? 0)];
          }),
        ),
      );
      return {
        key: String(section.key || ''),
        title: section.title || 'Untitled library',
        type: section.type || 'unknown',
        uuid: section.uuid || '',
        agent: section.agent || '',
        scanner: section.scanner || '',
        language: section.language || '',
        refreshing: truthy(section.refreshing),
        hidden: truthy(section.hidden),
        allowSync: truthy(section.allowSync),
        content: truthy(section.content),
        directory: truthy(section.directory),
        locations: (section.Location || []).map((location) => ({ id: location.id, path: location.path || '' })),
        createdAt: timestamp(section.createdAt),
        scannedAt: timestamp(section.scannedAt),
        updatedAt: timestamp(section.updatedAt),
        contentChangedAt: timestamp(section.contentChangedAt),
        counts,
      };
    }),
  );

  const preferences = publicPreferences(preferenceRoot.Setting || []);
  const preference = (id) => preferences.find((setting) => setting.id === id)?.value;
  const parsedUrl = new URL(config.plexUrl);
  const sessions = sessionRoot.Metadata || [];
  const transcodes = transcodeRoot.TranscodeSession || transcodeRoot.Metadata || [];
  const devices = deviceRoot.Device || [];
  const platformCounts = [...new Set<string>(devices.map((device) => String(device.platform || 'Unknown')))]
    .map((platform) => ({
      platform,
      count: devices.filter((device) => (device.platform || 'Unknown') === platform).length,
    }))
    .sort((a, b) => b.count - a.count || a.platform.localeCompare(b.platform));
  const bandwidth = sessions.reduce(
    (sum, item) => sum + Number(item.Session?.[0]?.bandwidth || item.TranscodeSession?.[0]?.bandwidth || 0),
    0,
  );
  const primaryItemCount = libraries.reduce(
    (sum, library) =>
      sum +
      Number(library.counts.movies || library.counts.episodes || library.counts.tracks || library.counts.photos || 0),
    0,
  );
  const resources = aggregateResources(resourceRoot.StatisticsResources || resourceRoot.StatisticsResource || []);

  return {
    generatedAt: new Date().toISOString(),
    identity: {
      name: root.friendlyName || 'Plex Media Server',
      version: identity.version || root.version || 'Unknown',
      platform: root.platform || 'Unknown',
      platformVersion: root.platformVersion || '',
      machineIdentifier: identity.machineIdentifier || root.machineIdentifier || '',
      apiVersion: identity.apiVersion || root.apiVersion || '',
      claimed: truthy(identity.claimed),
      updatedAt: timestamp(root.updatedAt),
      countryCode: root.countryCode || '',
    },
    plexAccount: {
      connected: truthy(root.myPlex),
      signInState: root.myPlexSigninState || '',
      mappingState: root.myPlexMappingState || '',
      subscription: truthy(root.myPlexSubscription),
      multiuser: truthy(root.multiuser),
    },
    connection: {
      origin: parsedUrl.origin,
      protocol: parsedUrl.protocol.replace(':', '').toUpperCase(),
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80'),
      path: parsedUrl.pathname,
      certificateAvailable: truthy(root.certificate),
      secureConnections: preference('secureConnections'),
      ipv6: truthy(preference('EnableIPv6')),
      networkType: preference('IPNetworkType') || '',
      preferredInterface: preference('PreferredNetworkInterface') || 'Automatic',
      localDiscovery: truthy(preference('GdmEnabled')),
      relay: truthy(preference('RelayEnabled')),
      strictTls: truthy(preference('DisableTLSv1_0')),
      webhooks: truthy(preference('WebHooksEnabled')),
      eventStream: truthy(root.eventStream),
    },
    capabilities: [
      capability('Video transcoding', root.transcoderVideo),
      capability('Audio transcoding', root.transcoderAudio),
      capability('Subtitle transcoding', root.transcoderSubtitles),
      capability('Photo transcoding', root.transcoderPhoto),
      capability('Offline transcode', root.offlineTranscode),
      capability('Hardware acceleration', preference('HardwareAcceleratedCodecs')),
      capability('Hardware encoding', preference('HardwareAcceleratedEncoders')),
      capability('HDR tone mapping', preference('TranscoderToneMapping')),
      capability('Media deletion', root.allowMediaDeletion),
      capability('Sharing', root.allowSharing),
      capability('Downloads and sync', root.allowSync || root.sync),
      capability('Live TV', root.livetv, `${Number(root.livetv || 0)} source flags`),
      capability('Tuners', root.allowTuners),
      capability('Push notifications', root.pushNotifications),
      capability('Voice search', root.voiceSearch),
      capability('Hub search', root.hubSearch),
      capability('Background processing', root.backgroundProcessing),
      capability('Plugin host', root.pluginHost),
    ],
    streamingBrain: {
      version: Number(root.streamingBrainVersion || 0),
      abrVersion: Number(root.streamingBrainABRVersion || 0),
      videoBitrates: String(root.transcoderVideoBitrates || '')
        .split(',')
        .filter(Boolean)
        .map(Number),
      videoResolutions: String(root.transcoderVideoResolutions || '')
        .split(',')
        .filter(Boolean),
      activeVideoSessions: Number(root.transcoderActiveVideoSessions || 0),
    },
    libraries,
    librarySummary: {
      libraries: libraries.length,
      movieLibraries: libraries.filter((library) => library.type === 'movie').length,
      televisionLibraries: libraries.filter((library) => library.type === 'show').length,
      musicLibraries: libraries.filter((library) => library.type === 'artist').length,
      indexedItems: primaryItemCount,
    },
    activity: {
      sessions: sessions.length,
      transcodes: transcodes.length,
      estimatedBandwidthKbps: bandwidth,
      backgroundTasks: (activityRoot.Activity || []).map((activity) => ({
        uuid: activity.uuid || '',
        type: activity.type || '',
        title: activity.title || '',
        subtitle: activity.subtitle || '',
        progress: Number(activity.progress || 0),
        cancellable: truthy(activity.cancellable),
      })),
      historyRecords: Number(historyRoot.totalSize ?? historyRoot.size ?? 0),
      playlists: Number(playlistRoot.totalSize ?? playlistRoot.size ?? 0),
    },
    devices: {
      registered: devices.length,
      platforms: platformCounts,
      oldestRegistration: devices.length
        ? Math.min(...devices.map((device) => Number(device.createdAt || Infinity)))
        : null,
      newestRegistration: Math.max(0, ...devices.map((device) => Number(device.createdAt || 0))),
    },
    resources,
    preferences,
    updater: {
      state: updaterRoot.state || updaterRoot.status || 'unknown',
      version: updaterRoot.version || updaterRoot.updateVersion || '',
      releaseNotes: updaterRoot.releaseNotes || '',
      available: truthy(updaterRoot.available || updaterRoot.updateAvailable),
    },
    companionBridge: {
      node: companion.application?.node || '',
      platform: companion.application?.platform || '',
      architecture: companion.application?.architecture || '',
      uptimeSeconds: companion.application?.uptimeSeconds || 0,
      configSource: companion.setup?.configSource || '',
      checks: companion.setup?.checks || {},
      mediaMapping: companion.setup?.optimization || {},
    },
    probes: probes.sort((a, b) => a.name.localeCompare(b.name)),
  };
}
