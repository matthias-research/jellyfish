import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordedStatistics} from '../src/statistics.js';
test('statistics count only actual recorded rolls and completed moves',()=>{
  const [white,black]=recordedStatistics(['New 7 point match.','You rolls 6–6.','You: 24/18 18/12* 12/6 6/off.','JellyFish rolls 1–2.','JellyFish: cannot move.','Opening roll tied at 4. Roll again.']);
  assert.deepEqual(white,{rolls:1,doubles:1,diceTotal:12,turns:1,moves:4,hits:1,passes:0,averageDie:6});
  assert.deepEqual(black,{rolls:1,doubles:0,diceTotal:3,turns:1,moves:0,hits:0,passes:1,averageDie:1.5});
});
test('empty history has unknown average rather than a fabricated value',()=>{assert.equal(recordedStatistics([])[0].averageDie,null);});
