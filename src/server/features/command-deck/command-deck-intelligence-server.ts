const DAY=86400;

function watchedAt(entry){return Number(entry.record.viewedAt||0)}
function minutes(entry){return Number(entry.media.duration||0)/60000}

export function buildDeckIntelligence(matches, historyRecords, nowSeconds=Math.floor(Date.now()/1000)) {
  const current=matches.filter(entry=>watchedAt(entry)>=nowSeconds-7*DAY);
  const previous=matches.filter(entry=>watchedAt(entry)>=nowSeconds-14*DAY&&watchedAt(entry)<nowSeconds-7*DAY);
  const totalMinutes=entries=>Math.round(entries.reduce((sum,entry)=>sum+minutes(entry),0));
  const currentMinutes=totalMinutes(current),previousMinutes=totalMinutes(previous);
  const trendPercent=previousMinutes?Math.round((currentMinutes-previousMinutes)/previousMinutes*100):currentMinutes?100:0;
  const daily=Array.from({length:7},(_,offset)=>{const date=new Date(nowSeconds*1000);date.setHours(0,0,0,0);date.setDate(date.getDate()-(6-offset));const start=date.getTime()/1000,end=start+DAY;const plays=current.filter(entry=>watchedAt(entry)>=start&&watchedAt(entry)<end);return{date:date.toISOString().slice(0,10),minutes:totalMinutes(plays),plays:plays.length}});

  const genreMap=new Map(),eraMap=new Map();let movies=0,episodes=0;
  for(const entry of matches){const ageDays=Math.max(0,(nowSeconds-watchedAt(entry))/DAY),recency=Math.max(.35,1-ageDays/120),weight=(1+Math.min(2.5,minutes(entry)/90))*recency;const genres=(entry.media.Genre||[]).map(item=>item.tag).filter(Boolean);for(const genre of genres){const value=genreMap.get(genre)||{score:0,plays:0,minutes:0};value.score+=weight;value.plays++;value.minutes+=minutes(entry);genreMap.set(genre,value)}const year=Number(entry.media.year||entry.record.year||0);if(year){const era=`${Math.floor(year/10)*10}s`;eraMap.set(era,(eraMap.get(era)||0)+1)}if(entry.record.type==='episode'||entry.media.type==='episode')episodes++;else movies++}
  const ranked=[...genreMap.entries()].sort((a,b)=>b[1].score-a[1].score),peak=ranked[0]?.[1].score||1,totalScore=ranked.reduce((sum,[,value])=>sum+value.score,0)||1;
  const genres=ranked.slice(0,6).map(([genre,value])=>({genre,affinity:Math.round(value.score/peak*100),share:Math.round(value.score/totalScore*100),plays:value.plays,minutes:Math.round(value.minutes)}));
  const archetypes:[RegExp,string][]=[[/Science Fiction|Sci-Fi/i,'Future Seeker'],[/Thriller|Mystery|Crime/i,'Tension Cartographer'],[/Comedy/i,'Joy Curator'],[/Horror/i,'Midnight Explorer'],[/Documentary/i,'Reality Decoder'],[/Animation|Family/i,'Wonder Collector'],[/Drama|Romance/i,'Human Storyteller'],[/Action|Adventure/i,'Momentum Chaser']];
  const archetype=archetypes.find(([pattern])=>genres.slice(0,2).some(item=>pattern.test(item.genre)))?.[1]||'Eclectic Explorer';
  const favouriteEra=[...eraMap.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'Still forming';
  const diversity=genres.length?Math.min(100,Math.round((1-Math.max(0,...genres.map(item=>item.share))/100)*125)):0;
  const matchRate=historyRecords?matches.length/historyRecords:0,confidence=matches.length?Math.min(99,Math.round(35+Math.min(45,matches.length*2.2)+matchRate*19)):0;
  const influences=matches.slice(0,8).map(({record,media})=>({title:record.grandparentTitle||record.title||media.title||'Unknown title',detail:[media.year||record.year,...(media.Genre||[]).slice(0,2).map(item=>item.tag)].filter(Boolean).join(' · '),viewedAt:watchedAt({record})}));
  return {
    watch:{minutes:currentMinutes,previousMinutes,trendPercent,plays:current.length,historyRecords:current.length,daily},
    taste:{genres,archetype,confidence,diversity,favouriteEra,samplePlays:matches.length,sampleDays:90,formats:{movies,episodes},influences,summary:genres.length?`${archetype} · led by ${genres.slice(0,2).map(item=>item.genre).join(' and ')}`:'Watch history will shape this signal.'},
  };
}
