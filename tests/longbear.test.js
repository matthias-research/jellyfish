import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeLongbear,longbearValue} from '../src/ai-search.js';
test('longbear indexing matches native lookup for five positions',()=>{
 initializeLongbear(readFileSync(new URL('../data/longbear.dat',import.meta.url),'utf8'));
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/native-longbear-corpus.json',import.meta.url),'utf8'));
 for(const r of fixture.normalized_result.messages[0].payload.result)assert.equal(longbearValue(r.position),r.value);
});
