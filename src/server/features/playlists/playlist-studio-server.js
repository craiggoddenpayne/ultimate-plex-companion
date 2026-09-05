const DAY = 86_400;

const genres = item => (item.Genre || []).map(entry => entry.tag).filter(Boolean);
const rating = item => Number(item.audienceRating || item.rating || 0);
const criticRating = item => Number(item.rating || 0);
const minutes = item => Math.round(Number(item.duration || 0) / 60_000);
const unwatched = item => Number(item.viewCount || 0) === 0;
const watched = item => Number(item.viewCount || 0) > 0;
const resolution = item => String(item.Media?.[0]?.videoResolution || '').toLowerCase();
const year = item => Number(item.year || item.originallyAvailableAt?.slice?.(0,4) || 0);
const progress = item => Number(item.duration) ? Number(item.viewOffset || 0) / Number(item.duration) : 0;
const title = item => item.grandparentTitle ? `${item.grandparentTitle} · ${item.title}` : item.title || 'Unknown title';
const audioChannels = item => Math.max(0, ...(item.Media || []).flatMap(media => [Number(media.audioChannels || 0), ...(media.Part || []).flatMap(part => (part.Stream || []).filter(stream => Number(stream.streamType) === 2).map(stream => Number(stream.channels || 0)))]));
const hdr = item => (item.Media || []).some(media => /hdr|dolby vision|dovi|smpte2084|arib-std-b67/i.test([
  media.videoDynamicRange, ...(media.Part || []).flatMap(part => (part.Stream || []).filter(stream => Number(stream.streamType) === 1).flatMap(stream => [stream.dynamicRange, stream.displayTitle, stream.extendedDisplayTitle, stream.colorTrc])),
].filter(Boolean).join(' ')));

const definitions = [
  { id:'fresh', category:'Discovery', name:'Fresh & Unwatched', eyebrow:'NEW ARRIVALS', description:'Recently added titles nobody has finished yet.', tone:'cyan', test:(item,now)=>unwatched(item)&&Number(item.addedAt||0)>now-30*DAY, sort:(a,b)=>Number(b.addedAt||0)-Number(a.addedAt||0) },
  { id:'essentials', category:'Discovery', name:'Unwatched Essentials', eyebrow:'QUALITY QUEUE', description:'Your strongest-rated unwatched films and episodes.', tone:'amber', test:item=>unwatched(item)&&rating(item)>=7.5, sort:(a,b)=>rating(b)-rating(a) },
  { id:'finish', category:'Progress', name:'Finish Line', eyebrow:'CONTINUE WATCHING', description:'Partially watched stories closest to completion.', tone:'violet', test:item=>progress(item)>=.05&&progress(item)<.9, sort:(a,b)=>progress(b)-progress(a) },
  { id:'short', category:'Runtime', name:'Under 105 Minutes', eyebrow:'QUICK WATCH', description:'Compact unwatched films for a shorter evening.', tone:'cyan', test:item=>item.type==='movie'&&unwatched(item)&&minutes(item)>0&&minutes(item)<=105, sort:(a,b)=>rating(b)-rating(a)||minutes(a)-minutes(b) },
  { id:'epic', category:'Runtime', name:'Weekend Epics', eyebrow:'LONG FORM', description:'Highly rated films that deserve an unhurried night.', tone:'rose', test:item=>item.type==='movie'&&minutes(item)>=140&&rating(item)>=7, sort:(a,b)=>rating(b)-rating(a) },
  { id:'showcase', category:'Cinema', name:'4K Showcase', eyebrow:'DISPLAY MODE', description:'The sharpest 4K titles available on your server.', tone:'violet', test:item=>resolution(item).includes('4k'), sort:(a,b)=>rating(b)-rating(a) },
  { id:'scifi', category:'Mood', name:'Science-Fiction Voyage', eyebrow:'GENRE SIGNAL', description:'Science fiction ranked by audience response.', tone:'cyan', test:item=>genres(item).includes('Science Fiction'), sort:(a,b)=>rating(b)-rating(a) },
  { id:'comfort', category:'Mood', name:'Comfort Queue', eyebrow:'MOOD · LIGHT', description:'Comedy, animation and romance with an easy tone.', tone:'amber', test:item=>genres(item).some(value=>['Comedy','Animation','Romance'].includes(value)), sort:(a,b)=>rating(b)-rating(a) },
  { id:'horror', category:'Mood', name:'After Dark', eyebrow:'MOOD · DARK', description:'Horror and thriller titles for a late-night run.', tone:'rose', test:item=>genres(item).some(value=>['Horror','Thriller'].includes(value)), sort:(a,b)=>rating(b)-rating(a) },
  { id:'family', category:'Household', name:'Family Night', eyebrow:'HOUSEHOLD PICK', description:'Family and animation titles suitable for a shared screen.', tone:'violet', test:item=>genres(item).some(value=>['Family','Animation'].includes(value)), sort:(a,b)=>rating(b)-rating(a) },
  { id:'hidden-gems', category:'Discovery', name:'Hidden Gems', eyebrow:'DEEP LIBRARY SIGNAL', description:'Highly rated unwatched titles that have been waiting for six months.', tone:'amber', test:(item,now)=>unwatched(item)&&rating(item)>=7&&Number(item.addedAt||0)>0&&Number(item.addedAt)<now-180*DAY, sort:(a,b)=>rating(b)-rating(a)||Number(a.addedAt||0)-Number(b.addedAt||0) },
  { id:'rediscover', category:'Progress', name:'Rediscover Favourites', eyebrow:'LONG-TIME NO SEE', description:'Strongly rated titles you watched before, but not in the last six months.', tone:'violet', test:(item,now)=>watched(item)&&rating(item)>=7.5&&Number(item.lastViewedAt||0)>0&&Number(item.lastViewedAt)<now-180*DAY, sort:(a,b)=>Number(a.lastViewedAt||0)-Number(b.lastViewedAt||0) },
  { id:'acclaimed', category:'Discovery', name:'Critics’ Circle', eyebrow:'CRITICAL SIGNAL', description:'Unwatched titles carrying an exceptional Plex critic rating.', tone:'amber', test:item=>unwatched(item)&&criticRating(item)>=8, sort:(a,b)=>criticRating(b)-criticRating(a)||rating(b)-rating(a) },
  { id:'hdr', category:'Cinema', name:'HDR Lightstorm', eyebrow:'DYNAMIC RANGE', description:'HDR and Dolby Vision titles ready to light up a capable display.', tone:'cyan', test:item=>hdr(item), sort:(a,b)=>rating(b)-rating(a) },
  { id:'surround', category:'Cinema', name:'Surround Soundstage', eyebrow:'AUDIO SHOWCASE', description:'Titles with 5.1-channel or better audio for the cinema room.', tone:'violet', test:item=>audioChannels(item)>=6, sort:(a,b)=>audioChannels(b)-audioChannels(a)||rating(b)-rating(a) },
  { id:'quick-episodes', category:'Runtime', name:'Quick Episode Run', eyebrow:'UNDER 35 MINUTES', description:'Short unwatched episodes for a compact viewing session.', tone:'cyan', test:item=>item.type==='episode'&&unwatched(item)&&minutes(item)>0&&minutes(item)<=35, sort:(a,b)=>rating(b)-rating(a)||minutes(a)-minutes(b) },
  { id:'documentary', category:'Mood', name:'Documentary Lens', eyebrow:'REAL STORIES', description:'Documentary films and episodes ranked by audience response.', tone:'amber', test:item=>genres(item).includes('Documentary'), sort:(a,b)=>rating(b)-rating(a) },
  { id:'crime', category:'Mood', name:'Crime Files', eyebrow:'MYSTERY SIGNAL', description:'Crime, mystery and detective stories for an investigative run.', tone:'rose', test:item=>genres(item).some(value=>['Crime','Mystery'].includes(value)), sort:(a,b)=>rating(b)-rating(a) },
  { id:'eighties', category:'Era', name:'Eighties Rewind', eyebrow:'1980—1989', description:'The strongest signals from your neon decade collection.', tone:'rose', test:item=>year(item)>=1980&&year(item)<=1989, sort:(a,b)=>rating(b)-rating(a)||year(a)-year(b) },
  { id:'nineties', category:'Era', name:'Nineties Time Capsule', eyebrow:'1990—1999', description:'A ranked trip through the films and television of the nineties.', tone:'violet', test:item=>year(item)>=1990&&year(item)<=1999, sort:(a,b)=>rating(b)-rating(a)||year(a)-year(b) },
  { id:'modern-classics', category:'Era', name:'Modern Classics', eyebrow:'2000—2014', description:'Exceptional turn-of-the-century titles rated eight or better.', tone:'amber', test:item=>year(item)>=2000&&year(item)<=2014&&rating(item)>=8, sort:(a,b)=>rating(b)-rating(a)||year(a)-year(b) },
  { id:'latest-releases', category:'Discovery', name:'Latest Releases', eyebrow:'NEW CINEMA', description:'Unwatched titles released within the last two calendar years.', tone:'cyan', test:(item,now)=>unwatched(item)&&year(item)>=new Date(now*1000).getUTCFullYear()-1, sort:(a,b)=>year(b)-year(a)||rating(b)-rating(a) },
];

function publicItem(item) {
  return {
    ratingKey:String(item.ratingKey), title:title(item), year:item.year || null, type:item.type || 'video',
    library:item.libraryTitle || '', rating:rating(item), minutes:minutes(item), progress:Math.round(progress(item)*100),
    detail:[item.year, item.type, minutes(item) ? `${minutes(item)} min` : '', rating(item) ? `★ ${rating(item).toFixed(1)}` : ''].filter(Boolean).join(' · '),
    poster:`/api/art/${item.ratingKey}`, plexUrl:`/api/plex/open/${item.ratingKey}`,
  };
}

export function buildPlaylistGenerators(items, now = Date.now()/1000) {
  const usable = items.filter(item => item.ratingKey && ['movie','episode'].includes(item.type));
  return definitions.map(definition => {
    const matches = usable.filter(item => definition.test(item, now)).sort(definition.sort);
    return { ...definition, count:matches.length, totalMinutes:matches.reduce((sum,item)=>sum+minutes(item),0), items:matches };
  });
}

export function playlistCreatePath(machineIdentifier, playlistTitle, ratingKeys) {
  const machine = String(machineIdentifier || '').trim();
  const name = String(playlistTitle || '').trim().replace(/[\r\n]+/g, ' ').slice(0, 80);
  const keys = ratingKeys.map(String).filter(key => /^\d+$/.test(key));
  if (!machine) throw new Error('Plex did not provide its server identifier.');
  if (!name) throw new Error('Give the playlist a name.');
  if (!keys.length) throw new Error('This generator has no matching titles.');
  const uri = `server://${machine}/com.plexapp.plugins.library/library/metadata/${keys.join(',')}`;
  return `/playlists?type=video&smart=0&title=${encodeURIComponent(name)}&uri=${encodeURIComponent(uri)}`;
}

async function catalog(config, { plexFetch, libraryItems }) {
  const sections = await plexFetch(config, '/library/sections');
  const libraries = (sections.MediaContainer?.Directory || []).filter(item => ['movie','show'].includes(item.type));
  return (await Promise.all(libraries.map(library => libraryItems(config, library)))).flat();
}

function publicGenerator(generator) {
  const { test, sort, items, ...safe } = generator;
  return { ...safe, available:items.length>0, sample:items.slice(0,12).map(publicItem) };
}

export async function playlistStudio(config, dependencies) {
  const items = await catalog(config, dependencies);
  let existing = [];
  try {
    const response = await dependencies.plexFetch(config, '/playlists?playlistType=video');
    existing = (response.MediaContainer?.Metadata || response.MediaContainer?.Directory || []).map(item => ({ ratingKey:String(item.ratingKey||''), title:item.title||'Untitled playlist', itemCount:Number(item.leafCount||item.childCount||0), durationMinutes:Math.round(Number(item.duration||0)/60_000), poster:item.thumb?`/api/art/${item.ratingKey}`:'' }));
  } catch { /* Playlist generation remains available if Plex cannot list existing playlists. */ }
  return { catalogSize:items.length, existing, generators:buildPlaylistGenerators(items).map(publicGenerator), generatedAt:new Date().toISOString() };
}

export async function createGeneratedPlaylist(config, dependencies, input) {
  if (input?.confirmed !== true) throw new Error('Confirm playlist creation before continuing.');
  const items = await catalog(config, dependencies);
  const generator = buildPlaylistGenerators(items).find(entry => entry.id === input.generatorId);
  if (!generator) throw new Error('Unknown playlist generator.');
  const limit = Math.min(100, Math.max(1, Number(input.limit || 30)));
  const selected = generator.items.slice(0, limit);
  const identity = await dependencies.inspectPlex(config);
  const playlistTitle = String(input.title || generator.name).trim();
  await dependencies.plexCommand(config, playlistCreatePath(identity.machineIdentifier, playlistTitle, selected.map(item=>item.ratingKey)), 'POST');
  return { title:playlistTitle.slice(0,80), itemCount:selected.length, generatorId:generator.id, items:selected.slice(0,12).map(publicItem) };
}
