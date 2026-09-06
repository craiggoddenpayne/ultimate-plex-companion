function plexBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

const accountHeaders = {
  'X-Plex-Product': 'Ultimate Plex Companion',
  'X-Plex-Version': '0.1.0',
  'X-Plex-Client-Identifier': 'ultimate-plex-companion',
};

function decodeXml(value = '') {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

export function parsePlexAccountDevices(xml) {
  return [...String(xml).matchAll(/<Device\s+([^>]+)>/g)].map((match) => {
    const attributes = Object.fromEntries(
      [...match[1].matchAll(/([\w]+)="([^"]*)"/g)].map((attribute) => [attribute[1], decodeXml(attribute[2])]),
    );
    return {
      id: String(attributes.id || ''),
      name: attributes.name || 'Plex client',
      product: attributes.product || '',
      platform: attributes.platform || '',
      clientIdentifier: String(attributes.clientIdentifier || ''),
      createdAt: Number(attributes.createdAt || 0) || null,
      lastSeenAt: Number(attributes.lastSeenAt || 0) || null,
    };
  });
}

async function plexAccountRequest(config, path, method, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetchImpl('https://plex.tv' + path, {
      method,
      signal: controller.signal,
      headers: { ...accountHeaders, 'X-Plex-Token': config.token, Accept: 'application/xml' },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function plexAccountDevices(config, fetchImpl = fetch) {
  const response = await plexAccountRequest(config, '/devices.xml', 'GET', fetchImpl);
  if (!response.ok) throw new Error(`Plex account device lookup failed (HTTP ${response.status}).`);
  return parsePlexAccountDevices(await response.text());
}

export async function revokePlexClient(config, clientIdentifier, confirmed, fetchImpl = fetch) {
  const identifier = String(clientIdentifier || '').trim();
  if (confirmed !== true) throw new Error('Confirm device access revocation before continuing.');
  if (!identifier || identifier.length > 200) throw new Error('A valid Plex client identifier is required.');
  if (identifier === accountHeaders['X-Plex-Client-Identifier'])
    throw new Error('Companion cannot revoke its own Plex authorization.');
  const devices = await plexAccountDevices(config, fetchImpl);
  const matches = devices.filter((device) => device.clientIdentifier === identifier && device.id);
  if (!matches.length) throw new Error('This client is no longer authorized on the Plex account.');
  const target = matches.sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0))[0];
  const response = await plexAccountRequest(
    config,
    `/devices/${encodeURIComponent(target.id)}.xml`,
    'DELETE',
    fetchImpl,
  );
  if (!response.ok) {
    if ([401, 403].includes(response.status))
      throw new Error('Plex refused the revocation. Confirm this token belongs to the server owner.');
    throw new Error(`Plex could not revoke this client (HTTP ${response.status}).`);
  }
  return { revoked: true, name: target.name, product: target.product, clientIdentifier: identifier };
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
    clientIdentifier: player.machineIdentifier || '',
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

export async function peopleTelemetry(config, plexFetch, requestedDays = 90, accountDevices = null) {
  const periodDays = Math.min(365, Math.max(7, Number(requestedDays || 90)));
  const since = Math.floor(Date.now() / 1000) - periodDays * 86400;
  const [accountsData, historyData, sessionsData, devicesData] = await Promise.all([
    plexFetch(config, '/accounts'),
    plexFetch(
      config,
      '/status/sessions/history/all?X-Plex-Container-Start=0&X-Plex-Container-Size=1000&sort=viewedAt%3Adesc',
    ),
    plexFetch(config, '/status/sessions'),
    plexFetch(config, '/devices').catch(() => ({ MediaContainer: {} })),
  ]);
  const accounts = accountsData.MediaContainer?.Account || [];
  const rawHistory = (historyData.MediaContainer?.Metadata || []).filter((item) => Number(item.viewedAt || 0) >= since);
  const metadataKeys = [
    ...new Set(rawHistory.map((item) => item.grandparentRatingKey || item.ratingKey).filter(Boolean)),
  ].slice(0, 48);
  const metadata = new Map<string, any>(
    await Promise.all(
      metadataKeys.map(async (key) => [String(key), await historyMetadata(config, plexFetch, key)] as [string, any]),
    ),
  );
  const history = rawHistory.map((item) => ({
    ...item,
    Genre: item.Genre?.length
      ? item.Genre
      : metadata.get(String(item.grandparentRatingKey || item.ratingKey))?.Genre || [],
  }));
  const active = (sessionsData.MediaContainer?.Metadata || []).map(sessionDetail);
  const accountNames = new Map<string, string>(
    accounts.map(
      (account) => [String(account.id), account.name || account.title || `User ${account.id}`] as [string, string],
    ),
  );
  const registeredDevices = new Map<string, any>(
    (devicesData.MediaContainer?.Device || []).map((device) => [String(device.id), device] as [string, any]),
  );
  const authorizedDevices: Map<string, any> | null = accountDevices
    ? new Map<string, any>(accountDevices.map((device) => [String(device.clientIdentifier), device]))
    : null;
  const deviceHistory = [...new Set(history.map((item) => item.deviceID).filter((id) => id != null))]
    .map((deviceId) => {
      const id = String(deviceId);
      const device = registeredDevices.get(id) || {};
      const plays = history.filter((item) => String(item.deviceID) === id);
      const clientIdentifier = String(device.clientIdentifier || '');
      const authorized = authorizedDevices?.get(clientIdentifier);
      const current = active.find(
        (session) =>
          (clientIdentifier && session.clientIdentifier === clientIdentifier) ||
          (!clientIdentifier &&
            device.name &&
            session.device === device.name &&
            (!device.platform || session.platform === device.platform)),
      );
      const people = [
        ...new Set<string>(
          plays.map((item) => accountNames.get(String(item.accountID))).filter((name): name is string => Boolean(name)),
        ),
      ].sort((a, b) => a.localeCompare(b));
      const viewedAt = plays.map((item) => Number(item.viewedAt || 0)).filter(Boolean);
      return {
        id,
        name: device.name || `Plex device ${id}`,
        platform: device.platform || current?.platform || 'Unknown platform',
        clientIdentifier,
        authorizationStatus: authorized ? 'authorized' : authorizedDevices ? 'not_authorized' : 'unknown',
        revocable: Boolean(authorized),
        authorizedProduct: authorized?.product || '',
        authorizationLastSeen: authorized?.lastSeenAt || null,
        registeredAt: Number(device.createdAt || 0) || null,
        people,
        plays: plays.length,
        movies: plays.filter((item) => item.type === 'movie').length,
        episodes: plays.filter((item) => item.type === 'episode').length,
        firstSeen: viewedAt.length ? Math.min(...viewedAt) : null,
        lastSeen: viewedAt.length ? Math.max(...viewedAt) : null,
        active: Boolean(current),
        product: current?.product || authorized?.product || '',
        version: current?.playerVersion || '',
        localAddress: current?.address || '',
        publicAddress: current?.publicAddress || '',
        location: current?.location || '',
        secure: current?.secure || false,
      };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || Number(b.lastSeen) - Number(a.lastSeen));
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
      const genreCounts = new Map();
      for (const item of plays)
        for (const genre of item.Genre || [])
          if (genre.tag) genreCounts.set(genre.tag, (genreCounts.get(genre.tag) || 0) + 1);
      const preferredGenres = [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([genre, count]) => ({
          genre,
          plays: count,
          share: Math.round((count / Math.max(1, plays.length)) * 100),
        }));
      const minutesWatched = Math.round(
        plays.reduce((sum, item) => sum + Number(item.duration || item.viewOffset || 0), 0) / 60_000,
      );
      const hourlyPlays = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: plays.filter((item) => new Date(Number(item.viewedAt || 0) * 1000).getHours() === hour).length,
      })).sort((a, b) => b.count - a.count || a.hour - b.hour);
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
        minutesWatched,
        preferredGenres,
        favouriteGenre: preferredGenres[0]?.genre || 'Still forming',
        peakHour: hourlyPlays[0]?.count ? hourlyPlays[0].hour : null,
        preferredFormat: movies === episodes ? 'Mixed' : movies > episodes ? 'Films' : 'Series',
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
    deviceHistory,
    totalPlays: history.length,
    activeNow: active.length,
    hours,
    days,
    periodDays,
    sampledAt: new Date().toISOString(),
  };
}
