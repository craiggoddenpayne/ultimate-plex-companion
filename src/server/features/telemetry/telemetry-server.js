function sessionDetail(item, index) {
  const player = item.Player?.[0] || {};
  const user = item.User?.[0] || {};
  const media = item.Media?.[0] || {};
  const part = media.Part?.[0] || {};
  const transcode = item.TranscodeSession?.[0] || null;
  const duration = Number(item.duration || 0);
  const viewOffset = Number(item.viewOffset || 0);
  const progress = duration ? Math.min(100, Math.round(viewOffset / duration * 100)) : 0;
  const mode = transcode ? 'Transcoding' : media.videoDecision === 'copy' || media.audioDecision === 'copy' ? 'Direct Stream' : 'Direct Play';
  return {
    id:item.Session?.[0]?.id || `session-${index}`, title:item.grandparentTitle ? `${item.grandparentTitle} · ${item.title}` : item.title || 'Unknown title',
    subtitle:item.grandparentTitle ? `S${String(item.parentIndex || 0).padStart(2,'0')} E${String(item.index || 0).padStart(2,'0')}` : item.year || '',
    user:user.title || 'Unknown', userId:user.id || null, device:player.title || player.product || 'Plex client', product:player.product || '', platform:player.platform || '',
    address:player.address || '', location:player.local ? 'Local' : player.relayed ? 'Relay' : 'Remote', secure:Boolean(player.secure), state:player.state || 'playing',
    progress, positionMs:viewOffset, durationMs:duration, remainingMinutes:Math.max(0, Math.ceil((duration-viewOffset)/60000)),
    mode, resolution:String(media.videoResolution || '').toUpperCase(), container:media.container || part.container || '', videoCodec:media.videoCodec || '', audioCodec:media.audioCodec || '',
    bitrate:Number(media.bitrate || 0), bandwidth:Number(transcode?.bandwidth || media.bitrate || 0), transcodeSpeed:Number(transcode?.speed || 0), throttled:Boolean(transcode?.throttled),
    hardware:Boolean(transcode?.transcodeHwFullPipeline || transcode?.transcodeHwRequested), videoDecision:transcode?.videoDecision || media.videoDecision || 'directplay', audioDecision:transcode?.audioDecision || media.audioDecision || 'directplay',
    tone:['amber','violet','cyan'][index%3], poster:item.ratingKey ? `/api/art/${item.ratingKey}` : null,
  };
}

const historyMetadataCache = new Map();
async function historyMetadata(config, plexFetch, ratingKey) {
  if (!ratingKey) return {};
  const cached = historyMetadataCache.get(String(ratingKey));
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached.item;
  try {
    const response = await plexFetch(config, "/library/metadata/" + encodeURIComponent(ratingKey));
    const item = response.MediaContainer?.Metadata?.[0] || {};
    historyMetadataCache.set(String(ratingKey), { at:Date.now(), item });
    return item;
  } catch { return {}; }
}

export async function streamTelemetry(config, plexFetch) {
  const started = Date.now();
  const [sessionsData, historyData, accountsData] = await Promise.all([
    plexFetch(config, "/status/sessions"),
    plexFetch(config, "/status/sessions/history/all?X-Plex-Container-Start=0&X-Plex-Container-Size=12&sort=viewedAt%3Adesc&includeMedia=1"),
    plexFetch(config, "/accounts").catch(() => ({ MediaContainer:{} })),
  ]);
  const sessions = (sessionsData.MediaContainer?.Metadata || []).map(sessionDetail);
  const totalBandwidth = sessions.reduce((sum,item)=>sum+item.bandwidth,0);
  const transcodes = sessions.filter(item=>item.mode==="Transcoding");
  const accounts = new Map((accountsData.MediaContainer?.Account || []).map(account => [String(account.id), account.name || account.title]));
  const recentRecords = (historyData.MediaContainer?.Metadata || []).sort((a,b) => Number(b.viewedAt || 0) - Number(a.viewedAt || 0)).slice(0,12);
  const recent = await Promise.all(recentRecords.map(async item=>{
    item = { ...await historyMetadata(config, plexFetch, item.ratingKey), ...item };
    const media = item.Media?.[0] || {};
    const accountId = item.accountID || null;
    return {
      title:item.grandparentTitle || item.title || "Unknown", subtitle:item.type === "episode" ? item.title || "" : "",
      type:item.type || "video", viewedAt:Number(item.viewedAt || 0), accountId,
      user:accounts.get(String(accountId)) || item.User?.[0]?.title || "",
      detail:item.type === "episode" ? "S" + String(item.parentIndex || 0).padStart(2,"0") + " E" + String(item.index || 0).padStart(2,"0") : "Movie",
      year:Number(item.year || item.grandparentYear || 0) || null,
      durationMinutes:item.duration ? Math.round(Number(item.duration) / 60_000) : null,
      resolution:String(media.videoResolution || "").toUpperCase(), container:String(media.container || ""),
      rating:Number(item.audienceRating || item.rating || 0) || null,
      poster:item.ratingKey ? "/api/art/" + item.ratingKey : null,
    };
  }));
  return { sessions, summary:{active:sessions.length,direct:sessions.length-transcodes.length,transcodes:transcodes.length,totalBandwidth,hardware:transcodes.filter(item=>item.hardware).length,latencyMs:Date.now()-started}, recent, sampledAt:new Date().toISOString() };
}

export async function peopleTelemetry(config, plexFetch, requestedDays = 90) {
  const periodDays = Math.min(365, Math.max(7, Number(requestedDays || 90)));
  const since = Math.floor(Date.now()/1000)-periodDays*86400;
  const [accountsData,historyData,sessionsData] = await Promise.all([
    plexFetch(config,'/accounts'),
    plexFetch(config,'/status/sessions/history/all?X-Plex-Container-Start=0&X-Plex-Container-Size=1000&sort=viewedAt%3Adesc'),
    plexFetch(config,'/status/sessions'),
  ]);
  const accounts = accountsData.MediaContainer?.Account || [];
  const history = (historyData.MediaContainer?.Metadata || []).filter(item=>Number(item.viewedAt||0)>=since);
  const active = (sessionsData.MediaContainer?.Metadata || []).map(sessionDetail);
  const totalPlays = history.length || 1;
  const relevantAccounts = accounts.filter(account => account.name || history.some(item => String(item.accountID) === String(account.id)) || active.some(item => String(item.userId) === String(account.id)));
  const people = relevantAccounts.map((account,index)=>{
    const plays=history.filter(item=>String(item.accountID)===String(account.id));
    const current=active.find(item=>String(item.userId)===String(account.id)||item.user===account.name);
    const latest=plays.reduce((max,item)=>Math.max(max,Number(item.viewedAt||0)),0);
    const movies=plays.filter(item=>item.type==='movie').length;
    const episodes=plays.filter(item=>item.type==='episode').length;
    return { id:account.id,name:account.name||`User ${index+1}`,initials:String(account.name||'U').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(),plays:plays.length,movies,episodes,share:Math.round(plays.length/totalPlays*100),lastSeen:latest,active:Boolean(current),nowPlaying:current?.title||null,tone:['amber','violet','cyan','rose'][index%4] };
  }).sort((a,b)=>Number(b.active)-Number(a.active)||b.plays-a.plays);
  const hours=Array.from({length:24},(_,hour)=>({hour,plays:history.filter(item=>new Date(Number(item.viewedAt)*1000).getHours()===hour).length}));
  const days=Array.from({length:7},(_,day)=>({day,plays:history.filter(item=>new Date(Number(item.viewedAt)*1000).getDay()===day).length}));
  return { people, totalPlays:history.length, activeNow:active.length, hours, days, periodDays, sampledAt:new Date().toISOString() };
}
