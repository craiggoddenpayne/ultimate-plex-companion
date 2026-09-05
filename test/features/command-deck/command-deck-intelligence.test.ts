import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeckIntelligence } from '../../../src/server/features/command-deck/command-deck-intelligence-server.ts';

test('Command Deck derives weighted taste and weekly comparison',()=>{
  const now=2_000_000_000;
  const entry=(days,title,genres,type='movie',year=2010)=>({record:{viewedAt:now-days*86400,type,title},media:{title,type,year,duration:7_200_000,Genre:genres.map(tag=>({tag}))}});
  const matches=[entry(1,'Arrival',['Science Fiction','Drama'], 'movie',2016),entry(2,'Dune',['Science Fiction','Adventure'],'movie',2021),entry(9,'Old Week',['Comedy'])];
  const result=buildDeckIntelligence(matches,3,now);
  assert.equal(result.watch.plays,2);
  assert.equal(result.watch.previousMinutes,120);
  assert.equal(result.taste.genres[0].genre,'Science Fiction');
  assert.equal(result.taste.archetype,'Future Seeker');
  assert.equal(result.taste.formats.movies,3);
  assert.equal(result.taste.favouriteEra,'2010s');
});
