import test from 'node:test';
import assert from 'node:assert/strict';
import {checkerPosition,interpolateChecker,motionSettings,MOTION_DEFAULTS} from '../src/animation.js';
test('motion preferences preserve explicit off and default invalid local values',()=>{
  assert.deepEqual(motionSettings(),MOTION_DEFAULTS);
  assert.deepEqual(motionSettings({dicePauseMs:0,animationMs:0}),{dicePauseMs:0,animationMs:0});
  assert.deepEqual(motionSettings({dicePauseMs:Infinity,animationMs:-1}),MOTION_DEFAULTS);
});
test('checker geometry follows board orientation, capped stacks, bar and off trays',()=>{
  assert.deepEqual(checkerPosition(23,1,1),{x:885,y:60,scaleY:1});
  assert.deepEqual(checkerPosition(23,1,1,true),{x:885,y:620,scaleY:1});
  assert.deepEqual(checkerPosition(5,1,15),checkerPosition(5,1,5));
  assert.deepEqual(checkerPosition(-1,-1,4),{x:472,y:256,scaleY:1});
  assert.deepEqual(checkerPosition(24,1,15),{x:962,y:458,scaleY:.2});
  assert.deepEqual(checkerPosition(24,-1,1),{x:962,y:41,scaleY:.2});
});
test('checker interpolation travels continuously between endpoints',()=>{
  const a=checkerPosition(23,1,1),b=checkerPosition(5,1,4);
  assert.deepEqual(interpolateChecker(a,b,0),a);assert.deepEqual(interpolateChecker(a,b,1),b);
  assert.deepEqual(interpolateChecker(a,b,.5),{x:(a.x+b.x)/2,y:(a.y+b.y)/2,scaleY:1});
});
