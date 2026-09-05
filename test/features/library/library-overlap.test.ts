import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEditionInsights, deleteOverlap } from '../../../src/server/features/library/library-overlap-server.ts';

function media(id,file,resolution,size,codec='h264') {
  return { id:String(id), videoResolution:resolution, videoCodec:codec, audioCodec:'aac', audioChannels:6, bitrate:12000, width:1920, height:1080, duration:7200000, Part:[{ file, size }] };
}

test('overlaps expose detailed, selectable media copies', () => {
  const first={ ratingKey:'11', type:'movie', title:'Arrival', year:2016, libraryTitle:'Movies', libraryKey:'1', facts:{ size:1000, versions:[{ media:media(101,'/media/Arrival/Arrival-4K.mkv','4k',1000), size:1000 }] } };
  const second={ ratingKey:'12', type:'movie', title:'Arrival', year:2016, libraryTitle:'Archive', libraryKey:'2', facts:{ size:500, versions:[{ media:media(102,'/archive/Arrival/Arrival-1080p.mkv','1080',500), size:500 }] } };
  const result=buildEditionInsights([first,second]);
  assert.equal(result.duplicateCount,1);
  assert.equal(result.duplicates[0].copies.length,2);
  assert.equal(result.duplicates[0].copies[0].locations[0],'/media/Arrival/Arrival-4K.mkv');
  assert.equal(result.duplicates[0].copies[0].audioChannels,6);
});

test('overlap deletion requires a current overlap and explicit confirmation', async () => {
  const copy={ ratingKey:'11', mediaId:'101', fileName:'Arrival-4K.mkv' };
  const report={ editions:{ duplicates:[{ title:'Arrival', copies:[copy,{ratingKey:'12',mediaId:'102'}] }], versioned:[] } };
  const calls=[];
  const dependencies={
    plexFetch:async()=>({ MediaContainer:{ Metadata:[{ title:'Arrival', Media:[media(101,'/media/Arrival/Arrival-4K.mkv','4k',1000)] }] } }),
    plexDelete:async(_config,path)=>calls.push(path), invalidate:()=>calls.push('invalidated'),
  };
  await assert.rejects(()=>deleteOverlap({},dependencies,{ratingKey:'11',mediaId:'101',confirmed:false},report),/Confirm deletion/);
  assert.equal(calls.length,0);
  const result=await deleteOverlap({},dependencies,{ratingKey:'11',mediaId:'101',confirmed:true},report);
  assert.equal(result.deleted,true);
  assert.deepEqual(calls,['/library/metadata/11/media/101?proxy=0','invalidated']);
});
