import { buildDeckIntelligence } from './command-deck-intelligence-server.js';
let catalogCache;

function historyIdentity(item) {
  if (item.type === 'episode') return [item.librarySectionID, 'episode', item.grandparentTitle, item.parentIndex, item.index].join('|');
  return [item.librarySectionID, item.type, item.title].join('|');
}

async function videoCatalog(config, plexFetch, libraryItems) {
  if (catalogCache && Date.now() - catalogCache.createdAt < 10 * 60_000) return catalogCache.items;
  const sections = await plexFetch(config, '/library/sections');
  const libraries = (sections.MediaContainer?.Directory || []).filter(library => ['movie','show'].includes(library.type));
  const items = (await Promise.all(libraries.map(library => libraryItems(config, library)))).flat();
  catalogCache = { createdAt:Date.now(), items };
  return items;
}

function recentHistory(records, catalog) {
  const index = new Map(), byRatingKey = new Map();
  for (const item of catalog) { index.set(historyIdentity({ ...item, librarySectionID:item.librarySectionID || item.libraryKey }), item); if(item.ratingKey) byRatingKey.set(String(item.ratingKey),item); }
  return records.map(record => ({ record, media:byRatingKey.get(String(record.ratingKey || '')) || index.get(historyIdentity(record)) })).filter(entry => entry.media);
}

export async function commandDeck(config, dependencies) {
  const { plexFetch, overview, libraryItems } = dependencies;
    const since = Math.floor(Date.now() / 1000) - 90 * 86400;
  const historyPath = '/status/sessions/history/all?X-Plex-Container-Start=0&X-Plex-Container-Size=1000&sort=viewedAt%3Adesc';
  let plexLatency=0; const timedOverview=(async()=>{const signal=Date.now();const result=await overview(config);plexLatency=Date.now()-signal;return result})();
  const [base, historyData, recentData, catalog] = await Promise.all([
    timedOverview, plexFetch(config, historyPath),
    plexFetch(config, '/library/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size=8'),
    videoCatalog(config, plexFetch, libraryItems),
  ]);
  const history = (historyData.MediaContainer?.Metadata || []).filter(item => Number(item.viewedAt || 0) >= since);
  const matched = recentHistory(history, catalog);
  const intelligence = buildDeckIntelligence(matched, history.length);
  const recentAdded = (recentData.MediaContainer?.Metadata || []).map(item => ({
    type:'added', title:item.title || item.grandparentTitle || 'New item',
    detail:`Added to ${item.librarySectionTitle || 'Plex'}`, at:Number(item.addedAt || 0), ratingKey:item.ratingKey,
  }));
  const recentWatched = matched.slice(0,12).map(({record,media}) => ({
    type:'watched', title:record.grandparentTitle || record.title || media.title,
    detail:record.type === 'episode' ? `Watched S${String(record.parentIndex || 0).padStart(2,'0')} E${String(record.index || 0).padStart(2,'0')}` : 'Watched', at:Number(record.viewedAt || 0),
  }));
  const live = base.sessions.map(session => ({ type:'stream', title:session.title, detail:`${session.user} · ${session.mode}`, at:Math.floor(Date.now()/1000) }));
  const activity = [...live,...recentAdded,...recentWatched].sort((a,b) => b.at-a.at).slice(0,20);
  const latency = plexLatency;
  const transcodes = base.sessions.filter(session => session.mode === 'Transcoding').length;
  const healthScore = Math.max(70, Math.min(99, 99 - Math.floor(latency / 250) - transcodes * 2));
  return {
    ...base,
    health:{ score:healthScore, latencyMs:latency, status:healthScore >= 94 ? 'Optimal' : healthScore >= 85 ? 'Healthy' : 'Under load', transcodes },
    watch:intelligence.watch,
    taste:intelligence.taste, activity,
    recentAdded:recentAdded.length,
  };
}
