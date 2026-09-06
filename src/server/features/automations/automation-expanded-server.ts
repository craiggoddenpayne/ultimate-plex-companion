const DAY = 86_400;

export const expandedAutomationTemplates = [
  ['artwork_coverage', 'Artwork Coverage Watch', 'Find titles without usable poster artwork.', 'Metadata', 'cyan'],
  [
    'summary_quality',
    'Summary Quality Lens',
    'Find missing, very short or unusually long summaries.',
    'Metadata',
    'violet',
  ],
  ['date_consistency', 'Release Date Consistency', 'Audit missing and implausible release years.', 'Metadata', 'amber'],
  [
    'duplicate_title_radar',
    'Duplicate Title Radar',
    'Surface same-year titles that may be duplicate records.',
    'Metadata',
    'rose',
  ],
  [
    'guid_integrity',
    'Match Identity Monitor',
    'Find catalogue records without stable provider identities.',
    'Metadata',
    'cyan',
  ],
  [
    'content_rating_coverage',
    'Certification Coverage',
    'Measure missing film and television certifications.',
    'Metadata',
    'violet',
  ],
  [
    'genre_taxonomy',
    'Genre Taxonomy Gardener',
    'Find untagged titles and fragmented one-off genres.',
    'Metadata',
    'amber',
  ],
  [
    'collection_curator',
    'Collection Curator',
    'Find collection gaps and titles without collection context.',
    'Discovery',
    'rose',
  ],
  ['cast_coverage', 'Cast Coverage Audit', 'Find titles whose Plex records expose no cast.', 'Metadata', 'cyan'],
  ['director_coverage', 'Director Coverage Audit', 'Find films without credited directors.', 'Metadata', 'violet'],
  [
    'audio_codec_audit',
    'Audio Codec Census',
    'Inventory audio codecs and flag unknown audio metadata.',
    'Formats',
    'amber',
  ],
  [
    'subtitle_coverage',
    'Subtitle Coverage Map',
    'Audit exposed subtitle streams and missing stream tags.',
    'Formats',
    'rose',
  ],
  ['hdr_inventory', 'HDR Capability Inventory', 'Map HDR, Dolby Vision and SDR media versions.', 'Formats', 'cyan'],
  [
    'bitrate_outliers',
    'Bitrate Outlier Watch',
    'Surface unusually high and missing bitrate metadata.',
    'Storage',
    'violet',
  ],
  [
    'container_compatibility',
    'Container Compatibility Map',
    'Inventory containers and highlight uncommon formats.',
    'Formats',
    'amber',
  ],
  ['resolution_balance', 'Resolution Balance', 'Measure SD, HD, Full HD and 4K representation.', 'Formats', 'rose'],
  ['aspect_ratio_audit', 'Aspect Ratio Audit', 'Find missing or unusual aspect-ratio metadata.', 'Formats', 'cyan'],
  [
    'file_size_outliers',
    'File Size Outlier Watch',
    'Rank the largest individual titles in the library.',
    'Storage',
    'violet',
  ],
  [
    'runtime_anomalies',
    'Runtime Anomaly Detector',
    'Find implausibly short, long or missing runtimes.',
    'Metadata',
    'amber',
  ],
  [
    'multi_audio_inventory',
    'Multi-Audio Inventory',
    'Find titles carrying several exposed audio streams.',
    'Formats',
    'rose',
  ],
  [
    'stale_library_radar',
    'Stale Addition Radar',
    'Find unwatched titles that have waited for years.',
    'Viewing',
    'cyan',
  ],
  [
    'unwatched_gems',
    'Unwatched Gems Scout',
    'Find highly rated titles that have never been played.',
    'Discovery',
    'violet',
  ],
  [
    'rewatch_favourites',
    'Rewatch Favourite Pulse',
    'Rank titles with the strongest repeat-play signal.',
    'Viewing',
    'amber',
  ],
  [
    'incomplete_playback',
    'Continue Watching Recovery',
    'Find partially watched titles with saved progress.',
    'Viewing',
    'rose',
  ],
  ['decade_balance', 'Decade Balance Monitor', 'Map release eras and identify thin decades.', 'Discovery', 'cyan'],
  [
    'episode_numbering',
    'Episode Numbering Audit',
    'Find episodes with incomplete season or episode numbers.',
    'Metadata',
    'violet',
  ],
  [
    'recent_arrival_quality',
    'Arrival Quality Follow-up',
    'Recheck recent additions for core metadata gaps.',
    'Metadata',
    'amber',
  ],
  [
    'library_distribution',
    'Library Distribution Snapshot',
    'Compare title counts across Plex libraries.',
    'Operations',
    'rose',
  ],
  ['storage_hotspots', 'Storage Hotspot Map', 'Compare estimated storage consumption by library.', 'Storage', 'cyan'],
  [
    'media_path_audit',
    'Media Path Exposure Audit',
    'Find media versions whose file path is unavailable.',
    'Storage',
    'violet',
  ],
].map(([type, name, description, category, tone]) => ({
  type,
  name,
  description,
  category,
  tone,
  readOnly: true,
}));

export const expandedAutomationTypes = new Set(expandedAutomationTemplates.map((item) => item.type));

const mediaRows = (items) => items.flatMap((item) => (item.Media || []).map((media) => ({ item, media })));
const parts = (item) => (item.Media || []).flatMap((media) => media.Part || []);
const streams = (item, type) =>
  parts(item)
    .flatMap((part) => part.Stream || [])
    .filter((stream) => Number(stream.streamType) === type);
const tags = (item, field) => (item[field] || []).map((tag) => tag.tag).filter(Boolean);
const title = (item) => item.grandparentTitle || item.title || 'Unknown title';
const size = (item) => parts(item).reduce((sum, part) => sum + Number(part.size || 0), 0);
const formatBytes = (input) => {
  let value = Number(input || 0),
    unit = 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit >= 3 ? 1 : 0)} ${units[unit]}`;
};
const rank = (values) => {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(String(value), (counts.get(String(value)) || 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
};
const publicItem = (item, detail, value = '') => ({
  title: title(item),
  detail,
  value,
  ratingKey: item.ratingKey,
});
const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);

function finish(definition, items, targets, analysis) {
  const findings = analysis.findings || [];
  return {
    headline: analysis.headline || `${findings.length} finding${findings.length === 1 ? '' : 's'}`,
    detail: analysis.detail,
    metrics: { scanned: items.length, ...analysis.metrics },
    facts: [
      { label: 'Focus', value: definition.category },
      { label: 'Libraries scanned', value: targets.map((item) => item.title).join(', ') || 'None' },
      { label: 'Changes made', value: 'None' },
    ],
    items: findings.slice(0, 8),
    recommendation: analysis.recommendation,
  };
}

export function expandedPreviewReport(type) {
  const definition = expandedAutomationTemplates.find((item) => item.type === type);
  return {
    headline: `${definition.name} ready`,
    detail: `${definition.description} The scan reads Plex metadata and makes no changes.`,
    facts: [
      { label: 'Access', value: 'Read only' },
      { label: 'Category', value: definition.category },
    ],
    recommendation: 'Run now to create a current evidence report, or configure the recipe to repeat it.',
  };
}

export function buildExpandedAutomationReport(type, items, targets, now = Math.floor(Date.now() / 1000)) {
  const definition = expandedAutomationTemplates.find((item) => item.type === type);
  if (!definition) throw new Error('Unknown automation recipe.');
  const versions = mediaRows(items);
  const map: Record<string, () => any> = {
    artwork_coverage: () => {
      const found = items.filter((item) => !item.thumb);
      return {
        detail: `${found.length} of ${items.length} titles have no poster artwork.`,
        metrics: { missingArtwork: found.length, coverage: pct(items.length - found.length, items.length) },
        findings: found.map((item) => publicItem(item, 'Poster artwork missing', item.libraryTitle)),
        recommendation: found.length
          ? 'Refresh or select artwork for the affected Plex records.'
          : 'Poster coverage is complete.',
      };
    },
    summary_quality: () => {
      const found = items.filter((item) => !item.summary || item.summary.length < 40 || item.summary.length > 2000);
      return {
        detail: `${found.length} summaries are missing or outside the useful length range.`,
        metrics: { summaryIssues: found.length, coverage: pct(items.length - found.length, items.length) },
        findings: found.map((item) =>
          publicItem(item, !item.summary ? 'Summary missing' : `${item.summary.length} characters`, item.libraryTitle),
        ),
        recommendation: 'Refresh metadata or edit summaries that provide too little useful context.',
      };
    },
    date_consistency: () => {
      const year = new Date().getFullYear() + 2;
      const found = items.filter((item) => !Number(item.year) || Number(item.year) < 1888 || Number(item.year) > year);
      return {
        detail: `${found.length} titles have missing or implausible release years.`,
        metrics: { dateIssues: found.length, validDates: items.length - found.length },
        findings: found.map((item) =>
          publicItem(item, item.year ? `Implausible year ${item.year}` : 'Release year missing', item.type),
        ),
        recommendation: 'Match or edit affected titles so sorting and era discovery remain reliable.',
      };
    },
    duplicate_title_radar: () => {
      const groups = new Map();
      for (const item of items) {
        const key = `${String(title(item)).toLowerCase()}|${item.year || ''}`;
        groups.set(key, [...(groups.get(key) || []), item]);
      }
      const duplicates = [...groups.values()].filter((group) => group.length > 1);
      return {
        detail: `${duplicates.length} same-title, same-year groups deserve review.`,
        metrics: { duplicateGroups: duplicates.length, duplicateRecords: duplicates.flat().length },
        findings: duplicates.flatMap((group) =>
          group.map((item) =>
            publicItem(item, `${group.length} matching records · ${item.year || 'year unknown'}`, item.libraryTitle),
          ),
        ),
        recommendation:
          'Inspect each group before merging or removing anything; editions can legitimately share a title and year.',
      };
    },
    guid_integrity: () => {
      const found = items.filter((item) => !(item.Guid || []).length && !item.guid);
      return {
        detail: `${found.length} records expose no provider GUID.`,
        metrics: { missingIdentity: found.length, identified: items.length - found.length },
        findings: found.map((item) => publicItem(item, 'No stable provider identity', item.libraryTitle)),
        recommendation: 'Use Plex Match on unidentified records to improve metadata updates and deduplication.',
      };
    },
    content_rating_coverage: () => {
      const found = items.filter((item) => !item.contentRating);
      return {
        detail: `${found.length} records have no content certification.`,
        metrics: { uncertified: found.length, coverage: pct(items.length - found.length, items.length) },
        findings: found.map((item) => publicItem(item, 'Certification missing', item.type)),
        recommendation: 'Refresh metadata for titles where parental guidance and filtering matter.',
      };
    },
    genre_taxonomy: () => {
      const counts = rank(items.flatMap((item) => tags(item, 'Genre')));
      const rare = new Set(counts.filter((row) => row.count === 1).map((row) => row.label));
      const found = items.filter(
        (item) => !tags(item, 'Genre').length || tags(item, 'Genre').some((genre) => rare.has(genre)),
      );
      return {
        detail: `${counts.length} genre labels include ${rare.size} one-off labels.`,
        metrics: {
          genres: counts.length,
          oneOffGenres: rare.size,
          untagged: items.filter((item) => !tags(item, 'Genre').length).length,
        },
        findings: found.map((item) =>
          publicItem(item, tags(item, 'Genre').join(' · ') || 'No genre tags', item.libraryTitle),
        ),
        recommendation: 'Review one-off labels for spelling variants and match untagged titles.',
      };
    },
    collection_curator: () => {
      const tagged = items.filter((item) => tags(item, 'Collection').length);
      const groups = rank(tagged.flatMap((item) => tags(item, 'Collection')));
      return {
        headline: `${groups.length} collection${groups.length === 1 ? '' : 's'} mapped`,
        detail: `${tagged.length} titles belong to a collection; ${items.length - tagged.length} stand alone.`,
        metrics: {
          collections: groups.length,
          collectedTitles: tagged.length,
          standalone: items.length - tagged.length,
        },
        findings: tagged
          .sort((a, b) => tags(b, 'Collection').length - tags(a, 'Collection').length)
          .map((item) => publicItem(item, tags(item, 'Collection').join(' · '), item.libraryTitle)),
        recommendation: 'Use the largest coherent groups as seeds for curated Plex collections.',
      };
    },
    cast_coverage: () => {
      const found = items.filter((item) => !tags(item, 'Role').length);
      return {
        detail: `${found.length} titles expose no cast credits.`,
        metrics: { missingCast: found.length, coverage: pct(items.length - found.length, items.length) },
        findings: found.map((item) => publicItem(item, 'Cast credits missing', item.type)),
        recommendation: 'Refresh metadata on cast-free records to improve people discovery.',
      };
    },
    director_coverage: () => {
      const films = items.filter((item) => item.type === 'movie');
      const found = films.filter((item) => !tags(item, 'Director').length);
      return {
        detail: `${found.length} of ${films.length} films expose no director credit.`,
        metrics: {
          films: films.length,
          missingDirector: found.length,
          coverage: pct(films.length - found.length, films.length),
        },
        findings: found.map((item) => publicItem(item, 'Director credit missing', item.year)),
        recommendation: 'Match affected films to restore director-led discovery and playlists.',
      };
    },
    audio_codec_audit: () => {
      const rows = rank(versions.map(({ media }) => String(media.audioCodec || 'Unknown').toUpperCase()));
      const found = versions.filter(({ media }) => !media.audioCodec);
      return {
        headline: `${rows.length} audio codec${rows.length === 1 ? '' : 's'} mapped`,
        detail: `${versions.length} media versions were inspected; ${found.length} lack an audio codec tag.`,
        metrics: { versions: versions.length, audioCodecs: rows.length, unknownAudio: found.length },
        findings: rows.map((row) => ({ title: row.label, detail: 'Audio codec', value: `${row.count} versions` })),
        recommendation: found.length
          ? 'Run Plex Analyze on media with unknown audio details.'
          : 'Audio codec metadata is complete.',
      };
    },
    subtitle_coverage: () => {
      const tagged = items.filter((item) => streams(item, 3).length);
      return {
        detail: `${tagged.length} titles expose subtitle streams through the current Plex response.`,
        metrics: {
          subtitleTagged: tagged.length,
          withoutExposedTags: items.length - tagged.length,
          coverage: pct(tagged.length, items.length),
        },
        findings: (tagged.length ? tagged : items).map((item) =>
          publicItem(
            item,
            streams(item, 3).length ? `${streams(item, 3).length} subtitle streams` : 'No subtitle stream tag exposed',
            item.libraryTitle,
          ),
        ),
        recommendation: tagged.length
          ? 'Review low-coverage libraries if subtitles are expected.'
          : 'This Plex bulk response exposes no subtitle stream tags; use this as an API capability signal.',
      };
    },
    hdr_inventory: () => {
      const rows = rank(
        versions.map(({ media }) =>
          String(media.videoDynamicRange || media.dynamicRange || (media.hdr ? 'HDR' : 'SDR')).toUpperCase(),
        ),
      );
      return {
        headline: `${rows.length} dynamic-range class${rows.length === 1 ? '' : 'es'} mapped`,
        detail: `${versions.length} versions were classified by reported dynamic range.`,
        metrics: {
          versions: versions.length,
          hdrVersions: versions.filter(({ media }) =>
            /hdr|dolby|dv/i.test(String(media.videoDynamicRange || media.dynamicRange || (media.hdr ? 'HDR' : ''))),
          ).length,
          classes: rows.length,
        },
        findings: rows.map((row) => ({ title: row.label, detail: 'Dynamic range', value: `${row.count} versions` })),
        recommendation: 'Compare HDR holdings with the playback capabilities shown in Server Intelligence.',
      };
    },
    bitrate_outliers: () => {
      const rated = versions
        .filter(({ media }) => Number(media.bitrate) > 0)
        .sort((a, b) => Number(b.media.bitrate) - Number(a.media.bitrate));
      const threshold = rated.length ? rated[Math.max(0, Math.floor(rated.length * 0.05) - 1)]?.media.bitrate : 0;
      const found = rated.filter(({ media }) => Number(media.bitrate) >= Number(threshold));
      return {
        detail: `${found.length} versions occupy the highest five percent of reported bitrates.`,
        metrics: {
          versions: versions.length,
          withBitrate: rated.length,
          missingBitrate: versions.length - rated.length,
        },
        findings: found.map(({ item, media }) =>
          publicItem(
            item,
            `${String(media.videoCodec || 'Unknown').toUpperCase()} · ${media.videoResolution || 'unknown resolution'}`,
            `${(Number(media.bitrate) / 1000).toFixed(1)} Mbps`,
          ),
        ),
        recommendation:
          'Review large high-bitrate sources in Codec Studio when storage or remote bandwidth is constrained.',
      };
    },
    container_compatibility: () => {
      const rows = rank(versions.map(({ media }) => String(media.container || 'Unknown').toUpperCase()));
      const common = new Set(['MP4', 'MKV', 'M4V']);
      const found = versions.filter(({ media }) => !common.has(String(media.container || 'Unknown').toUpperCase()));
      return {
        headline: `${rows.length} container${rows.length === 1 ? '' : 's'} mapped`,
        detail: `${found.length} versions use an unknown or less common container.`,
        metrics: { versions: versions.length, containers: rows.length, uncommon: found.length },
        findings: found.map(({ item, media }) =>
          publicItem(
            item,
            `${String(media.container || 'Unknown').toUpperCase()} container`,
            media.videoCodec || 'codec unknown',
          ),
        ),
        recommendation: 'Use live playback telemetry to confirm whether uncommon containers trigger remuxing.',
      };
    },
    resolution_balance: () => {
      const band = (media) =>
        /4k|2160/i.test(media.videoResolution || '')
          ? '4K'
          : /1080/i.test(media.videoResolution || '')
            ? 'Full HD'
            : /720/i.test(media.videoResolution || '')
              ? 'HD'
              : media.videoResolution
                ? 'SD / other'
                : 'Unknown';
      const rows = rank(versions.map(({ media }) => band(media)));
      return {
        headline: `${versions.length} versions classified`,
        detail: rows.map((row) => `${row.label}: ${row.count}`).join(' · '),
        metrics: {
          versions: versions.length,
          fourK: rows.find((row) => row.label === '4K')?.count || 0,
          unknownResolution: rows.find((row) => row.label === 'Unknown')?.count || 0,
        },
        findings: rows.map((row) => ({ title: row.label, detail: 'Resolution class', value: `${row.count} versions` })),
        recommendation: 'Use this balance to plan display upgrades and optimization targets.',
      };
    },
    aspect_ratio_audit: () => {
      const found = versions.filter(
        ({ media }) => !Number(media.aspectRatio) || Number(media.aspectRatio) < 0.8 || Number(media.aspectRatio) > 3,
      );
      return {
        detail: `${found.length} versions have missing or unusual aspect-ratio metadata.`,
        metrics: { versions: versions.length, aspectIssues: found.length, validAspect: versions.length - found.length },
        findings: found.map(({ item, media }) =>
          publicItem(
            item,
            media.aspectRatio ? `Unusual ratio ${media.aspectRatio}` : 'Aspect ratio missing',
            media.videoResolution,
          ),
        ),
        recommendation: 'Run Plex Analyze before correcting source metadata for persistent anomalies.',
      };
    },
    file_size_outliers: () => {
      const ranked = [...items].filter((item) => size(item) > 0).sort((a, b) => size(b) - size(a));
      const total = ranked.reduce((sum, item) => sum + size(item), 0);
      return {
        headline: `${formatBytes(total)} indexed`,
        detail: `The eight largest titles account for ${formatBytes(ranked.slice(0, 8).reduce((sum, item) => sum + size(item), 0))}.`,
        metrics: { sizedTitles: ranked.length, totalBytes: total, largestBytes: size(ranked[0] || {}) },
        findings: ranked.map((item) =>
          publicItem(
            item,
            `${(item.Media || []).length} media version${(item.Media || []).length === 1 ? '' : 's'}`,
            formatBytes(size(item)),
          ),
        ),
        recommendation: 'Review the largest low-value items in Library Atlas before making storage decisions.',
      };
    },
    runtime_anomalies: () => {
      const minutes = (item) => Number(item.duration || item.Media?.[0]?.duration || 0) / 60000;
      const found = items.filter(
        (item) =>
          !minutes(item) ||
          (item.type === 'movie' && (minutes(item) < 20 || minutes(item) > 300)) ||
          (item.type === 'episode' && minutes(item) > 240),
      );
      return {
        detail: `${found.length} titles have missing or implausible runtimes for their type.`,
        metrics: { runtimeIssues: found.length, validRuntime: items.length - found.length },
        findings: found.map((item) =>
          publicItem(
            item,
            `${item.type || 'media'} · ${minutes(item) ? `${Math.round(minutes(item))} minutes` : 'runtime missing'}`,
            item.libraryTitle,
          ),
        ),
        recommendation: 'Analyze the file or refresh metadata where runtime affects playback and filtering.',
      };
    },
    multi_audio_inventory: () => {
      const found = items.filter((item) => streams(item, 2).length > 1);
      return {
        detail: `${found.length} titles expose multiple audio streams.`,
        metrics: { multiAudio: found.length, singleOrUnknown: items.length - found.length },
        findings: found.map((item) =>
          publicItem(
            item,
            `${streams(item, 2).length} audio streams`,
            [
              ...new Set(
                streams(item, 2)
                  .map((stream) => stream.language || stream.languageCode)
                  .filter(Boolean),
              ),
            ].join(' · ') || 'Languages untagged',
          ),
        ),
        recommendation: found.length
          ? 'Use multi-audio titles to verify client language-selection defaults.'
          : 'No multi-audio stream data is exposed by the current bulk response.',
      };
    },
    stale_library_radar: () => {
      const found = items
        .filter((item) => !Number(item.viewCount) && Number(item.addedAt) && Number(item.addedAt) < now - 730 * DAY)
        .sort((a, b) => Number(a.addedAt) - Number(b.addedAt));
      return {
        detail: `${found.length} unwatched titles have waited at least two years.`,
        metrics: {
          staleUnwatched: found.length,
          oldestDays: found[0] ? Math.floor((now - Number(found[0].addedAt)) / DAY) : 0,
        },
        findings: found.map((item) =>
          publicItem(item, `Added ${Math.floor((now - Number(item.addedAt)) / DAY)} days ago`, item.libraryTitle),
        ),
        recommendation: 'Turn the strongest stale titles into a short discovery playlist before considering removal.',
      };
    },
    unwatched_gems: () => {
      const found = items
        .filter((item) => !Number(item.viewCount) && Number(item.audienceRating || item.rating) >= 7.5)
        .sort((a, b) => Number(b.audienceRating || b.rating) - Number(a.audienceRating || a.rating));
      return {
        detail: `${found.length} unwatched titles are rated 7.5 or above.`,
        metrics: { gems: found.length, topRating: Number(found[0]?.audienceRating || found[0]?.rating || 0) },
        findings: found.map((item) =>
          publicItem(
            item,
            `${item.year || 'Year unknown'} · ${item.libraryTitle || 'Library unknown'}`,
            `★ ${Number(item.audienceRating || item.rating).toFixed(1)}`,
          ),
        ),
        recommendation: 'Use these as high-confidence choices in Discovery Radar or Playlist Studio.',
      };
    },
    rewatch_favourites: () => {
      const found = items
        .filter((item) => Number(item.viewCount) > 1)
        .sort((a, b) => Number(b.viewCount) - Number(a.viewCount));
      return {
        detail: `${found.length} titles have been played more than once.`,
        metrics: {
          rewatchedTitles: found.length,
          repeatPlays: found.reduce((sum, item) => sum + Math.max(0, Number(item.viewCount) - 1), 0),
        },
        findings: found.map((item) =>
          publicItem(
            item,
            `${item.year || 'Year unknown'} · ${tags(item, 'Genre').slice(0, 2).join(' · ')}`,
            `${item.viewCount} plays`,
          ),
        ),
        recommendation: 'Use repeat favourites to seed comfort-viewing and household taste playlists.',
      };
    },
    incomplete_playback: () => {
      const found = items
        .filter(
          (item) =>
            Number(item.viewOffset) > 0 &&
            Number(item.viewOffset) < Number(item.duration || item.Media?.[0]?.duration || Infinity),
        )
        .sort(
          (a, b) =>
            Number(b.viewOffset) / Number(b.duration || b.Media?.[0]?.duration || 1) -
            Number(a.viewOffset) / Number(a.duration || a.Media?.[0]?.duration || 1),
        );
      return {
        detail: `${found.length} titles retain partial playback progress.`,
        metrics: {
          inProgress: found.length,
          nearFinish: found.filter(
            (item) => Number(item.viewOffset) / Number(item.duration || item.Media?.[0]?.duration || 1) >= 0.8,
          ).length,
        },
        findings: found.map((item) => {
          const progress = pct(Number(item.viewOffset), Number(item.duration || item.Media?.[0]?.duration));
          return publicItem(
            item,
            `${progress}% complete`,
            `${Math.round((Number(item.duration || item.Media?.[0]?.duration) - Number(item.viewOffset)) / 60000)} min left`,
          );
        }),
        recommendation: 'Resume near-finished titles first to clear abandoned progress from Continue Watching.',
      };
    },
    decade_balance: () => {
      const rows = rank(items.map((item) => (item.year ? `${Math.floor(Number(item.year) / 10) * 10}s` : 'Unknown')));
      const thin = rows.filter(
        (row) => row.label !== 'Unknown' && row.count <= Math.max(2, Math.round(items.length * 0.01)),
      );
      return {
        headline: `${rows.length} release eras mapped`,
        detail: `${thin.length} decades have especially light representation.`,
        metrics: {
          decades: rows.filter((row) => row.label !== 'Unknown').length,
          thinDecades: thin.length,
          unknownYear: rows.find((row) => row.label === 'Unknown')?.count || 0,
        },
        findings: rows.map((row) => ({
          title: row.label,
          detail: thin.includes(row) ? 'Thinly represented era' : 'Release era',
          value: `${row.count} titles`,
        })),
        recommendation: 'Use thin decades as prompts for discovery rather than collection quotas.',
      };
    },
    episode_numbering: () => {
      const episodes = items.filter((item) => item.type === 'episode');
      const found = episodes.filter(
        (item) => !Number.isFinite(Number(item.parentIndex)) || !Number.isFinite(Number(item.index)),
      );
      return {
        detail: `${found.length} of ${episodes.length} episodes have incomplete numbering.`,
        metrics: { episodes: episodes.length, numberingIssues: found.length },
        findings: found.map((item) =>
          publicItem(item, `Season ${item.parentIndex ?? '?'} · Episode ${item.index ?? '?'}`, item.grandparentTitle),
        ),
        recommendation: 'Correct episode matching before navigation and autoplay order are affected.',
      };
    },
    recent_arrival_quality: () => {
      const recent = items.filter((item) => Number(item.addedAt) >= now - 30 * DAY);
      const found = recent.filter((item) => !item.thumb || !item.summary || !item.year || !(item.Media || []).length);
      return {
        detail: `${found.length} of ${recent.length} additions from the last 30 days have core metadata gaps.`,
        metrics: { recent: recent.length, recentIssues: found.length, cleanRecent: recent.length - found.length },
        findings: found.map((item) =>
          publicItem(
            item,
            [
              !item.thumb && 'artwork',
              !item.summary && 'summary',
              !item.year && 'year',
              !(item.Media || []).length && 'media',
            ]
              .filter(Boolean)
              .join(' · ') + ' missing',
            item.libraryTitle,
          ),
        ),
        recommendation: 'Resolve recent issues early while source and matching details are easy to verify.',
      };
    },
    library_distribution: () => {
      const rows = rank(items.map((item) => item.libraryTitle || 'Unknown library'));
      return {
        headline: `${rows.length} libraries compared`,
        detail: `${items.length} titles are distributed across the selected Plex libraries.`,
        metrics: {
          libraries: rows.length,
          largestLibrary: rows[0]?.count || 0,
          unassigned: rows.find((row) => row.label === 'Unknown library')?.count || 0,
        },
        findings: rows.map((row) => ({
          title: row.label,
          detail: `${pct(row.count, items.length)}% of scanned catalogue`,
          value: `${row.count} titles`,
        })),
        recommendation: 'Use large imbalances to review library boundaries and scan scope.',
      };
    },
    storage_hotspots: () => {
      const rows = [...new Set(items.map((item) => item.libraryTitle || 'Unknown library'))]
        .map((label) => ({
          label,
          bytes: items
            .filter((item) => (item.libraryTitle || 'Unknown library') === label)
            .reduce((sum, item) => sum + size(item), 0),
        }))
        .sort((a, b) => b.bytes - a.bytes);
      return {
        headline: `${formatBytes(rows.reduce((sum, row) => sum + row.bytes, 0))} mapped`,
        detail: `${rows.length} libraries were compared by indexed media size.`,
        metrics: {
          libraries: rows.length,
          totalBytes: rows.reduce((sum, row) => sum + row.bytes, 0),
          largestLibraryBytes: rows[0]?.bytes || 0,
        },
        findings: rows.map((row) => ({
          title: row.label,
          detail: 'Indexed media footprint',
          value: formatBytes(row.bytes),
        })),
        recommendation: 'Open Library Atlas for title-level evidence inside the largest storage hotspot.',
      };
    },
    media_path_audit: () => {
      const found = items.filter((item) => (item.Media || []).length && parts(item).some((part) => !part.file));
      return {
        detail: `${found.length} titles contain media parts without an exposed file path.`,
        metrics: { pathIssues: found.length, pathComplete: items.length - found.length },
        findings: found.map((item) =>
          publicItem(
            item,
            `${parts(item).filter((part) => !part.file).length} path${parts(item).filter((part) => !part.file).length === 1 ? '' : 's'} unavailable`,
            item.libraryTitle,
          ),
        ),
        recommendation: 'Check Plex permissions and media availability when a path should be present.',
      };
    },
  };
  return finish(definition, items, targets, map[type]());
}
