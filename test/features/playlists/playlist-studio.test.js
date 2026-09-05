import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaylistGenerators, composePlaylist, createGeneratedPlaylist, normalizeComposerCriteria, playlistComposerFacets, playlistCreatePath } from '../../../src/server/features/playlists/playlist-studio-server.js';

const movie=(id,title,extra={})=>({ratingKey:String(id),type:'movie',title,duration:100*60_000,audienceRating:8,viewCount:0,Genre:[],Media:[{videoResolution:'1080'}],...extra});

test('playlist generators produce useful live criteria', () => {
  const now=1_800_000_000;
  const items=[movie(1,'New',{addedAt:now-100,Genre:[{tag:'Science Fiction'}]}),movie(2,'Short'),movie(3,'Epic',{duration:170*60_000,Media:[{videoResolution:'4k'}]}),movie(4,'Partial',{viewOffset:50*60_000})];
  const generators=buildPlaylistGenerators(items,now);
  assert.equal(generators.find(item=>item.id==='fresh').items[0].title,'New');
  assert.equal(generators.find(item=>item.id==='short').count,3);
  assert.equal(generators.find(item=>item.id==='showcase').items[0].title,'Epic');
  assert.equal(generators.find(item=>item.id==='finish').items[0].title,'Partial');
  assert.equal(generators.length,22);
  assert.equal(new Set(generators.map(item=>item.id)).size,22);
});

test('playlist studio derives discovery, cinema, runtime, mood and era signals', () => {
  const now=1_800_000_000;
  const currentYear=new Date(now*1000).getUTCFullYear();
  const episode=(id,title,extra={})=>({ratingKey:String(id),type:'episode',title,duration:25*60_000,audienceRating:7.8,viewCount:0,Genre:[],Media:[{videoResolution:'1080'}],...extra});
  const items=[
    movie(10,'Hidden',{addedAt:now-200*86_400}),
    movie(11,'Rediscover',{viewCount:1,lastViewedAt:now-220*86_400}),
    movie(12,'Critic Pick',{audienceRating:7,rating:8.6}),
    movie(13,'HDR Film',{Media:[{videoResolution:'4k',videoDynamicRange:'HDR10'}]}),
    movie(14,'Surround Film',{Media:[{videoResolution:'1080',audioChannels:8}]}),
    episode(15,'Short Episode'),
    movie(16,'Documentary',{Genre:[{tag:'Documentary'}]}),
    movie(17,'Mystery',{Genre:[{tag:'Mystery'}]}),
    movie(18,'Eighties',{year:1986}),
    movie(19,'Nineties',{year:1996}),
    movie(20,'Modern',{year:2010,audienceRating:8.4}),
    movie(21,'Latest',{year:currentYear}),
  ];
  const generators=buildPlaylistGenerators(items,now);
  for(const id of ['hidden-gems','rediscover','acclaimed','hdr','surround','quick-episodes','documentary','crime','eighties','nineties','modern-classics','latest-releases']) {
    assert.ok(generators.find(item=>item.id===id).count>0,`${id} should have a match`);
  }
  assert.deepEqual(new Set(generators.map(item=>item.category)),new Set(['Discovery','Progress','Runtime','Cinema','Mood','Household','Era']));
});

test('playlist creation builds a confirmed Plex video playlist', async () => {
  const calls=[];
  const dependencies={plexFetch:async()=>({MediaContainer:{Directory:[{key:'1',type:'movie'}]}}),libraryItems:async()=>[movie(8,'Primer')],inspectPlex:async()=>({machineIdentifier:'machine'}),plexCommand:async(...args)=>calls.push(args)};
  const created=await createGeneratedPlaylist({},dependencies,{generatorId:'essentials',title:'Great Films',limit:20,confirmed:true});
  assert.equal(created.itemCount,1);
  assert.match(calls[0][1],/^\/playlists\?type=video&smart=0&title=Great%20Films/);
  assert.equal(calls[0][2],'POST');
  assert.match(decodeURIComponent(calls[0][1]),/server:\/\/machine\/com\.plexapp\.plugins\.library\/library\/metadata\/8/);
  assert.throws(()=>playlistCreatePath('machine','',[]),/name/);
});

test('custom composer combines filters and ranks matching Plex items', () => {
  const items=[
    movie(30,'Best Short Sci-Fi',{year:2018,duration:80*60_000,audienceRating:9,Genre:[{tag:'Science Fiction'}],Media:[{videoResolution:'4k'}]}),
    movie(31,'Long Sci-Fi',{year:2015,duration:160*60_000,audienceRating:8.5,Genre:[{tag:'Science Fiction'}],Media:[{videoResolution:'4k'}]}),
    movie(32,'Wrong Genre',{year:2019,duration:75*60_000,audienceRating:9.5,Genre:[{tag:'Drama'}],Media:[{videoResolution:'4k'}]}),
  ];
  const result=composePlaylist(items,{type:'movie',watchState:'unwatched',genre:'Science Fiction',decade:2010,minRating:8,maxMinutes:120,resolution:'4k',sort:'rating'});
  assert.deepEqual(result.items.map(item=>item.ratingKey),['30']);
  assert.deepEqual(result.criteria,{type:'movie',watchState:'unwatched',genre:'Science Fiction',decade:2010,minRating:8,maxMinutes:120,resolution:'4k',sort:'rating'});
  const normalized=normalizeComposerCriteria({type:'music',watchState:'maybe',minRating:99,maxMinutes:900,resolution:'16k',sort:'random'});
  assert.equal(normalized.type,'all');
  assert.equal(normalized.minRating,10);
  assert.equal(normalized.maxMinutes,600);
  assert.equal(normalized.sort,'rating');
});

test('custom composer exposes useful facets and creates only confirmed matches', async () => {
  const items=[movie(40,'Drama',{year:1995,Genre:[{tag:'Drama'}]}),movie(41,'Comedy',{year:2004,Genre:[{tag:'Comedy'}]})];
  const facets=playlistComposerFacets(items);
  assert.deepEqual(facets.decades,[2000,1990]);
  assert.deepEqual(facets.genres.map(item=>item.value),['Comedy','Drama']);
  const calls=[];
  const dependencies={plexFetch:async()=>({MediaContainer:{Directory:[{key:'1',type:'movie'}]}}),libraryItems:async()=>items,inspectPlex:async()=>({machineIdentifier:'machine'}),plexCommand:async(...args)=>calls.push(args)};
  const created=await createGeneratedPlaylist({},dependencies,{generatorId:'custom',criteria:{genre:'Drama'},title:'Custom Drama',limit:10,confirmed:true});
  assert.equal(created.generatorId,'custom');
  assert.equal(created.itemCount,1);
  assert.match(decodeURIComponent(calls[0][1]),/metadata\/40/);
});
