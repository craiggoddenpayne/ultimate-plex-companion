import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaylistGenerators, createGeneratedPlaylist, playlistCreatePath } from '../playlist-studio-server.js';

const movie=(id,title,extra={})=>({ratingKey:String(id),type:'movie',title,duration:100*60_000,audienceRating:8,viewCount:0,Genre:[],Media:[{videoResolution:'1080'}],...extra});

test('playlist generators produce useful live criteria', () => {
  const now=1_800_000_000;
  const items=[movie(1,'New',{addedAt:now-100,Genre:[{tag:'Science Fiction'}]}),movie(2,'Short'),movie(3,'Epic',{duration:170*60_000,Media:[{videoResolution:'4k'}]}),movie(4,'Partial',{viewOffset:50*60_000})];
  const generators=buildPlaylistGenerators(items,now);
  assert.equal(generators.find(item=>item.id==='fresh').items[0].title,'New');
  assert.equal(generators.find(item=>item.id==='short').count,3);
  assert.equal(generators.find(item=>item.id==='showcase').items[0].title,'Epic');
  assert.equal(generators.find(item=>item.id==='finish').items[0].title,'Partial');
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
