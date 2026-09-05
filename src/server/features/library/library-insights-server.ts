import { buildEditionInsights } from './library-overlap-server.ts';
let insightsCache;

function mediaFacts(item) {
  const versions = (item.Media || [])
    .map((media) => ({ media, size: (media.Part || []).reduce((sum, part) => sum + Number(part.size || 0), 0) }))
    .sort((a, b) => b.size - a.size);
  const primary = versions[0]?.media || {};
  const raw = String(primary.videoResolution || '').toLowerCase();
  const resolution =
    raw.includes('4k') || Number(primary.width) >= 3000
      ? '4K'
      : raw.includes('1080') || Number(primary.height) >= 1000
        ? '1080p'
        : raw.includes('720') || Number(primary.height) >= 700
          ? '720p'
          : 'SD';
  const dynamic = String(primary.videoDynamicRange || primary.videoDynamicRangeType || '').toUpperCase();
  return {
    versions,
    size: versions.reduce((sum, entry) => sum + entry.size, 0),
    resolution,
    codec: String(primary.videoCodec || 'Unknown').toUpperCase(),
    hdr: /HDR|DOVI|DOLBY/.test(dynamic),
    bitrate: Number(primary.bitrate || 0),
  };
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = key(item);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export function invalidateLibraryInsights() {
  insightsCache = null;
}

export async function libraryInsights(config, dependencies, force = false) {
  if (!force && insightsCache && Date.now() - insightsCache.createdAt < 15 * 60_000) return insightsCache.data;
  const sections = await dependencies.plexFetch(config, '/library/sections');
  const libraries = (sections.MediaContainer?.Directory || []).filter((library) =>
    ['movie', 'show'].includes(library.type),
  );
  const batches = await Promise.all(
    libraries.map(async (library) =>
      (await dependencies.libraryItems(config, library)).map((item) => ({
        ...item,
        libraryKey: String(library.key),
        libraryType: library.type,
      })),
    ),
  );
  const items = batches.flat().map((item) => ({ ...item, facts: mediaFacts(item) }));
  const totalBytes = items.reduce((sum, item) => sum + item.facts.size, 0);
  const resolution = countBy(items, (item) => item.facts.resolution);
  const codecs = countBy(items, (item) => item.facts.codec).slice(0, 8);
  const hdrCount = items.filter((item) => item.facts.hdr).length;
  const editions = buildEditionInsights(items);
  const metadataIssues = items
    .map((item) => {
      const missing = [];
      if (!item.thumb) missing.push('artwork');
      if (!item.summary) missing.push('summary');
      if (!item.year && !item.grandparentYear) missing.push('year');
      if (item.libraryType === 'movie' && !(item.Genre || []).length) missing.push('genres');
      return { item, missing };
    })
    .filter((entry) => entry.missing.length)
    .sort((a, b) => b.missing.length - a.missing.length)
    .map(({ item, missing }) => ({
      ratingKey: item.ratingKey,
      title: item.grandparentTitle ? `${item.grandparentTitle} · ${item.title}` : item.title,
      library: item.libraryTitle,
      missing,
      poster: item.thumb ? `/api/art/${item.ratingKey}` : null,
    }));
  const now = Date.now() / 1000,
    recent = items.filter((item) => Number(item.addedAt || 0) > now - 90 * 86400),
    recentBytes = recent.reduce((sum, item) => sum + item.facts.size, 0);
  const byLibrary = libraries
    .map((library) => {
      const owned = items.filter((item) => item.libraryKey === String(library.key));
      return {
        key: String(library.key),
        title: library.title,
        type: library.type,
        count: owned.length,
        size: owned.reduce((sum, item) => sum + item.facts.size, 0),
        recent: owned.filter((item) => Number(item.addedAt || 0) > now - 30 * 86400).length,
      };
    })
    .sort((a, b) => b.size - a.size);
  const data = {
    generatedAt: new Date().toISOString(),
    itemCount: items.length,
    libraryCount: libraries.length,
    totalBytes,
    quality: {
      resolution,
      codecs,
      hdrCount,
      hdrPercent: items.length ? Math.round((hdrCount / items.length) * 100) : 0,
      averageBitrate: items.length
        ? Math.round(items.reduce((sum, item) => sum + item.facts.bitrate, 0) / items.length)
        : 0,
    },
    editions,
    metadata: {
      issues: metadataIssues.slice(0, 40),
      issueCount: metadataIssues.length,
      completeCount: items.length - metadataIssues.length,
      completeness: items.length ? Math.round(((items.length - metadataIssues.length) / items.length) * 100) : 100,
    },
    growth: {
      recentItems: recent.length,
      recentBytes,
      monthlyBytes: Math.round(recentBytes / 3),
      annualProjectionBytes: Math.round((recentBytes / 90) * 365),
      libraries: byLibrary,
    },
  };
  insightsCache = { createdAt: Date.now(), data };
  return data;
}
