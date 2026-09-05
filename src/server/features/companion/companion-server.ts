function compactItem(item, hub: any = {}) {
  const episode = item.type === 'episode';
  const title =
    episode && item.grandparentTitle
      ? `${item.grandparentTitle} · ${item.title || 'Episode'}`
      : item.title || item.name || 'Unknown';
  const detail = episode
    ? `S${String(item.parentIndex || 0).padStart(2, '0')} E${String(item.index || 0).padStart(2, '0')}`
    : item.parentTitle || item.originalTitle || '';
  return {
    ratingKey: String(item.ratingKey || ''),
    title,
    detail,
    type: item.type || hub.type || 'media',
    year: Number(item.year || item.grandparentYear || 0) || null,
    summary: item.summary || '',
    durationMinutes: item.duration ? Math.round(Number(item.duration) / 60_000) : null,
    rating: Number(item.audienceRating || item.rating || 0) || null,
    library: item.librarySectionTitle || hub.title || '',
    poster: item.ratingKey ? `/api/art/${item.ratingKey}` : null,
  };
}

export async function universalSearch(config, plexFetch, rawQuery) {
  const query = String(rawQuery || '')
    .trim()
    .slice(0, 120);
  if (query.length < 2) return { query, results: [] };
  const params = new URLSearchParams({ query, limit: '8', includeCollections: '1', includeExternalMedia: '0' });
  const response = await plexFetch(config, `/hubs/search?${params}`);
  const hubs = response.MediaContainer?.Hub || [];
  const seen = new Set();
  const results = [];
  for (const hub of hubs) {
    for (const item of [...(hub.Metadata || []), ...(hub.Directory || [])]) {
      const key = String(item.ratingKey || item.key || `${item.type}-${item.title}`);
      if (seen.has(key) || !item.title) continue;
      seen.add(key);
      results.push(compactItem(item, hub));
      if (results.length >= 24) break;
    }
    if (results.length >= 24) break;
  }
  return { query, results, total: results.length };
}

function formatBytes(bytes) {
  let value = Number(bytes) || 0,
    unit = 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit > 2 ? 1 : 0)} ${units[unit]}`;
}

export async function answerCompanion(config, dependencies, rawQuestion) {
  const question = String(rawQuestion || '')
    .trim()
    .slice(0, 500);
  if (!question) throw new Error('Ask Companion a question first.');
  const words = question.toLowerCase();
  if (/watch|recommend|tonight|film|movie/.test(words)) {
    const report = await dependencies.discoveryRecommendations(config, {
      mode: 'tonight',
      unwatchedOnly: 'true',
      maxMinutes: '180',
    });
    const picks = report.results.slice(0, 3);
    return {
      intent: 'recommendation',
      eyebrow: 'TONIGHT SIGNAL',
      headline: picks.length ? `Start with ${picks[0].title}` : 'Your watchlist is beautifully clear',
      answer: picks.length
        ? `I found ${picks.length} strong, unwatched matches already in your library. They fit within three hours and rank highly for quality and discovery value.`
        : 'I could not find an unwatched match within the current time window.',
      cards: picks,
      action: { label: 'Open Discovery Radar', route: 'radar' },
    };
  }
  if (/transcod|stream|buffer|playing|bandwidth/.test(words)) {
    const report = await dependencies.streamTelemetry(config, dependencies.plexFetch);
    const count = report.summary.transcodes;
    return {
      intent: 'streams',
      eyebrow: 'PLAYBACK DIAGNOSTIC',
      headline: count ? `${count} transcode${count === 1 ? '' : 's'} active` : 'Every path is running cleanly',
      answer: report.summary.active
        ? `${report.summary.active} stream${report.summary.active === 1 ? ' is' : 's are'} active. ${report.summary.direct} are direct and ${count} require transcoding. Estimated combined bandwidth is ${(report.summary.totalBandwidth / 1000).toFixed(1)} Mbps.`
        : 'Nothing is playing right now, so there is no encoder or bandwidth pressure.',
      stats: [
        ['ACTIVE', report.summary.active],
        ['DIRECT', report.summary.direct],
        ['TRANSCODES', count],
      ],
      action: { label: 'Open Live Streams', route: 'streams' },
    };
  }
  if (/space|storage|large|compress|saving|reclaim|hevc/.test(words)) {
    const report = await dependencies.storageAnalysis(config);
    return {
      intent: 'storage',
      eyebrow: 'STORAGE INTELLIGENCE',
      headline: `${formatBytes(report.estimatedSaving)} may be reclaimable`,
      answer: `I reviewed ${report.scanned.toLocaleString()} titles and found ${report.candidateCount} large H.264 files worth inspecting. Nothing has been queued or changed.`,
      stats: [
        ['CANDIDATES', report.candidateCount],
        ['FOOTPRINT', formatBytes(report.totalSize)],
        ['CONFIDENCE', `${report.averageConfidence}%`],
      ],
      action: { label: 'Review candidates', route: 'library' },
    };
  }
  if (/automat|schedule|routine|mission/.test(words)) {
    const report = await dependencies.automationEngine.list();
    const active = report.rules.filter((rule) => rule.enabled).length;
    return {
      intent: 'automation',
      eyebrow: 'AUTOMATION CORE',
      headline: report.paused ? 'The scheduler is paused' : `${active} automation${active === 1 ? '' : 's'} active`,
      answer: `You have ${report.rules.length} configured rule${report.rules.length === 1 ? '' : 's'} and ${report.runs.length} recorded run${report.runs.length === 1 ? '' : 's'}. ${report.paused ? 'Resume the core when you are ready.' : 'The scheduler is online and following local time.'}`,
      stats: [
        ['ACTIVE', active],
        ['RECIPES', report.templates.length],
        ['RUNS', report.runs.length],
      ],
      action: { label: 'Open Automation Core', route: 'automation' },
    };
  }
  if (/new|recent|added|arrival/.test(words)) {
    const response = await dependencies.plexFetch(
      config,
      '/library/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size=6',
    );
    const cards = (response.MediaContainer?.Metadata || []).map((item) => compactItem(item)).slice(0, 6);
    return {
      intent: 'arrivals',
      eyebrow: 'NEW ARRIVALS',
      headline: `${cards.length} fresh addition${cards.length === 1 ? '' : 's'}`,
      answer: cards.length
        ? `The newest arrival is ${cards[0].title}. Here is what recently landed across your Plex libraries.`
        : 'Plex did not return any recent additions.',
      cards,
      action: { label: 'Explore Discovery', route: 'radar' },
    };
  }
  const report = await dependencies.overview(config);
  return {
    intent: 'overview',
    eyebrow: 'SYSTEM ANSWER',
    headline: `${report.server.name} is connected`,
    answer: `Your server reports ${report.titleCount.toLocaleString()} titles across ${report.libraryCount} libraries, with ${report.sessions.length} active stream${report.sessions.length === 1 ? '' : 's'} right now. Ask me about recommendations, storage, streams, new arrivals or automations for a deeper answer.`,
    stats: [
      ['TITLES', report.titleCount.toLocaleString()],
      ['LIBRARIES', report.libraryCount],
      ['STREAMS', report.sessions.length],
    ],
    action: { label: 'Return to Command Deck', route: 'dashboard' },
  };
}

export async function companionNotifications(config, dependencies) {
  const [streams, automations] = await Promise.all([
    dependencies.streamTelemetry(config, dependencies.plexFetch),
    dependencies.automationEngine.list(),
  ]);
  const notifications = [];
  const now = Date.now();
  for (const session of streams.sessions.filter((item) => item.mode === 'Transcoding'))
    notifications.push({
      id: `stream-${session.id}`,
      tone: 'amber',
      title: 'Active transcode',
      body: `${session.title} · ${session.user} · ${session.resolution || 'video'}`,
      route: 'streams',
      at: new Date().toISOString(),
    });
  for (const run of automations.runs.filter((item) => item.status === 'failed').slice(0, 4))
    notifications.push({
      id: `run-${run.id}`,
      tone: 'rose',
      title: `${run.ruleName} failed`,
      body: run.error || 'Open Automation Core for details.',
      route: 'automation',
      at: run.finishedAt || run.startedAt,
    });
  for (const job of dependencies.getJobs().filter((item) => item.state === 'ready'))
    notifications.push({
      id: `job-${job.id}`,
      tone: 'cyan',
      title: 'Encode ready for review',
      body: `${job.title} · ${formatBytes(job.saving)} measured saving`,
      route: 'library',
      at: job.updatedAt,
    });
  const recentSuccess = automations.runs.find(
    (item) => item.status === 'success' && now - Date.parse(item.finishedAt || 0) < 24 * 60 * 60_000,
  );
  if (recentSuccess)
    notifications.push({
      id: `run-${recentSuccess.id}`,
      tone: 'green',
      title: `${recentSuccess.ruleName} completed`,
      body: recentSuccess.result?.headline || 'Automation completed successfully.',
      route: 'automation',
      at: recentSuccess.finishedAt,
    });
  notifications.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { notifications: notifications.slice(0, 12), generatedAt: new Date().toISOString() };
}
