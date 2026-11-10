import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {legalTurns} from '../src/rules.js';
import {nativePosition} from '../src/ai.js';
const read=n=>JSON.parse(readFileSync(new URL('./fixtures/'+n,import.meta.url),'utf8'));
test('legal resulting boards match original move generator across 546 position/roll pairs',()=>{
 const input=read('ai-corpus-input.json');
 for(const r of read('native-moves-corpus.json').normalized_result.messages[0].payload.result){const b=input[r.index];const actual=new Set(legalTurns(b.board,b.player,r.dice).map(t=>Array.from(nativePosition(t.board,b.player).slice(0,26)).join(',')));assert.deepEqual(actual,new Set(r.positions),`position ${r.index} dice ${r.dice}`);}
 for(const r of read('native-move-counts.json').normalized_result.messages[0].payload.result){const b=input[r.index],actual=new Set(legalTurns(b.board,b.player,r.dice).map(t=>JSON.stringify(t.board)));assert.equal(actual.size,r.count,'native work-budget candidate count');}
});
