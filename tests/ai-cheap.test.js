import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cheapFeatures,parseCheapNetwork,cheapProbabilities,cheapEquity} from '../src/ai-cheap.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const model=parseCheapNetwork(read('../data/jf300.dat'));
const positions=JSON.parse(read('./fixtures/ai-corpus-input.json'));
const native=JSON.parse(read('./fixtures/native-cheap-corpus.json')).normalized_result.messages[0].payload.result;
test('all 294 small-network inputs and six outputs match 26 native captures',()=>{
  for(let i=0;i<native.length;i++){
    assert.deepEqual(Array.from(cheapFeatures(positions[i].position)),native[i].features,`features ${i}`);
    assert.deepEqual(Array.from(cheapProbabilities(model,positions[i].position)),native[i].output,`output ${i}`);
  }
});
test('levels 1 and 2 reproduce native CRT remainder noise and accept injected randomness',()=>{
  const p=positions[0].position,base=cheapProbabilities(model,p);
  for(const level of [1,2]){
    let i=0;const values=[0,1000,1999,32767];
    const result=cheapProbabilities(model,p,{level,randInt:()=>values[i++]});
    assert.equal(i,4);assert.equal(result[0],base[0]);assert.equal(result[5],base[5]);
    for(let j=1;j<=4;j++)assert.equal(result[j],base[j]+(3-level)*(values[j-1]%2000-1000)*.00005);
  }
  assert.equal(cheapEquity(model,p),-base[0]-base[1]-base[2]+base[3]+base[4]+base[5]);
});
test('native small loader consumes only first 2400 values of the shipped file',()=>{
  const text=read('../data/jf300.dat');
  assert.deepEqual(parseCheapNetwork(text.trim().split(/\s+/).slice(0,2400).join(' ')),model);
  assert.throws(()=>parseCheapNetwork('0 1 2'));
});
