let recommendationCache;

function genres(item){return(item.Genre||[]).map(value=>value.tag).filter(Boolean)}
function selectSeeds(catalog){
  const watched=catalog.filter(item=>Number(item.viewCount||0)>0&&item.ratingKey).sort((a,b)=>Number(b.lastViewedAt||0)-Number(a.lastViewedAt||0)||Number(b.viewCount||0)-Number(a.viewCount||0));
  const fallback=catalog.filter(item=>item.ratingKey&&Number(item.audienceRating||item.rating||0)>=8).sort((a,b)=>Number(b.audienceRating||b.rating||0)-Number(a.audienceRating||a.rating||0));
  const selected=[];const seenGenres=new Set();
  for(const item of [...watched,...fallback]){
    const itemGenres=genres(item);const bringsNew=itemGenres.some(genre=>!seenGenres.has(genre));
    if(!selected.length||bringsNew||selected.length>=3){selected.push(item);itemGenres.forEach(genre=>seenGenres.add(genre));}
    if(selected.length===4)break;
  }
  return selected;
}

function scoreSimilar(seed,item){
  const seedGenres=new Set(genres(seed));const shared=genres(item).filter(genre=>seedGenres.has(genre));const rating=Number(item.audienceRating||item.rating||0);const unwatched=!Number(item.viewCount||0);
  return{score:Math.min(99,Math.round(55+shared.length*9+rating*2+(unwatched?8:0))),shared,rating,unwatched};
}

export async function personalRecommendations(config,dependencies,options={}){
  const includeWatched=options.includeWatched==='true';const force=options.refresh==='1';const cacheKey=includeWatched?'all':'unwatched';
  if(!force&&recommendationCache&&recommendationCache.key===cacheKey&&Date.now()-recommendationCache.createdAt<10*60_000)return recommendationCache.data;
  const{plexFetch,discoveryCatalog}=dependencies;const catalog=await discoveryCatalog(config,force);const seeds=selectSeeds(catalog);const ownedKeys=new Set(catalog.map(item=>String(item.ratingKey)));const used=new Set(seeds.map(item=>String(item.ratingKey)));
  const shelves=[];
  for(const seed of seeds){
    try{
      const result=await plexFetch(config,`/library/metadata/${encodeURIComponent(seed.ratingKey)}/similar?count=40`);
      const ranked=(result.MediaContainer?.Metadata||[]).filter(item=>ownedKeys.has(String(item.ratingKey))&&!used.has(String(item.ratingKey))&&(includeWatched||!Number(item.viewCount||0))).map(item=>({item,...scoreSimilar(seed,item)})).sort((a,b)=>b.score-a.score).slice(0,10);
      ranked.forEach(entry=>used.add(String(entry.item.ratingKey)));
      shelves.push({seed:{ratingKey:seed.ratingKey,title:seed.title,year:seed.year||null,poster:`/api/art/${seed.ratingKey}`,genres:genres(seed).slice(0,3),lastViewedAt:seed.lastViewedAt||null},items:ranked.map(({item,score,shared,rating,unwatched})=>({ratingKey:item.ratingKey,title:item.title,year:item.year||null,summary:item.summary||'',durationMinutes:Math.round(Number(item.duration||0)/60000),genres:genres(item).slice(0,4),rating,unwatched,score,reason:shared.length?`Shares ${shared.slice(0,3).join(', ')} with ${seed.title}`:`Plex finds it similar to ${seed.title}`,poster:`/api/art/${item.ratingKey}`}))});
    }catch{}
  }
  const data={generatedAt:new Date().toISOString(),includeWatched,catalogSize:catalog.length,seedCount:seeds.length,shelves:shelves.filter(shelf=>shelf.items.length)};
  recommendationCache={key:cacheKey,createdAt:Date.now(),data};return data;
}
