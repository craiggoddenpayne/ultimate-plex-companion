const DAY = 86_400;

const genres = item => (item.Genre || []).map(entry => entry.tag).filter(Boolean);
const rating = item => Number(item.audienceRating || item.rating || 0);
const minutes = item => Math.round(Number(item.duration || 0) / 60_000);
const unwatched = item => Number(item.viewCount || 0) === 0;
const resolution = item => String(item.Media?.[0]?.videoResolution || '').toLowerCase();
const progress = item => Number(item.duration) ? Number(item.viewOffset || 0) / Number(item.duration) : 0;
const title = item => item.grandparentTitle ? `${item.grandparentTitle} · ${item.title}` : item.title || 'Unknown title';

const definitions = [
  { id:'fresh', name:'Fresh & Unwatched', eyebrow:'NEW ARRIVALS', description:'Recently added titles nobody has finished yet.', tone:'cyan', test:(item,now)=>unwatched(item)&&Number(item.addedAt||0)>now-30*DAY, sort:(a,b)=>Number(b.addedAt||0)-Number(a.addedAt||0) },
  { id:'essentials', name:'Unwatched Essentials', eyebrow:'QUALITY QUEUE', description:'Your strongest-rated unwatched films and episodes.', tone:'amber', test:item=>unwatched(item)&&rating(item)>=7.5, sort:(a,b)=>rating(b)-rating(a) },
  { id:'finish', name:'Finish Line', eyebrow:'CONTINUE WATCHING', description:'Partially watched stories closest to completion.', tone:'violet', test:item=>progress(item)>=.05&&progress(item)<.9, sort:(a,b)=>progress(b)-progress(a) },
  { id:'short', name:'Under 105 Minutes', eyebrow:'QUICK WATCH', description:'Compact unwatched films for a shorter evening.', tone:'cyan', test:item=>item.type==='movie'&&unwatched(item)&&minutes(item)>0&&minutes(item)<=105, sort:(a,b)=>rating(b)-rating(a)||minutes(a)-minutes(b) },
  { id:'epic', name:'Weekend Epics', eyebrow:'LONG FORM', description:'Highly rated films that deserve an unhurried night.', tone:'rose', test:item=>item.type==='movie'&&minutes(item)>=140&&rating(item)>=7, sort:(a,b)=>rating(b)-rating(a) },
  { id:'showcase', name:'4K Showcase', eyebrow:'DISPLAY MODE', description:'The sharpest 4K titles available on your server.', tone:'violet', test:item=>resolution(item).includes('4k'), sort:(a,b)=>rating(b)-rating(a) },
  { id:'scifi', name:'Science-Fiction Voyage', eyebrow:'GENRE SIGNAL', description:'Science fiction ranked by audience response.', tone:'cyan', test:item=>genres(item).includes('Science Fiction'), sort:(a,b)=>rating(b)-rating(a) },
  { id:'comfort', name:'Comfort Queue', eyebrow:'MOOD · LIGHT', description:'Comedy, animation and romance with an easy tone.', tone:'amber', test:item=>genres(item).some(value=>['Comedy','Animation','Romance'].includes(value)), sort:(a,b)=>rating(b)-rating(a) },
  { id:'horror', name:'After Dark', eyebrow:'MOOD · DARK', description:'Horror and thriller titles for a late-night run.', tone:'rose', test:item=>genres(item).some(value=>['Horror','Thriller'].includes(value)), sort:(a,b)=>rating(b)-rating(a) },
  { id:'family', name:'Family Night', eyebrow:'HOUSEHOLD PICK', description:'Family and animation titles suitable for a shared screen.', tone:'violet', test:item=>genres(item).some(value=>['Family','Animation'].includes(value)), sort:(a,b)=>rating(b)-rating(a) },
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
