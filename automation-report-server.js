function formatBytes(bytes) {
  let value = Number(bytes) || 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(unit >= 3 ? 1 : 0)} ${units[unit]}`;
}

export function qualityReport(report) {
  return {
    headline:`${report.candidateCount} candidate${report.candidateCount === 1 ? '' : 's'} found`,
    detail:`Reviewed ${report.scanned.toLocaleString()} titles with ${formatBytes(report.estimatedSaving)} of potential saving.`,
    metrics:{ candidates:report.candidateCount, scanned:report.scanned, estimatedSaving:report.estimatedSaving, confidence:report.averageConfidence },
    facts:[{ label:'Libraries scanned', value:report.libraries }, { label:'Candidate footprint', value:formatBytes(report.totalSize) }, { label:'Changes made', value:'None' }],
    items:(report.candidates || []).slice(0, 8).map(item => ({ title:item.title, detail:[item.year, item.library, item.resolution, item.codec].filter(Boolean).join(' · '), value:`Save ~${formatBytes(item.estimatedSaving)}`, ratingKey:item.ratingKey })),
    recommendation:report.candidateCount ? 'Review the highest-saving candidates in Space Savings before approving any encode.' : 'No files currently meet the conservative optimization threshold.',
  };
}

export function healthReport(report) {
  const transcodes = report.sessions.filter(item => item.mode === 'Transcoding').length;
  return {
    headline:'Snapshot captured',
    detail:`${report.titleCount.toLocaleString()} titles across ${report.libraryCount} libraries with ${report.sessions.length} active session${report.sessions.length === 1 ? '' : 's'}.`,
    metrics:{ titles:report.titleCount, libraries:report.libraryCount, sessions:report.sessions.length, transcodes },
    facts:[{ label:'Server', value:report.server?.name || 'Plex' }, { label:'Server version', value:report.server?.version || 'Unknown' }],
    items:report.sessions.slice(0, 8).map(item => ({ title:item.title, detail:`${item.user} · ${item.device}`, value:item.mode })),
  };
}

export function arrivalReport(items) {
  return {
    headline:`${items.length} recent arrival${items.length === 1 ? '' : 's'}`,
    detail:items.length ? `Captured the ${items.length} newest additions returned by Plex.` : 'No recent additions returned by Plex.',
    metrics:{ arrivals:items.length },
    facts:[{ label:'Newest item', value:items[0]?.grandparentTitle || items[0]?.title || 'None' }, { label:'Changes made', value:'None' }],
    items:items.slice(0, 8).map(item => {
      const paths = (item.Media || []).flatMap(media => (media.Part || []).map(part => part.file).filter(Boolean));
      return { title:item.grandparentTitle || item.title || "Unknown title", detail:[item.title !== item.grandparentTitle ? item.title : "", item.year, item.type].filter(Boolean).join(" · "), value:item.addedAt ? new Date(Number(item.addedAt) * 1000).toLocaleDateString() : "Recently added", ratingKey:item.ratingKey, path:paths[0] || "", paths };
    }),
  };
}

export function streamReport(sessions) {
  const transcodes = sessions.filter(item => (item.TranscodeSession || []).length).length;
  const direct = sessions.length - transcodes;
  return {
    headline:`${sessions.length} active stream${sessions.length === 1 ? '' : 's'}`,
    detail:transcodes ? `${transcodes} currently transcoding and ${direct} playing directly.` : sessions.length ? 'Every active session is playing directly.' : 'Plex reported no active playback sessions.',
    metrics:{ sessions:sessions.length, transcodes, direct },
    facts:[{ label:'Transcode pressure', value:transcodes ? `${Math.round(transcodes / sessions.length * 100)}%` : '0%' }, { label:'Playback impact', value:'None' }],
    items:sessions.slice(0, 8).map(item => { const transcoding=(item.TranscodeSession || []).length > 0; return { title:item.grandparentTitle ? `${item.grandparentTitle} · ${item.title}` : item.title || 'Unknown title', detail:[item.User?.[0]?.title, item.Player?.[0]?.title || item.Player?.[0]?.product, item.Media?.[0]?.videoResolution?.toUpperCase()].filter(Boolean).join(' · '), value:transcoding ? 'Transcoding' : 'Direct play' }; }),
  };
}

export function metadataReport(items, issues, targets) {
  const missingArtwork=issues.filter(item=>!item.thumb).length;
  const missingSummary=issues.filter(item=>!item.summary).length;
  const missingYear=issues.filter(item=>!item.year).length;
  return {
    headline:`${issues.length} metadata issue${issues.length === 1 ? '' : 's'}`,
    detail:`Inspected ${items.length.toLocaleString()} titles across ${targets.length} ${targets.length === 1 ? 'library' : 'libraries'}.`,
    metrics:{ scanned:items.length, issues:issues.length, missingArtwork, missingSummary, missingYear },
    facts:[{ label:'Libraries scanned', value:targets.map(item => item.title).join(', ') || 'None' }, { label:'Changes made', value:'None' }],
    items:issues.slice(0, 8).map(item => ({ title:item.grandparentTitle || item.title || 'Unknown title', detail:[!item.thumb&&'Missing artwork', !item.summary&&'Missing summary', !item.year&&'Missing year'].filter(Boolean).join(' · '), value:item.type || 'Media', ratingKey:item.ratingKey })),
    recommendation:issues.length ? 'Open the affected titles in Plex to match or edit their metadata.' : 'No missing artwork, summaries or years were detected.',
  };
}

export function refreshReport(targets, dryRun) {
  return {
    headline:dryRun ? `${targets.length} librar${targets.length === 1 ? 'y' : 'ies'} ready` : 'Refresh requested',
    detail:dryRun ? `Would request a refresh for ${targets.map(item => item.title).join(', ')}.` : `Plex accepted a scan request for ${targets.map(item => item.title).join(', ')}.`,
    metrics:dryRun ? undefined : { libraries:targets.length },
    facts:[{ label:'Plex action', value:'Library refresh' }, { label:dryRun ? 'Changes made' : 'Requests accepted', value:dryRun ? 'None (preview)' : targets.length }],
    items:targets.map(item => ({ title:item.title, detail:item.type, value:dryRun ? 'Ready' : 'Scan requested' })),
    recommendation:dryRun ? 'Run the automation when you are ready for Plex to begin scanning.' : 'Plex continues the scan in the background; check the Command Deck for updated library totals.',
  };
}

export const previewReports = {
  quality_guardian:{ headline:'Quality audit ready', detail:'Plex metadata will be scanned. No files will be changed.', facts:[{ label:'Access', value:'Read only' }, { label:'Media changes', value:'None' }], recommendation:'Run the audit to measure reclaimable space and identify the strongest HEVC candidates.' },
  health_snapshot:{ headline:'Health snapshot ready', detail:'Library counts and active sessions will be read from Plex.', facts:[{ label:'Access', value:'Read only' }, { label:'History', value:'Snapshot retained' }] },
  arrival_digest:{ headline:'Arrival digest ready', detail:'The latest Plex additions will be summarized without changing metadata.', facts:[{ label:'Access', value:'Read only' }, { label:'Maximum results', value:'12' }] },
  stream_sentinel:{ headline:'Stream sentinel ready', detail:'Active sessions and transcode decisions will be sampled from Plex.', facts:[{ label:'Access', value:'Read only' }, { label:'Playback impact', value:'None' }] },
  metadata_sentinel:{ headline:'Metadata scan ready', detail:'Artwork, summaries and dates will be inspected read-only across selected libraries.', facts:[{ label:'Access', value:'Read only' }, { label:'Fields checked', value:'Artwork · Summary · Year' }] },
};
