import test from 'node:test';
import assert from 'node:assert/strict';
import {checkerDestinations} from '../src/move-options.js';
import * as R from '../src/rules.js';

function board(entries,bar=[0,0]) {
  const points=Array(24).fill(0);
  for(const [i,n] of entries)points[i]=n;
  return {points,bar,off:[15-bar[0]-points.reduce((s,n)=>s+Math.max(n,0),0),15-bar[1]-points.reduce((s,n)=>s+Math.max(-n,0),0)]};
}
const options=(b,dice,from,p=1)=>checkerDestinations(R.legalTurns(b,p,dice),0,from);
test('one checker can use either die or both, for either player',()=>{
  const a=options(board([[12,1],[23,-15]]),[3,5],12);
  assert.deepEqual([...a.keys()].sort((a,b)=>a-b),[4,7,9]);
  assert.deepEqual(a.get(4).map(m=>m.die),[3,5]);
  const b=options(board([[11,-1],[0,15]]),[3,5],11,-1);
  assert.deepEqual([...b.keys()].sort((a,b)=>a-b),[14,16,19]);
});
test('combined route avoids blocked intermediates and preserves hits',()=>{
  const b=board([[12,1],[9,-2],[7,-1],[23,-12]]);
  const path=options(b,[3,5],12).get(4);
  assert.deepEqual(path.map(m=>m.die),[5,3]);
  assert.equal(path[0].hit,true);
  const after=path.reduce((b,m)=>R.applyMove(b,1,m),b);
  assert.equal(after.bar[1],1);
  assert.equal(after.points[4],1);
  assert.equal(options(board([[12,1],[9,-2],[7,-2],[23,-11]]),[3,5],12).size,0);
});
test('doubles offer one through four steps and remaining steps after a prefix',()=>{
  const turns=R.legalTurns(board([[12,1],[23,-15]]),1,[2,2]);
  const a=checkerDestinations(turns,0,12);
  assert.deepEqual([...a.keys()],[10,8,6,4]);
  assert.equal(a.get(4).length,4);
  assert.deepEqual([...checkerDestinations(turns,1,10).keys()],[8,6,4]);
});
test('bar priority prevents moving an entered checker while another remains on bar',()=>{
  const b=board([[0,-15]],[2,0]);
  assert.equal(options(b,[2,3],R.BAR).has(19),false);
  assert.equal(options(board([[0,-15]],[1,0]),[2,3],R.BAR).get(19).length,2);
});
test('forced higher die and bearoff do not bypass full-turn legality',()=>{
  const a=options(board([[0,1],[18,-15]]),[1,6],0);
  assert.equal(a.size,1);assert.equal(a.get(R.OFF)[0].die,6);
  const b=options(board([[1,1],[18,-15]]),[1,2],1);
  assert.equal(b.get(R.OFF).length,2);
  assert.deepEqual(b.get(R.OFF).map(m=>m.die),[1,2]);
});
