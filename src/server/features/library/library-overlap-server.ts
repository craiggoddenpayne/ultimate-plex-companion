import { basename } from 'node:path';

function displayResolution(media) {
  const raw = String(media.videoResolution || '').toLowerCase();
  if (raw.includes('4k') || Number(media.width) >= 3000) return '4K';
  if (raw.includes('1080') || Number(media.height) >= 1000) return '1080p';
  if (raw.includes('720') || Number(media.height) >= 700) return '720p';
  return raw ? raw.toUpperCase() : 'SD';
}

function copyDetails(item, entry, index) {
  const media = entry.media || {},
    parts = media.Part || [];
  const locations = parts.map((part) => part.file).filter(Boolean);
  const size = entry.size || parts.reduce((sum, part) => sum + Number(part.size || 0), 0);
  const dynamicRange = String(media.videoDynamicRange || media.videoDynamicRangeType || '').toUpperCase();
  return {
    ratingKey: String(item.ratingKey),
    mediaId: String(media.id || ''),
    title: item.grandparentTitle ? `${item.grandparentTitle} · ${item.title}` : item.title || 'Unknown title',
    library: item.libraryTitle || 'Unknown library',
    libraryKey: String(item.libraryKey || ''),
    fileName: locations[0] ? basename(locations[0]) : `Media version ${index + 1}`,
    locations,
    partCount: parts.length,
    size,
    resolution: displayResolution(media),
    width: Number(media.width || 0),
    height: Number(media.height || 0),
    videoCodec: String(media.videoCodec || 'Unknown').toUpperCase(),
    container: String(media.container || parts[0]?.container || 'Unknown').toUpperCase(),
    bitrate: Number(media.bitrate || 0),
    frameRate: String(media.videoFrameRate || ''),
    hdr: /HDR|DOVI|DOLBY/.test(dynamicRange),
    dynamicRange: dynamicRange || 'SDR',
    audioCodec: String(media.audioCodec || 'Unknown').toUpperCase(),
    audioChannels: Number(media.audioChannels || 0),
    duration: Number(media.duration || item.duration || 0),
    edition: item.editionTitle || '',
  };
}

export function buildEditionInsights(items) {
  const versionsFor = (item) => item.facts.versions.map((entry, index) => copyDetails(item, entry, index));
  const versioned = items
    .filter((item) => item.facts.versions.length > 1 || item.editionTitle)
    .map((item) => ({
      ratingKey: String(item.ratingKey),
      title: item.grandparentTitle ? `${item.grandparentTitle} · ${item.title}` : item.title,
      year: item.year || item.grandparentYear || null,
      library: item.libraryTitle,
      copyCount: item.facts.versions.length,
      edition: item.editionTitle || '',
      size: item.facts.size,
      poster: `/api/art/${item.ratingKey}`,
      copies: versionsFor(item),
      kind: 'Multiple media versions',
    }));
  const groups = new Map();
  for (const item of items) {
    const key =
      item.type === 'episode' || item.grandparentTitle
        ? `episode|${item.grandparentTitle}|${item.parentIndex}|${item.index}`.toLowerCase()
        : `movie|${item.title}|${item.year || ''}`.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const duplicates = [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const copies = group.flatMap((item) => versionsFor(item));
      return {
        title: group[0].grandparentTitle ? `${group[0].grandparentTitle} · ${group[0].title}` : group[0].title,
        year: group[0].year || group[0].grandparentYear || null,
        copyCount: copies.length,
        itemCount: group.length,
        size: copies.reduce((sum, item) => sum + item.size, 0),
        libraries: [...new Set(group.map((item) => item.libraryTitle))],
        poster: `/api/art/${group[0].ratingKey}`,
        copies,
        kind: 'Duplicate library records',
      };
    })
    .sort((a, b) => b.size - a.size);
  return {
    versioned: versioned.slice(0, 30),
    versionedCount: versioned.length,
    duplicates: duplicates.slice(0, 30),
    duplicateCount: duplicates.length,
    duplicateBytes: duplicates.reduce((sum, item) => sum + item.size, 0),
  };
}

export async function deleteOverlap(config, dependencies, input, report) {
  const ratingKey = String(input.ratingKey || ''),
    mediaId = String(input.mediaId || '');
  if (!/^\d+$/.test(ratingKey) || !/^\d+$/.test(mediaId)) throw new Error('Invalid Plex media selection.');
  const groups = [...(report.editions?.duplicates || []), ...(report.editions?.versioned || [])];
  const group = groups.find(
    (candidate) =>
      candidate.copies?.length > 1 &&
      candidate.copies.some((copy) => copy.ratingKey === ratingKey && copy.mediaId === mediaId),
  );
  if (!group)
    throw new Error('This media version is no longer part of a detected overlap. Refresh Atlas and review it again.');
  const metadata = await dependencies.plexFetch(config, `/library/metadata/${encodeURIComponent(ratingKey)}`);
  const item = metadata.MediaContainer?.Metadata?.[0];
  const media = (item?.Media || []).find((candidate) => String(candidate.id) === mediaId);
  if (!media) throw new Error('Plex no longer reports that media version. Nothing was deleted.');
  const locations = (media.Part || []).map((part) => part.file).filter(Boolean);
  const fileName = locations[0] ? basename(locations[0]) : `Media version ${mediaId}`;
  if (input.confirmed !== true) throw new Error('Confirm deletion before continuing.');
  await dependencies.plexDelete(
    config,
    `/library/metadata/${encodeURIComponent(ratingKey)}/media/${encodeURIComponent(mediaId)}?proxy=0`,
  );
  dependencies.invalidate?.();
  return { deleted: true, title: item?.title || group.title, fileName, mediaId, ratingKey };
}
