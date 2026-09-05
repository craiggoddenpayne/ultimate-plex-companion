function plexBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function selectedStream(part, streamType) {
  const streams = part.Stream || [];
  return (
    streams.find((stream) => Number(stream.streamType) === streamType && plexBoolean(stream.selected)) ||
    streams.find((stream) => Number(stream.streamType) === streamType) ||
    {}
  );
}

function dynamicRange(video) {
  const description = [video.dynamicRange, video.displayTitle, video.extendedDisplayTitle, video.colorTrc]
    .filter(Boolean)
    .join(' ');
  if (/dolby vision|dovi/i.test(description)) return 'Dolby Vision';
  if (/hdr10\+/i.test(description)) return 'HDR10+';
  if (/hdr|smpte2084|arib-std-b67/i.test(description)) return 'HDR';
  return 'SDR';
}

export function sessionDetail(item, index = 0) {
  const player = item.Player?.[0] || {};
  const session = item.Session?.[0] || {};
  const user = item.User?.[0] || {};
  const media = item.Media?.[0] || {};
  const part = media.Part?.[0] || {};
  const video = selectedStream(part, 1);
  const audio = selectedStream(part, 2);
  const subtitle = selectedStream(part, 3);
  const transcode = item.TranscodeSession?.[0] || null;
  const duration = Number(item.duration || media.duration || 0);
  const viewOffset = Number(item.viewOffset || 0);
  const progress = duration ? Math.min(100, Math.max(0, Math.round((viewOffset / duration) * 100))) : 0;
  const videoDecision = transcode?.videoDecision || media.videoDecision || 'directplay';
  const audioDecision = transcode?.audioDecision || media.audioDecision || 'directplay';
  const subtitleDecision =
    transcode?.subtitleDecision || media.subtitleDecision || (subtitle.id ? 'directplay' : 'none');
  const requiresEncode = videoDecision === 'transcode' || audioDecision === 'transcode' || subtitleDecision === 'burn';
  const mode = requiresEncode
    ? 'Transcoding'
    : transcode || videoDecision === 'copy' || audioDecision === 'copy'
      ? 'Direct Stream'
      : 'Direct Play';
  const width = Number(media.width || video.width || video.codedWidth || transcode?.width || 0);
  const height = Number(media.height || video.height || video.codedHeight || transcode?.height || 0);

  return {
    id: session.id || `session-${index}`,
    title: item.grandparentTitle ? `${item.grandparentTitle} · ${item.title}` : item.title || 'Unknown title',
    subtitle: item.grandparentTitle
      ? `S${String(item.parentIndex || 0).padStart(2, '0')} E${String(item.index || 0).padStart(2, '0')}`
      : item.year || '',
    mediaType: item.type || 'video',
    user: user.title || 'Unknown',
    userId: user.id || null,
    device: player.title || player.product || 'Plex client',
    product: player.product || '',
    platform: player.platform || '',
    platformVersion: player.platformVersion || '',
    playerVersion: player.version || '',
    playerModel: player.model || '',
    playerProfile: player.profile || '',
    address: player.address || '',
    publicAddress: player.remotePublicAddress || '',
    location: session.location || (plexBoolean(player.local) ? 'lan' : plexBoolean(player.relayed) ? 'relay' : 'wan'),
    local: plexBoolean(player.local),
    relayed: plexBoolean(player.relayed),
    secure: plexBoolean(player.secure),
    state: player.state || 'playing',
    progress,
    positionMs: viewOffset,
    durationMs: duration,
    remainingMinutes: Math.max(0, Math.ceil((duration - viewOffset) / 60_000)),
    mode,
    resolution: String(media.videoResolution || '').toUpperCase(),
    dimensions: width && height ? `${width}×${height}` : '',
    container: media.container || part.container || '',
    videoCodec: media.videoCodec || video.codec || '',
    videoProfile: media.videoProfile || video.profile || '',
    videoBitDepth: Number(video.bitDepth || 0) || null,
    videoFrameRate: video.frameRate || media.videoFrameRate || '',
    videoDisplayTitle: video.extendedDisplayTitle || video.displayTitle || '',
    dynamicRange: dynamicRange(video),
    audioCodec: media.audioCodec || audio.codec || '',
    audioChannels: Number(media.audioChannels || audio.channels || transcode?.audioChannels || 0) || null,
    audioLanguage: audio.language || audio.languageCode || '',
    audioDisplayTitle: audio.extendedDisplayTitle || audio.displayTitle || '',
    audioSampleRate: Number(audio.samplingRate || 0) || null,
    subtitleCodec: subtitle.codec || '',
    subtitleLanguage: subtitle.language || subtitle.languageCode || '',
    subtitleDisplayTitle: subtitle.extendedDisplayTitle || subtitle.displayTitle || '',
    bitrate: Number(media.bitrate || video.bitrate || 0),
    bandwidth: Number(session.bandwidth || transcode?.bandwidth || media.bitrate || 0),
    transcodeSpeed: Number(transcode?.speed || 0),
    transcodeProgress: Number(transcode?.progress || 0),
    throttled: plexBoolean(transcode?.throttled),
    hardware: plexBoolean(transcode?.transcodeHwFullPipeline) || plexBoolean(transcode?.transcodeHwRequested),
    videoDecision,
    audioDecision,
    subtitleDecision,
    outputVideoCodec: transcode?.videoCodec || media.videoCodec || '',
    outputAudioCodec: transcode?.audioCodec || media.audioCodec || '',
    outputContainer: transcode?.container || media.container || part.container || '',
    protocol: transcode?.protocol || '',
    tone: ['amber', 'violet', 'cyan'][index % 3],
    poster: item.ratingKey ? `/api/art/${item.ratingKey}` : null,
  };
}

const historyMetadataCache = new Map();
async function historyMetadata(config, plexFetch, ratingKey) {
  if (!ratingKey) return {};
  const cached = historyMetadataCache.get(String(ratingKey));
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached.item;
  try {
    const response = await plexFetch(config, `/library/metadata/${encodeURIComponent(ratingKey)}`);
    const item = response.MediaContainer?.Metadata?.[0] || {};
    historyMetadataCache.set(String(ratingKey), { at: Date.now(), item });
    return item;
  } catch {
    return {};
  }
}

export async function streamTelemetry(config, plexFetch) {
  const started = Date.now();
  const [sessionsData, historyData, accountsData] = await Promise.all([
    plexFetch(config, '/status/sessions'),
    plexFetch(
      config,
      '/status/sessions/history/all?X-Plex-Container-Start=0&X-Plex-Container-Size=12&sort=viewedAt%3Adesc&includeMedia=1',
    ),
    plexFetch(config, '/accounts').catch(() => ({ MediaContainer: {} })),
  ]);
  const sessions = (sessionsData.MediaContainer?.Metadata || []).map(sessionDetail);
  const totalBandwidth = sessions.reduce((sum, item) => sum + item.bandwidth, 0);
  const transcodes = sessions.filter((item) => item.mode === 'Transcoding');
  const accounts = new Map(
    (accountsData.MediaContainer?.Account || []).map((account) => [String(account.id), account.name || account.title]),
  );
  const recentRecords = (historyData.MediaContainer?.Metadata || [])
    .sort((a, b) => Number(b.viewedAt || 0) - Number(a.viewedAt || 0))
    .slice(0, 12);
  const recent = await Promise.all(
    recentRecords.map(async (record) => {
      const item = { ...(await historyMetadata(config, plexFetch, record.ratingKey)), ...record };
      const media = item.Media?.[0] || {};
      const accountId = item.accountID || null;
      return {
        title: item.grandparentTitle || item.title || 'Unknown',
        subtitle: item.type === 'episode' ? item.title || '' : '',
        type: item.type || 'video',
        viewedAt: Number(item.viewedAt || 0),
        accountId,
        user: accounts.get(String(accountId)) || item.User?.[0]?.title || '',
        detail:
          item.type === 'episode'
            ? `S${String(item.parentIndex || 0).padStart(2, '0')} E${String(item.index || 0).padStart(2, '0')}`
            : 'Movie',
        year: Number(item.year || item.grandparentYear || 0) || null,
        durationMinutes: item.duration ? Math.round(Number(item.duration) / 60_000) : null,
        resolution: String(media.videoResolution || '').toUpperCase(),
        container: String(media.container || ''),
        rating: Number(item.audienceRating || item.rating || 0) || null,
        poster: item.ratingKey ? `/api/art/${item.ratingKey}` : null,
      };
    }),
  );
  return {
    sessions,
    summary: {
      active: sessions.length,
      direct: sessions.length - transcodes.length,
      transcodes: transcodes.length,
      totalBandwidth,
      hardware: transcodes.filter((item) => item.hardware).length,
      latencyMs: Date.now() - started,
    },
    recent,
    sampledAt: new Date().toISOString(),
  };
}

export async function peopleTelemetry(config, plexFetch, requestedDays = 90) {
  const periodDays = Math.min(365, Math.max(7, Number(requestedDays || 90)));
  const since = Math.floor(Date.now() / 1000) - periodDays * 86400;
  const [accountsData, historyData, sessionsData] = await Promise.all([
    plexFetch(config, '/accounts'),
    plexFetch(
      config,
      '/status/sessions/history/all?X-Plex-Container-Start=0&X-Plex-Container-Size=1000&sort=viewedAt%3Adesc',
    ),
    plexFetch(config, '/status/sessions'),
  ]);
  const accounts = accountsData.MediaContainer?.Account || [];
  const history = (historyData.MediaContainer?.Metadata || []).filter((item) => Number(item.viewedAt || 0) >= since);
  const active = (sessionsData.MediaContainer?.Metadata || []).map(sessionDetail);
  const totalPlays = history.length || 1;
  const relevantAccounts = accounts.filter(
    (account) =>
      account.name ||
      history.some((item) => String(item.accountID) === String(account.id)) ||
      active.some((item) => String(item.userId) === String(account.id)),
  );
  const people = relevantAccounts
    .map((account, index) => {
      const plays = history.filter((item) => String(item.accountID) === String(account.id));
      const current = active.find((item) => String(item.userId) === String(account.id) || item.user === account.name);
      const latest = plays.reduce((max, item) => Math.max(max, Number(item.viewedAt || 0)), 0);
      const movies = plays.filter((item) => item.type === 'movie').length;
      const episodes = plays.filter((item) => item.type === 'episode').length;
      return {
        id: account.id,
        name: account.name || `User ${index + 1}`,
        initials: String(account.name || 'U')
          .split(/\s+/)
          .map((value) => value[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        plays: plays.length,
        movies,
        episodes,
        share: Math.round((plays.length / totalPlays) * 100),
        lastSeen: latest,
        active: Boolean(current),
        nowPlaying: current?.title || null,
        tone: ['amber', 'violet', 'cyan', 'rose'][index % 4],
      };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || b.plays - a.plays);
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    plays: history.filter((item) => new Date(Number(item.viewedAt) * 1000).getHours() === hour).length,
  }));
  const days = Array.from({ length: 7 }, (_, day) => ({
    day,
    plays: history.filter((item) => new Date(Number(item.viewedAt) * 1000).getDay() === day).length,
  }));
  return {
    people,
    totalPlays: history.length,
    activeNow: active.length,
    hours,
    days,
    periodDays,
    sampledAt: new Date().toISOString(),
  };
}
