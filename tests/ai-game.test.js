import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeAI,chooseTurn} from '../src/ai.js';
import * as rules from '../src/rules.js';
const files=['jf300.dat','longbear.dat','jf301.dat','jf302.dat','jf303.dat','jf304.dat','bearoff.dat'];
initializeAI(Object.fromEntries(await Promise.all(files.map(async name=>[name,await readFile(new URL('../data/'+name,import.meta.url),'utf8')]))));
test('recovered AI completes seeded games with legal turns and valid scoring',()=>{
 let seed=32980;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let game=0;game<4;game++){
  let board=rules.initialBoard(),player=game%2?1:-1,turn=0;
  while(!rules.winner(board)&&turn++<1000){
   const dice=rules.rollDice(random),choice=chooseTurn(board,player,dice,{level:5});
   assert.ok(Number.isFinite(choice.score));
   assert.ok(rules.legalTurns(board,player,dice).some(t=>JSON.stringify(t.moves)===JSON.stringify(choice.moves)));
   board=choice.board;rules.validateBoard(board);player=-player;
  }
  assert.ok(rules.winner(board),'AI game must terminate');
  const match=rules.finishGame(rules.createMatch(1),board);
  assert.equal(match.matchWinner,rules.winner(board));
 }
});
