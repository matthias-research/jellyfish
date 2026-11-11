import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as R from '../src/rules.js';
import {checkerPosition} from '../src/animation.js';

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const undoSource=app.slice(app.indexOf('async function undo(){'),app.indexOf('function finish(){'));
function position(entries,bar=[0,0]){
  const points=Array(24).fill(0);for(const [i,n] of entries)points[i]=n;
  return {points,bar,off:[15-bar[0]-points.reduce((s,n)=>s+Math.max(n,0),0),15-bar[1]-points.reduce((s,n)=>s+Math.max(-n,0),0)]};
}
for(const [label,start,dice] of [
  ['ordinary turn',R.initialBoard(),[3,1]],
  ['doubles',R.initialBoard(),[2,2]],
  ['bar entry',position([[5,14],[18,-15]],[1,0]),[1,3]],
  ['hit',position([[10,2],[8,-1],[18,-14]]),[2,1]],
  ['bearing off',position([[2,2],[18,-15]]),[3,3]],
])test(`Undo restores ${label} with and without animation`,async()=>{
  const turns=R.legalTurns(start,1,dice);
  const turn=turns.find(t=>t.moves.some(m=>m.hit))??turns[0];
  for(const duration of [0,350]){
    let animations=0;
    const context={R,checkerPosition,turnStart:start,board:R.cloneBoard(turn.board),prefix:[...turn.moves],dice:[...dice],player:1,epoch:1,busy:false,settings:{flip:true,animationMs:duration},isComputer:()=>false,clearHintArrows(){},render(){},updateSprite(){},message:s=>assert.fail(s),
      async animateChecker(from,to,ms,update,current){assert.equal(ms,duration);assert.ok(current());animations++;update(to);return true;}};
    runInNewContext(undoSource,context);await context.undo();
    assert.deepEqual(context.board,start);
    assert.equal(context.prefix.length,0);
    assert.deepEqual(context.dice,dice);
    assert.equal(context.busy,false);assert.equal(context.animationState,null);
    assert.equal(animations,duration?turn.moves.length+turn.moves.filter(m=>m.hit).length:0);
  }
});
test('a reset during Undo cannot overwrite the new game',async()=>{
  const start=R.initialBoard(),turn=R.legalTurns(start,1,[3,1])[0],replacement=R.initialBoard();
  const context={R,checkerPosition,turnStart:start,board:turn.board,prefix:[...turn.moves],player:1,epoch:1,busy:false,settings:{animationMs:350},isComputer:()=>false,clearHintArrows(){},render(){},updateSprite(){},message:s=>assert.fail(s),
    async animateChecker(){context.epoch++;context.board=replacement;context.prefix=[];context.busy=false;context.animationState=null;return false;}};
  runInNewContext(undoSource,context);await context.undo();
  assert.equal(context.board,replacement);assert.equal(context.busy,false);assert.equal(context.prefix.length,0);
});
