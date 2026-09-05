import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));
const execute = promisify(execFile);

test('saves Plex credentials securely and returns a live overview', async t => {
  const configDir = await mkdtemp(join(tmpdir(), 'plex-companion-'));
  const sourcePath = join(configDir, 'Large Film.mkv');
  await execute('ffmpeg', ['-v','error','-f','lavfi','-i','testsrc2=size=640x360:rate=24','-t','2','-c:v','libx264','-qp','0','-an',sourcePath]);
  const mock = createServer((req, res) => {
    assert.equal(req.headers['x-plex-token'], 'secret-token');
    const payload = req.url === '/' ? { MediaContainer:{ friendlyName:'Test Plex' } }
      : req.url === '/identity' ? { MediaContainer:{ version:'1.42.2', machineIdentifier:'abc' } }
      : req.url === '/library/sections' ? { MediaContainer:{ Directory:[{ key:'1', title:'Movies', type:'movie' }] } }
      : req.url === '/status/sessions' ? { MediaContainer:{ Metadata:[{ title:'Arrival', year:2016, duration:1000, viewOffset:500, User:[{title:'Craig'}], Player:[{title:'TV'}], Media:[{videoResolution:'4k',videoDecision:'directplay',Part:[{size:100}]}] }] } }
      : req.url.startsWith('/library/metadata/99') ? { MediaContainer:{ Metadata:[{ ratingKey:'99', title:'Large Film', librarySectionID:'1', Media:[{ videoResolution:'4k', videoCodec:'h264', bitrate:30000, Part:[{size:10 * 1024 ** 3,file:sourcePath}] }] }] } }
      : req.url.startsWith('/library/sections/1/all') ? { MediaContainer:{ totalSize:1, Metadata:[{ ratingKey:'99', title:'Large Film', year:2020, Media:[{ videoResolution:'4k', videoCodec:'h264', bitrate:30000, Part:[{size:10 * 1024 ** 3,file:sourcePath}] }] }] } } : { MediaContainer:{} };
    res.writeHead(200, { 'Content-Type':'application/json' }); res.end(JSON.stringify(payload));
  });
  const mockPort = await listen(mock);
  const appPortProbe = createServer(); const appPort = await listen(appPortProbe); await close(appPortProbe);
  const app = spawn(process.execPath, ['server.ts'], { cwd:process.cwd(), env:{ ...process.env, PORT:String(appPort), CONFIG_DIR:configDir }, stdio:'ignore' });
  t.after(async () => { app.kill(); await close(mock); await rm(configDir, { recursive:true, force:true }); });
  await new Promise(resolve => setTimeout(resolve, 180));

  const credentials = { plexUrl:`http://127.0.0.1:${mockPort}`, token:'secret-token' };
  const saved = await fetch(`http://127.0.0.1:${appPort}/api/config`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(credentials) });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).server.name, 'Test Plex');

  const publicConfig = await (await fetch(`http://127.0.0.1:${appPort}/api/config`)).json();
  assert.equal(publicConfig.configured, true);
  assert.equal('token' in publicConfig, false);

  const overview = await (await fetch(`http://127.0.0.1:${appPort}/api/overview`)).json();
  assert.equal(overview.titleCount, 1);
  assert.equal(overview.sessions.length, 1);
  assert.equal(overview.sessions[0].title, 'Arrival');

  const plexLink = await fetch(`http://127.0.0.1:${appPort}/api/plex/open/99`, { redirect:"manual" });
  assert.equal(plexLink.status, 302);
  assert.equal(plexLink.headers.get("location"), "https://app.plex.tv/desktop/#!/server/abc/details?key=%2Flibrary%2Fmetadata%2F99");

  const analysis = await (await fetch(`http://127.0.0.1:${appPort}/api/analysis/storage`)).json();
  assert.equal(analysis.readOnly, true);
  assert.equal(analysis.scanned, 1);
  assert.equal(analysis.candidateCount, 1);
  assert.equal(analysis.candidates[0].title, 'Large Film');
  assert.equal(analysis.estimatedSaving, Math.round(10 * 1024 ** 3 * .35));

  const encoderConfig = await fetch(`http://127.0.0.1:${appPort}/api/optimization/config`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({plexPathRoot:configDir,mediaPathRoot:configDir,crf:20,preset:'fast'}) });
  assert.equal(encoderConfig.status, 200);
  const queued = await (await fetch(`http://127.0.0.1:${appPort}/api/optimization/jobs`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ratingKey:'99'}) })).json();
  let job = queued.job;
  for (let attempts = 0; attempts < 100 && !['ready','failed'].includes(job.state); attempts++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const list = await (await fetch(`http://127.0.0.1:${appPort}/api/optimization/jobs`)).json();
    job = list.jobs.find(item => item.id === job.id);
  }
  assert.equal(job.state, 'ready', job.error);
  assert.equal(job.verified, true);
  assert.ok(job.saving > 0);
  const replaced = await fetch(`http://127.0.0.1:${appPort}/api/optimization/jobs/${job.id}/replace`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({confirmed:true}) });
  assert.equal(replaced.status, 200);
  await assert.rejects(access(sourcePath));
  await access(join(configDir, 'Large Film.hevc.mkv'));
});
