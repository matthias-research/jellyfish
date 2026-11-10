import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../src/rules.js';
function board(entries,bar=[0,0]) {const points=Array(24).fill(0);for(const [i,n] of entries)points[i]=n;return {points,bar,off:[15-bar[0]-points.reduce((s,n)=>s+Math.max(n,0),0),15-bar[1]-points.reduce((s,n)=>s+Math.max(-n,0),0)]};}
test('starting board, conservation, immutable turns',()=>{const b=r.initialBoard(),snapshot=JSON.stringify(b);assert.equal(r.pipCount(b,1),167);assert.equal(r.pipCount(b,-1),167);for(const p of [1,-1])for(let a=1;a<=6;a++)for(let c=1;c<=6;c++)for(const t of r.legalTurns(b,p,[a,c])){assert.ok(r.validateBoard(t.board));assert.equal(t.moves.length,a===c?4:2);}assert.equal(JSON.stringify(b),snapshot);});
test('bar takes priority and blocked entry passes',()=>{const b=board([[5,14],[23,-2],[22,-2],[10,-11]],[1,0]);assert.equal(r.legalTurns(b,1,[1,2])[0].moves.length,0);const turns=r.legalTurns(b,1,[1,3]);for(const t of turns){assert.equal(t.moves[0].from,r.BAR);assert.equal(t.moves[0].to,21);}});
test('hitting sends a blot to the bar',()=>{const b=board([[10,1],[8,-1],[18,-14]]);const after=r.applyMove(b,1,{from:10,to:8,die:2});assert.equal(after.points[8],1);assert.equal(after.bar[1],1);assert.equal(b.points[8],-1);});
test('bearing off requires home and oversize die uses farthest checker',()=>{const b=board([[5,1],[2,1],[18,-15]]);assert.throws(()=>r.applyMove(b,1,{from:2,to:r.OFF,die:6}));assert.equal(r.applyMove(b,1,{from:5,to:r.OFF,die:6}).off[0],14);const outside=board([[6,1],[2,1],[18,-15]]);assert.throws(()=>r.applyMove(outside,1,{from:2,to:r.OFF,die:3}));});
test('higher die compulsory when only one die can be played',()=>{const b=board([[0,1],[18,-15]]);const turns=r.legalTurns(b,1,[1,6]);assert.equal(turns.length,1);assert.equal(turns[0].moves[0].die,6);});
test('must use two dice where a tempting oversize bearoff uses one',()=>{const b=board([[1,1],[18,-15]]);for(const t of r.legalTurns(b,1,[1,2])){assert.equal(t.moves.length,2);assert.equal(t.moves[0].die,1);}});
test('black rules mirror white',()=>{const b=r.initialBoard();for(const dice of [[1,2],[6,6],[3,5]]){const a=r.legalTurns(b,1,dice).map(t=>t.moves.map(m=>`${23-m.from}:${m.to===r.OFF?r.OFF:23-m.to}:${m.die}`).join(',')).sort();const c=r.legalTurns(b,-1,dice).map(t=>t.moves.map(m=>`${m.from}:${m.to}:${m.die}`).join(',')).sort();assert.deepEqual(a,c);}});
test('single gammon backgammon distinctions',()=>{let b=board([[18,-14]]);assert.equal(r.winner(b),1);assert.equal(r.winMultiplier(b),1);b=board([[18,-15]]);assert.equal(r.winMultiplier(b),2);b=board([[2,-1],[18,-14]]);assert.equal(r.winMultiplier(b),3);b=board([[18,-14]],[0,1]);assert.equal(r.winMultiplier(b),3);});
test('cube ownership, redoubling and dropping old cube value',()=>{let m=r.createMatch();m=r.respondDouble(r.offerDouble(m,1),true);assert.equal(m.cube,2);assert.equal(m.cubeOwner,-1);assert.throws(()=>r.offerDouble(m,1));m=r.respondDouble(r.offerDouble(m,-1),false);assert.equal(m.result.points,2);assert.equal(m.result.winner,-1);assert.deepEqual(m.scores,[0,2]);});
test('Crawford lasts exactly one game',()=>{let m=r.createMatch(3);m=r.finishGame(m,board([[18,-15]]));assert.deepEqual(m.scores,[2,0]);m=r.startGame(m);assert.equal(m.crawford,true);assert.throws(()=>r.offerDouble(m,1));m=r.finishGame(m,board([[5,14]]));m=r.startGame(m);assert.equal(m.crawford,false);assert.equal(m.crawfordUsed,true);assert.ok(r.canDouble(m,1));});
test('match ends at target; money play continues',()=>{let m=r.finishGame(r.createMatch(1),board([[18,-14]]));assert.equal(m.matchWinner,1);assert.throws(()=>r.startGame(m));m=r.finishGame(r.createMatch(0),board([[18,-15]]));assert.equal(m.matchWinner,null);assert.equal(r.startGame(m).game,2);});
test('seeded games terminate and conserve checkers',()=>{let seed=9821;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);for(let game=0;game<12;game++){let b=r.initialBoard(),p=1,turn=0;while(!r.winner(b)&&turn++<2000){const turns=r.legalTurns(b,p,r.rollDice(random));b=turns[Math.floor(random()*turns.length)].board;r.validateBoard(b);p=-p;}assert.ok(r.winner(b));}});
test('seeded complete matches preserve score and cube/Crawford invariants',()=>{
  let seed=20261110;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(const target of [1,3,5,7,11]) {
    let m=r.createMatch(target),totalAwarded=0,games=0;
    while(!m.matchWinner && games++<100) {
      let b=r.initialBoard(),opening;
      do {opening=r.openingRoll(random);}while(opening.player===null);
      let p=opening.player,dice=opening.dice,turn=0;
      while(!m.result&&turn++<2000) {
        if(turn>1&&r.canDouble(m,p)&&m.cube<8&&random()<0.03) {
          m=r.respondDouble(r.offerDouble(m,p),random()>0.1);
          if(m.result) break;
        }
        const turns=r.legalTurns(b,p,dice);
        b=turns[Math.floor(random()*turns.length)].board;
        r.validateBoard(b);
        if(r.winner(b)) m=r.finishGame(m,b);
        else {p=-p;dice=r.rollDice(random);}
      }
      assert.ok(m.result);totalAwarded+=m.result.points;
      assert.equal(m.scores[0]+m.scores[1],totalAwarded);
      if(!m.matchWinner) {m=r.startGame(m);assert.equal(m.cube,1);assert.equal(m.cubeOwner,null);if(m.crawford)assert.equal(r.canDouble(m,1),false);}
    }
    assert.ok(m.matchWinner);assert.ok(m.scores[r.playerIndex(m.matchWinner)]>=target);
  }
});
