import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeAI,chooseTurn,nativePosition,evaluate,evaluateLookahead} from '../src/ai.js';
const text=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8'),read=n=>JSON.parse(text('tests/fixtures/'+n));
initializeAI(Object.fromEntries(['jf300.dat','jf301.dat','jf302.dat','jf303.dat','jf304.dat','bearoff.dat','longbear.dat'].map(n=>[n,text('data/'+n)])));
test('level 5 selects original best equity for 546 position/roll pairs',()=>{
 const inputs=read('ai-corpus-input.json');let ties=0;
 for(const r of read('native-level5-corpus.json').normalized_result.messages[0].payload.result){const b=inputs[r.index],actual=chooseTurn(b.board,b.player,r.dice),p=r.position;
  const nativeBoard={points:p.slice(1,25),bar:[p[25],-p[0]],off:[15-p[47],15-p[48]]};
  const expected=-evaluate(nativeBoard,-1).equity;
  assert.ok(Math.abs(actual.score-expected)<1e-10,`position ${r.index} dice ${r.dice}: ${actual.score} != ${expected}`);
  if(Array.from(nativePosition(actual.board,b.player).slice(0,26)).join(',')!==p.slice(0,26).join(','))ties++;
 }
 assert.equal(ties,0,'native descending-point tie ordering');
});
test('native level 6 and 7 lookahead and variance parity',()=>{
 const input=read('native-lookahead-input.json');
 for(const r of read('native-lookahead-corpus.json').normalized_result.messages[0].payload.result){const b=input[r.index],actual=evaluateLookahead(b.board,b.player,{level:r.level});r.output.forEach((v,i)=>assert.ok(Math.abs(v-actual.probabilities[i])<1e-10));assert.ok(Math.abs(r.variance-actual.variance)<1e-10);}
});
test('original levels 3, 4, 6 and 7 selected boards match all 312 controlled calls',()=>{
 const input=read('ai-corpus-input.json');
 for(const r of read('native-levels-corpus.json').normalized_result.messages[0].payload.result){const b=input[r.index],actual=chooseTurn(b.board,b.player,r.dice,{level:r.level});assert.deepEqual(Array.from(nativePosition(actual.board,b.player).slice(0,26)),r.position,`position ${r.index}, dice ${r.dice}, level ${r.level}`);}
});
test('match-weighted pruning and search match all 160 original selected boards',()=>{
 const input=read('native-match-search-input.json');
 for(const r of read('native-match-search-corpus.json').normalized_result.messages[0].payload.result){const b=input[r.index],actual=chooseTurn(b.board,b.player,r.dice,{level:r.level,target:7,scores:[7-r.a,7-r.b],cube:r.c});assert.deepEqual(Array.from(nativePosition(actual.board,b.player).slice(0,26)),r.position,`position ${r.index}, dice ${r.dice}, level ${r.level}, ${r.a}/${r.b}-away`);}
});
