import test from 'node:test';
import assert from 'node:assert/strict';
import {moveQuality} from '../src/move-quality.js';
test('loss classification uses the stated thresholds, including floating point boundaries',()=>{
  for(const [loss,quality] of [[0,'ok'],[.019,'ok'],[.020,'ok'],[.021,'error'],[.080,'error'],[.081,'blunder']]){
    const value=moveQuality(.6,.6-loss);
    assert.equal(value.quality,quality);assert.ok(Math.abs(value.loss-loss)<1e-12);
  }
  assert.equal(moveQuality(.5,.5).label,'OK');
  assert.equal(moveQuality(.5,.6).loss,0);
  assert.equal(moveQuality(NaN,.2),null);
});
