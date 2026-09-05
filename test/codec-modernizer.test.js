import test from 'node:test';
import assert from 'node:assert/strict';
import { conversionTarget, isLegacyCodec, supportedTargets, videoArguments } from '../codec-modernizer-server.js';

test('codec modernizer recognizes legacy sources and builds modern targets',()=>{assert.equal(isLegacyCodec('vc1'),true);assert.equal(isLegacyCodec('mpeg2video'),true);assert.equal(isLegacyCodec('hevc'),false);assert.equal(conversionTarget('av1').encoder,'libsvtav1');assert.deepEqual(videoArguments('hevc',{preset:'slow',crf:19}),['-c:v:0','libx265','-preset','slow','-crf','19']);assert.deepEqual(supportedTargets('libx265 libsvtav1').map(item=>item.available),[true,true,false]);assert.equal(conversionTarget('vp9').encoder,'libvpx-vp9');assert.deepEqual(videoArguments('vp9'),['-c:v:0','libvpx-vp9','-crf','30','-b:v','0','-deadline','good','-cpu-used','2']);assert.throws(()=>conversionTarget('unknown'),/HEVC, AV1 or VP9/)});
