import test from 'node:test';
import assert from 'node:assert/strict';
import { universalSearch, answerCompanion, companionNotifications } from '../../../src/server/features/companion/companion-server.ts';

test('universal search normalizes Plex hubs and removes duplicates', async () => {
  const plexFetch=async()=>({ MediaContainer:{ Hub:[
    { title:'Movies', Metadata:[{ ratingKey:'1', title:'Arrival', type:'movie', year:2016, duration:6960000 }] },
    { title:'Search', Metadata:[{ ratingKey:'1', title:'Arrival', type:'movie' },{ ratingKey:'2', title:'The Answer', type:'episode', grandparentTitle:'Show', parentIndex:1, index:2 }] },
  ] } });
  const result=await universalSearch({},plexFetch,'arr');
  assert.equal(result.results.length,2);
  assert.equal(result.results[0].durationMinutes,116);
  assert.equal(result.results[1].title,'Show · The Answer');
  assert.equal(result.results[1].detail,'S01 E02');
});

test('Companion answers from live dependencies and notifications expose actionable signals', async () => {
  const dependencies={
    overview:async()=>({ server:{name:'Test Plex'},titleCount:42,libraryCount:2,sessions:[] }),
    storageAnalysis:async()=>({ estimatedSaving:1024**3,candidateCount:2,scanned:42,totalSize:5*1024**3,averageConfidence:91 }),
    discoveryRecommendations:async()=>({results:[]}), streamTelemetry:async()=>({summary:{active:0,direct:0,transcodes:0,totalBandwidth:0},sessions:[]}),
    plexFetch:async()=>({MediaContainer:{Metadata:[]}}), automationEngine:{list:async()=>({paused:false,rules:[{enabled:true}],runs:[],templates:Array(6)})},
  };
  const answer=await answerCompanion({},dependencies,'How much storage can I reclaim?');
  assert.equal(answer.intent,'storage');
  assert.match(answer.headline,/1.0 GB/);
  const notices=await companionNotifications({}, {...dependencies,getJobs:()=>[{id:'job',state:'ready',title:'Film',saving:1024,updatedAt:new Date().toISOString()}]});
  assert.equal(notices.notifications[0].route,'library');
});
