import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeAI,evaluate,nativePosition,raceFeatures,chooseTurn,rankTurns,scorePlayedBoard,activation} from '../src/ai.js';
import {contactFeatures} from '../src/ai-features.js';
import {initialBoard,legalTurns} from '../src/rules.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
initializeAI(Object.fromEntries(['jf300.dat','jf301.dat','jf302.dat','jf303.dat','jf304.dat','bearoff.dat','longbear.dat'].map(n=>[n,read('data/'+n)])));
for(const [input,output] of [['ai-corpus-input.json','native-ai-corpus.json'],['ai-corpus-extra-input.json','native-ai-extra-corpus.json']]) {
  test(`native JellyFish evaluator parity: ${input}`,()=>{
    const inputs=JSON.parse(read('tests/fixtures/'+input));
    const outputs=JSON.parse(read('tests/fixtures/'+output)).normalized_result.messages[0].payload.result;
    assert.equal(inputs.length,outputs.length);
    inputs.forEach((v,i)=>{
      assert.deepEqual(Array.from(nativePosition(v.board,v.player)),v.position);
      assert.deepEqual(Array.from(contactFeatures(v.position)),outputs[i].contact,`contact features at ${i}`);
      if(outputs[i].raceInputs)assert.deepEqual(Array.from(raceFeatures(v.position)),outputs[i].raceInputs,`race features at ${i}`);
      const evaluation=evaluate(v.board,v.player);
      evaluation.probabilities.forEach((p,j)=>assert.ok(Math.abs(p-outputs[i].output[j])<1e-10,`position ${i} output ${j}: ${p} vs ${outputs[i].output[j]}`));
    });
  });
}
test('network activation preserves native integer clamps',()=>{
  assert.equal(activation(-1e7),0);assert.equal(activation(1e7),1000);assert.equal(activation(0),500);
});
test('opening 6-1 makes the bar point using original network',()=>{
  const turn=chooseTurn(initialBoard(),1,[6,1]);
  assert.equal(turn.board.points[6],2);
  assert.equal(turn.board.points[12],4);
  assert.equal(turn.board.points[7],2);
});
test('ranked moves are legal distinct boards in descending equity order',()=>{
  const board=initialBoard(),r=rankTurns(board,1,[3,1],{limit:30});
  const key=b=>JSON.stringify(b),legal=new Set(legalTurns(board,1,[3,1]).map(t=>key(t.board)));
  assert.equal(new Set(r.map(t=>key(t.board))).size,r.length);
  r.forEach((t,i)=>{assert.ok(legal.has(key(t.board)));if(i)assert.ok(r[i-1].score>=t.score);});
});

test('played-board scoring matches ranked moves at their actual evaluation depth',()=>{
  const board=initialBoard();
  for(const level of [4,6]){
    const context={level,target:7,scores:[2,3],cube:2};
    const ranked=rankTurns(board,1,[6,4],{...context,limit:999});
    const best=ranked[0];
    const evaluated=scorePlayedBoard(best.board,1,{...context,level:best.evaluationLevel});
    assert.ok(Math.abs(evaluated.score-best.score)<1e-12);
    const omitted=legalTurns(board,1,[6,4]).find(t=>!ranked.some(r=>JSON.stringify(r.board)===JSON.stringify(t.board)));
    assert.ok(omitted,'fixture must contain an excluded move');
    const result=scorePlayedBoard(omitted.board,1,{...context,level:best.evaluationLevel});
    assert.ok(Number.isFinite(result.score));
  }
});
