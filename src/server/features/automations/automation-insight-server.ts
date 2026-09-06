const DAY = 86_400;

function bytes(item) {
  return (item.Media || []).reduce(
    (total, media) => total + (media.Part || []).reduce((sum, part) => sum + Number(part.size || 0), 0),
    0,
  );
}

function formatBytes(input) {
  let value = Number(input || 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit >= 3 ? 1 : 0)} ${units[unit]}`;
}

function title(item) {
  return item.grandparentTitle || item.title || 'Unknown title';
}

export function backlogReport(items, targets, now = Math.floor(Date.now() / 1000)) {
  const unwatched = items.filter((item) => !Number(item.viewCount || 0));
  const aged = unwatched.filter((item) => Number(item.addedAt || 0) && Number(item.addedAt) < now - 365 * DAY);
  const highRated = unwatched.filter((item) => Number(item.audienceRating || item.rating || 0) >= 7.5);
  return {
    headline: `${unwatched.length} unwatched title${unwatched.length === 1 ? '' : 's'}`,
    detail: `${aged.length} have waited at least a year and ${highRated.length} carry an audience rating of 7.5 or higher.`,
    metrics: { scanned: items.length, unwatched: unwatched.length, aged: aged.length, highRated: highRated.length },
    facts: [
      { label: 'Libraries scanned', value: targets.map((item) => item.title).join(', ') || 'None' },
      { label: 'Changes made', value: 'None' },
    ],
    items: [...unwatched]
      .sort(
        (a, b) =>
          Number(a.addedAt || Infinity) - Number(b.addedAt || Infinity) ||
          Number(b.audienceRating || b.rating || 0) - Number(a.audienceRating || a.rating || 0),
      )
      .slice(0, 8)
      .map((item) => ({
        title: title(item),
        detail: [
          item.year,
          item.libraryTitle,
          Number(item.audienceRating || item.rating || 0)
            ? `★ ${Number(item.audienceRating || item.rating).toFixed(1)}`
            : '',
        ]
          .filter(Boolean)
          .join(' · '),
        value: item.addedAt ? `${Math.max(0, Math.floor((now - Number(item.addedAt)) / DAY))} days` : 'Age unknown',
        ratingKey: item.ratingKey,
      })),
    recommendation: highRated.length
      ? 'Use Discovery Radar or Playlist Studio to turn the strongest waiting titles into a watchable shortlist.'
      : 'The unwatched shelf currently has no highly rated backlog pressure.',
  };
}

export function formatReport(items, targets) {
  const versions = items.flatMap((item) => (item.Media || []).map((media) => ({ item, media })));
  const legacyNames = new Set(['h264', 'avc', 'mpeg2video', 'mpeg2', 'vc1', 'mpeg4']);
  const legacy = versions.filter(({ media }) => legacyNames.has(String(media.videoCodec || '').toLowerCase()));
  const fourK = versions.filter(({ media }) => /4k|2160/i.test(String(media.videoResolution || ''))).length;
  const unknown = versions.filter(({ media }) => !media.videoCodec || !media.videoResolution).length;
  const codecCounts = new Map();
  for (const { media } of versions) {
    const codec = String(media.videoCodec || 'unknown').toUpperCase();
    codecCounts.set(codec, (codecCounts.get(codec) || 0) + 1);
  }
  return {
    headline: `${legacy.length} legacy media version${legacy.length === 1 ? '' : 's'}`,
    detail: `Mapped ${versions.length} versions across ${items.length} titles and ${targets.length} ${targets.length === 1 ? 'library' : 'libraries'}.`,
    metrics: { versions: versions.length, legacy: legacy.length, fourK, unknownFormats: unknown },
    facts: [
      {
        label: 'Codec mix',
        value:
          [...codecCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([codec, count]) => `${codec} ${count}`)
            .join(' · ') || 'No media',
      },
      { label: 'Changes made', value: 'None' },
    ],
    items: legacy.slice(0, 8).map(({ item, media }) => ({
      title: title(item),
      detail: [item.year, item.libraryTitle, String(media.videoResolution || '').toUpperCase()]
        .filter(Boolean)
        .join(' · '),
      value: String(media.videoCodec || 'Unknown').toUpperCase(),
      ratingKey: item.ratingKey,
    })),
    recommendation: legacy.length
      ? 'Review large legacy versions in Codec Studio; this automation never queues or replaces media.'
      : 'No legacy codec versions were detected in the selected libraries.',
  };
}

export function editionReport(items, targets) {
  const multiple = items
    .filter((item) => (item.Media || []).length > 1)
    .map((item) => {
      const sizes = (item.Media || []).map((media) =>
        (media.Part || []).reduce((sum, part) => sum + Number(part.size || 0), 0),
      );
      return { item, sizes, additional: Math.max(0, sizes.reduce((sum, size) => sum + size, 0) - Math.max(...sizes)) };
    })
    .sort((a, b) => b.additional - a.additional);
  const additionalBytes = multiple.reduce((sum, entry) => sum + entry.additional, 0);
  return {
    headline: `${multiple.length} multi-version title${multiple.length === 1 ? '' : 's'}`,
    detail: `Found ${formatBytes(additionalBytes)} stored beyond each title's largest single version. Editions may be intentional.`,
    metrics: { scanned: items.length, multiVersion: multiple.length, additionalStorage: additionalBytes },
    facts: [
      { label: 'Libraries scanned', value: targets.map((item) => item.title).join(', ') || 'None' },
      { label: 'Automatic deletion', value: 'Never' },
    ],
    items: multiple.slice(0, 8).map(({ item, sizes, additional }) => ({
      title: title(item),
      detail: [item.year, item.libraryTitle, `${sizes.length} versions`].filter(Boolean).join(' · '),
      value: `${formatBytes(additional)} extra`,
      ratingKey: item.ratingKey,
    })),
    recommendation: multiple.length
      ? 'Review these in Duplicate & Edition Finder before deciding whether every version is intentional.'
      : 'No titles with multiple Plex media versions were found.',
  };
}

export function growthReport(items, now = Math.floor(Date.now() / 1000)) {
  const within = (days) => items.filter((item) => Number(item.addedAt || 0) >= now - days * DAY);
  const week = within(7),
    month = within(30);
  return {
    headline: `${week.length} arrival${week.length === 1 ? '' : 's'} this week`,
    detail: `${month.length} titles arrived in 30 days, adding ${formatBytes(month.reduce((sum, item) => sum + bytes(item), 0))}.`,
    metrics: {
      today: within(1).length,
      thisWeek: week.length,
      thisMonth: month.length,
      addedBytes: month.reduce((sum, item) => sum + bytes(item), 0),
    },
    facts: [
      { label: 'Sample size', value: `Latest ${items.length} arrivals` },
      { label: 'Changes made', value: 'None' },
    ],
    items: items.slice(0, 8).map((item) => ({
      title: title(item),
      detail: [item.year, item.type, item.librarySectionTitle].filter(Boolean).join(' · '),
      value: item.addedAt ? new Date(Number(item.addedAt) * 1000).toLocaleDateString() : 'Recently added',
      ratingKey: item.ratingKey,
    })),
  };
}

export function playbackDigestReport(history, now = Math.floor(Date.now() / 1000)) {
  const recent = history.filter((item) => Number(item.viewedAt || 0) >= now - 7 * DAY);
  const previous = history.filter((item) => {
    const viewedAt = Number(item.viewedAt || 0);
    return viewedAt >= now - 14 * DAY && viewedAt < now - 7 * DAY;
  });
  const titleCounts = new Map();
  const userCounts = new Map();
  for (const item of recent) {
    const itemTitle = title(item);
    titleCounts.set(itemTitle, (titleCounts.get(itemTitle) || 0) + 1);
    const user = item.accountName || item.User?.[0]?.title || 'Unknown user';
    userCounts.set(user, (userCounts.get(user) || 0) + 1);
  }
  const topTitles = [...titleCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topUsers = [...userCounts.entries()].sort((a, b) => b[1] - a[1]);
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: recent.filter((item) => new Date(Number(item.viewedAt || 0) * 1000).getHours() === hour).length,
  }));
  const peak = hours.sort((a, b) => b.count - a.count)[0];
  return {
    headline: `${recent.length} play${recent.length === 1 ? '' : 's'} this week`,
    detail: `${recent.length - previous.length >= 0 ? '+' : ''}${recent.length - previous.length} compared with the previous seven days.`,
    metrics: {
      thisWeek: recent.length,
      previousWeek: previous.length,
      uniqueTitles: titleCounts.size,
      viewers: userCounts.size,
    },
    facts: [
      {
        label: 'Peak hour',
        value: peak?.count ? `${String(peak.hour).padStart(2, '0')}:00 · ${peak.count} plays` : 'No signal',
      },
      { label: 'Most active viewer', value: topUsers[0] ? `${topUsers[0][0]} · ${topUsers[0][1]} plays` : 'No signal' },
    ],
    items: topTitles.slice(0, 8).map(([itemTitle, count]) => ({
      title: itemTitle,
      detail: 'Seven-day playback',
      value: `${count} play${count === 1 ? '' : 's'}`,
    })),
  };
}

export function newMediaReport(items) {
  const issues = items
    .map((item) => {
      const media = item.Media || [];
      const parts = media.flatMap((entry) => entry.Part || []);
      const findings = [
        !media.length && 'No media version',
        !Number(item.duration || media[0]?.duration || 0) && 'Missing duration',
        media.some((entry) => !entry.videoCodec) && 'Unknown video codec',
        media.some((entry) => !entry.videoResolution) && 'Unknown resolution',
        parts.some((part) => !Number(part.size || 0)) && 'Missing file size',
      ].filter(Boolean);
      return { item, findings };
    })
    .filter(({ findings }) => findings.length);
  return {
    headline: `${issues.length} new-media issue${issues.length === 1 ? '' : 's'}`,
    detail: `Checked the latest ${items.length} Plex arrivals for playable media, duration, codec, resolution and file size.`,
    metrics: { checked: items.length, issues: issues.length, clean: items.length - issues.length },
    facts: [
      { label: 'Access', value: 'Read only' },
      { label: 'Automatic repair', value: 'None' },
    ],
    items: issues.slice(0, 8).map(({ item, findings }) => ({
      title: title(item),
      detail: findings.join(' · '),
      value: item.type || 'Media',
      ratingKey: item.ratingKey,
    })),
    recommendation: issues.length
      ? 'Verify the affected files and use Plex Analyze or Refresh Metadata after correcting the source.'
      : 'Every sampled arrival contains the expected core media information.',
  };
}
