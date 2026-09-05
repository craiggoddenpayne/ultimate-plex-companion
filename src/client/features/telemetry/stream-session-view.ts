const escape = (value) =>
  String(value == null ? '' : value).replace(
    /[&<>'"]/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[char],
  );

const streamIcon = '<svg class="icon" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>';

function codec(value) {
  const names = {
    h264: 'H.264',
    hevc: 'HEVC',
    h265: 'HEVC',
    eac3: 'E-AC-3',
    ac3: 'AC-3',
    aac: 'AAC',
    dca: 'DTS',
    truehd: 'TrueHD',
    opus: 'Opus',
    av1: 'AV1',
  };
  return names[String(value || '').toLowerCase()] || String(value || '').toUpperCase() || 'Unknown';
}

function decision(value) {
  return (
    { directplay: 'Direct play', copy: 'Direct stream', transcode: 'Transcode', burn: 'Burned in', none: 'None' }[
      String(value || '').toLowerCase()
    ] ||
    value ||
    'Unknown'
  );
}

function bitrate(kbps) {
  const value = Number(kbps || 0);
  if (!value) return 'Unknown bitrate';
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2)} Mbps` : `${Math.round(value)} Kbps`;
}

function duration(milliseconds) {
  const totalMinutes = Math.max(0, Math.floor(Number(milliseconds || 0) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
}

function fact(label, value, detail, tone = '') {
  return `<span class="session-tech-fact ${tone}"><small>${escape(label)}</small><b>${escape(value || 'Unknown')}</b><em>${escape(detail || '')}</em></span>`;
}

function routeName(item) {
  if (item.relayed) return 'Plex Relay';
  if (item.local || String(item.location).toLowerCase() === 'lan') return 'Local network';
  return 'Remote network';
}

function pictureDetail(item) {
  return [
    item.dimensions,
    item.videoProfile,
    item.videoBitDepth ? `${item.videoBitDepth}-bit` : '',
    item.videoFrameRate ? `${item.videoFrameRate} fps` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function audioDetail(item) {
  return [
    item.audioChannels ? `${item.audioChannels} channels` : '',
    item.audioLanguage,
    item.audioSampleRate ? `${Math.round(item.audioSampleRate / 1000)} kHz` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function transcodePipeline(item) {
  if (item.mode !== 'Transcoding') return '';
  const source = `${codec(item.videoCodec)} + ${codec(item.audioCodec)}`;
  const output = `${codec(item.outputVideoCodec)} + ${codec(item.outputAudioCodec)}`;
  return `<div class="transcode-pipeline"><span><small>SOURCE</small><b>${escape(source)}</b></span><i>→</i><span><small>OUTPUT</small><b>${escape(output)}</b></span><div class="pipeline-metrics"><em>${item.hardware ? 'HW accelerated' : 'Software encode'}</em><em>${Number(item.transcodeSpeed || 0).toFixed(1)}× speed</em><em>${item.throttled ? 'Throttled / buffered' : 'Encoding now'}</em>${item.transcodeProgress ? `<em>${Math.round(item.transcodeProgress)}% encoded</em>` : ''}</div></div>`;
}

export function sessionMarkup(item) {
  const headline = [
    item.subtitle,
    item.resolution,
    codec(item.videoCodec),
    item.dynamicRange,
    codec(item.audioCodec),
    String(item.container || '').toUpperCase(),
  ]
    .filter(Boolean)
    .join(' · ');
  const networkDetail = [item.secure ? 'Secure' : 'Unsecured', item.address || item.publicAddress]
    .filter(Boolean)
    .join(' · ');
  const clientDetail = [
    item.product,
    item.platform,
    item.platformVersion,
    item.playerVersion ? `v${item.playerVersion}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const deliveryDetail = [
    decision(item.videoDecision),
    decision(item.audioDecision),
    item.protocol ? item.protocol.toUpperCase() : '',
    item.outputContainer ? item.outputContainer.toUpperCase() : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const subtitleValue = item.subtitleDisplayTitle || (item.subtitleCodec ? codec(item.subtitleCodec) : 'None selected');
  const subtitleDetail = item.subtitleCodec
    ? [item.subtitleLanguage, decision(item.subtitleDecision)].filter(Boolean).join(' · ')
    : 'No subtitle processing';

  return `<article class="observed-session ${escape(item.tone)}"><div class="session-art">${item.poster ? `<img src="${escape(item.poster)}" alt="">` : streamIcon}<span>${escape(item.state)}</span></div><div class="session-info"><div class="session-title"><div><h3>${escape(item.title)}</h3><p>${escape(headline)}</p></div><b class="decision ${item.mode === 'Transcoding' ? 'transcoding' : 'direct'}">${escape(item.mode)}</b></div><div class="session-route"><span><b>${escape(item.user)}</b>${escape(item.device)}</span><i></i><span><b>${escape(routeName(item))}</b>${escape(networkDetail)}</span><i></i><span><b>${escape(`${item.remainingMinutes} min`)}</b>remaining · ${escape(duration(item.durationMs))} total</span><i></i><span><b>${escape(bitrate(item.bandwidth))}</b>live bandwidth</span></div><div class="session-progress"><i style="width:${Math.min(100, Math.max(0, Number(item.progress || 0)))}%"></i><span>${Math.round(item.progress || 0)}%</span></div><div class="session-tech-grid">${fact('Picture', item.videoDisplayTitle || `${item.resolution} ${codec(item.videoCodec)}`, pictureDetail(item))}${fact('Audio', item.audioDisplayTitle || codec(item.audioCodec), audioDetail(item))}${fact('Subtitles', subtitleValue, subtitleDetail)}${fact('Client', item.device, clientDetail)}${fact('Delivery', item.mode, deliveryDetail, item.mode === 'Transcoding' ? 'warning' : 'healthy')}${fact('Source rate', bitrate(item.bitrate), `${String(item.container || '').toUpperCase()} media · ${item.dynamicRange}`)}</div>${transcodePipeline(item)}</div></article>`;
}

export const sessionFormatters = { bitrate, codec, decision, duration };
