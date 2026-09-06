const definitions = [
  ['artwork_coverage', 'Artwork Coverage Watch', 'scan', 'Audit artwork', 'Missing poster artwork'],
  ['summary_quality', 'Summary Quality Lens', 'scan', 'Inspect summaries', 'Missing or weak summaries'],
  ['date_consistency', 'Release Date Consistency', 'clock', 'Validate dates', 'Missing and implausible years'],
  ['duplicate_title_radar', 'Duplicate Title Radar', 'shield', 'Find duplicates', 'Same-title, same-year records'],
  ['guid_integrity', 'Match Identity Monitor', 'shield', 'Audit matching', 'Missing provider identities'],
  ['content_rating_coverage', 'Certification Coverage', 'shield', 'Check ratings', 'Missing content certifications'],
  ['genre_taxonomy', 'Genre Taxonomy Gardener', 'scan', 'Inspect genres', 'Untagged and one-off genres'],
  ['collection_curator', 'Collection Curator', 'bolt', 'Map collections', 'Collection membership map'],
  ['cast_coverage', 'Cast Coverage Audit', 'scan', 'Inspect cast', 'Missing cast credits'],
  ['director_coverage', 'Director Coverage Audit', 'scan', 'Inspect directors', 'Missing director credits'],
  ['audio_codec_audit', 'Audio Codec Census', 'clock', 'Map audio', 'Audio codec inventory'],
  ['subtitle_coverage', 'Subtitle Coverage Map', 'clock', 'Map subtitles', 'Subtitle stream coverage'],
  ['hdr_inventory', 'HDR Capability Inventory', 'bolt', 'Map HDR', 'Dynamic-range inventory'],
  ['bitrate_outliers', 'Bitrate Outlier Watch', 'scan', 'Inspect bitrate', 'Highest-bitrate media'],
  ['container_compatibility', 'Container Compatibility Map', 'shield', 'Map containers', 'Uncommon media containers'],
  ['resolution_balance', 'Resolution Balance', 'scan', 'Map resolution', 'Resolution distribution'],
  ['aspect_ratio_audit', 'Aspect Ratio Audit', 'scan', 'Inspect ratios', 'Missing or unusual ratios'],
  ['file_size_outliers', 'File Size Outlier Watch', 'shield', 'Rank file sizes', 'Largest stored titles'],
  ['runtime_anomalies', 'Runtime Anomaly Detector', 'clock', 'Validate runtimes', 'Missing or unusual runtimes'],
  ['multi_audio_inventory', 'Multi-Audio Inventory', 'clock', 'Map audio tracks', 'Multiple audio streams'],
  ['stale_library_radar', 'Stale Addition Radar', 'clock', 'Find stale titles', 'Unwatched for two years'],
  ['unwatched_gems', 'Unwatched Gems Scout', 'bolt', 'Find hidden gems', 'Highly rated unwatched titles'],
  ['rewatch_favourites', 'Rewatch Favourite Pulse', 'bolt', 'Map favourites', 'Repeat-play favourites'],
  ['incomplete_playback', 'Continue Watching Recovery', 'clock', 'Recover progress', 'Partially watched titles'],
  ['decade_balance', 'Decade Balance Monitor', 'clock', 'Map decades', 'Thinly represented eras'],
  ['episode_numbering', 'Episode Numbering Audit', 'scan', 'Check episodes', 'Incomplete episode numbering'],
  ['recent_arrival_quality', 'Arrival Quality Follow-up', 'shield', 'Check arrivals', 'Recent metadata gaps'],
  [
    'library_distribution',
    'Library Distribution Snapshot',
    'bolt',
    'Compare libraries',
    'Title distribution by library',
  ],
  ['storage_hotspots', 'Storage Hotspot Map', 'shield', 'Map storage', 'Storage use by library'],
  ['media_path_audit', 'Media Path Exposure Audit', 'shield', 'Audit paths', 'Unavailable media paths'],
];

export const expandedTypeMeta = Object.fromEntries(
  definitions.map(([type, label, icon, verb, note]) => [type, { label, icon, verb, note, catalog: true }]),
);

export const expandedSuggestedSchedules = Object.fromEntries(
  definitions.map(([type], index) => [
    type,
    {
      frequency: index % 6 === 0 ? 'daily' : 'weekly',
      time: `${String(2 + (index % 5)).padStart(2, '0')}:15`,
      weekday: index % 7,
    },
  ]),
);
