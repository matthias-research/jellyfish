import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeAI} from '../src/ai.js';
import {rollout} from '../src/rollout.js';
const files=['jf300.dat','longbear.dat','jf301.dat','jf302.dat','jf303.dat','jf304.dat','bearoff.dat'];
initializeAI(Object.fromEntries(await Promise.all(files.map(async n=>[n,await readFile(new URL('../data/'+n,import.meta.url),'utf8')]))));
test('rollout finishes guaranteed one-checker bearoff without modifying input',()=>{
 const b={points:Array(24).fill(0),bar:[0,0],off:[14,14]};b.points[0]=1;b.points[23]=-1;
 const before=JSON.stringify(b),a=rollout(b,1,{games:8,seed:42});
 assert.equal(a.wins,8);assert.equal(a.losses,0);assert.equal(a.equity,1);assert.equal(a.standardError,0);assert.equal(JSON.stringify(b),before);
 assert.deepEqual(a,rollout(b,1,{games:8,seed:42}));
});
test('rollout reports censored games instead of counting them as losses',()=>{
 const b={points:Array(24).fill(0),bar:[0,0],off:[14,14]};b.points[23]=1;b.points[0]=-1;
 const a=rollout(b,1,{games:4,seed:1,maxTurns:1});assert.equal(a.unfinished,4);assert.equal(a.winRate,null);assert.equal(a.equity,null);
});
