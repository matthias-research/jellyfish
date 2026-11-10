import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeMoneyCube,nativeMatchCube} from '../src/ai-cube.js';
const read=p=>JSON.parse(readFileSync(new URL('./fixtures/'+p,import.meta.url),'utf8'));
test('native money and match cube decisions match 312 original controlled calls',()=>{
 const input=read('ai-corpus-input.json'),output=read('native-cube-corpus.json').normalized_result.messages[0].payload.result;
 for(const entry of output){const p=Array.from(input[entry.index].position);p[49]=entry.a;p[50]=entry.b;p[68]=entry.c;const r=(entry.a?nativeMatchCube:nativeMoneyCube)(p,entry.output,entry.volatility);assert.equal(+r.offer,entry.offer,JSON.stringify(entry));assert.equal(r.take,entry.take,JSON.stringify(entry));}
});
