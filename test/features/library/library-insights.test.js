import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryInsights } from '../../../src/server/features/library/library-insights-server.js';

test('Library Atlas maps quality, editions, metadata and growth', async () => {
  const now=Math.floor(Date.now()/1000);
  const items=[
    {ratingKey:'1',type:'movie',title:'Arrival',year:2016,thumb:'/thumb',summary:'Story',Genre:[{tag:'Science Fiction'}],addedAt:now-86400,Media:[{videoResolution:'4k',videoCodec:'hevc',videoDynamicRange:'HDR',bitrate:20000,Part:[{size:1000}]},{videoResolution:'1080',videoCodec:'h264',Part:[{size:500}]}]},
    {ratingKey:'2',type:'movie',title:'Arrival',year:2016,summary:'',Genre:[],addedAt:now-86400,Media:[{videoResolution:'1080',videoCodec:'h264',bitrate:8000,Part:[{size:700}]}]},
  ];
  const report=await libraryInsights({}, {
    plexFetch:async()=>({MediaContainer:{Directory:[{key:'1',title:'Movies',type:'movie'}]}}),
    libraryItems:async()=>items,
  }, true);
  assert.equal(report.itemCount,2);
  assert.equal(report.quality.hdrCount,1);
  assert.equal(report.editions.duplicateCount,1);
  assert.equal(report.editions.versionedCount,1);
  assert.equal(report.metadata.issueCount,1);
  assert.ok(report.growth.annualProjectionBytes>0);
});
